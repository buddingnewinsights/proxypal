package cliproxy

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/api"
	baseauth "github.com/router-for-me/CLIProxyAPI/v6/internal/auth"
	geminiwebclient "github.com/router-for-me/CLIProxyAPI/v6/internal/client/gemini-web"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/registry"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/runtime/executor"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/util"
	sdkAuth "github.com/router-for-me/CLIProxyAPI/v6/sdk/auth"
	coreauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
	log "github.com/sirupsen/logrus"
)

// Service wraps the proxy server lifecycle so external programs can embed the CLI proxy.
type Service struct {
	cfg        *config.Config
	cfgMu      sync.RWMutex
	configPath string

	tokenProvider  TokenClientProvider
	apiKeyProvider APIKeyClientProvider
	watcherFactory WatcherFactory
	hooks          Hooks
	serverOptions  []api.ServerOption

	server    *api.Server
	serverErr chan error

	watcher       *WatcherWrapper
	watcherCancel context.CancelFunc

	// legacy client caches removed
	authManager *sdkAuth.Manager
	coreManager *coreauth.Manager

	shutdownOnce sync.Once
}

func newDefaultAuthManager() *sdkAuth.Manager {
	return sdkAuth.NewManager(
		sdkAuth.NewFileTokenStore(),
		sdkAuth.NewGeminiAuthenticator(),
		sdkAuth.NewCodexAuthenticator(),
		sdkAuth.NewClaudeAuthenticator(),
		sdkAuth.NewQwenAuthenticator(),
	)
}

