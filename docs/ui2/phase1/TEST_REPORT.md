# UI 2.0 Phase 1 — 测试报告（TEST_REPORT）

生成时间：2026-11-14
仓库 HEAD（核验前）：`b97b0502fba455067c58851e4d20a8c4b3f4ce3a`（chore: v3.2.9）
工作分支：`feature/ui2-phase1`（未 commit / push）

## 1. 命令结果

| 命令 | 结果 |
|---|---|
| `npm ci --omit=optional --no-audit --no-fund` | exit 0（564 包，lockfile 一致） |
| `npm run compile`（tsc → dest） | exit 0，无 TS 错误 |
| `npm test`（compile + node --test） | **217 / 217 通过** |
| `npm run renderer:typecheck`（tsc -p tsconfig.renderer.json） | exit 0 |
| `npm run renderer:build`（vite build → ui2-renderer/） | exit 0，`index.html` + JS 219.8 KB + CSS 0.4 KB |
| 当前平台打包（`electron-builder --win --dir`，本地验证口径） | exit 0（`release/win-unpacked`：`飞牛影视.exe` 201 MB + `resources/app.asar` 9.2 MB + `third_party`） |

## 2. 打包内容核验（release/win-unpacked）

- `resources/app.asar` 内 **version=3.2.9**，包含：`\ui2-renderer\index.html`、`ui2-renderer\assets`（3 个文件）、`\resource\library\index.html`、`\resource\login\index.html`、`\resource\mpv-overlay\mpv.conf` ✔
- `third_party`（extraFiles）：`fntv-mpv`、`proxy` ✔
- 打包版启动冒烟：窗口标题 `媒体库 v3.2.9`、`Responding=True`；日志确认 `Proxy模块启动成功`、`[library] using sqlite store`、`MPV 插件补丁已覆盖 uosc_danmaku (5 个文件)`、`MPV托管插件已同步` ✔（打包环境 uiShell 恒 classic）

## 3. 三条启动路径证据（P1-03/P1-04）

| 路径 | 触发方式 | 证据 |
|---|---|---|
| classic | 无 `FNTV_UI_SHELL` | 日志 `加载本地媒体库页面` ✔ |
| react（构建产物） | `FNTV_UI_SHELL=react` | 日志 `加载 UI 2.0 React 页面: ...ui2-renderer/index.html`；file:// 截图确认 React 壳渲染、外部 CSS 生效 ✔ |
| 回退 | `FNTV_UI_SHELL=react` + 无效 dev 地址 | `ERR_CONNECTION_REFUSED` → 日志 `UI 2.0 页面加载失败，回退 classic`（仅一次）✔ |
| `start:ui2` 联动 | `node scripts/ui2-dev.mjs` | Vite `127.0.0.1:5273` ready → Electron 加载 `React 开发服务器` → 结束 Electron 后 ui2-dev 退出、端口释放 ✔ |

## 4. CSP 验证（P1-09）

- 生产 `ui2-renderer/index.html`：`connect-src 'none'`；无 `localhost` / `ws://` / `unsafe-inline` / `unsafe-eval`；无 inline `<script>`、无 inline style 属性；样式为外链 CSS ✔
- 开发模式（Vite serve）：`connect-src 'self' ws://127.0.0.1:5273`（仅固定 loopback HMR 例外）✔

## 5. Phase 1 验收矩阵

| 任务 | 验收 | 结果 |
|---|---|---|
| P1-01/P1-02 | React/Vite 独立构建、typecheck、`ui2-renderer` 产物、无 CDN/内联脚本 | ✔ |
| P1-03/P1-04 | `start:ui2` 联动与清理、uiShell 解析与单次回退、原 `start` 未变 | ✔ |
| P1-05 | preload dev-origin allowlist（仅固定 loopback）、3 个白名单缺口 + B1/B2/B3 通道登记、桥接类型、隔离测试 | ✔（9 个新/改断言） |
| P1-06 | `library:test-source` → `library:test-source-result`（saved/draft、requestId、脱敏、本地/WebDAV 枚举） | ✔（单元测试覆盖 207/401/403/404/timeout/network/invalid/local 各分支） |
| P1-07 | `library:update-source`（部分更新、password keep/replace/clear、type/private 不可改、路径查重、隐私门禁、复用 `library:source-updated`） | ✔（纯逻辑 + JSON store 落盘无明文测试） |
| P1-08 | `library:history` → `library:history-info`（limit 1..50 默认 20、可见性过滤、DTO 白名单、requestId、空数组） | ✔ |
| P1-09/P1-10 | 生产 CSP、builder files 含 `ui2-renderer`、各平台 build 脚本先构建 renderer、Release/PR CI 增加测试与 renderer 构建 | ✔（打包内容与启动已本地核验） |
| P1-11 | 回归与交付文档 | ✔（本报告 + ROLLBACK + IMPLEMENTATION_LOG） |

## 6. 未覆盖项 / 说明（blockers 与限制）

1. **NSIS 安装包未在本机构建**：本机对 GitHub 的 TLS 连接不稳定，electron-builder 默认会下载 Electron 分发/签名工具失败；本地验证采用 `--dir` + `--config.electronDist=node_modules/electron/dist` + `--config.win.signAndEditExecutable=false`（仅 CLI 临时参数，**未修改** `build` 配置/签名配置）。正式安装包与三平台构建由 CI（release.yml，配置保持原样）验证；本轮未 push，CI 未触发。
2. **CI 工作流未实际运行**：按计划不自动 push/release；`pr-ci.yml` 与 `release.yml` 变更仅做了静态检查，待推送后在 GitHub 上验证。
3. **B1/B2/B3 的 React UI 未接线**：按决策登记表 P3，Phase 1 只交付后端 IPC 与白名单，UI 在 Phase 3（B3）/ Phase 4（B1/B2）。
4. **深度功能手测未在本轮重跑**：登录、隐私模式、源管理增量、扫描、刮削、播放、MPV 字幕/弹幕/跳过片头、观看进度、托盘、更新与代理路径自 v3.2.9 基线保持未改动（本轮改动集中在 preload 白名单新增、新 handler、`loadLibraryPage` 分支与 renderer 构建链）。已核验：应用启动、代理启动、媒体库加载、MPV 托管同步、窗口响应、托盘插件初始化、本机安装版运行正常。
5. **已知环境注意**：本机 Node 24 下 Electron 38 postinstall 解压可能静默中断（已手动修复并记录于实施计划 §13.2）；CI 使用 Node 22 不受影响。
