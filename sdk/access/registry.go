package access

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"github.com/router-for-me/CLIProxyAPI/v6/sdk/config"
)

// Provider validates credentials for incoming requests.
type Provider interface {
	Identifier() string
	Authenticate(ctx context.Context, r *http.Request) (*Result, error)
}

// Result conveys authentication outcome.
type Result struct {
	Provider  string
	Principal string
	Metadata  map[string]string
}

// ProviderFactory builds a provider from configuration data.
type ProviderFactory func(cfg *config.AccessProvider, root *config.SDKConfig) (Provider, error)

var (
	registryMu sync.RWMutex
	registry   = make(map[string]ProviderFactory)
)

// RegisterProvider registers a provider factory for a given type identifier.
func RegisterProvider(typ string, factory ProviderFactory) {
	if typ == "" || factory == nil {
		return
	}
	registryMu.Lock()
	registry[typ] = factory
	registryMu.Unlock()
}

func BuildProvider(cfg *config.AccessProvider, root *config.SDKConfig) (Provider, error) {
	if cfg == nil {
		return nil, fmt.Errorf("access: nil provider config")
	}
	registryMu.RLock()
	factory, ok := registry[cfg.Type]
	registryMu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("access: provider type %q is not registered", cfg.Type)
	}
	provider, err := factory(cfg, root)
	if err != nil {
		return nil, fmt.Errorf("access: failed to build provider %q: %w", cfg.Name, err)
	}
	return provider, nil
}

// BuildProviders constructs providers declared in configuration.
func BuildProviders(root *config.SDKConfig) ([]Provider, error) {
	if root == nil {
		return nil, nil
	}
	providers := make([]Provider, 0, len(root.Access.Providers))
	for i := range root.Access.Providers {
		providerCfg := &root.Access.Providers[i]
		if providerCfg.Type == "" {
			continue
		}
		provider, err := BuildProvider(providerCfg, root)
		if err != nil {
			return nil, err
		}
		providers = append(providers, provider)
	}
	if len(providers) == 0 {
		if inline := config.MakeInlineAPIKeyProvider(root.APIKeys); inline != nil {
			provider, err := BuildProvider(inline, root)
			if err != nil {
				return nil, err
			}
			providers = append(providers, provider)
		}
	}
	return providers, nil
}
