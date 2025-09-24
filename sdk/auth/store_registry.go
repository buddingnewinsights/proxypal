package auth

import "sync"

var (
	storeMu              sync.RWMutex
	registeredTokenStore TokenStore
)

// RegisterTokenStore sets the global token store used by the authentication helpers.
func RegisterTokenStore(store TokenStore) {
	storeMu.Lock()
	registeredTokenStore = store
	storeMu.Unlock()
}

// GetTokenStore returns the globally registered token store.
func GetTokenStore() TokenStore {
	storeMu.RLock()
	s := registeredTokenStore
	storeMu.RUnlock()
	if s != nil {
		return s
	}
	storeMu.Lock()
	defer storeMu.Unlock()
	if registeredTokenStore == nil {
		registeredTokenStore = NewFileTokenStore()
	}
	return registeredTokenStore
}
