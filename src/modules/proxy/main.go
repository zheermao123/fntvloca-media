package main

import (
	"bufio"
	"os"
	"proxy/internal/logic"
	"proxy/pkg/logger"
	"strings"
)

func main() {
	logger.SetLevel(logger.INFO)
	logger.SetColor(false)

	secret, readErr := bufio.NewReader(os.Stdin).ReadString('\n')
	secret = strings.TrimSpace(secret)
	if readErr != nil {
		panic("启动服务器失败: 无法读取代理认证密钥")
	}
	if secret == "" {
		panic("启动服务器失败: 缺少代理认证密钥")
	}
	err := logic.RunApiServer("127.0.0.1:22345", secret)
	if err != nil {
		panic("启动服务器失败: " + err.Error())
	}
}
