package auth

import (
	"context"
	"sort"
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
	for i := 0; i < len(auths); i++ {
		candidate := auths[i]
		if isAuthBlockedForModel(candidate, model, now) {
			continue
		}
		available = append(available, candidate)
	}
	if len(available) == 0 {
		return nil, &Error{Code: "auth_unavailable", Message: "no auth available"}
	}
	// Make round-robin deterministic even if caller's candidate order is unstable.
	if len(available) > 1 {
		sort.Slice(available, func(i, j int) bool { return available[i].ID < available[j].ID })
	}
	key := provider + ":" + model
	s.mu.Lock()
	index := s.cursors[key]

	if index >= 2_147_483_640 {
		index = 0
	}

	s.cursors[key] = index + 1
	s.mu.Unlock()
	// log.Debugf("available: %d, index: %d, key: %d", len(available), index, index%len(available))
	return available[index%len(available)], nil
}

func isAuthBlockedForModel(auth *Auth, model string, now time.Time) bool {
	if auth == nil {
		return true
	}
	if auth.Disabled || auth.Status == StatusDisabled {
		return true
	}
	// If a specific model is requested, prefer its per-model state over any aggregated
	// auth-level unavailable flag. This prevents a failure on one model (e.g., 429 quota)
	// from blocking other models of the same provider that have no errors.
	if model != "" {
		if len(auth.ModelStates) > 0 {
			if state, ok := auth.ModelStates[model]; ok && state != nil {
				if state.Status == StatusDisabled {
					return true
				}
				if state.Unavailable {
					if state.NextRetryAfter.IsZero() {
						return false
					}
					if state.NextRetryAfter.After(now) {
						return true
					}
				}
				// Explicit state exists and is not blocking.
				return false
			}
		}
		// No explicit state for this model; do not block based on aggregated
		// auth-level unavailable status. Allow trying this model.
		return false
	}
	// No specific model context: fall back to auth-level unavailable window.
	if auth.Unavailable && auth.NextRetryAfter.After(now) {
		return true
	}
	return false
}
