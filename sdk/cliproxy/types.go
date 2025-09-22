package cliproxy

import (
	"context"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/watcher"
	coreauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
)

// TokenClientProvider loads clients backed by stored authentication tokens.
type TokenClientProvider interface {
	Load(ctx context.Context, cfg *config.Config) (*TokenClientResult, error)
}

// TokenClientResult represents clients generated from persisted tokens.
type TokenClientResult struct {
	SuccessfulAuthed int
}

// APIKeyClientProvider loads clients backed directly by configured API keys.
type APIKeyClientProvider interface {
	Load(ctx context.Context, cfg *config.Config) (*APIKeyClientResult, error)
}

// APIKeyClientResult contains API key based clients along with type counts.
type APIKeyClientResult struct {
	GeminiKeyCount    int
	ClaudeKeyCount    int
	CodexKeyCount     int
	OpenAICompatCount int
}

// WatcherFactory creates a watcher for configuration and token changes.
// The reload callback now only receives the updated configuration.
type WatcherFactory func(configPath, authDir string, reload func(*config.Config)) (*WatcherWrapper, error)

// WatcherWrapper exposes the subset of watcher methods required by the SDK.
type WatcherWrapper struct {
	start func(ctx context.Context) error
	stop  func() error

	setConfig      func(cfg *config.Config)
	snapshotAuths  func() []*coreauth.Auth
	setUpdateQueue func(queue chan<- watcher.AuthUpdate)
}

// Start proxies to the underlying watcher Start implementation.
func (w *WatcherWrapper) Start(ctx context.Context) error {
	if w == nil || w.start == nil {
		return nil
	}
	return w.start(ctx)
}

// Stop proxies to the underlying watcher Stop implementation.
func (w *WatcherWrapper) Stop() error {
	if w == nil || w.stop == nil {
		return nil
	}
	return w.stop()
}

// SetConfig updates the watcher configuration cache.
func (w *WatcherWrapper) SetConfig(cfg *config.Config) {
	if w == nil || w.setConfig == nil {
		return
	}
	w.setConfig(cfg)
}

// SetClients updates the watcher file-backed clients registry.
// SetClients and SetAPIKeyClients removed; watcher manages its own caches

// SnapshotClients returns the current combined clients snapshot from the underlying watcher.
// SnapshotClients removed; use SnapshotAuths

// SnapshotAuths returns the current auth entries derived from legacy clients.
func (w *WatcherWrapper) SnapshotAuths() []*coreauth.Auth {
	if w == nil || w.snapshotAuths == nil {
		return nil
	}
	return w.snapshotAuths()
}

// SetAuthUpdateQueue registers the channel used to propagate auth updates.
func (w *WatcherWrapper) SetAuthUpdateQueue(queue chan<- watcher.AuthUpdate) {
	if w == nil || w.setUpdateQueue == nil {
		return
	}
	w.setUpdateQueue(queue)
}
