# UI 2.0 Phase 2 — 验收记录（PHASE2_ACCEPTANCE）

日期：2026-11-14
分支：`feature/ui2-phase2`（未推送）
环境：Windows 10.0.26100 / Node 24 / Electron 38.0.0 / 真实用户媒体库（本机 17,000+ 条目、隐私密码已设置）

## 1. 命令验证

| 命令 | 结果 |
|---|---|
| `npm run compile` | exit 0（main/preload 未改动） |
| `npm test` | **243 / 243 通过**（Phase 1 217 → P2-01 222 → P2-02 227 → P2-03 233 → P2-04 234 → P2-05 238 → P2-06 241 → 复审修复 +2：开发 CSP 回归测试） |
| `npm run renderer:typecheck` | exit 0 |
| `npm run renderer:build` | exit 0（ui2-renderer 资产生成，生产 CSP `connect-src 'none'`、无内联样式） |

说明：本阶段未运行 `npm ci` —— 当前 Node 24 环境 Electron postinstall 解压存在已知静默中断问题（本地已手工修复 `node_modules/electron/dist`），clean install 会破坏该修复且不改变验收结论；CI（Node 22）负责 clean install 验证。

## 2. 功能验收（真实 IPC + 开发 React 壳，CDP 实测）

证据文件：`phase2-evidence\p207-result.json`（file:// 构建，含样式断言）；`p207-dev-result.json`（开发 React 壳，修复后）

| 页面/能力 | 结果 | 证据 |
|---|---|---|
| App Shell | 通过 | 侧边栏/品牌/版本号渲染，console errors 0 |
| 媒体库-电影 `/library/movies` | 通过 | 41 张真实卡片、标题「电影」、计数“41 部 / 53”式展示；截图 `ui2-p207-library.png` |
| 电影详情 `/media/:id` | 通过 | 「黑客帝国4：矩阵重启」标题、年份/类型/清晰度/时长/评分、文件信息、简介、播放按钮；截图 `ui2-p207-detail.png` |
| 媒体库-剧集 `/library/tv` | 通过 | 40 张卡片，含季路由 `?season=2`；截图 `ui2-p207-tv.png` |
| 季详情 `/media/:show?season=N` | 通过 | 「半泽直树2 … 第 2 季」、9 集列表（S02E01…）、续播按钮与真实观看状态；截图 `ui2-p207-season-detail.png` |
| 全局搜索（Ctrl/Cmd+K） | 通过 | 标题搜索“黑”→ 8 条真实结果、提示文案如实（仅标题、上限 50）；截图 `ui2-p207-search.png` |
| 媒体源 `/sources` | 通过 | 6 个真实源、类型标签/路径（`D:\【电影】`）/上次扫描时间/条目数/重新扫描按钮；截图 `ui2-p207-sources.png` |
| 任务状态 `/tasks` | 通过 | 扫描与 TMDB 刮削两张任务卡、刮削状态真实读取、扫描无实时进度的限制如实标注；截图 `ui2-p207-tasks.png` |
| 隐私门禁 | 通过 | 隐私入口 → 密码输入弹窗（既有 privacy-begin/unlock 链路）；截图 `ui2-p207-privacy.png` |
| Console | 通过 | 全流程 `Runtime.consoleAPICalled(type=error)` / `Runtime.exceptionThrown` = 0 |

## 2.1 复审修复：开发模式截图无样式（2026-11-14）

### 现象

- 开发 React 壳（Vite dev URL）的截图只有浏览器默认样式：默认蓝链接、无布局；file:// 构建截图样式正常。
- 功能检查（DOM 选择器/文本）仍全部通过，因为功能断言不校验 CSS。

### 根因

- 开发 CSP 为 `style-src 'self'`；Vite 开发模式通过 `@vite/client updateStyle` 以**内联 <style>** 注入 CSS，被 CSP 拒绝（6 个 style 标签存在但 `document.styleSheets` 为空）。
- 生产/file:// 构建使用外链 CSS（`<link rel=stylesheet>`），`style-src 'self'` 允许，因此样式正常。
- 原门禁只监听 `Runtime.consoleAPICalled`/异常，CSP 拒绝日志在 `Log.entryAdded`（source=security），所以出现“Console errors 0 但页面无样式”的假通过。

### 修复与验证

- 仅开发 CSP 增加 `style-src 'self' 'unsafe-inline'`（`vite.config.ts`）；生产 CSP 保持 `style-src 'self'`，新增 `tests/ui2DevCsp.test.cjs` 防回归。
- 开发模式复测：240 条 CSS 规则生效、body 背景 `rgb(245, 245, 247)`、0 条 CSP 拒绝。
- 验收脚本新增样式断言（styleSheets 规则数、body 背景、链接颜色）并采集 Log 安全域；canonical 截图改用 file:// 构建（样式+海报完整）：`phase2-evidence\ui2-p207-*.png`；开发模式修复后截图：`ui2-p207-dev-*.png`。

