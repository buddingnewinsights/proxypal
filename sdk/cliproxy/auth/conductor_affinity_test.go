package auth

import (
	"context"
	"net/http"
	"testing"

	"github.com/router-for-me/CLIProxyAPI/v6/internal/registry"
	cliproxyexecutor "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/executor"
)

type affinityTestExecutor struct{ id string }

func (e affinityTestExecutor) Identifier() string { return e.id }

func (e affinityTestExecutor) Execute(context.Context, *Auth, cliproxyexecutor.Request, cliproxyexecutor.Options) (cliproxyexecutor.Response, error) {
	return cliproxyexecutor.Response{}, nil
}

func (e affinityTestExecutor) ExecuteStream(context.Context, *Auth, cliproxyexecutor.Request, cliproxyexecutor.Options) (*cliproxyexecutor.StreamResult, error) {
	ch := make(chan cliproxyexecutor.StreamChunk)
	close(ch)
	return &cliproxyexecutor.StreamResult{Chunks: ch}, nil
}

func (e affinityTestExecutor) Refresh(_ context.Context, auth *Auth) (*Auth, error) { return auth, nil }

func (e affinityTestExecutor) CountTokens(context.Context, *Auth, cliproxyexecutor.Request, cliproxyexecutor.Options) (cliproxyexecutor.Response, error) {
	return cliproxyexecutor.Response{}, nil
}

func (e affinityTestExecutor) HttpRequest(context.Context, *Auth, *http.Request) (*http.Response, error) {
	return nil, nil
}

func TestManagerPickNextMixedUsesAuthAffinity(t *testing.T) {
	t.Parallel()

	manager := NewManager(nil, &RoundRobinSelector{}, nil)
	manager.executors["codex"] = affinityTestExecutor{id: "codex"}
	reg := registry.GetGlobalRegistry()
	reg.RegisterClient("codex-a", "codex", []*registry.ModelInfo{{ID: "gpt-5.4"}})
	reg.RegisterClient("codex-b", "codex", []*registry.ModelInfo{{ID: "gpt-5.4"}})
	t.Cleanup(func() {
		reg.UnregisterClient("codex-a")
		reg.UnregisterClient("codex-b")
	})
	if _, errRegister := manager.Register(context.Background(), &Auth{ID: "codex-a", Provider: "codex"}); errRegister != nil {
		t.Fatalf("Register(codex-a) error = %v", errRegister)
	}
	if _, errRegister := manager.Register(context.Background(), &Auth{ID: "codex-b", Provider: "codex"}); errRegister != nil {
		t.Fatalf("Register(codex-b) error = %v", errRegister)
	}

	manager.SetAuthAffinity("idem-1", "codex-b")
	opts := cliproxyexecutor.Options{Metadata: map[string]any{"auth_affinity_key": "idem-1"}}

	got, _, provider, errPick := manager.pickNextMixed(context.Background(), []string{"codex"}, "gpt-5.4", opts, map[string]struct{}{})
	if errPick != nil {
		t.Fatalf("pickNextMixed() error = %v", errPick)
	}
	if provider != "codex" {
		t.Fatalf("provider = %q, want %q", provider, "codex")
	}
	if got == nil || got.ID != "codex-b" {
		t.Fatalf("auth.ID = %v, want codex-b", got)
	}
	if pinned := pinnedAuthIDFromMetadata(opts.Metadata); pinned != "codex-b" {
		t.Fatalf("pinned auth metadata = %q, want %q", pinned, "codex-b")
	}
}

func TestManagerAuthAffinityRoundTrip(t *testing.T) {
	t.Parallel()

	manager := NewManager(nil, nil, nil)
	manager.SetAuthAffinity("idem-2", "auth-1")
	if got := manager.AuthAffinity("idem-2"); got != "auth-1" {
		t.Fatalf("AuthAffinity = %q, want %q", got, "auth-1")
	}
	manager.ClearAuthAffinity("idem-2")
	if got := manager.AuthAffinity("idem-2"); got != "" {
		t.Fatalf("AuthAffinity after clear = %q, want empty", got)
	}
}
