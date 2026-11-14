# FN Media UI 2.0 — OpenCode Phase 1 执行提示词

> 适用环境：在 `fntvloca-media` 仓库根目录打开 OpenCode 后使用。  
> 前置文件：`FN_Media_UI2_v1_3_Spec.md`、`FN_Media_UI2_Phase1_Implementation_Plan_v1.0.md`、`FN_Media_UI2_v1_3_Decision_Register.md`。

---

## 1. 总控提示词（先执行，只做基线和计划确认）

```text
你正在维护 FN Media 项目，执行工具是 OpenCode。不要使用 Codex 专属流程或提示词格式。

开始前请读取并遵循：
1. 仓库根目录 AGENTS.md；
2. .trellis/ 下与开发流程、任务拆解和交付有关的规范；
3. .agents/skills/ 中和 TypeScript、Electron、测试、构建相关的技能，并确认当前 OpenCode 是否会自动发现这些技能；
4. 以下 UI 2.0 文件：
   - FN_Media_UI2_v1_3_Spec.md
   - FN_Media_UI2_Phase1_Implementation_Plan_v1.0.md
   - FN_Media_UI2_v1_3_Decision_Register.md

如果文档不在仓库根目录，请先用文件搜索定位；不要假设路径。如果根目录 AGENTS.md 已存在，不要覆盖，不要运行 /init 重写它。不要修改全局 ~/.config/opencode 配置，不要未经确认创建 opencode.json 或新的 agent/skill/plugin。

本次批准范围：B1 媒体源连接测试、B2 编辑媒体源、B3 最近播放历史均已由产品负责人明确批准，必须按 Phase 1 计划实现；不得继续把它们标记成待审批。但不能扩大到 B4 source enabled、数据库 schema、其他新协议或其它未批准能力。

第一步只做只读基线核对：
- git status --short / git branch / git rev-parse HEAD / git log -1；
- 读取 package.json、tsconfig、builder files、release workflow、.gitignore；
- 读取 src/preload/index.ts、src/main/common/mainwin.ts、src/main/common/winctrl.ts、现有 library IPC handler、store、WebDAV helper、source types、credential encrypt/decrypt helper；
- 查找 tests/rendererIsolation.test.cjs 和所有现有 Node tests；
- 使用 rg 确认 library:set-source-category、library:source-updated、library:scrape-status-info 的真实发送方/接收方；
- 运行现有 npm run compile 和 npm test，记录结果；
- 记录当前仓库 HEAD SHA、工作树脏文件与真实 handler 文件路径。

输出 docs/ui2/phase1/BASELINE.md，并列出任何与实施计划不同的实际情况。不得修改生产代码，不得 reset、clean、stash、commit 或 push。若有未提交修改，先保护它们并明确指出。

完成后停止，向用户报告：基线、测试结果、文件路径映射、计划冲突与下一批任务建议。不要提前开始 React 编码。
```

## 2. P1-01 + P1-02：React/Vite 基础设施

```text
基线已审查通过。现在只执行 Phase 1 计划 P1-01 和 P1-02：隔离 renderer TypeScript 配置，安装 React/Vite 依赖，建立最小 React scaffold 和 Vite production build。

必须遵守：
- main/preload 继续使用现有 tsc -> dest；
- React 源码独立放在 src/renderer（若项目已有惯例，先说明再采用）；
- Vite production 输出到根目录 ui2-renderer/，不要输出到 dest/，不要覆盖 resource/library；
- base 必须支持 file:// 相对路径；
- 不要实现完整页面，不要接真实业务 API；
- 不要升级 Electron major，不要顺便升级无关依赖；
- 只更新仓库当前实际跟踪的 lockfile；
- package.json 和配置只做最小修改。

验收：npm run compile 仍通过；renderer 独立 typecheck 通过；npm run renderer:build 产生 ui2-renderer/index.html 和所有资源；不引用 CDN；production HTML 无 inline script 和 script-src unsafe-inline。

结束后更新 IMPLEMENTATION_LOG.md，列出修改文件、依赖版本、命令和结果。停止等待下一批任务。
```