### 已知限制（非本次回归）

- 开发 dev URL 为 http 源，Chrome 禁止加载 `file://` 海报缓存，故开发模式截图仅有占位图；验收以 file:// 构建为准。
- file:// React 冒烟中 preload 标题栏插件注入内联样式会被生产 CSP 拒绝（6 条，记录为 `titlebarStyleViolations`）；该插件为既有机制、按约束未修改，且打包版始终 classic、React 不启用，不影响用户。

## 3. 生产/打包验收

| 项 | 结果 | 证据 |
|---|---|---|
| file:// 加载 React 构建（dev 非 Vite 模式） | 通过 | `file:///E:/fntv-electron-release/ui2-renderer/index.html#/home` 启动，电影页 12 张卡片，console errors 0；`p207-react-result.json`、截图 `ui2-p207-file-library.png` |
| 默认 classic（未设置 `FNTV_UI_SHELL`） | 通过 | `#titlebar` 存在、无 `.app-shell-root`、标题「媒体库 v3.2.9」；`p207-classic-result.json` |
| electron-builder `--win --dir` 打包 | 通过 | asar 内含 `ui2-renderer/index.html` + 2 个资产；`release/win-unpacked` 生成 |
| 打包产物运行 | 通过 | 打包 exe 从 asar 加载 classic，标题「媒体库 v3.2.9」、窗控正常 |
| 打包默认壳层 | 通过 | `resolveUiShell` 对 `isPackaged=true` 始终返回 classic（普通用户零变化） |

## 4. 隐私与安全

- 隐私门禁在 main 侧执行；React 仅通过既有 `library:privacy-*` 接线状态，隐私目录查询带 `private` 标记。
- 媒体源页隐私模式地址显示「已隐藏（隐私模式）」；WebDAV URL 凭据脱敏（`user:pass@` 剥离，单测覆盖）。
- 生产 CSP 保持 Phase 1 约束：`connect-src 'none'`、无 `unsafe-inline`/`unsafe-eval`、无远程资源；组件无内联 style。仅开发 CSP 为兼容 Vite 样式注入放行 `style-src 'unsafe-inline'`（生产构建已验证不含该例外）。
- 无新增 IPC、无 preload 白名单变更、无主进程业务行为变更。

## 5. 已知缺口（按 P2-00 基线如实保留）

- G1 分类计数依赖 4 次 catalog 查询（上限 600 条时标记“可能不完整”）；无计数专用接口。
- G2 扫描无实时进度/状态查询接口：任务页仅提供触发 + 完成汇总，明确标注该限制。
- G3 `play-library-item` 无结果回包：按钮仅显示短暂“已发起播放…”，不展示成功状态。
- G4 搜索仅标题（含剧集名），不支持文件名；面板文案已注明。
- G5 详情页同电影多版本未提供切换（接口有 versions，但不在本阶段范围）。
- G6 扫描/刮削触发沿用既有通道，仅本机验证；无 mock/测试数据。
- G7 未引入组件级 DOM 测试设施（采用 renderer 纯函数测试编译方案，241 项全绿）。

## 6. 与计划的偏差（已记录）

- 服务层目录保留在 `src/renderer/services/`（计划示例为 `src/services/`）；功能等价，不搬迁以降低风险。
- P2-02 未创建 WindowControls/MacTrafficLights（复用 preload 注入标题栏，已批准）。
- 搜索实现为全局弹层（Dialog）而非独立路由页；满足全局搜索与结果跳详情要求。
- 验收使用开发版 Electron 与真实用户库；打包 smoke 使用 `--dir` + 本地 electronDist（CI 负责 NSIS 全量构建）。
- 开发模式截图初检未校验 CSS（见 2.1），复审后已补样式断言并将 canonical 截图切换为 file:// 构建。

## 7. 结论

Phase 2 全部阶段（P2-01 ~ P2-08）功能、命令与运行时验收 **通过**；默认 classic 行为未改变，React UI 可在开发/验证模式完整使用。Phase 2 分支未推送，等待用户确认后再决定合并/发布节奏。

## 8. 发布前审查（2026-11-14）

### 1) CSP 检查

- `git diff ui2-integration...HEAD -- vite.config.ts`：`unsafe-inline` 仅出现在 `DEVELOPMENT_CSP` 的 `style-src`；`PRODUCTION_CSP` 保持 `style-src 'self'`。
- `ui2-renderer/index.html`（生产构建）无 `unsafe-inline` / `unsafe-eval` / localhost / ws。
- `tests/ui2DevCsp.test.cjs` 持续断言生产 CSP 严格性。

