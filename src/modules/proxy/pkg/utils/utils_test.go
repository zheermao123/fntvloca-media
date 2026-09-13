package utils

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestRangeRetryTransportRetriesInitialOpenRange(t *testing.T) {
	requests := 0
	transport := rangeRetryTransport{base: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		requests++
		if requests == 1 {
			if got := req.Header.Get("Range"); got != "bytes=0-" {
				t.Fatalf("unexpected initial range: %q", got)
			}
			return &http.Response{StatusCode: http.StatusRequestedRangeNotSatisfiable, Body: io.NopCloser(strings.NewReader(""))}, nil
		}
		if got := req.Header.Get("Range"); got != "" {
			t.Fatalf("retry must omit range, got %q", got)
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("ok"))}, nil
	})}

	req, _ := http.NewRequest(http.MethodGet, "https://example.test/video", nil)
	req.Header.Set("Range", "bytes=0-")
	resp, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatalf("round trip failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK || requests != 2 {
		t.Fatalf("expected successful retry, status=%d requests=%d", resp.StatusCode, requests)
	}
}

func TestRangeRetryTransportDoesNotRewriteExplicitRange(t *testing.T) {
	requests := 0
	transport := rangeRetryTransport{base: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		requests++
		return &http.Response{StatusCode: http.StatusRequestedRangeNotSatisfiable, Body: io.NopCloser(strings.NewReader(""))}, nil
	})}

	req, _ := http.NewRequest(http.MethodGet, "https://example.test/video", nil)
	req.Header.Set("Range", "bytes=100-200")
	resp, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatalf("round trip failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusRequestedRangeNotSatisfiable || requests != 1 {
		t.Fatalf("explicit range must not retry, status=%d requests=%d", resp.StatusCode, requests)
	}
}
