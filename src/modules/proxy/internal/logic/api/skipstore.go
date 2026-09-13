package api

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// LocalSkipStore 为本地/直连播放目标保存跳过片头片尾信息。
// 数据以 JSON 文件持久化，供 mpv 的 smart_skip 插件通过代理接口读写。
type LocalSkipStore struct {
	path string
	mu   sync.Mutex
	data map[string]SkipInfo
}

func NewLocalSkipStore(path string) *LocalSkipStore {
	store := &LocalSkipStore{path: path, data: make(map[string]SkipInfo)}
	store.load()
	return store
}

func (s *LocalSkipStore) load() {
	raw, err := os.ReadFile(s.path)
	if err != nil {
		return
	}
	var data map[string]SkipInfo
	if err := json.Unmarshal(raw, &data); err != nil || data == nil {
		return
	}
	s.data = data
}

// Get 返回指定键的跳过信息；第二个返回值表示是否存在记录。
func (s *LocalSkipStore) Get(key string) (SkipInfo, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.data[key]
	return entry, ok
}

func (s *LocalSkipStore) Set(key string, start, end int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[key] = SkipInfo{SkipStart: start, SkipEnd: end}
	return s.persistLocked()
}

func (s *LocalSkipStore) persistLocked() error {
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	if dir := filepath.Dir(s.path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}
