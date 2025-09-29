package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/auth/codex"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/browser"
	// legacy client removed
	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/misc"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/util"
	coreauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
	log "github.com/sirupsen/logrus"
)

// CodexAuthenticator implements the OAuth login flow for Codex accounts.
type CodexAuthenticator struct {
	CallbackPort int
}

// NewCodexAuthenticator constructs a Codex authenticator with default settings.
func NewCodexAuthenticator() *CodexAuthenticator {
	return &CodexAuthenticator{CallbackPort: 1455}
}

func (a *CodexAuthenticator) Provider() string {
	return "codex"
}

func (a *CodexAuthenticator) RefreshLead() *time.Duration {
	d := 5 * 24 * time.Hour
	return &d
}

func (a *CodexAuthenticator) Login(ctx context.Context, cfg *config.Config, opts *LoginOptions) (*coreauth.Auth, error) {
	if cfg == nil {
		return nil, fmt.Errorf("cliproxy auth: configuration is required")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if opts == nil {
		opts = &LoginOptions{}
	}

	pkceCodes, err := codex.GeneratePKCECodes()
	if err != nil {
		return nil, fmt.Errorf("codex pkce generation failed: %w", err)
	}

	state, err := misc.GenerateRandomState()
	if err != nil {
		return nil, fmt.Errorf("codex state generation failed: %w", err)
	}

	oauthServer := codex.NewOAuthServer(a.CallbackPort)
	if err = oauthServer.Start(); err != nil {
		if strings.Contains(err.Error(), "already in use") {
			return nil, codex.NewAuthenticationError(codex.ErrPortInUse, err)
		}
		return nil, codex.NewAuthenticationError(codex.ErrServerStartFailed, err)
	}
	defer func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if stopErr := oauthServer.Stop(stopCtx); stopErr != nil {
			log.Warnf("codex oauth server stop error: %v", stopErr)
		}
	}()

	authSvc := codex.NewCodexAuth(cfg)

	authURL, err := authSvc.GenerateAuthURL(state, pkceCodes)
	if err != nil {
		return nil, fmt.Errorf("codex authorization url generation failed: %w", err)
	}

	if !opts.NoBrowser {
		fmt.Println("Opening browser for Codex authentication")
		if !browser.IsAvailable() {
			log.Warn("No browser available; please open the URL manually")
			util.PrintSSHTunnelInstructions(a.CallbackPort)
			fmt.Printf("Visit the following URL to continue authentication:\n%s\n", authURL)
		} else if err = browser.OpenURL(authURL); err != nil {
			log.Warnf("Failed to open browser automatically: %v", err)
			util.PrintSSHTunnelInstructions(a.CallbackPort)
			fmt.Printf("Visit the following URL to continue authentication:\n%s\n", authURL)
		}
	} else {
		util.PrintSSHTunnelInstructions(a.CallbackPort)
		fmt.Printf("Visit the following URL to continue authentication:\n%s\n", authURL)
	}

	fmt.Println("Waiting for Codex authentication callback...")

	result, err := oauthServer.WaitForCallback(5 * time.Minute)
	if err != nil {
		if strings.Contains(err.Error(), "timeout") {
			return nil, codex.NewAuthenticationError(codex.ErrCallbackTimeout, err)
		}
		return nil, err
	}

	if result.Error != "" {
		return nil, codex.NewOAuthError(result.Error, "", http.StatusBadRequest)
	}

	if result.State != state {
		return nil, codex.NewAuthenticationError(codex.ErrInvalidState, fmt.Errorf("state mismatch"))
	}

	log.Debug("Codex authorization code received; exchanging for tokens")

	authBundle, err := authSvc.ExchangeCodeForTokens(ctx, result.Code, pkceCodes)
	if err != nil {
		return nil, codex.NewAuthenticationError(codex.ErrCodeExchangeFailed, err)
	}

	tokenStorage := authSvc.CreateTokenStorage(authBundle)

	if tokenStorage == nil || tokenStorage.Email == "" {
		return nil, fmt.Errorf("codex token storage missing account information")
	}

	fileName := fmt.Sprintf("codex-%s.json", tokenStorage.Email)
	metadata := map[string]any{
		"email": tokenStorage.Email,
	}

	fmt.Println("Codex authentication successful")
	if authBundle.APIKey != "" {
		fmt.Println("Codex API key obtained and stored")
	}

	return &coreauth.Auth{
		ID:       fileName,
		Provider: a.Provider(),
		FileName: fileName,
		Storage:  tokenStorage,
		Metadata: metadata,
	}, nil
}
