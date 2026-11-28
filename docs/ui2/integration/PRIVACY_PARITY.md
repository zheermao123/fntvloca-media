# 隐私模式功能恢复记录（React UI 2.0）

> 本文件记录 2026-11-15 v3.4.1–v3.4.3 的隐私恢复过程；相关隐私功能在 v3.5.7 中继续保留。当前正式发布记录见 `docs/ui2/release/RELEASES.md`。

日期：2026-11-15
分支：`feat/ui2-default`
版本：`3.4.1` 测试构建（不改变官方 v3.3.0 Release）

## 背景

UI 2.0 重写后，隐私模式入口与后端门禁保留，但旧 classic UI 的部分隐私模式功能没有迁移：
- 进入隐私模式后未自动显示隐私库；
- 隐私“继续观看”未展示；
- 隐私源添加/移除缺失；
- 已看/收藏操作缺失；
- 隐私态未隐藏公开分类与刮削。

本次在 React UI 内恢复这些功能，不将界面改回 classic。

## 旧版行为依据（classic）

- `resource/library/index.html`：隐私态隐藏 `#kindTabs/#scrapeBtn/#settingsBtn`；
- 隐私模式 `library:continue {private:true}` 展示继续观看；
- 隐私源管理支持添加私有源、移除、重扫；
- 详情支持标记已看/未看、收藏/取消收藏；
- 来源管理在隐私态保持可用（扫描也保留）。

## 新 UI 恢复内容

| 功能 | 新 UI 实现 |
|---|---|
| 进入隐私自动显示隐私库 | `/privacy` 路由；AppShell 自动跳转；Home 隐私态重定向 |
| 隐私继续观看 | `PrivacyLibraryPage` 调用 `fetchContinueWatching(true)` |
| 隐私目录 | `library:catalog {private:true}`，分页/排序/观看/收藏筛选、网格/列表 |
| 隐私模式导航 | 侧栏隐藏首页与公开分类，显示“隐私库”；保留媒体源/任务 |
| 隐藏刮削 | 隐私态任务页仅保留扫描，并显示“刮削不可用”说明 |
| 源添加/移除 | 媒体源页新增本地/WebDAV 添加（隐私态自动标记私有）、移除确认、添加后扫描 |
| 已看/收藏 | 详情页标记已看/未看、收藏/取消收藏；网格卡片收藏星标 |
| 搜索/详情/播放 | 隐私态继续保持 private 查询与门禁 |

## 不包含（非隐私模式原有功能）

- “重新刮削 / 手动匹配”：旧隐私模式本来就隐藏；新 UI 全局缺失，另行排期。

## 测试

- 全量 `npm test`：**277/277**。
- 隔离隐私 E2E（21 步）通过，覆盖：
  - 解锁后自动进入 `/privacy`；
  - 隐私库卡片；
  - 隐私源添加/移除（UI）；
  - 隐私态隐藏刮削、扫描可用；
  - 详情收藏/已看；
  - 搜索、锁定回退、历史后退、直达路由、重启、解锁中关闭；
  - 源测试/编辑与凭据脱敏。
- `renderer:typecheck` / `renderer:build` 通过。

## 数据安全

- 无数据库迁移、无新 IPC、无 preload 白名单变更。
- 安装前备份 `~/.fntv`；升级后核对源/条目/观看/收藏/隐私配置计数。

## 测试构建与安装验证（2026-11-15）

- 版本：`3.4.1`（React 默认 UI，测试构建，未改变官方 v3.3.0 Release）
- CI run：`43688541023`（Windows，`publish=false`）；shell smoke 验证 React 默认 + `FNTV_UI_SHELL=classic` 回退
- 产物：`FNMedia_3.4.1_win_x64.exe`，139,657,124 字节，SHA256 `1AA9052EB1902C711C15B3EF16B99E33D5984E6E394076AC62894D48D5C208CB`
- 已安装并在本机启动：版本 3.4.1；打包版回归（p207 12 步）通过，console errors 0
- 数据核对：`DATA_MATCH=true`（76 源 / 345 剧 / 11,598 条目 / 341 观看状态 / 7 收藏 / 64 季；隐私密码与 TMDB 配置保留）
- 安装前备份：`C:\Users\Administrator\.fntv-backup-20261115-151115-pre341`
- 说明：真实隐私密码解锁由用户本机输入；自动化隐私 E2E 使用隔离数据目录，不包含真实密码。
## 播放修复（3.4.2）

- 根因：preload 的 classic 播放按钮接管插件在 React 页面同样生效，拦截并阻止了 React 播放按钮 click，改用旧 `play-movie`，导致点击无反应。
- 修复：`playButton`/`playMaskButton` 在 React UI 页面（file:// ui2-renderer 或 dev 5273）禁用；classic 保持原行为。
- 验证：隔离 E2E 点击播放进入 React 处理器（按钮显示“已发起播放”）；开发日志确认走 `Library play event received itemId`，不再出现 `Play movie event received`。
## 3.4.2 安装与播放验证（2026-11-15）

- 版本：`3.4.2` 测试构建；CI run `43690561903`；产物 SHA256 `715C4C43DD343770F6A80C01517EB89D89BE24D0357B37D49A7CFBECA9EA5D2A`
- 打包版点击播放验证：React 详情页按钮显示“已发起播放…”，主进程走 `play-library-item`（短暂启动 MPV 后测试关闭）。
- 数据核对：源/剧/条目/观看状态/收藏/季 与升级前一致；隐私密码与 TMDB 配置保留。
- 安装前备份：`C:\Users\Administrator\.fntv-backup-20261115-153854-pre342`
## 3.4.3 视图偏好持久化

- 根因：媒体库排序/筛选/视图为组件局部 state，进入详情后组件卸载，返回时重置。
- 修复：新增 `LibraryPreferencesProvider`，公共库与隐私库共享应用级偏好；路由切换/播放返回后保持。
- E2E：隐私库选择“标题”排序 → 打开详情 → 返回，工具栏仍显示“排序：标题”。
## 3.4.3 安装验证

- CI run `43692691912`；产物 `FNMedia_3.4.3_win_x64.exe`，SHA256 `AABE92454F6925012F2BFC26D101231948BB379EC8A0BB152494BD2DE0D227F4`
- 打包版实测：媒体库选择“标题”排序 + 列表视图 → 打开详情 → 返回，排序与视图仍保持。
- 数据核对：源/剧/条目/收藏/季未丢失；观看状态因播放验证新增进度（341→344）。
- 安装前备份：`C:\Users\Administrator\.fntv-backup-20261115-160736-pre343`