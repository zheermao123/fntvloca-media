# UI 2.0 Phase 2 — 验收记录（PHASE2_ACCEPTANCE）

日期：2026-11-14
分支：`feature/ui2-phase2`（未推送）
环境：Windows 10.0.26100 / Node 24 / Electron 38.0.0 / 真实用户媒体库（本机 17,000+ 条目、隐私密码已设置）

## 1. 命令验证

| 命令 | 结果 |
|---|---|
| `npm run compile` | exit 0（main/preload 未改动） |
| `npm test` | **241 / 241 通过**（Phase 1 217 → P2-01 222 → P2-02 227 → P2-03 233 → P2-04 234 → P2-05 238 → P2-06 241） |
| `npm run renderer:typecheck` | exit 0 |
| `npm run renderer:build` | exit 0（ui2-renderer 资产生成，生产 CSP `connect-src 'none'`、无内联样式） |

说明：本阶段未运行 `npm ci` —— 当前 Node 24 环境 Electron postinstall 解压存在已知静默中断问题（本地已手工修复 `node_modules/electron/dist`），clean install 会破坏该修复且不改变验收结论；CI（Node 22）负责 clean install 验证。

## 2. 功能验收（真实 IPC + 开发 React 壳，CDP 实测）

证据文件：`C:\Users\Administrator\AppData\Local\Temp\opencode\p207-result.json`

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
- 生产 CSP 保持 Phase 1 约束：`connect-src 'none'`、无 `unsafe-inline`/`unsafe-eval`、无远程资源；组件无内联 style。
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

## 7. 结论

Phase 2 全部阶段（P2-01 ~ P2-08）功能、命令与运行时验收 **通过**；默认 classic 行为未改变，React UI 可在开发/验证模式完整使用。Phase 2 分支未推送，等待用户确认后再决定合并/发布节奏。
