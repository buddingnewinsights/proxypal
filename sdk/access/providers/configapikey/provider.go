package configapikey

import (
	"context"
	"net/http"
	"strings"

	sdkaccess "github.com/router-for-me/CLIProxyAPI/v6/sdk/access"
	"github.com/router-for-me/CLIProxyAPI/v6/sdk/config"
)

type provider struct {
	name string
	keys map[string]struct{}
}

func init() {
	sdkaccess.RegisterProvider(config.AccessProviderTypeConfigAPIKey, newProvider)
}

func newProvider(cfg *config.AccessProvider, _ *config.SDKConfig) (sdkaccess.Provider, error) {
	name := cfg.Name
	if name == "" {
		name = config.DefaultAccessProviderName
	}
	keys := make(map[string]struct{}, len(cfg.APIKeys))
	for _, key := range cfg.APIKeys {
		if key == "" {
			continue
		}
		keys[key] = struct{}{}
	}
	return &provider{name: name, keys: keys}, nil
}

func (p *provider) Identifier() string {
	if p == nil || p.name == "" {
		return config.DefaultAccessProviderName
	}
	return p.name
}

func (p *provider) Authenticate(_ context.Context, r *http.Request) (*sdkaccess.Result, error) {
	if p == nil {
		return nil, sdkaccess.ErrNotHandled
	}
	if len(p.keys) == 0 {
		return nil, sdkaccess.ErrNotHandled
	}
	authHeader := r.Header.Get("Authorization")
	authHeaderGoogle := r.Header.Get("X-Goog-Api-Key")
	authHeaderAnthropic := r.Header.Get("X-Api-Key")
	queryKey := ""
	if r.URL != nil {
		queryKey = r.URL.Query().Get("key")
	}
	if authHeader == "" && authHeaderGoogle == "" && authHeaderAnthropic == "" && queryKey == "" {
		return nil, sdkaccess.ErrNoCredentials
	}

	apiKey := extractBearerToken(authHeader)

	candidates := []struct {
		value  string
		source string
	}{
		{apiKey, "authorization"},
		{authHeaderGoogle, "x-goog-api-key"},
		{authHeaderAnthropic, "x-api-key"},
		{queryKey, "query-key"},
	}

	for _, candidate := range candidates {
		if candidate.value == "" {
			continue
		}
		if _, ok := p.keys[candidate.value]; ok {
			return &sdkaccess.Result{
				Provider:  p.Identifier(),
				Principal: candidate.value,
				Metadata: map[string]string{
					"source": candidate.source,
				},
			}, nil
		}
	}

	return nil, sdkaccess.ErrInvalidCredential
}

func extractBearerToken(header string) string {
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 {
		return header
	}
	if strings.ToLower(parts[0]) != "bearer" {
		return header
	}
	return strings.TrimSpace(parts[1])
}
