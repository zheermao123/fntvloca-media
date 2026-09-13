package api

import (
	"proxy/pkg/fnapi"
	"proxy/pkg/logger"

	"github.com/gin-gonic/gin"
)

func GetSkipInfoHandler(c *gin.Context, sessions *PlaybackSessionStore, skipStore *LocalSkipStore) {
	// 解析参数
	var params GetSkipInfoParams
	if err := c.ShouldBindUri(&params); err != nil {
		logger.Errorf("解析参数失败: %v", err)
		c.JSON(400, ResponseBase{Code: InternalErrorCode, Msg: "Invalid parameters"})
		return
	}

	if err := c.ShouldBindQuery(&params); err != nil {
		logger.Errorf("解析参数失败: %v", err)
		c.JSON(400, ResponseBase{Code: InternalErrorCode, Msg: "Invalid parameters"})
		return
	}

	if params.Session == "" || params.ItemGuid == "" {
		logger.Errorf("缺少必要参数: sessionPresent=%t, itemGuid=%s", params.Session != "", params.ItemGuid)
		c.JSON(400, ResponseBase{Code: InternalErrorCode, Msg: "Missing required parameters"})
		return
	}

	session, err := sessions.Resolve(params.Session, params.ItemGuid)
	if err != nil {
		c.JSON(401, ResponseBase{Code: InternalErrorCode, Msg: "Invalid playback session"})
		return
	}

	// 直接播放目标（本地文件/直连URL）使用本地跳过信息存储
	if target, ok := session.Targets[params.ItemGuid]; ok {
		key := params.ItemGuid
		if target.SkipKey != "" {
			key = target.SkipKey
		}
		skipInfo := &SkipInfo{}
		if entry, found := skipStore.Get(key); found {
			skipInfo.SkipStart = entry.SkipStart
			skipInfo.SkipEnd = entry.SkipEnd
		}
		c.JSON(200, GetSkipInfoResp{
			ResponseBase: ResponseBase{Code: 0, Msg: "success"},
			Data:         skipInfo,
		})
		return
	}

	fnApi := fnapi.NewApiService(session.Domain, session.Token, session.SkipVerify, session.AccessCookie)

	// 获取跳过片头片尾信息
	logger.Infof("开始获取跳过片头片尾信息: itemGuid=%s", params.ItemGuid)
	resp, err := fnApi.GetPlayInfo(params.ItemGuid)
	if err != nil || !resp.Success {
		logger.Errorf("获取跳过片头片尾信息失败: %v", err)
		c.JSON(500, ResponseBase{Code: InternalErrorCode, Msg: "Failed to get skip info"})
		return
	}

	playInfo := resp.Data

	skipInfo := &SkipInfo{}
	if playInfo.PlayConfig.SkipOpening != nil {
		skipInfo.SkipStart = *playInfo.PlayConfig.SkipOpening
	}

	if playInfo.PlayConfig.SkipEnding != nil {
		skipInfo.SkipEnd = *playInfo.PlayConfig.SkipEnding
	}

	c.JSON(200, GetSkipInfoResp{
		ResponseBase: ResponseBase{
			Code: 0,
			Msg:  "success",
		},
		Data: skipInfo,
	})
}

func SetSkipInfoHandler(c *gin.Context, sessions *PlaybackSessionStore, skipStore *LocalSkipStore) {
	// 解析参数
	var req SetSkipInfoReq
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Errorf("解析请求体失败: %v", err)
		c.JSON(400, ResponseBase{Code: InternalErrorCode, Msg: "Invalid request body"})
		return
	}

	if err := c.ShouldBindQuery(&req); err != nil {
		logger.Errorf("解析请求体失败: %v", err)
		c.JSON(400, ResponseBase{Code: InternalErrorCode, Msg: "Invalid request body"})
		return
	}

	if req.Session == "" || req.Guid == "" {
		logger.Errorf("缺少必要参数: sessionPresent=%t, guid=%s", req.Session != "", req.Guid)
		c.JSON(400, ResponseBase{Code: InternalErrorCode, Msg: "Missing required parameters"})
		return
	}

	session, err := sessions.Resolve(req.Session, req.Guid)
	if err != nil {
		c.JSON(401, ResponseBase{Code: InternalErrorCode, Msg: "Invalid playback session"})
		return
	}

	// 直接播放目标（本地文件/直连URL）写入本地跳过信息存储
	if target, ok := session.Targets[req.Guid]; ok {
		key := req.Guid
		if target.SkipKey != "" {
			key = target.SkipKey
		}
		if err := skipStore.Set(key, req.SkipStart, req.SkipEnd); err != nil {
			logger.Errorf("写入本地跳过信息失败: %v", err)
			c.JSON(500, ResponseBase{Code: InternalErrorCode, Msg: "Failed to set skip info"})
			return
		}
		logger.Infof("已保存本地跳过信息: key=%s, skipStart=%d, skipEnd=%d", key, req.SkipStart, req.SkipEnd)
		c.JSON(200, ResponseBase{Code: 0, Msg: "success"})
		return
	}

	fnApi := fnapi.NewApiService(session.Domain, session.Token, session.SkipVerify, session.AccessCookie)

	// 获取播放信息缓存
	playInfo, err := fnApi.GetPlayInfoCached(req.Guid)
	if err != nil || !playInfo.Success {
		logger.Errorf("获取播放信息缓存失败: %v", err)
		c.JSON(500, ResponseBase{Code: InternalErrorCode, Msg: "Failed to get play info cache"})
		return
	}

	parentGuid := playInfo.Data.ParentGUID

	// 设置跳过片头片尾信息
	logger.Infof("开始设置跳过片头片尾信息: parentGuid=%s, skipStart=%d, skipEnd=%d", parentGuid, req.SkipStart, req.SkipEnd)
	err = fnApi.SetSkipInfo(parentGuid, req.SkipStart, req.SkipEnd)
	if err != nil {
		logger.Errorf("设置跳过片头片尾信息失败: %v", err)
		c.JSON(500, ResponseBase{Code: InternalErrorCode, Msg: "Failed to set skip info"})
		return
	}
	c.JSON(200, ResponseBase{Code: 0, Msg: "success"})
}
