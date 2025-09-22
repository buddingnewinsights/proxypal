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
	geminiwebclient "github.com/router-for-me/CLIProxyAPI/v6/internal/client/gemini-web"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/registry"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/runtime/executor"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/util"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/watcher"
	sdkaccess "github.com/router-for-me/CLIProxyAPI/v6/sdk/access"
	_ "github.com/router-for-me/CLIProxyAPI/v6/sdk/access/providers/configapikey"
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
	authUpdates   chan watcher.AuthUpdate
	authQueueStop context.CancelFunc

	// legacy client caches removed
	authManager   *sdkAuth.Manager
	accessManager *sdkaccess.Manager
	coreManager   *coreauth.Manager

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

func (s *Service) refreshAccessProviders(cfg *config.Config) {
	if s == nil || s.accessManager == nil || cfg == nil {
		return
	}
	providers, err := sdkaccess.BuildProviders(cfg)
	if err != nil {
		log.Errorf("failed to rebuild request auth providers: %v", err)
		return
	}
	s.accessManager.SetProviders(providers)
}

func (s *Service) ensureAuthUpdateQueue(ctx context.Context) {
	if s == nil {
		return
	}
	if s.authUpdates == nil {
		s.authUpdates = make(chan watcher.AuthUpdate, 64)
	}
	if s.authQueueStop != nil {
		return
	}
	queueCtx, cancel := context.WithCancel(ctx)
	s.authQueueStop = cancel
	go s.consumeAuthUpdates(queueCtx)
}

func (s *Service) consumeAuthUpdates(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case update, ok := <-s.authUpdates:
			if !ok {
				return
			}
			s.handleAuthUpdate(ctx, update)
		}
	}
}

func (s *Service) handleAuthUpdate(ctx context.Context, update watcher.AuthUpdate) {
	if s == nil {
		return
	}
	s.cfgMu.RLock()
	cfg := s.cfg
	s.cfgMu.RUnlock()
	if cfg == nil || s.coreManager == nil {
		return
	}
	switch update.Action {
	case watcher.AuthUpdateActionAdd, watcher.AuthUpdateActionModify:
		if update.Auth == nil || update.Auth.ID == "" {
			return
		}
		s.applyCoreAuthAddOrUpdate(ctx, update.Auth)
	case watcher.AuthUpdateActionDelete:
		id := update.ID
		if id == "" && update.Auth != nil {
			id = update.Auth.ID
		}
		if id == "" {
			return
		}
		s.applyCoreAuthRemoval(ctx, id)
	default:
		log.Debugf("received unknown auth update action: %v", update.Action)
	}
}

func (s *Service) applyCoreAuthAddOrUpdate(ctx context.Context, auth *coreauth.Auth) {
	if s == nil || auth == nil || auth.ID == "" {
		return
	}
	if s.coreManager == nil {
		return
	}
	auth = auth.Clone()
	s.ensureExecutorsForAuth(auth)
	s.registerModelsForAuth(auth)
	if existing, ok := s.coreManager.GetByID(auth.ID); ok && existing != nil {
		auth.CreatedAt = existing.CreatedAt
		auth.LastRefreshedAt = existing.LastRefreshedAt
		auth.NextRefreshAfter = existing.NextRefreshAfter
		if _, err := s.coreManager.Update(ctx, auth); err != nil {
			log.Errorf("failed to update auth %s: %v", auth.ID, err)
		}
		return
	}
	if _, err := s.coreManager.Register(ctx, auth); err != nil {
		log.Errorf("failed to register auth %s: %v", auth.ID, err)
	}
}

func (s *Service) applyCoreAuthRemoval(ctx context.Context, id string) {
	if s == nil || id == "" {
		return
	}
	if s.coreManager == nil {
		return
	}
	GlobalModelRegistry().UnregisterClient(id)
	if existing, ok := s.coreManager.GetByID(id); ok && existing != nil {
		existing.Disabled = true
		existing.Status = coreauth.StatusDisabled
		if _, err := s.coreManager.Update(ctx, existing); err != nil {
			log.Errorf("failed to disable auth %s: %v", id, err)
		}
	}
}

func (s *Service) ensureExecutorsForAuth(a *coreauth.Auth) {
	if s == nil || a == nil {
		return
	}
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
		providerKey := strings.ToLower(strings.TrimSpace(a.Provider))
		if providerKey == "" {
			providerKey = "openai-compatibility"
		}
		s.coreManager.RegisterExecutor(executor.NewOpenAICompatExecutor(providerKey, s.cfg))
	}
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
	s.refreshAccessProviders(s.cfg)
	s.server = api.NewServer(s.cfg, s.coreManager, s.accessManager, s.configPath, s.serverOptions...)

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
		if newCfg == nil {
			return
		}
		s.refreshAccessProviders(newCfg)
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
	s.ensureAuthUpdateQueue(ctx)
	if s.authUpdates != nil {
		watcherWrapper.SetAuthUpdateQueue(s.authUpdates)
	}
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
		if s.authQueueStop != nil {
			s.authQueueStop()
			s.authQueueStop = nil
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
		s.applyCoreAuthAddOrUpdate(ctx, a)
	}
	// Disable removed auths
	for _, stored := range s.coreManager.List() {
		if stored == nil {
			continue
		}
		if _, ok := seen[stored.ID]; ok {
			continue
		}
		s.applyCoreAuthRemoval(ctx, stored.ID)
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
	provider := strings.ToLower(strings.TrimSpace(a.Provider))
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
			providerKey := provider
			compatName := strings.TrimSpace(a.Provider)
			if strings.EqualFold(providerKey, "openai-compatibility") {
				if a.Attributes != nil {
					if v := strings.TrimSpace(a.Attributes["compat_name"]); v != "" {
						compatName = v
					}
					if v := strings.TrimSpace(a.Attributes["provider_key"]); v != "" {
						providerKey = strings.ToLower(v)
					}
				}
				if providerKey == "openai-compatibility" && compatName != "" {
					providerKey = strings.ToLower(compatName)
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
						if providerKey == "" {
							providerKey = "openai-compatibility"
						}
						GlobalModelRegistry().RegisterClient(a.ID, providerKey, ms)
					}
					return
				}
			}
		}
	}
	if len(models) > 0 {
		key := provider
		if key == "" {
			key = strings.ToLower(strings.TrimSpace(a.Provider))
		}
		GlobalModelRegistry().RegisterClient(a.ID, key, models)
	}
}