### 2) 隐私切换 / 路由 / 异步状态

- 隐私退出：关闭搜索并跳转 `/home`（AppShell），避免退出后残留私有详情页；解锁/退出增加 busy 防重入与桥接不可用提示。
- 媒体库/首页/详情/搜索：请求序号或 `cancelled` 标记丢弃过期响应，避免快速切换分类/路由/关键词时旧结果覆盖新状态。
- 媒体源/任务页加载同样带请求序号与存活标记。

### 3) 监听清理

- 新增可取消的 `onceReplyCancellable`（取消时 `off` 监听并 reject `IPC_CANCELLED`）。
- 扫描/刮削长等待支持 `AbortSignal`；离开页面或组件卸载时 abort 并清理进度订阅。
- 扫描/刮削增加 in-flight 同步锁，防止重复点击产生并行等待与重复订阅。

### 4) 干净环境安装与测试

- 临时干净目录（无 node_modules/.git/.npmrc）执行 `npm ci` 成功；`npm test` **249 / 249 通过**。
- 说明：本机 Node 24 的 Electron postinstall 静默失败为已知环境问题，已用本地缓存补齐 Electron 运行时；CI（Node 22）执行真实全新安装。

### 5) CI 构建与安装验证

- 首次 CI（run 43597938525）失败：`npm ci --omit=optional` 排除了 Vite 8/rolldown 的 `@rolldown/binding-win32-x64-msvc`；已修复 CI 安装参数（commit `71da62e`），PR CI 同步修正。
- 复跑 CI（run 43598158857，SHA `71da62e`）Windows 构建成功；Release 任务按 workflow_dispatch 条件跳过（未创建 Release）。
- 产物：`FNMedia_3.2.9_win_x64.exe`（139,650,813 字节）。
- 实际安装后验证：标题「媒体库 v3.2.9」、`#titlebar` 存在、无 `.app-shell-root`（classic 默认）。
- 回退验证：打包环境设置 `FNTV_UI_SHELL=react` + dev URL 后仍加载 classic（`resolveUiShell` 对 packaged 强制 classic）。
- 安装包 `app.asar` 内含 `ui2-renderer`（index.html + JS/CSS 资产，5 条目），资源随包分发但不影响默认壳层。
## 9. 发布准入阻塞项修复（2026-11-14）

### 隐式发布风险

- 所有 electron-builder 打包脚本显式追加 `--publish never`（win/mac/linux x64/arm64）。
- CI 构建步骤仍由独立 Release Job 统一负责发布；本次 workflow_dispatch 的 Release Job 保持 skipped。

### CI 安装冒烟

- release.yml 新增 Windows 步骤：静默安装 CI 产物 → 启动 → CDP 校验 URL 为 `app.asar/resource/library/index.html` 且标题含「媒体库」→ 关闭。
- 同时验证回退：设置 `FNTV_UI_SHELL=react` + dev URL 后，打包版仍加载 classic。
- run `43601112843`（SHA `952e99b`）成功，日志确认：
  - `[default] classic smoke OK: 媒体库 v3.2.9`
  - `[packaged-fallback] classic smoke OK: 媒体库 v3.2.9`
- 本机再次安装该 CI 产物验证：标题「媒体库 v3.2.9」、`#titlebar` 存在、无 React 根节点。

### 扫描重复触发

- 主进程 `runScan` 改为 `createSingleFlight` 守卫：扫描期间再次触发立即返回「已有扫描任务在进行中」，异常/完成后释放；不再依赖渲染层状态。
- 新增 `tests/libraryScanGuard.test.cjs`（并发拒绝/完成释放/异常释放）与生命周期契约断言。

### 隐私真实密码端到端

- 新增仅开发态生效的 `FNTV_USER_DATA_DIR` 覆盖（打包版忽略），E2E 使用隔离数据目录，不触碰真实 `~/.fntv`。
- 新增 `scripts/ui2-privacy-e2e.cjs`：真实打开密码弹窗 → 错误密码被拒 → 正确密码解锁 → 隐私库 → 退出自动回首页 → 公开视图恢复。
- 结果：7 个步骤全部通过；证据 `privacy-e2e-result.json`、`ui2-privacy-e2e.png`。
- 新增 `tests/privacyPassword.test.cjs`：scrypt 哈希校验、错误/畸形哈希、加盐唯一性、内存解锁状态。

### 汇总

- `npm test` **256 / 256 通过**；compile / renderer:typecheck / renderer:build 全绿。
- 注意：Phase 2 仍未启用 React 为默认 UI，未打 tag、未创建 Release。
