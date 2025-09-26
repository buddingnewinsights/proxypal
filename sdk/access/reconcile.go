package access

import (
	"reflect"
	"sort"
	"strings"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
)

// ReconcileProviders builds the desired provider list by reusing existing providers when possible
// and creating or removing providers only when their configuration changed. It returns the final
// ordered provider slice along with the identifiers of providers that were added, updated, or
// removed compared to the previous configuration.
func ReconcileProviders(oldCfg, newCfg *config.Config, existing []Provider) (result []Provider, added, updated, removed []string, err error) {
	if newCfg == nil {
		return nil, nil, nil, nil, nil
	}

	existingMap := make(map[string]Provider, len(existing))
	for _, provider := range existing {
		if provider == nil {
			continue
		}
		existingMap[provider.Identifier()] = provider
	}

	oldCfgMap := accessProviderMap(oldCfg)
	newEntries := collectProviderEntries(newCfg)

	result = make([]Provider, 0, len(newEntries))
	finalIDs := make(map[string]struct{}, len(newEntries))

	for _, providerCfg := range newEntries {
		key := providerIdentifier(providerCfg)
		if key == "" {
			continue
		}

		if oldCfgProvider, ok := oldCfgMap[key]; ok && providerConfigEqual(oldCfgProvider, providerCfg) {
			if existingProvider, ok := existingMap[key]; ok {
				result = append(result, existingProvider)
				finalIDs[key] = struct{}{}
				continue
			}
		}

		provider, buildErr := buildProvider(providerCfg, newCfg)
		if buildErr != nil {
			return nil, nil, nil, nil, buildErr
		}
		if _, ok := oldCfgMap[key]; ok {
			if _, existed := existingMap[key]; existed {
				updated = append(updated, key)
			} else {
				added = append(added, key)
			}
		} else {
			added = append(added, key)
		}
		result = append(result, provider)
		finalIDs[key] = struct{}{}
	}

	if len(result) == 0 && len(newCfg.APIKeys) > 0 {
		config.SyncInlineAPIKeys(newCfg, newCfg.APIKeys)
		if providerCfg := newCfg.ConfigAPIKeyProvider(); providerCfg != nil {
			key := providerIdentifier(providerCfg)
			if key != "" {
				if oldCfgProvider, ok := oldCfgMap[key]; ok && providerConfigEqual(oldCfgProvider, providerCfg) {
					if existingProvider, ok := existingMap[key]; ok {
						result = append(result, existingProvider)
					} else {
						provider, buildErr := buildProvider(providerCfg, newCfg)
						if buildErr != nil {
							return nil, nil, nil, nil, buildErr
						}
						if _, existed := existingMap[key]; existed {
							updated = append(updated, key)
						} else {
							added = append(added, key)
						}
						result = append(result, provider)
					}
				} else {
					provider, buildErr := buildProvider(providerCfg, newCfg)
					if buildErr != nil {
						return nil, nil, nil, nil, buildErr
					}
					if _, ok := oldCfgMap[key]; ok {
						if _, existed := existingMap[key]; existed {
							updated = append(updated, key)
						} else {
							added = append(added, key)
						}
					} else {
						added = append(added, key)
					}
					result = append(result, provider)
				}
				finalIDs[key] = struct{}{}
			}
		}
	}

	removedSet := make(map[string]struct{})
	for id := range existingMap {
		if _, ok := finalIDs[id]; !ok {
			removedSet[id] = struct{}{}
		}
	}

	removed = make([]string, 0, len(removedSet))
	for id := range removedSet {
		removed = append(removed, id)
	}

	sort.Strings(added)
	sort.Strings(updated)
	sort.Strings(removed)

	return result, added, updated, removed, nil
}

func accessProviderMap(cfg *config.Config) map[string]*config.AccessProvider {
	result := make(map[string]*config.AccessProvider)
	if cfg == nil {
		return result
	}
	for i := range cfg.Access.Providers {
		providerCfg := &cfg.Access.Providers[i]
		if providerCfg.Type == "" {
			continue
		}
		key := providerIdentifier(providerCfg)
		if key == "" {
			continue
		}
		result[key] = providerCfg
	}
	if len(result) == 0 && len(cfg.APIKeys) > 0 {
		if provider := cfg.ConfigAPIKeyProvider(); provider != nil {
			if key := providerIdentifier(provider); key != "" {
				result[key] = provider
			}
		}
	}
	return result
}

func collectProviderEntries(cfg *config.Config) []*config.AccessProvider {
	entries := make([]*config.AccessProvider, 0, len(cfg.Access.Providers))
	if cfg == nil {
		return entries
	}
	for i := range cfg.Access.Providers {
		providerCfg := &cfg.Access.Providers[i]
		if providerCfg.Type == "" {
			continue
		}
		if key := providerIdentifier(providerCfg); key != "" {
			entries = append(entries, providerCfg)
		}
	}
	return entries
}

func providerIdentifier(provider *config.AccessProvider) string {
	if provider == nil {
		return ""
	}
	if name := strings.TrimSpace(provider.Name); name != "" {
		return name
	}
	typ := strings.TrimSpace(provider.Type)
	if typ == "" {
		return ""
	}
	if strings.EqualFold(typ, config.AccessProviderTypeConfigAPIKey) {
		return config.DefaultAccessProviderName
	}
	return typ
}

func providerConfigEqual(a, b *config.AccessProvider) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	if !strings.EqualFold(strings.TrimSpace(a.Type), strings.TrimSpace(b.Type)) {
		return false
	}
	if strings.TrimSpace(a.SDK) != strings.TrimSpace(b.SDK) {
		return false
	}
	if !stringSetEqual(a.APIKeys, b.APIKeys) {
		return false
	}
	if len(a.Config) != len(b.Config) {
		return false
	}
	if len(a.Config) > 0 && !reflect.DeepEqual(a.Config, b.Config) {
		return false
	}
	return true
}

func stringSetEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	if len(a) == 0 {
		return true
	}
	seen := make(map[string]int, len(a))
	for _, val := range a {
		seen[val]++
	}
	for _, val := range b {
		count := seen[val]
		if count == 0 {
			return false
		}
		if count == 1 {
			delete(seen, val)
		} else {
			seen[val] = count - 1
		}
	}
	return len(seen) == 0
}
