package logic

import (
	"os"
	"strings"

	"proxy/internal/logic/api"
	"proxy/pkg/logger"

	"github.com/gin-gonic/gin"
)

// RunApiServer 启动 API 服务器
func RunApiServer(addr, secret string) error {
	gin.SetMode(gin.ReleaseMode)
	r := NewRouter(secret, api.NewLocalSkipStore(resolveSkipStorePath()))

	logger.Infof("服务器启动在:%s", addr)
	return r.Run(addr)
}

// resolveSkipStorePath 返回本地跳过信息的持久化路径（主进程通过环境变量指定）。
func resolveSkipStorePath() string {
	if path := strings.TrimSpace(os.Getenv("FNTV_SKIP_STORE")); path != "" {
		return path
	}
	return "skip-info.json"
}

// NewRouter 构建路由；导出以便测试注入本地跳过信息存储。
func NewRouter(secret string, skipStore *api.LocalSkipStore) *gin.Engine {
	// gin.Default 的访问日志会包含完整 query，其中带有播放会话能力。
	// 各处理器已经记录不含凭据的必要上下文，这里只保留崩溃恢复。
	r := gin.New()
	r.Use(gin.Recovery())

	r.GET("/health", func(c *gin.Context) {
		if !api.HasValidProxySecret(c.GetHeader("X-FNTV-Proxy-Secret"), secret) {
			c.JSON(401, gin.H{"error": "Unauthorized"})
			return
		}
		c.JSON(200, gin.H{"service": "fntv-proxy", "protocol": 2})
	})
	sessions := api.NewPlaybackSessionStore()
	r.POST("/api/v1/session", api.CreatePlaybackSessionHandler(secret, sessions))
	r.GET("/api/v1/playvideo/:itemGuid", func(c *gin.Context) { api.PlayVideoHandler(c, sessions) })
	r.GET("/api/v1/skipinfo/:itemGuid", func(c *gin.Context) { api.GetSkipInfoHandler(c, sessions, skipStore) })
	r.POST("/api/v1/skipinfo", func(c *gin.Context) { api.SetSkipInfoHandler(c, sessions, skipStore) })

	// 404 路由
	r.NoRoute(func(c *gin.Context) {
		logger.Warnf("收到404请求: %s %s", c.Request.Method, c.Request.URL.Path)
		c.JSON(404, gin.H{"error": "Not Found"})
	})

	return r
}
