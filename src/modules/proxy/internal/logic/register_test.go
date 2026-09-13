package logic

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"proxy/internal/logic/api"

	"github.com/gin-gonic/gin"
)

func newTestRouter(t *testing.T) (*gin.Engine, *api.LocalSkipStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	skipStore := api.NewLocalSkipStore(filepath.Join(t.TempDir(), "skip-info.json"))
	return NewRouter("test-secret", skipStore), skipStore
}

func createDirectSession(t *testing.T, r *gin.Engine, guid string, target api.PlaybackTarget) string {
	t.Helper()
	payload := map[string]any{
		"itemGuids": []string{guid},
		"targets":   map[string]api.PlaybackTarget{guid: target},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/session", bytes.NewReader(body))
	request.Header.Set("X-FNTV-Proxy-Secret", "test-secret")
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	r.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Session string `json:"session"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode session response: %v", err)
	}
	if response.Session == "" {
		t.Fatal("empty session id")
	}
	return response.Session
}

func TestHealthResponseContract(t *testing.T) {
	r, _ := newTestRouter(t)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	request.Header.Set("X-FNTV-Proxy-Secret", "test-secret")
	r.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var payload struct {
		Service  string `json:"service"`
		Protocol int    `json:"protocol"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode health response: %v", err)
	}
	if payload.Service != "fntv-proxy" || payload.Protocol != 2 {
		t.Fatalf("unexpected health response: %+v", payload)
	}
}

func TestHealthRejectsMissingSecret(t *testing.T) {
	r, _ := newTestRouter(t)
	recorder := httptest.NewRecorder()
	r.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/health", nil))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", recorder.Code)
	}
}

func TestPlayVideoServesLocalFileTargetWithRange(t *testing.T) {
	r, _ := newTestRouter(t)
	dir := t.TempDir()
	filePath := filepath.Join(dir, "video.mkv")
	content := []byte("0123456789abcdef")
	if err := os.WriteFile(filePath, content, 0o644); err != nil {
		t.Fatal(err)
	}

	session := createDirectSession(t, r, "local-item", api.PlaybackTarget{Kind: "file", Path: filePath})

	request := httptest.NewRequest(http.MethodGet, "/api/v1/playvideo/local-item?session="+session, nil)
	request.Header.Set("Range", "bytes=0-3")
	recorder := httptest.NewRecorder()
	r.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusPartialContent {
		t.Fatalf("expected status 206, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if got := recorder.Body.String(); got != "0123" {
		t.Fatalf("unexpected range body: %q", got)
	}
	if accept := recorder.Header().Get("Accept-Ranges"); accept != "bytes" {
		t.Fatalf("expected Accept-Ranges: bytes, got %q", accept)
	}
}

func TestPlayVideoLocalTargetRejectsUnknownSession(t *testing.T) {
	r, _ := newTestRouter(t)
	request := httptest.NewRequest(http.MethodGet, "/api/v1/playvideo/item?session=bogus", nil)
	recorder := httptest.NewRecorder()
	r.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", recorder.Code)
	}
}

func TestSkipInfoLocalStoreRoundTrip(t *testing.T) {
	r, _ := newTestRouter(t)
	session := createDirectSession(t, r, "episode-item", api.PlaybackTarget{
		Kind:    "file",
		Path:    "D:/series/S01E01.mkv",
		SkipKey: "show-group-1",
	})

	// 初始为空
	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/skipinfo/episode-item?session="+session, nil)
	getRec := httptest.NewRecorder()
	r.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", getRec.Code)
	}
	var initial struct {
		Code int `json:"code"`
		Data struct {
			SkipStart int `json:"skipStart"`
			SkipEnd   int `json:"skipEnd"`
		} `json:"data"`
	}
	if err := json.Unmarshal(getRec.Body.Bytes(), &initial); err != nil {
		t.Fatal(err)
	}
	if initial.Data.SkipStart != 0 || initial.Data.SkipEnd != 0 {
		t.Fatalf("expected empty skip info, got %+v", initial.Data)
	}

	// 写入
	body, _ := json.Marshal(map[string]any{"guid": "episode-item", "skipStart": 30, "skipEnd": 95})
	postReq := httptest.NewRequest(http.MethodPost, "/api/v1/skipinfo?session="+session, bytes.NewReader(body))
	postReq.Header.Set("Content-Type", "application/json")
	postRec := httptest.NewRecorder()
	r.ServeHTTP(postRec, postReq)
	if postRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 on set, got %d: %s", postRec.Code, postRec.Body.String())
	}

	// 读回
	getRec2 := httptest.NewRecorder()
	r.ServeHTTP(getRec2, httptest.NewRequest(http.MethodGet, "/api/v1/skipinfo/episode-item?session="+session, nil))
	var updated struct {
		Data struct {
			SkipStart int `json:"skipStart"`
			SkipEnd   int `json:"skipEnd"`
		} `json:"data"`
	}
	if err := json.Unmarshal(getRec2.Body.Bytes(), &updated); err != nil {
		t.Fatal(err)
	}
	if updated.Data.SkipStart != 30 || updated.Data.SkipEnd != 95 {
		t.Fatalf("unexpected skip info after set: %+v", updated.Data)
	}
}