// Run starts the service and blocks until the context is cancelled or the server stops.
func (s *Service) Run(ctx context.Context) error {
	if s == nil {
		return fmt.Errorf("cliproxy: service is nil")
	}
	if ctx == nil {
		ctx = context.Background()
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()
	defer func() {
		if err := s.Shutdown(shutdownCtx); err != nil {
			log.Errorf("service shutdown returned error: %v", err)
		}
	}()

	if err := s.ensureAuthDir(); err != nil {
		return err
	}

	if s.coreManager != nil {
		if errLoad := s.coreManager.Load(ctx); errLoad != nil {
			log.Warnf("failed to load auth store: %v", errLoad)
		}
	}

	tokenResult, err := s.tokenProvider.Load(ctx, s.cfg)
	if err != nil && !errors.Is(err, context.Canceled) {
		return err
	}
	if tokenResult == nil {
		tokenResult = &TokenClientResult{}
	}

	apiKeyResult, err := s.apiKeyProvider.Load(ctx, s.cfg)
	if err != nil && !errors.Is(err, context.Canceled) {
		return err
	}
	if apiKeyResult == nil {
		apiKeyResult = &APIKeyClientResult{}
	}

	// legacy clients removed; no caches to refresh

	// handlers no longer depend on legacy clients; pass nil slice initially
	s.server = api.NewServer(s.cfg, s.coreManager, s.configPath, s.serverOptions...)

	if s.authManager == nil {
		s.authManager = newDefaultAuthManager()
	}

	if s.hooks.OnBeforeStart != nil {
		s.hooks.OnBeforeStart(s.cfg)
	}

	s.serverErr = make(chan error, 1)
	go func() {
		if errStart := s.server.Start(); errStart != nil {
			s.serverErr <- errStart
		} else {
			s.serverErr <- nil
		}
	}()

	time.Sleep(100 * time.Millisecond)
	log.Info("API server started successfully")

	if s.hooks.OnAfterStart != nil {
		s.hooks.OnAfterStart(s)
	}

	var watcherWrapper *WatcherWrapper
	reloadCallback := func(newCfg *config.Config) {
		if newCfg == nil {
			s.cfgMu.RLock()
			newCfg = s.cfg
			s.cfgMu.RUnlock()
		}

		// Pull the latest auth snapshot and sync
		auths := watcherWrapper.SnapshotAuths()
		s.syncCoreAuthFromAuths(ctx, auths)
		if s.server != nil {
			s.server.UpdateClients(newCfg)
		}

		s.cfgMu.Lock()
		s.cfg = newCfg
		s.cfgMu.Unlock()

	}

	watcherWrapper, err = s.watcherFactory(s.configPath, s.cfg.AuthDir, reloadCallback)
	if err != nil {
		return fmt.Errorf("cliproxy: failed to create watcher: %w", err)
	}
	s.watcher = watcherWrapper
	watcherWrapper.SetConfig(s.cfg)

	watcherCtx, watcherCancel := context.WithCancel(context.Background())
	s.watcherCancel = watcherCancel
	if err = watcherWrapper.Start(watcherCtx); err != nil {
		return fmt.Errorf("cliproxy: failed to start watcher: %w", err)
	}
	log.Info("file watcher started for config and auth directory changes")

	// Prefer core auth manager auto refresh if available.
	if s.coreManager != nil {
		interval := 15 * time.Minute
		if sec := s.cfg.GeminiWeb.TokenRefreshSeconds; sec > 0 {
			interval = time.Duration(sec) * time.Second
		}
		s.coreManager.StartAutoRefresh(context.Background(), interval)
		log.Infof("core auth auto-refresh started (interval=%s)", interval)
	}

	authFileCount := util.CountAuthFiles(s.cfg.AuthDir)
	totalNewClients := authFileCount + apiKeyResult.GeminiKeyCount + apiKeyResult.ClaudeKeyCount + apiKeyResult.CodexKeyCount + apiKeyResult.OpenAICompatCount
	log.Infof("full client load complete - %d clients (%d auth files + %d GL API keys + %d Claude API keys + %d Codex keys + %d OpenAI-compat)",
		totalNewClients,
		authFileCount,
		apiKeyResult.GeminiKeyCount,
		apiKeyResult.ClaudeKeyCount,
		apiKeyResult.CodexKeyCount,
		apiKeyResult.OpenAICompatCount,
	)

	select {
	case <-ctx.Done():
		log.Debug("service context cancelled, shutting down...")
		return ctx.Err()
	case err = <-s.serverErr:
		return err
	}
}

// Shutdown gracefully stops background workers and the HTTP server.
func (s *Service) Shutdown(ctx context.Context) error {
	if s == nil {
		return nil
	}
	var shutdownErr error
	s.shutdownOnce.Do(func() {
		if ctx == nil {
			ctx = context.Background()
		}

		// legacy refresh loop removed; only stopping core auth manager below

		if s.watcherCancel != nil {
			s.watcherCancel()
		}
		if s.coreManager != nil {
			s.coreManager.StopAutoRefresh()
		}
		if s.watcher != nil {
			if err := s.watcher.Stop(); err != nil {
				log.Errorf("failed to stop file watcher: %v", err)
				shutdownErr = err
			}
		}

		// no legacy clients to persist

		if s.server != nil {
			shutdownCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			if err := s.server.Stop(shutdownCtx); err != nil {
				log.Errorf("error stopping API server: %v", err)
				if shutdownErr == nil {
					shutdownErr = err
				}
			}
		}
	})
	return shutdownErr
}

func (s *Service) ensureAuthDir() error {
	info, err := os.Stat(s.cfg.AuthDir)
	if err != nil {
		if os.IsNotExist(err) {
			if mkErr := os.MkdirAll(s.cfg.AuthDir, 0o755); mkErr != nil {
				return fmt.Errorf("cliproxy: failed to create auth directory %s: %w", s.cfg.AuthDir, mkErr)
			}
			log.Infof("created missing auth directory: %s", s.cfg.AuthDir)
			return nil
		}
		return fmt.Errorf("cliproxy: error checking auth directory %s: %w", s.cfg.AuthDir, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("cliproxy: auth path exists but is not a directory: %s", s.cfg.AuthDir)
	}
	return nil
}

func (s *Service) syncCoreAuthFromClients(ctx context.Context, _ map[string]any) { _ = ctx }

func (s *Service) startRefreshLoop() {
	// legacy refresh loop disabled; core auth manager handles auto refresh
}

func (s *Service) refreshTokens(ctx context.Context) { _ = ctx /* no-op */ }

func (s *Service) snapshotFileClients() map[string]any { return nil }

// persistClients deprecated: no legacy clients remain
func (s *Service) persistClients() {}

// refreshCachesFromCombined deprecated: no legacy clients remain
func (s *Service) refreshCachesFromCombined(_ map[string]any) {}

// combineClients deprecated

func (s *Service) refreshWithManager(ctx context.Context, provider, filePath string, storage baseauth.TokenStorage, metadata map[string]string) {
	_ = ctx
	_ = provider
	_ = filePath
	_ = storage
	_ = metadata
	// legacy file-backed refresh was replaced by core auth manager auto refresh
}

// syncCoreAuthFromAuths registers or updates core auths and disables missing ones.
func (s *Service) syncCoreAuthFromAuths(ctx context.Context, auths []*coreauth.Auth) {
	if s.coreManager == nil {
		return
	}
	seen := make(map[string]struct{}, len(auths))
	for _, a := range auths {
		if a == nil || a.ID == "" {
			continue
		}
		seen[a.ID] = struct{}{}
		// Ensure executors registered per provider: prefer stateless where available.
		switch strings.ToLower(a.Provider) {
		case "gemini":
			s.coreManager.RegisterExecutor(executor.NewGeminiExecutor(s.cfg))
		case "gemini-cli":
			s.coreManager.RegisterExecutor(executor.NewGeminiCLIExecutor(s.cfg))
		case "gemini-web":
			s.coreManager.RegisterExecutor(executor.NewGeminiWebExecutor(s.cfg))
		case "claude":
			s.coreManager.RegisterExecutor(executor.NewClaudeExecutor(s.cfg))
		case "codex":
			s.coreManager.RegisterExecutor(executor.NewCodexExecutor(s.cfg))
		case "qwen":
			s.coreManager.RegisterExecutor(executor.NewQwenExecutor(s.cfg))
		default:
			s.coreManager.RegisterExecutor(executor.NewOpenAICompatExecutor("openai-compatibility", s.cfg))
		}

		// Preserve existing temporal fields
		if existing, ok := s.coreManager.GetByID(a.ID); ok && existing != nil {
			a.CreatedAt = existing.CreatedAt
			a.LastRefreshedAt = existing.LastRefreshedAt
			a.NextRefreshAfter = existing.NextRefreshAfter
		}
		// Ensure model registry reflects core auth identity
		s.registerModelsForAuth(a)
		if _, ok := s.coreManager.GetByID(a.ID); ok {
			_, _ = s.coreManager.Update(ctx, a)
		} else {
			_, _ = s.coreManager.Register(ctx, a)
		}
	}
	// Disable removed auths
	for _, stored := range s.coreManager.List() {
		if stored == nil {
			continue
		}
		if _, ok := seen[stored.ID]; ok {
			continue
		}
		stored.Disabled = true
		stored.Status = coreauth.StatusDisabled
		// Unregister from model registry when disabled
		GlobalModelRegistry().UnregisterClient(stored.ID)
		_, _ = s.coreManager.Update(ctx, stored)
	}
}

// registerModelsForAuth (re)binds provider models in the global registry using the core auth ID as client identifier.
func (s *Service) registerModelsForAuth(a *coreauth.Auth) {
	if a == nil || a.ID == "" {
		return
	}
	// Unregister legacy client ID (if present) to avoid double counting
	if a.Runtime != nil {
		if idGetter, ok := a.Runtime.(interface{ GetClientID() string }); ok {
			if rid := idGetter.GetClientID(); rid != "" && rid != a.ID {
				GlobalModelRegistry().UnregisterClient(rid)
			}
		}
	}
	provider := strings.ToLower(a.Provider)
	var models []*ModelInfo
	switch provider {
	case "gemini":
		models = registry.GetGeminiModels()
	case "gemini-cli":
		models = registry.GetGeminiCLIModels()
	case "gemini-web":
		models = geminiwebclient.GetGeminiWebAliasedModels()
	case "claude":
		models = registry.GetClaudeModels()
	case "codex":
		models = registry.GetOpenAIModels()
	case "qwen":
		models = registry.GetQwenModels()
	default:
		// Handle OpenAI-compatibility providers by name using config
		if s.cfg != nil {
			// When provider is normalized to "openai-compatibility", read the original name from attributes.
			compatName := a.Provider
			if strings.EqualFold(compatName, "openai-compatibility") {
				if a.Attributes != nil && a.Attributes["compat_name"] != "" {
					compatName = a.Attributes["compat_name"]
				}
			}
			for i := range s.cfg.OpenAICompatibility {
				compat := &s.cfg.OpenAICompatibility[i]
				if strings.EqualFold(compat.Name, compatName) {
					// Convert compatibility models to registry models
					ms := make([]*ModelInfo, 0, len(compat.Models))
					for j := range compat.Models {
						m := compat.Models[j]
						ms = append(ms, &ModelInfo{
							ID:          m.Alias,
							Object:      "model",
							Created:     time.Now().Unix(),
							OwnedBy:     compat.Name,
							Type:        "openai-compatibility",
							DisplayName: m.Name,
						})
					}
					// Register and return
					if len(ms) > 0 {
						GlobalModelRegistry().RegisterClient(a.ID, a.Provider, ms)
					}
					return
				}
			}
		}
	}
	if len(models) > 0 {
		GlobalModelRegistry().RegisterClient(a.ID, a.Provider, models)
	}
}
