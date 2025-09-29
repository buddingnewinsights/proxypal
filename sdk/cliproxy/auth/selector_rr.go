package auth

import (
	"context"
	"strings"

	conversation "github.com/router-for-me/CLIProxyAPI/v6/internal/provider/gemini-web/conversation"
	cliproxyexecutor "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/executor"
	log "github.com/sirupsen/logrus"
)

const (
	geminiWebProviderKey = "gemini-web"
)

type geminiWebStickySelector struct {
	base Selector
}

func NewGeminiWebStickySelector(base Selector) Selector {
	if selector, ok := base.(*geminiWebStickySelector); ok {
		return selector
	}
	if base == nil {
		base = &RoundRobinSelector{}
	}
	return &geminiWebStickySelector{base: base}
}

func (m *Manager) EnableGeminiWebStickySelector() {
	if m == nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.selector.(*geminiWebStickySelector); ok {
		return
	}
	m.selector = NewGeminiWebStickySelector(m.selector)
}

func (s *geminiWebStickySelector) Pick(ctx context.Context, provider, model string, opts cliproxyexecutor.Options, auths []*Auth) (*Auth, error) {
	if !strings.EqualFold(provider, geminiWebProviderKey) {
		if opts.Metadata != nil {
			delete(opts.Metadata, conversation.MetadataMatchKey)
		}
		return s.base.Pick(ctx, provider, model, opts, auths)
	}

	messages := extractGeminiWebMessages(opts.Metadata)
	if len(messages) >= 2 {
		normalizedModel := conversation.NormalizeModel(model)
		candidates := conversation.BuildLookupHashes(normalizedModel, messages)
		for _, candidate := range candidates {
			record, ok, err := conversation.LookupMatch(candidate.Hash)
			if err != nil {
				log.Warnf("gemini-web selector: lookup failed for hash %s: %v", candidate.Hash, err)
				continue
			}
			if !ok {
				continue
			}
			label := strings.TrimSpace(record.AccountLabel)
			if label == "" {
				continue
			}
			auth := findAuthByLabel(auths, label)
			if auth != nil {
				if opts.Metadata != nil {
					opts.Metadata[conversation.MetadataMatchKey] = &conversation.MatchResult{
						Hash:   candidate.Hash,
						Record: record,
						Model:  normalizedModel,
					}
				}
				return auth, nil
			}
			_ = conversation.RemoveMatch(candidate.Hash)
		}
	}

	return s.base.Pick(ctx, provider, model, opts, auths)
}

func extractGeminiWebMessages(metadata map[string]any) []conversation.Message {
	if metadata == nil {
		return nil
	}
	raw, ok := metadata[conversation.MetadataMessagesKey]
	if !ok {
		return nil
	}
	switch v := raw.(type) {
	case []conversation.Message:
		return v
	case *[]conversation.Message:
		if v == nil {
			return nil
		}
		return *v
	default:
		return nil
	}
}

func findAuthByLabel(auths []*Auth, label string) *Auth {
	if len(auths) == 0 {
		return nil
	}
	normalized := strings.ToLower(strings.TrimSpace(label))
	for _, auth := range auths {
		if auth == nil {
			continue
		}
		if strings.ToLower(strings.TrimSpace(auth.Label)) == normalized {
			return auth
		}
		if auth.Metadata != nil {
			if v, ok := auth.Metadata["label"].(string); ok && strings.ToLower(strings.TrimSpace(v)) == normalized {
				return auth
			}
		}
	}
	return nil
}
