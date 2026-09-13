package api

import (
	"path/filepath"
	"testing"
)

func TestLocalSkipStorePersistsAndReloads(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "skip-info.json")
	store := NewLocalSkipStore(path)

	if _, ok := store.Get("k"); ok {
		t.Fatal("expected empty store")
	}
	if err := store.Set("k", 30, 90); err != nil {
		t.Fatalf("set: %v", err)
	}
	entry, ok := store.Get("k")
	if !ok || entry.SkipStart != 30 || entry.SkipEnd != 90 {
		t.Fatalf("unexpected entry: %+v ok=%v", entry, ok)
	}

	reloaded := NewLocalSkipStore(path)
	entry, ok = reloaded.Get("k")
	if !ok || entry.SkipStart != 30 || entry.SkipEnd != 90 {
		t.Fatalf("expected persisted entry after reload, got %+v ok=%v", entry, ok)
	}

	if err := reloaded.Set("k", 10, 20); err != nil {
		t.Fatalf("overwrite: %v", err)
	}
	entry, _ = reloaded.Get("k")
	if entry.SkipStart != 10 || entry.SkipEnd != 20 {
		t.Fatalf("unexpected overwritten entry: %+v", entry)
	}
}
