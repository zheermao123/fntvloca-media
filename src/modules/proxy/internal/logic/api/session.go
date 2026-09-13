package api

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const playbackSessionTTL = 24 * time.Hour

// PlaybackTarget 描述一个直接播放目标（本地文件或远程URL），
// 用于不经过 fnOS 服务的播放源（本地库 / WebDAV / STRM 等）。
type PlaybackTarget struct {
	Kind    string            `json:"kind"`              // "file" 或 "url"
	Path    string            `json:"path,omitempty"`    // 本地文件路径（kind=file）
	URL     string            `json:"url,omitempty"`     // 远程地址（kind=url）
	Headers map[string]string `json:"headers,omitempty"` // 附加请求头（kind=url）
	SkipKey string            `json:"skipKey,omitempty"` // 本地跳过信息存储键（剧集组或条目ID）
}

type PlaybackSessionRequest struct {
	Token        string                    `json:"token"`
	Account      string                    `json:"account"`
	Domain       string                    `json:"domain"`
	AccessCookie string                    `json:"accessCookie,omitempty"`
	SkipVerify   bool                      `json:"skipVerify"`
	UseNasLocal  bool                      `json:"useNasLocal"`
	ItemGuids    []string                  `json:"itemGuids"`
	Targets      map[string]PlaybackTarget `json:"targets,omitempty"`
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

const maxPlaybackTargets = 2000

// validateTargets 校验直接播放目标，防止畸形路径与请求头注入。
func validateTargets(targets map[string]PlaybackTarget) error {
	if len(targets) > maxPlaybackTargets {
		return errors.New("too many playback targets")
	}
	for guid, target := range targets {
		if guid == "" {
			return errors.New("empty target guid")
		}
		switch target.Kind {
		case "file":
			if target.Path == "" || strings.ContainsAny(target.Path, "\r\n") {
				return errors.New("invalid target path")
			}
		case "url":
			parsed, err := url.Parse(target.URL)
			if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
				return errors.New("invalid target url")
			}
			for name, value := range target.Headers {
				if name == "" || strings.ContainsAny(name, ":\r\n") || strings.ContainsAny(value, "\r\n") {
					return errors.New("invalid target header")
				}
			}
		default:
			return errors.New("unsupported target kind")
		}
	}
	return nil
}

func (s *PlaybackSessionStore) Create(req PlaybackSessionRequest) (string, error) {
	if len(req.ItemGuids) == 0 {
		return "", errors.New("missing required session parameters")
	}
	if len(req.Targets) > 0 {
		if err := validateTargets(req.Targets); err != nil {
			return "", err
		}
	} else if req.Token == "" || req.Account == "" || req.Domain == "" {
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
