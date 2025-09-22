package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// FileStore implements Store backed by JSON files in a directory.
type FileStore struct {
	dir string
	mu  sync.Mutex
}

// NewFileStore builds a file-backed store rooted at dir.
func NewFileStore(dir string) *FileStore {
	return &FileStore{dir: dir}
}

// List enumerates all auth JSON files under the store directory.
func (s *FileStore) List(ctx context.Context) ([]*Auth, error) {
	if s.dir == "" {
		return nil, fmt.Errorf("auth filestore: directory not configured")
	}
	entries := make([]*Auth, 0)
	err := filepath.WalkDir(s.dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(strings.ToLower(d.Name()), ".json") {
			return nil
		}
		auth, err := s.readFile(path)
		if err != nil {
			// Record error but keep scanning to surface remaining auths.
			return nil
		}
		if auth != nil {
			entries = append(entries, auth)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return entries, nil
}

// Save writes the auth metadata back to its source file location.
func (s *FileStore) Save(ctx context.Context, auth *Auth) error {
	if auth == nil {
		return fmt.Errorf("auth filestore: auth is nil")
	}
	path := s.resolvePath(auth)
	if path == "" {
		return fmt.Errorf("auth filestore: missing file path attribute for %s", auth.ID)
	}
	// If the auth has been disabled and the original file was removed, avoid
	// recreating it on disk. This lets operators delete auth files explicitly.
	if auth.Disabled {
		if _, err := os.Stat(path); err != nil {
			if os.IsNotExist(err) {
				return nil
			}
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("auth filestore: create dir failed: %w", err)
	}
	raw, err := json.Marshal(auth.Metadata)
	if err != nil {
		return fmt.Errorf("auth filestore: marshal metadata failed: %w", err)
	}
	if existing, errReadFile := os.ReadFile(path); errReadFile == nil {
		if jsonEqual(existing, raw) {
			return nil
		}
	}
	tmp := path + ".tmp"
	if err = os.WriteFile(tmp, raw, 0o600); err != nil {
		return fmt.Errorf("auth filestore: write temp failed: %w", err)
	}
	if err = os.Rename(tmp, path); err != nil {
		return fmt.Errorf("auth filestore: rename failed: %w", err)
	}
	return nil
}

func jsonEqual(a, b []byte) bool {
	var objA any
	var objB any
	if err := json.Unmarshal(a, &objA); err != nil {
		return false
	}
	if err := json.Unmarshal(b, &objB); err != nil {
		return false
	}
	return deepEqualJSON(objA, objB)
}

func deepEqualJSON(a, b any) bool {
	switch valA := a.(type) {
	case map[string]any:
		valB, ok := b.(map[string]any)
		if !ok || len(valA) != len(valB) {
			return false
		}
		for key, subA := range valA {
			subB, ok1 := valB[key]
			if !ok1 || !deepEqualJSON(subA, subB) {
				return false
			}
		}
		return true
	case []any:
		sliceB, ok := b.([]any)
		if !ok || len(valA) != len(sliceB) {
			return false
		}
		for i := range valA {
			if !deepEqualJSON(valA[i], sliceB[i]) {
				return false
			}
		}
		return true
	case float64:
		valB, ok := b.(float64)
		if !ok {
			return false
		}
		return valA == valB
	case string:
		valB, ok := b.(string)
		if !ok {
			return false
		}
		return valA == valB
	case bool:
		valB, ok := b.(bool)
		if !ok {
			return false
		}
		return valA == valB
	case nil:
		return b == nil
	default:
		return false
	}
}

// Delete removes the auth file.
func (s *FileStore) Delete(ctx context.Context, id string) error {
	if id == "" {
		return fmt.Errorf("auth filestore: id is empty")
	}
	path := filepath.Join(s.dir, id)
	if strings.ContainsRune(id, os.PathSeparator) {
		path = id
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("auth filestore: delete failed: %w", err)
	}
	return nil
}

func (s *FileStore) readFile(path string) (*Auth, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}
	if len(data) == 0 {
		return nil, nil
	}
	metadata := make(map[string]any)
	if err = json.Unmarshal(data, &metadata); err != nil {
		return nil, fmt.Errorf("unmarshal auth json: %w", err)
	}
	provider, _ := metadata["type"].(string)
	if provider == "" {
		provider = "unknown"
	}
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("stat file: %w", err)
	}
	id := s.idFor(path)
	auth := &Auth{
		ID:               id,
		Provider:         provider,
		Label:            s.labelFor(metadata),
		Status:           StatusActive,
		Attributes:       map[string]string{"path": path},
		Metadata:         metadata,
		CreatedAt:        info.ModTime(),
		UpdatedAt:        info.ModTime(),
		LastRefreshedAt:  time.Time{},
		NextRefreshAfter: time.Time{},
	}
	if email, ok := metadata["email"].(string); ok && email != "" {
		auth.Attributes["email"] = email
	}
	return auth, nil
}

func (s *FileStore) idFor(path string) string {
	rel, err := filepath.Rel(s.dir, path)
	if err != nil {
		return path
	}
	return rel
}

func (s *FileStore) resolvePath(auth *Auth) string {
	if auth == nil {
		return ""
	}
	if auth.Attributes != nil {
		if p := auth.Attributes["path"]; p != "" {
			return p
		}
	}
	if filepath.IsAbs(auth.ID) {
		return auth.ID
	}
	if auth.ID == "" {
		return ""
	}
	return filepath.Join(s.dir, auth.ID)
}

func (s *FileStore) labelFor(metadata map[string]any) string {
	if metadata == nil {
		return ""
	}
	if v, ok := metadata["label"].(string); ok && v != "" {
		return v
	}
	if v, ok := metadata["email"].(string); ok && v != "" {
		return v
	}
	if project, ok := metadata["project_id"].(string); ok && project != "" {
		return project
	}
	return ""
}
