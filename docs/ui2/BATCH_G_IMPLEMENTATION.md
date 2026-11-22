# 批次 G：显式 SxxE00 归组修复

- 版本：3.5.6
- 触发：全部媒体中的独立卡片 `Hanzawa Naoki`（S02E00）
- 根因：`resolveFolderEpisodeContext` 将 `episode < 1` 直接判为无效，导致 `S02E00` 丢失目录上下文，回退为文件名剧名并单独分组。

## 改动

- `src/modules/library/episodeContext.ts`
  - 新增 `EXPLICIT_ZERO_EPISODE`（显式 `SxxE00`）。
  - 仅当集号为 0 且文件名显式包含 `SxxE00` 时，允许继续使用目录上下文。
  - 保留普通非显式 `00` 无效；保留 Specials/特别版第 0 季规则。
- `tests/libraryEpisodeContext.test.cjs`
  - 新增 `Season 2 / Show.S02E00` 应归入第 2 季第 0 集。
  - 新增普通 `Show.00.mkv` 仍返回 null。

## 数据修复与验证

- 重新扫描受影响的「日剧」源：
  - `S02E00` 从独立 `Hanzawa Naoki` 移动到 `半泽直树2 1080P` 第 2 季；
  - 旧空剧集分组不再显示；
  - 「半泽直树2 1080P」由全 10 集变为全 11 集；
  - 全部媒体卡片由 112 变为 111；
  - 文件、观看记录、收藏未删除。
- `npm test`：291/291。
- 打包版 CI/安装验证待补充。

## 展示

- 详情剧集列表中该集显示 `S02E00`，播放目标仍是原文件。
- 不伪造为第 1 集。
