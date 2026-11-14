# UI 2.0 Phase 1 — 实施日志（IMPLEMENTATION_LOG）

## 2026-11-14 · 前置工程任务（四项决策） + P1-01/P1-02

### 环境

| 项 | 值 |
|---|---|
| 仓库 HEAD（开始前） | `b97b0502fba455067c58851e4d20a8c4b3f4ce3a`（chore: v3.2.9） |
| 工作分支 | `feature/ui2-phase1` |
| 本地 Node / npm | v24.16.0 / 11.13.0 |
| CI Node / npm | 22（npm 10，随 setup-node 提供），`engines.node >= 22.13.0` |
| 未提交的用户更改 | `AGENTS.md`（保持原样）、`FN_Media_UI2_Phase1_OpenCode_Package/`、`fn_media_ui2_demo.html` |
| 提交状态 | **未 commit / push**（按计划要求，由维护者决定） |

### 1. 文档入库（.gitignore 白名单）

- `.gitignore` 末尾追加：
  ```gitignore
  # Keep docs ignored except FN Media UI 2.0 records
  !/docs/
  /docs/*
  !/docs/ui2/
  !/docs/ui2/**
  ```
- 验证：
  - `git check-ignore -v docs/ui2/phase1/BASELINE.md` → 命中 `!/docs/ui2/**`（未忽略，`git status` 中 `docs/` 为未跟踪）
  - `git check-ignore -v docs/other.md` → 命中 `/docs/*`（仍忽略 ✓）
- UI 2.0 规格 / 实施计划 / 决策登记表已复制到 `docs/ui2/`；本日志与 `BASELINE.md` 位于 `docs/ui2/phase1/`。
- 记录文档不含密码、Token、绝对用户目录等敏感内容。

### 2. package-lock.json 纳入跟踪 + npm ci

- 移除 `.gitignore` 中 `package-lock.json` 忽略行（`git check-ignore package-lock.json` → exit 1，未忽略 ✓）。
- 使用本地 npm 11 生成 `package-lock.json`：`lockfileVersion=3`、589 packages（依赖安装前）。
- `npm ci --omit=optional --no-audit --no-fund`：成功（564 packages / 30s，缓存命中）。
- `npm ci --dry-run`：up to date（lockfile 与 package.json 一致）。
- `package.json` 增加 `engines.node >= 22.13.0`（`node:sqlite` 从 Node 22.13 起无需实验开关）。
- 已知环境注意（已记录到实施计划 §13.2）：本机 Node 24 下 Electron 38 的 postinstall（`extract-zip`）解压可能静默中断，导致 `node_modules/electron/dist` 缺 `electron.exe`；本次通过缓存 zip 手动解压到 `dist/` 并写入 `path.txt` 修复。CI（Node 22）此前构建正常，不受影响。

### 3. 启动入口统一（决策记录）

- 已写入实施计划 §13.3：保留 `main.ts` 现有启动路径，由 `winctrl.loadLibraryPage` 统一按 `uiShell` 选择 classic / React；React 失败仅回退一次 classic；普通用户缺省 classic。
- 本次未改代码（属于 P1-03/P1-04 实施范围）。

### 4. Release CI 与 PR CI

- `.github/workflows/release.yml`：
  - 安装步骤 `npm install --no-optional ...` → `npm ci --omit=optional --no-audit --no-fund`
  - macOS `dmg-license` 安装改为 `npm install dmg-license --no-save ...`（不改 package.json/lockfile）
  - 在 `Compile TypeScript` 之后新增 `Run tests`（`npm test`），测试通过后才进入平台打包
  - Node 22 / Go 1.24 / mpv-config 下载解压顺序与平台 matrix 保持不变
- 新增 `.github/workflows/pr-ci.yml`：对向 `ui2-integration`（及 `main`）提交的 PR 执行 `npm ci → npm run compile → npm test`（Node 22，npm cache）。

### 5. P1-01 + P1-02：React/Vite 基础设施

**新增依赖（仅必要项，未升级无关依赖）**

| 依赖 | 版本 | 类型 |
|---|---|---|
| react / react-dom | ^19.3.1 | dependencies |
| vite | ^8.3.8 | devDependencies |
| @vitejs/plugin-react | ^6.3.0 | devDependencies |
| @types/react / @types/react-dom | ^19.3.0 | devDependencies |

**修改/新增文件**

| 文件 | 说明 |
|---|---|
| `tsconfig.renderer.json` | renderer 独立配置：`jsx: react-jsx`、`moduleResolution: Bundler`、`noEmit`、`types: ["vite/client"]`，仅含 `src/renderer/**/*` |
| `tsconfig.json` | `exclude` 增加 `src/renderer`（main 的 `tsc → dest` 不编译 renderer） |
| `vite.config.ts` | `root: src/renderer`、`base: './'`、产出 `ui2-renderer/`、`emptyOutDir` |
| `src/renderer/index.html` | 最小入口（`<script type="module" src="/main.tsx">`，无内联脚本） |
| `src/renderer/main.tsx` | `createRoot` + `StrictMode` 挂载 |
| `src/renderer/App.tsx` | 最小应用壳（占位文案，不接业务 API） |
| `package.json` | 新增脚本 `renderer:typecheck`（tsc -p）与 `renderer:build`（typecheck + vite build）；`engines`；react 依赖 |
| `.gitignore` | 新增 `ui2-renderer`（生成目录不进 Git） |