## 3. P1-03 + P1-04：开发启动和 shell fallback

```text
执行 Phase 1 计划 P1-03 和 P1-04。先读当前 winctrl、preferences、main startup、proxy build scripts，确定不会破坏已有启动流程。

目标：新增 start:ui2，启动固定 loopback Vite server，等待 server ready 后启动 Electron；Electron 退出时关闭 Vite 子进程。新增 uiShell classic/react 解析；缺省 classic；开发环境可以用显式环境变量强制 react；React 文件缺失或加载失败时只回退一次到 resource/library/index.html。

禁止：
- 改变 macOS traffic lights、Windows/Linux frameless、窗口生命周期；
- 改变 sandbox:false、contextIsolation:true、nodeIntegration:false；
- 改变 login、play-movie、remote fnOS URL、preload plugin 的生命周期；
- 将 uiShell 放入只管理登录 token/cookie 的 secret config，除非读取代码后确认它就是通用偏好存储；
- 改普通用户缺省为 react。

验收：classic、react、react 资源缺失回退三条路径有自动化或手动证据；旧 npm start 兼容行为未无故改变；子进程可清理。
```

## 4. P1-05：preload allowlist 与开发源安全

```text
执行 Phase 1 计划 P1-05。先读 preload 当前 API、所有 SEND/RECEIVE channel、旧 UI 使用方和 tests/rendererIsolation.test.cjs。

当前关键问题：preload 当前只在 file: 页面 expose electronAPI，而 Vite dev server 是 loopback http 页面；必须添加显式、精确、仅开发态的 origin allowlist。仅允许配置的 localhost/127.0.0.1 + 精确端口；不得允许任意 HTTP、HTTPS、局域网或远程页面。

核实已知白名单缺口（发送方均已在决策登记表 P2 核实，登记并复核即可）：
- library:set-source-category（SEND，handler 见 library.ts:306）；
- library:source-updated（RECEIVE，发送方 library.ts:318）；
- library:scrape-status-info（RECEIVE，发送方 library.ts:650-652，当前死通道转正供 React 轮询）。

随后登记 B1/B2/B3 channels。不要暴露 ipcRenderer 本体，不要放宽为任意 channel。更新隔离测试，覆盖 file、精确 dev origin、错误端口、远程 origin。加入 renderer TypeScript bridge 类型和 listener off 清理。

验收：node --test tests/*.test.cjs 通过；所有真实 channel pair 均在 allowlist；无不存在/未使用 channel 被盲目加入；远程 renderer 无本地桥接 API。
```

## 5. P1-06：B1 媒体源连接测试

```text
B1 已获批准。实现 library:test-source 请求和 library:test-source-result 响应。先核对 SourceConfig/NewSource 的真实字段，不要重新设计数据库结构。

saved target：main 按 sourceId 取 store.getSource 并在 main 使用现有解密 helper；draft target：新建/编辑表单的临时信息仅随请求传给 main，不保存、不记录、不回显密码。

本地和 SMB：按现有路径语义 fs.stat，并确认是目录。SMB 不引入新客户端库或认证协议。WebDAV：复用现有 webdav.ts 的 PROPFIND 解析/认证/timeout，做单次 root probe（优先 Depth:0），不要调用全量递归 scanWebdavFolder。

返回有限枚举状态、耗时和脱敏用户消息；不得返回 stack、password、Authorization header、带 userinfo URL 或完整凭据。用 requestId 回传至发起的 event.sender。

测试 local success/not found/not directory/permission、WebDAV 207/401/403/404/timeout/network error/invalid URL、临时密码不落日志、saved 与 draft 两种请求。不得执行真实外网请求作为单元测试。
```

## 6. P1-07：B2 编辑媒体源

