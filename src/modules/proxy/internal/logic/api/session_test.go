package api

import "testing"

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

func TestPlaybackSessionRejectsMissingCredentials(t *testing.T) {
	store := NewPlaybackSessionStore()
	if _, err := store.Create(PlaybackSessionRequest{ItemGuids: []string{"item"}}); err == nil {
		t.Fatal("expected missing credentials to be rejected")
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
