package api

import "testing"

func TestApplyPlaybackCookieUsesNasGrantForLocalMedia(t *testing.T) {
	headers := map[string]string{"Cookie": "from-player=value"}
	applyPlaybackCookie(headers, false, "cloud=value", "gateway=secret")
	if actual := headers["Cookie"]; actual != "gateway=secret; mode=relay" {
		t.Fatalf("unexpected NAS cookie: %q", actual)
	}
}

func TestApplyPlaybackCookieKeepsNasGrantOutOfCloudDirect(t *testing.T) {
	headers := map[string]string{"Cookie": "gateway=secret; mode=relay"}
	applyPlaybackCookie(headers, true, "provider=cloud", "gateway=secret")
	if actual := headers["Cookie"]; actual != "provider=cloud" {
		t.Fatalf("unexpected cloud cookie: %q", actual)
	}
}

func TestApplyPlaybackCookieClearsCookiesWhenCloudProvidesNone(t *testing.T) {
	headers := map[string]string{"Cookie": "gateway=secret"}
	applyPlaybackCookie(headers, true, "", "gateway=secret")
	if _, exists := headers["Cookie"]; exists {
		t.Fatal("cloud direct request must not inherit a NAS cookie")
	}
}