**命令与结果**

| 命令 | 结果 |
|---|---|
| `npm run compile` | exit 0（main/preload 仍 `tsc → dest`，dest 不含 renderer） |
| `npm run renderer:typecheck` | exit 0 |
| `npm run renderer:build` | exit 0 → `ui2-renderer/index.html` + `ui2-renderer/assets/index-*.js`（约 215 KB） |
| `npm test` | **196 / 196 通过** |

**P1-01/P1-02 验收核对**

- [x] `npm run compile` 仍通过
- [x] renderer 独立 typecheck 通过
- [x] `npm run renderer:build` 产出 `ui2-renderer/index.html` 及全部资源
- [x] 不引用 CDN（production HTML 无 `http(s)://`）
- [x] production HTML 无 inline script（仅外部 `./assets/index-*.js`，相对路径）
- [x] 输出在根目录 `ui2-renderer/`，未覆盖 `resource/library`；`ui2-renderer` 已 gitignore

## 2026-11-14 · P1-03 + P1-04（开发启动 + uiShell 双壳）

### 改动文件

| 文件 | 说明 |
|---|---|
| `src/main/common/uiShell.ts` | 新增：uiShell 解析（classic/react）+ 固定 loopback 开发地址校验（仅 `http://127.0.0.1|localhost:5273`） |
| `src/main/common/winctrl.ts` | `loadLibraryPage` 统一入口：按 uiShell 选择 classic / React（dev server 或 `ui2-renderer/index.html`）；加载失败只回退一次 classic；未改动窗口生命周期/安全选项 |
| `scripts/ui2-dev.mjs` | 新增：启动固定 loopback Vite dev server（127.0.0.1:5273，strictPort）→ ready 后以 `FNTV_UI_SHELL=react`、`FNTV_UI2_DEV_URL` 启动 Electron → Electron 退出时关闭 Vite 并退出 |
| `package.json` | 新增脚本 `start:ui2`（clean + build:proxy:win + tsc + node scripts/ui2-dev.mjs）；`start` 未改动 |
| `tests/uiShell.test.cjs` | 新增 6 个用例：打包恒 classic、开发缺省 classic、env 强制 react（dev 地址/构建产物）、资源缺失回退、loopback 地址白名单 |

### 行为规则

- 打包环境：始终 classic（Phase 1 不改变普通用户缺省值）。
- 开发环境：仅 `FNTV_UI_SHELL=react` 时启用 React；优先合法 dev server 地址，否则使用已构建的 `ui2-renderer/index.html`；资源缺失回退 classic。
- 加载失败（如 dev server 未启动）：`loadFile/loadURL` 的 catch 触发一次 classic 回退，无循环。
- 禁止项核对：未改 macOS traffic lights / 无边框窗口 / 窗口生命周期 / sandbox / contextIsolation / nodeIntegration / login 与 fnOS 链路；uiShell 未写入 secret config（仅内存解析）。

### 命令与结果

| 命令 | 结果 |
|---|---|
| `npm run compile` | exit 0 |
| `npm test` | **202 / 202 通过**（新增 6 个 uiShell 用例） |
| 路径1：`electron .`（无环境变量） | 日志：`加载本地媒体库页面`（classic）✓ |
| 路径2：`FNTV_UI_SHELL=react` | 日志：`加载 UI 2.0 React 页面: ...ui2-renderer/index.html` ✓ |
| 路径3：`FNTV_UI_SHELL=react` + 无效 dev 地址 | 日志：`UI 2.0 页面加载失败，回退 classic`（ERR_CONNECTION_REFUSED，单次回退）✓ |
| `node scripts/ui2-dev.mjs` | Vite `127.0.0.1:5273` ready → Electron 加载 `React 开发服务器` → 结束 Electron 后：ui2-dev 进程退出、端口 5273 释放 ✓ |

### 已知说明

- 开发环境日志同时输出到仓库 `log/app.log`（logger 既有行为）；安装版日志仍在 `%APPDATA%\fntv\logs`。
- 验证期间临时停止/重启了安装版应用（单实例锁），验证结束后已恢复运行（v3.2.9）。

## 2026-11-14 · P1-05 ~ P1-11（批量执行，全部完成）

### P1-05 preload allowlist 与开发源安全

