package utils

import (
	"bytes"
	"crypto/sha1"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"proxy/pkg/logger"

	"github.com/gin-gonic/gin"
)

type rangeRetryTransport struct {
	base http.RoundTripper
}

func (t rangeRetryTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	resp, err := t.base.RoundTrip(req)
	if err != nil || resp.StatusCode != http.StatusRequestedRangeNotSatisfiable || req.Header.Get("Range") != "bytes=0-" {
		return resp, err
	}

	if closeErr := resp.Body.Close(); closeErr != nil {
		logger.Debugf("关闭 416 响应失败: %v", closeErr)
	}
	retry := req.Clone(req.Context())
	retry.Header = req.Header.Clone()
	retry.Header.Del("Range")
	retry.Header.Del("If-Range")
	logger.Warnf("上游拒绝初始开放 Range，请求将在不带 Range 的情况下重试: %s", req.URL.Path)
	return t.base.RoundTrip(retry)
}

func JsonPrintBytes(v any) []byte {
	if v == nil {
		return []byte("{}")
	}

	b, err := json.Marshal(v)
	if err != nil {
		return []byte("{}")
	}

	return b
}

// JsonPrint 打印JSON
func JsonPrint(v any) string {
	return string(JsonPrintBytes(v))
}

// StringToUUID 将字符串转换为UUID格式
func StringToUUID(s string) string {
	if len(s) == 0 {
		return "00000000-0000-0000-0000-000000000000"
	}

	hash := sha1.Sum([]byte(s))
	hexStr := hex.EncodeToString(hash[:16])

	return hexStr[:8] + "-" + hexStr[8:12] + "-" + hexStr[12:16] + "-" + hexStr[16:20] + "-" + hexStr[20:]
}

// PassthroughHeaders 从HTTP请求中提取需要传递的头信息
func PassthroughHeaders(req *http.Request) map[string]string {
	headers := make(map[string]string)

	// 需要传递的头列表
	passHeaders := []string{
		"User-Agent",
		"Accept",
		"Accept-Language",
		"Accept-Encoding",
		"Cache-Control",
		"Pragma",
		"Range",
		"If-Range",
		"If-Modified-Since",
		"If-None-Match",
	}

	for _, header := range passHeaders {
		if value := req.Header.Get(header); value != "" {
			headers[header] = value
		}
	}

	return headers
}

// DynamicProxy 透明代理
func DynamicProxy(c *gin.Context, targetURL string, extraHeaders map[string]string, skipVerify bool) {
	// 使用recover来捕获可能的panic
	defer func() {
		if err := recover(); err != nil {
			// 检查是否是http.ErrAbortHandler错误
			if err == http.ErrAbortHandler {
				// logger.Debugf("客户端断开连接，忽略错误: %v", err)
				return
			}
			// 其他panic重新抛出
			panic(err)
		}
	}()

	// 解析目标URL
	target, err := url.Parse(targetURL)
	if err != nil {
		c.JSON(500, gin.H{"error": "Invalid target URL"})
		return
	}

	// 兼容webdav 取出 userinfo（如果有）
	var (
		uName   string
		uPass   string
		hasUser bool
	)
	if target.User != nil {
		uName = target.User.Username()
		if p, ok := target.User.Password(); ok {
			uPass = p
		}
		hasUser = (uName != "")
	}

	// 清除URL中的用户信息，避免泄露
	targetNoUser := *target
	targetNoUser.User = nil

	// 创建反向代理
	proxy := httputil.NewSingleHostReverseProxy(&targetNoUser)

	// 设置超时时间
	baseTransport := &http.Transport{
		ResponseHeaderTimeout: 120 * time.Second,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: skipVerify,
		},
	}
	proxy.Transport = rangeRetryTransport{base: baseTransport}

	// 修改请求前的处理
	proxy.Director = func(req *http.Request) {
		// 设置原始请求信息
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.URL.Path = target.Path
		req.URL.RawQuery = target.RawQuery
		req.Host = target.Host

		// 复制原始请求的头部
		for key, values := range c.Request.Header {
			for _, value := range values {
				req.Header.Set(key, value)
			}
		}

		// 添加额外的头部信息
		for key, value := range extraHeaders {
			req.Header.Set(key, value)
		}

		logger.Infof("代理请求 method=%s host=%s path=%s range=%s", req.Method, req.URL.Host, req.URL.Path, req.Header.Get("Range"))

		// 如果客户端没带 Authorization，但 URL 有 userinfo，就补上 BasicAuth
		if req.Header.Get("Authorization") == "" && hasUser {
			req.SetBasicAuth(uName, uPass)
		}

		// 设置请求方法
		req.Method = c.Request.Method

		// 如果有请求体，复制它
		if c.Request.Body != nil {
			bodyBytes, err := io.ReadAll(c.Request.Body)
			if err == nil {
				req.Body = io.NopCloser(bytes.NewReader(bodyBytes))
				req.ContentLength = int64(len(bodyBytes))
			}
		}
	}

	// 修改响应后的处理
	proxy.ModifyResponse = func(resp *http.Response) error {
		logger.Infof("代理响应 status=%s contentLength=%d", resp.Status, resp.ContentLength)
		// 可以在这里修改响应头部或内容
		return nil
	}

	// 处理错误 - 修复：避免重复写入响应头
	proxy.ErrorHandler = func(w http.ResponseWriter, req *http.Request, err error) {
		// 检查响应是否已经开始写入
		if c.Writer.Written() {
			logger.Debugf("代理错误，但响应已开始写入: %v", err)
			return
		}
		logger.Debugf("代理错误: %v", err)
		c.JSON(500, gin.H{"error": "Proxy error", "details": err.Error()})
	}

	// 执行代理
	proxy.ServeHTTP(c.Writer, c.Request)
}
