package api

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const playbackSessionTTL = 24 * time.Hour

type PlaybackSessionRequest struct {
	Token        string   `json:"token"`
	Account      string   `json:"account"`
	Domain       string   `json:"domain"`
	AccessCookie string   `json:"accessCookie,omitempty"`
	SkipVerify   bool     `json:"skipVerify"`
	UseNasLocal  bool     `json:"useNasLocal"`
	ItemGuids    []string `json:"itemGuids"`
}

type PlaybackSession struct {
	PlaybackSessionRequest
	allowedItems map[string]struct{}
	expiresAt    time.Time
}

type PlaybackSessionStore struct {
	mu       sync.Mutex
	sessions map[string]*PlaybackSession
}

func HasValidProxySecret(provided, secret string) bool {
	return secret != "" && len(provided) == len(secret) && subtle.ConstantTimeCompare([]byte(provided), []byte(secret)) == 1
}

func NewPlaybackSessionStore() *PlaybackSessionStore {
	return &PlaybackSessionStore{sessions: make(map[string]*PlaybackSession)}
}

func (s *PlaybackSessionStore) Create(req PlaybackSessionRequest) (string, error) {
	if req.Token == "" || req.Account == "" || req.Domain == "" || len(req.ItemGuids) == 0 {
		return "", errors.New("missing required session parameters")
	}
	if len(req.ItemGuids) > 10000 {
		return "", errors.New("too many playlist items")
	}
	if len(req.AccessCookie) > 16384 || strings.ContainsAny(req.AccessCookie, "\r\n") {
		return "", errors.New("invalid access cookie")
	}

	allowedItems := make(map[string]struct{}, len(req.ItemGuids))
	for _, guid := range req.ItemGuids {
		if guid == "" {
			return "", errors.New("empty playlist item")
		}
		allowedItems[guid] = struct{}{}
	}

	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	id := hex.EncodeToString(random)

	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for key, session := range s.sessions {
		if now.After(session.expiresAt) {
			delete(s.sessions, key)
		}
	}
	s.sessions[id] = &PlaybackSession{
		PlaybackSessionRequest: req,
		allowedItems:           allowedItems,
		expiresAt:              now.Add(playbackSessionTTL),
	}
	return id, nil
}

func (s *PlaybackSessionStore) Resolve(id, itemGuid string) (*PlaybackSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session := s.sessions[id]
	if session == nil || time.Now().After(session.expiresAt) {
		delete(s.sessions, id)
		return nil, errors.New("invalid or expired playback session")
	}
	if _, ok := session.allowedItems[itemGuid]; !ok {
		return nil, errors.New("item is not part of playback session")
	}
	session.expiresAt = time.Now().Add(playbackSessionTTL)
	return session, nil
}

func CreatePlaybackSessionHandler(secret string, store *PlaybackSessionStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		provided := c.GetHeader("X-FNTV-Proxy-Secret")
		if !HasValidProxySecret(provided, secret) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var req PlaybackSessionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}
		id, err := store.Create(req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"session": id})
	}
}