| 文件 | 说明 |
|---|---|
| `src/preload/core/devOrigin.ts`（新） | 开发源白名单：仅 `FNTV_UI_SHELL=react` 且 `http://127.0.0.1|localhost:5273` 暴露桥接；其余（https/局域网/远程/错误端口/非 react）一律拒绝 |
| `src/preload/index.ts` | 桥接暴露条件改为 file: 页面或精确 dev origin；登记 3 个白名单缺口（`library:set-source-category` SEND、`library:source-updated` RECEIVE、`library:scrape-status-info` RECEIVE）与 B1/B2/B3 通道（`library:test-source(-result)`、`library:update-source`、`library:history(-info)`） |
| `src/renderer/bridge.d.ts`（新） | 渲染层桥接类型（send/on/once/off/openExternal + log），off 清理语义与 preload 一致 |
| `tests/rendererIsolation.test.cjs` | 新增/扩充分离断言：dev origin 白名单、无 ipcRenderer 暴露、通道登记完整性 |

### P1-06 B1 媒体源连接测试

| 文件 | 说明 |
|---|---|
| `src/modules/library/webdav.ts` | 新增 `probeWebdavRoot`（PROPFIND Depth:0、5s 超时、401/403→auth、404→not_found、超时→timeout、其余→network、消息脱敏），测试可注入 request，不触真实网络 |
| `src/modules/library/sourceTest.ts`（新） | 本地/SMB 路径 stat 探测（not_found/auth/network 映射，statFn 可注入）+ WebDAV 探测封装 |
| `src/main/handlers/plugins/library.ts` | `library:test-source`：saved（sourceId，隐私源需解锁，主进程解密）与 draft（仅随请求传递，不落盘不回显）；requestId 回传；不记录密码 |
| `tests/sourceTest.test.cjs`（新） | 本地成功/缺失/非目录/空路径、权限映射；WebDAV 207/200/401/403/404/500/超时/网络/无效地址/脱敏 |

### P1-07 B2 编辑媒体源

| 文件 | 说明 |
|---|---|
| `src/modules/library/sourceEdit.ts`（新） | 纯逻辑 `planSourceUpdate`：id 不可改、type/private 不在补丁字段、未知字段拒绝、category 校验、local/webdav 字段隔离、密码三态（keep/replace/clear），加密动作交给主进程 |
| `src/main/handlers/plugins/library.ts` | `library:update-source`：隐私门禁、密码 replace 时 `encryptSecret`、local 新路径同文件夹查重（排除自身）、校验全通过才 `updateSource`（失败不部分更新）、结果复用 `library:source-updated`（兼容旧 UI） |
| `tests/sourceEdit.test.cjs`（新） | id/type/未批准字段/空名称/非法 category/本地字段隔离；密码 keep/replace/clear；JSON store 落盘无明文、重开持久化 |

### P1-08 B3 最近播放历史

| 文件 | 说明 |
|---|---|
| `src/modules/library/historyView.ts`（新） | `clampHistoryLimit`（默认 20、1..50）、`toHistoryItemView` DTO 白名单（剔除 filePath/sourceId/mtime 等） |
| `src/main/handlers/plugins/library.ts` | `library:history`：隐私过滤与 continue 同款可见性规则、requestId、空历史返回空数组、错误安全码 |
| `tests/historyView.test.cjs`（新） | limit 边界、DTO 字段白名单、进度计算、空数组与倒序 |

### P1-09 + P1-10 CSP、打包与 CI

| 文件 | 说明 |
|---|---|
| `src/renderer/index.html` | 生产 CSP：`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' file: data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'` |
| `src/renderer/app.css`（新）+ `App.tsx` | 去除 inline style，改为外链 CSS（满足 style-src 'self'） |
| `vite.config.ts` | dev-only CSP 覆盖插件：仅 serve 模式把 `connect-src 'none'` 换成 `connect-src 'self' ws://127.0.0.1:5273`；生产保持严格 CSP |
| `package.json` | `build.files` 增加 `ui2-renderer`；`build:win/mac/linux` 在 electron-builder 前执行 `renderer:build` |
| `.github/workflows/release.yml` | 新增 renderer 构建步骤（测试通过后、平台打包前） |
| `.github/workflows/pr-ci.yml` | 新增 renderer 构建步骤（npm ci → compile → test → renderer build） |

### P1-11 回归与交付

- `npm run compile` exit 0；`npm test` **217/217**；`renderer:typecheck` exit 0；`renderer:build` exit 0
- 本机打包验证（`electron-builder --win --dir`）：asar 内 **3.2.9** + `ui2-renderer`（3 assets）+ `resource/library|login|mpv-overlay`；`third_party`（fntv-mpv/proxy）完整；打包版启动 `媒体库 v3.2.9`、代理/媒体库/托管同步日志正常
- 交付文档：`BASELINE.md`、`IMPLEMENTATION_LOG.md`（本文件）、`TEST_REPORT.md`、`ROLLBACK.md`
- 限制：本机网络无法下载 electron-builder 工具链，本地打包采用 `--config.electronDist` + `--config.win.signAndEditExecutable=false` 临时参数（未改配置）；NSIS 正式安装包与三平台构建由 CI 验证（本轮未 push）

### 下一步
- 维护者走查 `git status` / `git diff` 后提交；推送后验证 `pr-ci.yml` 与 `release.yml` 实际运行（需创建/使用 `ui2-integration` 分支流程）
- Phase 3（B3 UI）/ Phase 4（B1/B2 UI）按计划另起任务
