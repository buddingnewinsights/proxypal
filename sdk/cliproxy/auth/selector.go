package auth

import (
	"context"
	"sync"
	"time"

	cliproxyexecutor "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/executor"
)

// RoundRobinSelector provides a simple provider scoped round-robin selection strategy.
type RoundRobinSelector struct {
	mu      sync.Mutex
	cursors map[string]int
}

// Pick selects the next available auth for the provider in a round-robin manner.
func (s *RoundRobinSelector) Pick(ctx context.Context, provider, model string, opts cliproxyexecutor.Options, auths []*Auth) (*Auth, error) {
	_ = ctx
	_ = opts
	if len(auths) == 0 {
		return nil, &Error{Code: "auth_not_found", Message: "no auth candidates"}
	}
	if s.cursors == nil {
		s.cursors = make(map[string]int)
	}
	available := make([]*Auth, 0, len(auths))
	now := time.Now()
	for i := range auths {
		candidate := auths[i]
		if candidate.Unavailable && candidate.NextRetryAfter.After(now) {
			continue
		}
		if candidate.Status == StatusDisabled || candidate.Disabled {
			continue
		}
		available = append(available, candidate)
	}
	if len(available) == 0 {
		return nil, &Error{Code: "auth_unavailable", Message: "no auth available"}
	}
	key := provider + ":" + model
	s.mu.Lock()
	index := s.cursors[key]
	s.cursors[key] = (index + 1) % len(available)
	s.mu.Unlock()
	return available[index%len(available)], nil
}
