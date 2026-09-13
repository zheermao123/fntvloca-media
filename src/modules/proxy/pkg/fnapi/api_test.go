package fnapi

import "testing"

func TestApiCacheKeyIsIsolatedByServerAndToken(t *testing.T) {
	first := &ApiService{baseURL: "https://nas-a.test", token: "token-a"}
	otherServer := &ApiService{baseURL: "https://nas-b.test", token: "token-a"}
	otherToken := &ApiService{baseURL: "https://nas-a.test", token: "token-b"}

	firstKey := first.generateCacheKey("GET", "/v/api/v1/user/info", nil)
	if firstKey == otherServer.generateCacheKey("GET", "/v/api/v1/user/info", nil) {
		t.Fatal("cache key must include the server namespace")
	}
	if firstKey == otherToken.generateCacheKey("GET", "/v/api/v1/user/info", nil) {
		t.Fatal("cache key must include the token namespace")
	}
}