```text
B2 已获批准。新增 library:update-source 请求和安全结果响应；优先按原来的 channel 命名复用 library:source-updated，但必须先核对旧事件语义。如果旧 event payload 不兼容，新增 library:update-source-result；不得破坏旧 UI listener。

实现时从 store.getSource(sourceId) 取 currentSource，严格校验 patch 字段，以 current + patch 合并后调用已有 store.updateSource。sourceId 不可修改，source type 默认不可修改。WebDAV 凭据使用显式 keep/replace/clear 三态：空 password 默认 keep，replace 在 main 使用现有加密 helper，clear 只有实际数据模型支持才允许。response 不回传明文或密文。

同时覆盖 SQLite store 和 JSON fallback store；不改 schema、不加 enabled 字段。测试 source not found、非法字段、正常编辑、密码 keep/replace/clear、落盘无明文、失败不部分更新。
```

## 7. P1-08：B3 最近播放历史

```text
B3 已获批准。将现有 store.listHistory(limit) 暴露为 library:history -> library:history-info（通道名以决策登记表 §2 为准）。先检查 WatchedEntry 的真实字段、排序和当前存储实现。不要重新实现播放历史逻辑。

limit 默认 20、最大 50、最小 1，并在 main 端校验/夹紧（与规格 §0.5 契约一致）。将 WatchedEntry 投影成只含 renderer 所需字段的 HistoryItemViewModel；不得回传凭据、密文或不必要绝对路径。空历史是成功的空数组。无数据库 schema 变化、无 offset/分页扩展。

用 requestId 关联结果，错误返回安全错误码。测试排序、空数组、limit 边界、DTO 白名单、无内部路径泄露。
```

## 8. P1-09 + P1-10：CSP、打包和 CI

```text
完成 React production HTML CSP 和 electron-builder/build/CI 闭环。

production CSP：default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' file: data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'。真实 file:// 环境验证本地缓存图片和 bundle。不要为了样式方便全局加入 unsafe-inline。

dev-only CSP 可对固定 127.0.0.1:port 和 HMR websocket 开最小例外，production build 必须无 localhost、ws、unsafe-inline、unsafe-eval。

Vite 输出为 ui2-renderer/，electron-builder.files 显式加入 ui2-renderer；同时保留 dest/build/resource/login/resource/library/resource/mpv-overlay。更新 .gitignore，让生成目录不进 Git。所有本地平台 build scripts 在 electron-builder 前都要生成 renderer bundle。更新 release.yml：保留 Node 22、Go 1.24、MPV config 下载顺序和平台 matrix；增加 npm test；确保 Windows/macOS/Linux build entry 都执行 renderer build。

验收：每个平台的 builder config 能打包 ui2-renderer/index.html；安装包同时包含 classic resource/library 和 login/mpv-overlay；实际解包检查 app.asar/资源；当前平台实际安装包启动，另两平台由 CI 构建验证。不要改第三方资源下载和签名配置。
```

## 9. P1-11：回归与交付

```text
执行 Phase 1 计划 P1-11。运行 compile、npm test、renderer typecheck、renderer build、当前平台 package build；检查打包内容并做 classic/react/fallback 三条启动测试。按计划验证原登录、privacy mode、窗口控件、添加源、扫描、刮削、播放、MPV 字幕/弹幕/跳过片头、观看进度、托盘、更新和代理路径。

新增/更新：BASELINE.md、IMPLEMENTATION_LOG.md、TEST_REPORT.md、ROLLBACK.md。报告真实 HEAD SHA、工作分支、变更文件、每条命令状态、当前平台手测和 CI links。不要 commit/push/release；不要更改 uiShell 普通用户默认值 classic。

有任何未通过项就列明 blocker 和复现步骤，不得通过删除测试或省略验证宣告完成。
```

---

## 10. OpenCode 运行方式建议

1. 在项目根目录打开 OpenCode，确认根 `AGENTS.md` 已被加载。
2. 把本文件与 Phase 1 实施计划放进 OpenCode 能直接读取的项目文件夹（建议 `docs/ui2/`），在主会话中明确引用完整路径。
3. 先运行“总控提示词”完成只读基线，不要一次性把所有 P1-* 子提示词并行发出。
4. 每个子任务完成后检查 git diff、测试和文件列表，再进入下一个。
5. OpenCode 若使用子 agent，只分配审计/测试阅读等互不写同一文件的任务；共享文件改动顺序串行。
6. 任何与用户本地 AGENTS/Trellis 规范的冲突都先报告，不自行覆盖。
