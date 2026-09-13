package api

import (
	"strconv"
	"testing"
)

func TestPlaybackSessionRestrictsPlaylistItems(t *testing.T) {
	store := NewPlaybackSessionStore()
	id, err := store.Create(PlaybackSessionRequest{
		Token: "nas-token", Account: "user", Domain: "https://nas.example",
		ItemGuids: []string{"allowed-item"},
	})
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if _, err := store.Resolve(id, "allowed-item"); err != nil {
		t.Fatalf("resolve allowed item: %v", err)
	}
	if _, err := store.Resolve(id, "other-item"); err == nil {
		t.Fatal("expected unlisted item to be rejected")
	}
	if id == "nas-token" {
		t.Fatal("session id must not expose the NAS token")
	}
}

func TestDirectSessionAllowsTargetsWithoutFnosCredentials(t *testing.T) {
	store := NewPlaybackSessionStore()
	id, err := store.Create(PlaybackSessionRequest{
		ItemGuids: []string{"local-item"},
		Targets: map[string]PlaybackTarget{
			"local-item": {Kind: "file", Path: "D:/Movies/demo.mkv", SkipKey: "show-1"},
		},
	})
	if err != nil {
		t.Fatalf("create direct session: %v", err)
	}
	session, err := store.Resolve(id, "local-item")
	if err != nil {
		t.Fatal(err)
	}
	if target, ok := session.Targets["local-item"]; !ok || target.Path != "D:/Movies/demo.mkv" {
		t.Fatalf("target not carried in session: %+v", session.Targets)
	}
}

func TestDirectSessionRejectsInvalidTargets(t *testing.T) {
	store := NewPlaybackSessionStore()
	cases := []struct {
		name    string
		targets map[string]PlaybackTarget
	}{
		{"unsupported kind", map[string]PlaybackTarget{"g": {Kind: "exec", Path: "x"}}},
		{"empty path", map[string]PlaybackTarget{"g": {Kind: "file", Path: ""}}},
		{"crlf path", map[string]PlaybackTarget{"g": {Kind: "file", Path: "a\r\nb"}}},
		{"bad url scheme", map[string]PlaybackTarget{"g": {Kind: "url", URL: "ftp://host/file"}}},
		{"url without host", map[string]PlaybackTarget{"g": {Kind: "url", URL: "https:///file"}}},
		{"header injection", map[string]PlaybackTarget{"g": {Kind: "url", URL: "https://host/file", Headers: map[string]string{"X-Test": "a\r\nX-Evil: 1"}}}},
		{"header name injection", map[string]PlaybackTarget{"g": {Kind: "url", URL: "https://host/file", Headers: map[string]string{"X: Evil": "1"}}}},
	}
	for _, tc := range cases {
		if _, err := store.Create(PlaybackSessionRequest{ItemGuids: []string{"g"}, Targets: tc.targets}); err == nil {
			t.Fatalf("%s: expected error", tc.name)
		}
	}
}

func TestDirectSessionStillRequiresPlaylistWhitelist(t *testing.T) {
	store := NewPlaybackSessionStore()
	id, err := store.Create(PlaybackSessionRequest{
		ItemGuids: []string{"listed"},
		Targets:   map[string]PlaybackTarget{"listed": {Kind: "file", Path: "D:/a.mkv"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Resolve(id, "unlisted"); err == nil {
		t.Fatal("expected unlisted item to be rejected in direct sessions too")
	}
}

func TestPlaybackSessionRejectsMissingCredentials(t *testing.T) {
	store := NewPlaybackSessionStore()
	if _, err := store.Create(PlaybackSessionRequest{ItemGuids: []string{"item"}}); err == nil {
		t.Fatal("expected missing credentials to be rejected")
	}
}

func TestPlaybackSessionRejectsTooManyTargets(t *testing.T) {
	store := NewPlaybackSessionStore()
	targets := make(map[string]PlaybackTarget, maxPlaybackTargets+1)
	guids := make([]string, 0, maxPlaybackTargets+1)
	for i := 0; i <= maxPlaybackTargets; i++ {
		guid := "g" + strconv.Itoa(i)
		targets[guid] = PlaybackTarget{Kind: "file", Path: "D:/a.mkv"}
		guids = append(guids, guid)
	}
	if _, err := store.Create(PlaybackSessionRequest{ItemGuids: guids, Targets: targets}); err == nil {
		t.Fatal("expected too many targets to be rejected")
	}
}

func TestPlaybackSessionCarriesAccessCookieInsideAuthenticatedSession(t *testing.T) {
	store := NewPlaybackSessionStore()
	id, err := store.Create(PlaybackSessionRequest{
		Token:        "token",
		Account:      "account",
		Domain:       "https://nas.example",
		AccessCookie: "gateway=secret",
		ItemGuids:    []string{"item"},
	})
	if err != nil {
		t.Fatal(err)
	}
	session, err := store.Resolve(id, "item")
	if err != nil {
		t.Fatal(err)
	}
	if session.AccessCookie != "gateway=secret" {
		t.Fatalf("unexpected access cookie: %q", session.AccessCookie)
	}
}

func TestPlaybackSessionRejectsCookieHeaderInjection(t *testing.T) {
	store := NewPlaybackSessionStore()
	_, err := store.Create(PlaybackSessionRequest{
		Token:        "token",
		Account:      "account",
		Domain:       "https://nas.example",
		AccessCookie: "gateway=secret\r\nX-Injected: yes",
		ItemGuids:    []string{"item"},
	})
	if err == nil {
		t.Fatal("expected invalid access cookie to be rejected")
	}
}
