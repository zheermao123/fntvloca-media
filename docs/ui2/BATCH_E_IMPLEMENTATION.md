# UI 2.0 批次 E 实施记录

- 基线：3.5.2 @ `952e4bc`
- 目标/实际版本：3.5.3
- 来源：首页数据错误反馈 + 方案 A（仅移除首页继续观看）

## 首页结构

顺序：欢迎语 → 分类统计卡片 → 分类快捷入口 → 最近播放 → 最近入库。

- `HomePage.tsx` 将 `LibraryOverview` 提到 `CategoryQuickLinks` 之前。
- 首页删除“继续观看”区块；侧栏 `/continue` 与独立页保留，隐私库继续观看保留。
- `HomeOverview` 移除 `continueWatching`；`fetchHomeOverview` 不再请求 continue。
- `HomeHeader` 提示语更新为“最近播放/最近入库”。

## 数据正确性修复

根因：`fetchHomeOverview` 并发发起四个 `library:catalog` 请求，共用 `library:catalog-info` 通道；`onceReply` 无 requestId 过滤，首个回包同时唤醒全部监听器，残留回包被“最近入库”消费。

修复：

- `library:catalog` 接收并回显 `requestId`（成功、隐私锁定、异常分支）。
- `src/renderer/app/bridge.ts` 新增 `onceReplyMatching`：使用 `on/off`，只接受匹配回包，超时清理。
- `queryCatalogPage` 生成唯一 requestId 并按 requestId 等待；旧请求的回包不会影响新请求。
- classic UI / 无 requestId 的旧调用保持兼容。

## 验证

- `npm test`：288/288（新增并发回包测试）。
- `npm run renderer:typecheck`：通过。
- `npm run renderer:build`：通过。
- 源码 Electron 冒烟：
  - 首页子区块顺序为 `home-header → stats-grid → home-chips → 最近播放 → 最近入库`；
  - 分类计数不再全相同（实测 41 / 40 / 30 / 0，其他视频为 0 因公开源无内容）；
  - 最近入库 12 条；
  - 首页无“继续观看”，无运行时异常。

## 交付

- CI：run `44884057131` 成功；`FNMedia_3.5.3_win_x64.exe` 139,662,769 字节，SHA256 `78922C7F66CF037F923CBD0092A8340500D686BE90A60E7ABA515F06B9290463`。
- 已安装 3.5.3（Installer exit 0，文件版本 3.5.3）；安装前备份 `C:\Users\Administrator\.fntv-backup-20261121-162135-pre353`。
- 打包版首页实测与源码一致：顺序 `home-header → stats-grid → home-chips → 最近播放 → 最近入库`；分类计数 41 / 40 / 30 / 0；最近入库 12 条；无“继续观看”；无运行时异常。
- 无数据库 schema、IPC 白名单或用户数据结构变更；回滚按提交 revert，不涉及数据迁移。
