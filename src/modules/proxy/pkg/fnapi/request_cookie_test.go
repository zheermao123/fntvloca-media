package fnapi

import "testing"

func TestComposeCookieHeaderAddsRelayOnce(t *testing.T) {
	actual := ComposeCookieHeader("gateway=secret; mode=other; second=value; gateway=duplicate")
	want := "gateway=secret; second=value; mode=relay"
	if actual != want {
		t.Fatalf("unexpected cookie header: got %q want %q", actual, want)
	}
}

func TestComposeCookieHeaderWithoutGrant(t *testing.T) {
	if actual := ComposeCookieHeader(""); actual != "mode=relay" {
		t.Fatalf("unexpected base cookie: %q", actual)
	}
}
