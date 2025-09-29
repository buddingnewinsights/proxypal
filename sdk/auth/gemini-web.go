package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	coreauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
)

// GeminiWebAuthenticator provides a minimal wrapper so core components can treat
// Gemini Web credentials via the shared Authenticator contract.
type GeminiWebAuthenticator struct{}

func NewGeminiWebAuthenticator() *GeminiWebAuthenticator { return &GeminiWebAuthenticator{} }

func (a *GeminiWebAuthenticator) Provider() string { return "gemini-web" }

func (a *GeminiWebAuthenticator) Login(ctx context.Context, cfg *config.Config, opts *LoginOptions) (*coreauth.Auth, error) {
	_ = ctx
	_ = cfg
	_ = opts
	return nil, fmt.Errorf("gemini-web authenticator does not support scripted login; use CLI --gemini-web-auth")
}

func (a *GeminiWebAuthenticator) RefreshLead() *time.Duration {
	d := time.Hour
	return &d
}
