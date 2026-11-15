# FN Media UI 2.0 — Phase 1 实施计划

> **文档版本：** 1.0.2（2026-11-14 执行修订：docs 白名单入库、package-lock 纳入跟踪 + npm ci、启动入口统一、Release/PR CI 测试门禁；见文末 §13）  
> **状态：** 实施计划基线（B1/B2/B3 已获批准；"后端先行"时序已由决策登记表 P3 确认）  
> **对应设计规格：** FN Media UI 2.0 Spec v1.3（`FN_Media_UI2_v1_3_Spec.md`）与决策登记表 v1.3（`FN_Media_UI2_v1_3_Decision_Register.md`）；契约冲突时以登记表 §2 与规格 §0.5 为准  
> **执行环境：** OpenCode（项目根目录会话）  
> **仓库：** https://github.com/zheermao123/fntvloca-media  
> **核对日期：** 2026-11-14（公开 `main` 分支；实际开始实施时必须记录本地 HEAD SHA）  
> **本文件用途：** 将 UI 2.0 Phase 1 拆成可逐项执行、可验证、可回滚的工程任务。它不是对仓库的代码修改，也不代表已经执行了任何任务。

---

## 0. 执行摘要

Phase 1 的目标是建立 UI 2.0 的**可运行、可打包、可回退的 React renderer 基础设施**，同时补齐 UI 2.0 后续页面必需且已批准的三个媒体源/历史 IPC 能力：

- **B1 — 媒体源连接测试：已批准。** 本地目录和 SMB 路径按现有文件系统路径语义探测；WebDAV 使用根目录 PROPFIND 探测。不得新增 SMB 认证协议或启动完整递归扫描来冒充连接测试。
- **B2 — 编辑媒体源：已批准。** 新增 `library:update-source`，主进程复用现有 `store.updateSource`；WebDAV 凭据在主进程按当前加密方式处理，renderer 不读取、不保存、不回显明文。
- **B3 — 最近播放历史：已批准。** 新增 IPC 暴露现有 `listHistory(limit)`；做数量限制和 UI DTO 投影；不改数据库 schema。

Phase 1 不负责交付完整 Apple 风格媒体库页面。Phase 1 结束时，React renderer 应有可运行的最小应用壳，开发模式能连接 Vite，生产包能加载静态 renderer，主窗口可通过 `uiShell` 在 classic/React 之间选择，并可在 React 资源缺失时回退到旧库页。B1/B2/B3 的主进程服务、IPC 合约、preload 白名单和自动化测试必须完成；对应完整 UI 操作分别在后续媒体源/首页页面阶段接入。

**核心原则：** 先形成安全且可回滚的双壳结构，再逐页迁移；绝不以 UI 重构为理由重写数据库、扫描器、刮削器、MPV、托盘、登录或 fnOS 遗留链路。

## 1. 决策与范围

### 1.1 已批准且不可自行更改的决策

| 项目 | 实施决定 |
|---|---|
| 视觉 | Apple 风格；克制、内容优先、低噪音、精细排版 |
| 默认主题 | Light；后续支持 Dark / System |
| Renderer | React + TypeScript + Vite |
| Electron | 保留当前 Electron 主进程与应用壳；不迁移 Web-only |
| Main / preload 编译 | 保留现有 `tsc → dest` |
| 窗口策略 | macOS 保留原生交通灯与 `hiddenInset`；Windows/Linux 保留 frameless + 页面自绘窗控/拖拽区 |
| Electron 安全选项 | `sandbox: false` 暂时不变；`contextIsolation: true`、`nodeIntegration: false` 不得降低；renderer 不获得 Node API |
| CSP | React 生产 renderer 移除 `script-src 'unsafe-inline'`；`connect-src 'none'`；`img-src` 允许 `file:`，并按当前缓存需要保留 `'self'`、`data:` |
| 全局搜索快捷键 | `Cmd/Ctrl + K` |
| 首页 | 紧凑页头，不使用早期 demo 的大 Hero |
| 其他视频 | `category=other` 路由为 `/library/others` |
| UI 回退 | `uiShell: 'classic' | 'react'`；缺省 `classic`；React 资源不可用时回退 classic |
| B1 / B2 / B3 | 均已批准，按本计划实现 |
| 数据库 | 不改 SQLite/JSON schema，不做数据迁移 |

### 1.2 Phase 1 要做

1. OpenCode 对当前工作树做基线检查，并遵循已有项目指令。
2. 新增 React renderer 目录、Vite 构建和独立 TypeScript 配置。
3. 保留原 main/preload 的 tsc 构建边界，不让 TSX 文件进入 main 编译目标。
4. 建立 React dev server 与 Electron 的可靠启动/退出编排。
5. 建立 `uiShell` 选择、classic 默认值、React 资源检查及失败回退。
6. 扩展 preload 对本地 Vite 开发源的**精确 allowlist**，解决当前只对 `file:` 暴露 API 导致 Vite dev renderer 无法访问桥接 API 的问题。
7. 修复已确认的 preload 白名单缺口：`library:set-source-category`（SEND）、`library:source-updated`（RECEIVE）、`library:scrape-status-info`（RECEIVE）——三者发送方均已在定稿核验中确认存在（`library.ts:306`、`318`、`650-652`，登记表 P2），实施时直接登记并联测，复核即可。
8. 实现 B1、B2、B3 的主进程 IPC、DTO、参数验证、错误脱敏和单元测试。
9. 新 React production HTML 使用严格 CSP；Vite HMR 的 localhost 例外只在开发态出现。
10. 修改 `package.json`、`electron-builder.files`、`.gitignore`、release workflow，形成 dev/build/package/CI 闭环。
11. 更新 `rendererIsolation.test.cjs` 与 Node `--test` 测试，确保 allowlist 与桥接行为一致。
12. 生成构建产物清单、手动验收记录和回滚说明。

### 1.3 Phase 1 不做

- 不实现完整媒体库、首页、详情页、全局搜索弹窗或所有设置页。
- 不将 `uiShell` 默认值切换为 `react`；普通用户默认仍为 `classic`。
- 不移除 `resource/library/index.html`，不重写其旧 UI 作为 Phase 1 的前置条件。
- 不更改 `sandbox: false`，不迁移或重写 preload 插件加载方式。
- 不更改登录页 `resource/login`、`play-movie`、preload 注入插件（包括 playButton/titlebar）和 dormant `phase5 fnos-adapter`。
- 不新增 source `enabled` 字段，不增加数据库 schema 或迁移框架。
- 不做 cast/crew、独立健康页、虚构的字幕/弹幕设置页、无后端依据的媒体库/安全配置页。
- 不添加 B1/B2/B3 以外的无批准业务 IPC；不改变扫描、刮削、播放算法。
- 不把 `fetch`、XHR、WebSocket 或远程 API 调用放入 React renderer。

### 1.4 完成定义

Phase 1 只有在以下各项全部满足时才可标记完成：

- `npm test`（或仓库现有等价测试命令）通过；
- `npm run compile` 通过；
- React renderer production build 通过；
- Windows/macOS/Linux 对应的 builder 配置均能找到新增 renderer 目录；
- 至少完成当前开发平台的完整安装包构建和启动烟雾测试；其他平台由 CI matrix 构建验证；
- 默认 `uiShell` 为 classic；显式选择 React 能加载；React 资源不存在时自动回退 classic；
- remote page 不会因为 preload 的开发态 allowlist 而获得本地 API；
- B1/B2/B3 单元测试通过，且最小手动集成测试通过；
- 旧库页、登录、MPV、托盘、扫描、刮削和观看状态没有回归；
- 没有数据库 schema 变化，没有把密钥、密码或完整路径写入日志/测试快照。

---

## 2. 当前仓库核对结果与关键约束

以下是对公开 `main` 分支及此前代码审查结果的交叉核对。公开分支不是用户本地工作树的替代品，OpenCode 开工时必须重新确认 HEAD、未提交改动、依赖与实际文件路径。

| 观察点 | 当前可见现状 | Phase 1 的处理 |
|---|---|---|
| 项目协作指令 | 根目录已有 `AGENTS.md`，并有 `.agents/skills/`、`.codex/`、`.trellis/` | OpenCode 先读取根 `AGENTS.md`；检查 Trellis 和 skills 的适用约束；不复制 Codex 专属流程，不覆盖现有文件 |
| 构建 | `package.json` 的 `main` 为 `dest/main/main.js`；主进程由 `tsc` 编译；Electron 38；已有 `npm-run-all` | React 单独用 Vite；main/preload 仍由 tsc 输出到 `dest` |
| 当前测试 | `npm test` 调用 `npm run compile && node --test tests/*.test.cjs` | 保留 Node 测试；React 组件测试框架后续再按需加入，不替换 Node 测试 |
| builder files | 当前公开配置包含 `dest`、`build`、`resource/login`、`resource/library`、`resource/mpv-overlay` | 新产物采用根目录 `ui2-renderer/`，并显式加入 `electron-builder.files` |
| 页面加载 | `src/main/common/winctrl.ts` 的 `loadLibraryPage()` 目前加载 `resource/library/index.html` | 在统一入口增加 uiShell resolver，不修改 login/远程 fnOS 流程 |
| 窗口偏好 | `src/main/common/mainwin.ts` 当前保留 macOS traffic lights、Win/Linux frameless，并设置 isolation 与 sandbox | Phase 1 不改变窗口外观参数，只验证两种页面都能在现有窗口上运行 |
| Preload | `src/preload/index.ts` 有 SEND/RECEIVE Set；`exposeLoginPageApi()` 当前仅在 `file:` 页面暴露 electronAPI；仍用 fs/path/require 加载插件 | 保留 sandbox false；添加精确 Vite dev origin 检查，不允许任意 http(s) 页面获得 API |
| Store | `src/modules/library/store.ts` 接口已声明 `getSource`、`updateSource`、`listHistory(limit)` | B2/B3 复用现有方法，不新增数据库表 |
| WebDAV | `src/modules/library/webdav.ts` 已有 PROPFIND body、解析和递归扫描能力 | B1 抽出/新增浅探测函数；连接测试不启动递归扫描 |
| 旧库 CSP | `resource/library/index.html` 当前 CSP 含 `script-src 'unsafe-inline'`、`style-src 'unsafe-inline'`、`img-src 'self' file: data:`、`connect-src 'none'` | Phase 1 为 React 新入口建立独立严格 CSP；旧页 CSP 的兼容性整改另行审计，不能直接删 inline 导致 classic 白屏 |
| Release workflow | `.github/workflows/release.yml` 使用 Node 22、Go 1.24，下载 MPV config zip 后执行平台构建脚本 | 保留第三方资源下载顺序；新 renderer build 必须包含在本地及 CI 调用的 build 脚本里 |

### 2.1 开始前必须由 OpenCode 核验的路径

仓库当前公开页面能确认以下锚点：

- `package.json`
- `src/main/main.ts`
- `src/main/common/mainwin.ts`
- `src/main/common/winctrl.ts`
- `src/preload/index.ts`
- `src/modules/library/store.ts`
- `src/modules/library/webdav.ts`
- `resource/library/index.html`
- `.github/workflows/release.yml`
- `tests/rendererIsolation.test.cjs`（本地需确认存在及准确路径）
- `AGENTS.md`

主进程媒体库 IPC 具体实现文件必须通过以下命令定位，不允许猜文件名后新建平行 handler：

```bash
rg -n "library:add-source|library:list-sources|library:catalog|library:source-added|updateSource|listHistory" src/main src/modules tests
rg -n "library:set-source-category|library:source-updated|library:scrape-status-info" src tests
```

如果用户本地文件结构与这些锚点不同，以本地 HEAD 为准，并在 `docs/ui2/phase1/BASELINE.md` 记录实际路径。

---

## 3. 目标结构与技术边界

### 3.1 建议新增的 renderer 源码结构

```text
src/renderer/
├── index.html
├── main.tsx
├── App.tsx
├── types/
│   └── electron.d.ts
├── services/
│   └── electronBridge.ts
└── styles/
    ├── tokens.css
    └── global.css

vite.config.ts
tsconfig.renderer.json
scripts/
└── start-ui2.cjs
ui2-renderer/              # Vite production output; ignored by Git, included in app package
```

注：`tsconfig.renderer.json` 前面不要带空格；目录树中的路径只是建议布局，若仓库已有 renderer/frontend 约定，应采用已有约定并记录差异。不要把 React 源码放进 `resource/library`，也不要把 Vite 的生成文件覆盖旧库页。

### 3.2 编译职责

| 部分 | 编译器/工具 | 输入 | 输出 | 禁止事项 |
|---|---|---|---|---|
| Electron main | 现有 TypeScript compiler | `src/main/**` | `dest/main/**` | 不迁移 Vite |
| Preload | 现有 TypeScript compiler | `src/preload/**` | `dest/preload/**` | 不改变插件目录结构或 sandbox |
| React renderer | Vite + React plugin | `src/renderer/**` | `ui2-renderer/**` | 不生成 Node main/preload，不清空 dest |
| Classic renderer | 现有静态资源 | `resource/library/**` | 原样打包 | 不被 React build 覆盖或删除 |
| Login | 现有静态资源 | `resource/login/**` | 原样打包 | 不接入 React shell selector |

### 3.3 Vite 构建要求

建议 `vite.config.ts` 至少固定：

- `root: 'src/renderer'`；
- `base: './'`，确保 `file://` 加载时 JS/CSS 路径为相对路径；
- `build.outDir: '../../ui2-renderer'`（相对 Vite root 的最终实际路径需由 OpenCode 验证）；
- `build.emptyOutDir: true`，只清空 renderer 输出目录；
- 固定 `server.host: '127.0.0.1'`、`strictPort: true`；
- 生产资源全部本地 bundle，不引用外部 CDN；
- 不启用可绕过 CSP 的 inline script；
- 产物使用相对路径和独立 hash 文件名。

如采用 `src/renderer` 为 Vite root、仓库根目录 `ui2-renderer` 为输出目录，配置中的 `outDir` 是相对 Vite root 的路径，常见值为 `../../ui2-renderer`。实施后必须检查生成的真实目录，不允许只凭配置字符串判断。

### 3.4 React 与 main/preload 的通信边界

- React 不得 import `electron`、`fs`、`path`、`child_process`、SQLite 模块或 main 层代码。
- React 只访问 `window.electronAPI`（或经审计后确定的单一既有全局桥接对象）。
- `services/electronBridge.ts` 负责强类型 channel、请求/结果关联、事件订阅释放和 DTO 校验；组件不得散落裸 channel 字符串。
- 保持当前受限的 preload `send/on/once/off` 模式；不要为了方便让 renderer 任意调用任意 IPC channel。
- 新请求与结果事件使用 `requestId` 关联；handler 通过 `event.sender.send()` 回发给请求发起方，不广播给所有 renderer。
- main handler 对发送方来源、参数结构、sourceId、请求频率和凭据长度做验证；preload allowlist 不是主进程授权的替代品。

### 3.5 Vite 开发态 preload API 暴露

当前 preload 在 `window.location.protocol !== 'file:'` 时不暴露 `electronAPI`。Vite dev server 使用 `http://127.0.0.1:<port>`，所以不增加受限开发源 allowlist 的话，React dev 页面会启动但无法调用 IPC。

必须实现以下规则：

1. `file:` 页面按当前行为继续允许本地应用 API；
2. `http:` 仅在显式设置 `FN_MEDIA_UI2_DEV_URL`（或经项目约定命名的环境变量）时允许；
3. 运行时 URL 必须与配置的 dev URL 的 `protocol + hostname + port` 完全匹配；hostname 仅可为 `127.0.0.1` 或 `localhost`；不得允许任意局域网 IP、任意端口、任意路径或任意远程域名；
4. `https:` 远程站点和非本地 http(s) 永不注入本地 API；
5. packaged build 不设置该环境变量，因此只允许 `file:`；
6. 用测试覆盖 file、精确 localhost、错误端口、错误 host、远程 https 五类情况。

不得把 `if (protocol === 'http:') exposeApi()` 作为实现。

---

## 4. Phase 1 工作包与执行顺序

工作包必须按依赖顺序执行。每个工作包完成后先运行对应测试，再合并到当前分支；不允许同时让多个 agent 修改 `package.json`、`src/preload/index.ts` 或同一个 library handler 文件。

### P1-00：OpenCode 基线与审计快照

**目标：** 固定实际工作树和项目协作约束，避免对脏工作树覆盖已有修改。

**执行前：** OpenCode 必须从仓库根目录启动。

**读取：**

- `AGENTS.md`；
- `.trellis/` 内项目工作流与规格；
- `.agents/skills/` 中与 TypeScript/Electron/测试相关的技能，并确认 OpenCode 是否会自动发现该目录；
- `.codex/` 仅用于确认历史 Codex 文件是否包含仍有效的项目约束，不能将其当作 OpenCode 配置入口；
- `package.json`、`tsconfig.json`、`.gitignore`、`.github/workflows/release.yml`、preload、main window loader、library handlers、store、WebDAV、tests。

**命令：**

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -1 --format="%H%n%cs%n%s"
node --version
npm --version
npm run compile
npm test
```

随后执行本计划 §2.1 的 `rg` 定位命令，并记录目录树和实际 IPC 文件。

**输出：** `docs/ui2/phase1/BASELINE.md`，至少包含 commit SHA、分支、dirty 文件、Node/npm 版本、现有测试结果、实际 handler 路径、当前源配置类型、凭据加密/解密调用链、WebDAV 调用链、相关 renderer isolation 测试路径。

**停止条件：** 如果当前分支包含未提交的用户修改，先列出并确保本次改动不覆盖它们；不得 reset、clean -fd、stash 或自动重写工作区。

**验收：** 基线报告中没有把公开 `main` 信息冒充成本地事实；所有无法确认项标记 `NEEDS_VERIFICATION`。

### P1-01：依赖与 TypeScript 编译隔离

**目标：** 为 renderer 添加 React/Vite，但不改变 main/preload tsc 编译。

**文件：**

- 修改 `package.json`；
- 修改或新增 `tsconfig.renderer.json`；
- 必要时修改 `tsconfig.json` 的 `exclude`；
- 更新当前被仓库跟踪的 npm lockfile（仅当实际存在并受项目约定时）。

**改动：**

- 增加 `react`、`react-dom`、`vite`、`@vitejs/plugin-react` 及对应类型依赖；版本使用项目可支持的稳定版本并锁定，不在实施计划中猜测版本号；
- 将 renderer 类型检查与 main/preload 类型检查分开；
- 确保 `npm run compile` 仍只编译 main/preload，不把 `src/renderer/*.tsx` 吞进 Electron main 输出；
- 不删除已有依赖、不升级 Electron major、不顺手升级所有依赖。

**验收：** `npm run compile` 通过；renderer 单独 typecheck 通过；`dest/main/main.js` 仍然存在且入口路径不变。

### P1-02：React renderer scaffold 与 Vite build

**目标：** 产生可以通过 `file://` 方式加载的最小 React 页面。

**文件：**

- 新增 `src/renderer/index.html`、`main.tsx`、`App.tsx`；
- 新增 `styles/tokens.css`、`styles/global.css`；
- 新增 `vite.config.ts`；
- 新增或更新 renderer TS config。

**最小内容：** 页面只显示 `FN Media UI 2.0`、当前 shell 标识、构建环境标识和一个桥接连通状态指示；不可使用生产假数据模拟业务成功。此 scaffold 是技术验收页，不是最终视觉页面。

**验收：** `npm run renderer:build` 后 `ui2-renderer/index.html` 存在；HTML 引用的 JS/CSS 文件全部存在；以相对路径加载；无外部 CDN、无 inline script、无 `unsafe-inline` script CSP。

### P1-03：开发启动与 renderer dev server 编排

**目标：** OpenCode 本地开发时可一条命令启动 Vite + Electron，退出 Electron 时不留下 Vite 子进程。

**文件：**

- 新增 `scripts/start-ui2.cjs`；
- 修改 `package.json` scripts；
- 必要时修改 `.gitignore`。

**改动：**

- 新增 `renderer:dev`、`renderer:build`、`start:ui2`；
- 保留旧 `npm start` 行为或明确记录兼容变更，不直接将普通用户默认 UI 切换到 React；
- `start:ui2` 先按当前 OS 执行已有代理构建与 `tsc`，再启动固定 loopback 地址 Vite server，等待 server ready 后启动 Electron；
- 向 Electron main/preload 传递唯一 `FN_MEDIA_UI2_DEV_URL`，并设置开发模式的 `FN_MEDIA_UI_SHELL=react`；
- Electron 退出、脚本收到 SIGINT/SIGTERM、Vite 启动失败时，正确关闭子进程并返回非零状态；
- Windows/macOS/Linux 的代理二进制构建命令沿用项目当前脚本，不能把 Windows proxy build 写死在跨平台启动器里。

**验收：** 在主开发平台执行 `npm run start:ui2`，React 页面显示且桥接 API 连通；关闭 Electron 后 Vite 子进程结束；Vite 端口冲突时明确报错，不悄悄使用任意新端口。

### P1-04：`uiShell` resolver 与 classic fallback

**目标：** 建立可逆的双 renderer 入口。

**文件：**

- 修改 `src/main/common/winctrl.ts` 的 `loadLibraryPage()`；
- 修改 `src/main/common/preferences.ts` 或经审计确认的通用非凭据偏好存储；
- 若需要，新增 `src/main/common/uiShell.ts` 负责解析 shell 和路径。

**配置行为：**

- 允许值仅为 `classic` 和 `react`；非法值按 `classic`；
- 缺省值为 `classic`；
- 开发时 `FN_MEDIA_UI_SHELL=react` 可覆盖用户偏好，但仅在 dev server URL 被验证后生效；
- 生产环境读取持久化 `uiShell`；
- React 产物不存在、index 不可读或 loadFile 失败时，记录脱敏日志并回退 `resource/library/index.html`；
- 对 `did-fail-load` 做一次性 fallback，忽略 `ERR_ABORTED`，避免重复 load 循环；
- fallback 后不再自动尝试 React，直到下次启动或显式切换。

**配置存储边界：** `uiShell` 属于普通 UI 偏好，不应塞进只负责 fnOS 登录 token/cookie 的凭据配置对象。优先扩展现有通用 preference store；若 `preferences.ts` 实际仅负责少量窗口偏好且不适合作为通用配置，则建立最小独立非敏感偏好持久化，不新增 SQLite schema。

**验收：** classic 默认；React 可选；缺文件回退；错误配置回退；登录页、remote fnOS URL 和 play-movie 加载路径不受影响。

### P1-05：Preload allowlist 与 bridge 类型

**目标：** 新 renderer 可使用白名单桥接；remote page 无法继承开发态权限。

**文件：**

- 修改 `src/preload/index.ts`；
- 修改或新增 `tests/rendererIsolation.test.cjs`；
- 新增 `src/renderer/types/electron.d.ts`；
- 新增 `src/renderer/services/electronBridge.ts`。

**必须核实并处理：**

- `library:set-source-category`：handler 已核实存在（`library.ts:306`），登记为 SEND；
- `library:source-updated`：发送方已核实（`library.ts:318`），登记为 RECEIVE；
- `library:scrape-status-info`：发送方已核实（`library.ts:650-652`，当前为死通道、旧 UI 未调用），登记为 RECEIVE 并保留 handler 供 React 任务中心轮询（定稿登记表 P2）；
- B1/B2/B3 的请求 SEND 与结果 RECEIVE channel 按 §5 加入 allowlist；
- 所有新 channel 在测试中逐项 pin，避免 renderer 任意 IPC。

**桥接 API：**

- 暴露 `send/on/once/off` 的现有受限能力，不直接暴露 `ipcRenderer`；
- 类型声明只包含批准的 channel；
- `electronBridge.ts` 封装 requestId、Promise timeout、事件 off、payload parser；
- 组件卸载时释放 listener；
- 不在 React 页面直接引用字符串 channel。

**验收：** `rendererIsolation.test.cjs`、所有 Node 测试通过；不允许 renderer import Electron/Node builtin；file origin 和指定 loopback dev origin 成功；非指定远程 origin 不暴露 API。

### P1-06：B1 媒体源连接测试

**目标：** 为新增源向导和源列表测试按钮提供真实连接诊断。

**建议文件：**

- 在现有 library service 中抽取/新增 `testSourceConnection`；可新增 `src/modules/library/sourceTester.ts`；
- 修改 §2.1 `rg` 找到的现有 library IPC plugin；
- 按需要修改 `src/modules/library/types.ts`；
- 修改 `src/modules/library/webdav.ts` 以抽出可重用的单次 PROPFIND helper；
- 新增 `tests/librarySourceTest.test.cjs`。

**IPC 合约建议：**

```ts
type SourceTestTarget =
  | { kind: 'saved'; sourceId: string }
  | { kind: 'draft'; source: SourceDraftForTest };

// SEND: library:test-source
interface TestSourceRequest {
  requestId: string;
  target: SourceTestTarget;
}

// RECEIVE: library:test-source-result
interface TestSourceResult {
  requestId: string;
  ok: boolean;
  status:
    | 'reachable'
    | 'invalid-config'
    | 'not-found'
    | 'unauthorized'
    | 'forbidden'
    | 'timeout'
    | 'unreachable'
    | 'not-directory'
    | 'unsupported';
  latencyMs: number;
  message: string; // 面向用户的脱敏文案
  checkedAt: number;
}
```

以上是稳定的产品合约草案，`SourceDraftForTest` 内部字段必须映射到仓库实际 `SourceConfig/NewSource`，不能凭草案改动现有数据模型。

**实现规则：**

1. `saved`：主进程通过现有 store 的 `getSource(sourceId)` 获取源配置；如凭据加密，主进程内部使用现有 helper 解析；不要让 renderer 先读出密码。
2. `draft`：用于尚未保存的新建/编辑表单；临时凭据只通过一次 IPC 传给 main，不保存、不写日志、不回传。
3. local：主进程 `fs.stat` 路径，必须确认路径存在且为目录；失败码归一化为 `not-found`、`permission-denied`/`unreachable` 等用户可理解状态。
4. SMB：先核对当前 scanner 对 SMB 源的实际路径模型；只有当它本来就是 UNC/挂载路径并通过 Node 文件系统访问时，才按该路径语义执行 `fs.stat`。若当前连接方式另有封装，则复用该封装，不引入 SMB 客户端库，不新增域账户/密码协商协议。
5. WebDAV：对根 URL 发起一次 PROPFIND（建议 `Depth: 0`，按服务器兼容性验证），复用当前认证、timeout、URL 规范化逻辑；不调用完整 `scanWebdavFolder()` 做连接测试。
6. 超时、401、403、404、连接拒绝、TLS 失败必须区分；对 UI 返回脱敏文案。
7. `latencyMs` 使用单调时钟或 `performance`/`hrtime`，不得暴露凭据。
8. 请求必须设置合理超时；不可无限等待；不要把密码放进 URL query、日志、Error message 或 result。
9. 仅向发起请求的 `event.sender` 回传结果，保持 requestId 对应。
10. B1 只检测可达性，不修改 source、不启动扫描、不改变数据库。

**测试：** local 目录成功/不存在/不是目录/权限错误；SMB 路径按平台可运行 mock；WebDAV 207 成功/401/403/404/超时/网络失败/非法 URL；日志和结果中不含密码；请求 id 匹配；保存源与 draft 测试都覆盖。

### P1-07：B2 编辑媒体源

**目标：** 暴露已存在 `store.updateSource()`，提供不会丢字段或泄密的部分更新语义。

**文件：**

- 修改现有 library IPC plugin；
- 按需修改 `src/modules/library/types.ts`；
- 修改现有凭据加密 helper 的调用点（不新造算法）；
- 新增 `tests/libraryUpdateSource.test.cjs`。

**IPC 合约建议：**

```ts
// SEND: library:update-source
interface UpdateSourceRequest {
  requestId: string;
  sourceId: string;
  patch: SourceEditablePatch;
  credentials?:
    | { action: 'keep' }
    | { action: 'replace'; password: string }
    | { action: 'clear' };
}

// RECEIVE: library:source-updated
interface UpdateSourceResult {
  requestId: string;
  ok: boolean;
  source?: SafeSourceViewModel; // 永不包含明文/密文凭据
  error?: { code: string; message: string };
}
```

**实现规则：**

1. 通过 `sourceId` 重新从 store 读取当前 source；源不存在返回 `not-found`。
2. 对 patch 做字段白名单和类型校验；source id 不可变；source type 默认不可变，除非现有业务明确支持类型切换。
3. 使用 `currentSource + patch` 合并，避免 full replace 意外清空未编辑字段；只调用一次 `store.updateSource(updatedSource)`。
4. `credentials.action='keep'` 时完整保留当前加密凭据；`replace` 时在 main 中调用现有加密路径；`clear` 只有在当前数据模型明确支持无凭据时才允许。
5. UI 密码框默认空值表示 keep，不表示清空；清空凭据必须有明确二次操作。
6. 不回传密码、加密密文、keychain 内容；日志仅记录 sourceId 与成功/失败 code，不记录 source path 中的敏感片段。
7. source 更新成功后只发送脱敏 source view model，并发出已存在 UI 监听所需的 `library:source-updated` event；若该事件目前是由别处发出，先统一事件语义，禁止重复发两种不一致 payload。
8. 同时验证 SQLite store 和 JSON fallback store；禁止新增/修改表结构。
9. renderer 收到失败结果不得乐观更新 source list；收到成功结果才更新或重新拉取。

**测试：** 正常改名/路径；source 不存在；非法 patch；编辑源未触碰凭据；替换 WebDAV 密码正确加密且 raw password 不落盘；密码空白保留原值；明确清除（若允许）；不回传密钥；SQLite/JSON 两种 store 更新后可读回；失败无部分写入。

### P1-08：B3 最近播放历史

**目标：** 复用 store 的 `listHistory(limit)`，以稳定 IPC 供首页/历史页面使用。

**文件：**

- 修改现有 library IPC plugin；
- 按需修改 library DTO/types；
- 新增 `tests/libraryHistoryIpc.test.cjs`。

**IPC 合约建议：**

```ts
// SEND: library:history
interface ListHistoryRequest {
  requestId: string;
  limit?: number;
}

// RECEIVE: library:history-info
interface ListHistoryResult {
  requestId: string;
  ok: boolean;
  items: HistoryItemViewModel[];
  error?: { code: string; message: string };
}
```

**实现规则：**

- 主进程把 limit 转成整数并 clamp：默认 20、最大 50、最小 1（与规格 §0.5 / 登记表 §2 的 B3 契约一致）；不能让 renderer 传任意大数。
- 调用 `store.listHistory(limit)`，保持 store 的真实排序和语义；先核对 WatchedEntry 字段，不在 IPC handler 里重写历史逻辑。
- 映射到 UI 所需的最小 DTO（如 itemId、标题/剧集标题、封面缓存标识、类别、最近播放时间、position/duration/progress、sourceId）；字段以实际类型为准，不返回不必要的原始凭据/内部 DB 对象。
- 不暴露超过 UI 需要的绝对文件路径；播放时使用已有 `library:continue` 等合法业务入口。
- 返回空数组是合法成功状态；不能把“没有历史”当作 IPC 错误。
- 不加 offset、不加分页、不改数据库、不建立新历史表。

**测试：** 空历史；默认 limit；负数/小数/字符串/超大 limit clamp 或拒绝；正确排序；DTO 字段白名单；不暴露凭据/内部路径；历史读取错误有明确错误 result。

### P1-09：严格 CSP 与旧页隔离

**目标：** React 新页面生产 CSP 严格，同时 classic 旧页保持现有可运行行为。

**文件：**

- 新 `src/renderer/index.html`；
- `vite.config.ts`（开发/生产 CSP 注入策略）；
- 更新 `tests/rendererIsolation.test.cjs`。

**生产 CSP 基线：**

```text
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' file: data:;
font-src 'self' data:;
connect-src 'none';
object-src 'none';
base-uri 'none'
```

这是起始策略，须在真实 Electron file renderer 中验证。不要为了解决一个 React 样式问题把 `unsafe-inline` 全局加回；优先改为外部 CSS 和 class。若 React/第三方库确实要求 inline style，必须在评审中说明具体来源与最小 CSP 放宽，不允许默认引入。

**开发 CSP：** 只允许 `127.0.0.1:<固定端口>` 的脚本/HMR websocket 连接，且只在 dev server 模式；生产 build 必须无 localhost、ws、unsafe-eval、unsafe-inline。

**旧页：** Phase 1 不直接修改 `resource/library/index.html` 的旧 inline CSS/JS，否则可能破坏 classic 回退。新旧页面的 CSP 分开验证；旧页后续若有单独安全整改，独立做兼容性测试。

### P1-10：electron-builder、gitignore 与 release CI 闭环

**目标：** 确保 React build 的产物进入所有平台安装包且不会进 Git。

**文件：**

- 修改 `package.json`；
- 修改 `electron-builder.files`；
- 修改 `.gitignore`；
- 修改 `.github/workflows/release.yml`；
- 新增或修改 `tests/rendererPackageContents.test.cjs`（如测试策略允许）。

**构建输出选择：** 统一使用根目录 `ui2-renderer/`，避免和 tsc 的 `dest/` 相互清理。`electron-builder.files` 增加精确条目 `ui2-renderer`。`resource/library` 必须继续包含，供 classic fallback；`resource/login`、`resource/mpv-overlay`、`build`、`third_party` 的现有处理不得回归。

**Scripts 责任：**

- `renderer:build` 单独构建 React bundle；
- 所有正式 `build:win`、`build:mac`、`build:linux` 入口在调用 electron-builder 前必须执行 `compile` 和 `renderer:build`；
- `build:linux` 的 x64/arm64 多架构构建避免重复清理已生成的 renderer；
- `clean` 同时清理 `dest` 与 `ui2-renderer`，但不能清理 `third_party` 或用户资源；
- 保留 proxy、MPV zip 下载、macOS universal lipo、签名配置与 artifact 命名行为。

**CI：**

- `.github/workflows/release.yml` 保留 Node 22、Go 1.24、第三方 MPV zip 下载和现有 matrix；
- 增加 `npm test`（若已有则沿用）；
- 确认 CI 调用的每个平台 build script 都会产生 renderer 产物；
- 对 `release/*.exe`、`*.dmg`、`*.AppImage` 之外，不改 artifact 上传匹配规则；
- 构建后检查安装包 `app.asar` 或资源目录确实包含 `ui2-renderer/index.html` 与全部 hash assets；同时包含 `resource/library/index.html`；
- 至少一次实际安装包启动测试：默认 classic、强制 react、react 资源缺失 fallback 三条路径。

**验收：** 三平台 CI build 不缺 renderer；本地当前平台安装包可启动；包内同时有 React 和 classic 两套入口；`ui2-renderer/` 不出现在 Git diff。

### P1-11：阶段回归与交付记录

**目标：** 结束阶段时交付可审阅的变化和证据。

**文件：**

- 更新 `docs/ui2/phase1/BASELINE.md`；
- 新增 `docs/ui2/phase1/IMPLEMENTATION_LOG.md`；
- 新增 `docs/ui2/phase1/TEST_REPORT.md`；
- 新增 `docs/ui2/phase1/ROLLBACK.md`。

**回归内容：**

1. 初次启动（无 uiShell 配置）进入 classic；
2. uiShell=classic 进入旧库页；
3. uiShell=react 能启动新 renderer；
4. 删除/重命名 React 产物后回退 classic；
5. login 页行为不变；
6. privacy mode 原有行为不变；
7. 窗口 minimize/maximize/close、拖拽、macOS traffic lights 不变；
8. 原有源列表/添加/删除/扫描行为不变；
9. TMDB 刮削、手动匹配、封面缓存不变；
10. MPV 播放、字幕、弹幕、跳过片头片尾、续播和进度回传不变；
11. 托盘、更新、代理和系统退出行为不变；
12. B1/B2/B3 测试通过并未泄漏密码。

**交付报告：** 列出实际变更文件、commit SHA、测试命令和输出、打包平台、手动测试环境、已知限制、未完成项。不得只写“测试通过”，需要提供命令与摘要。

---

## 5. IPC 契约登记

所有 channel 名称最终必须与项目当前命名、事件风格和 `rendererIsolation.test.cjs` 一致。以下是推荐最小命名，不应与现有事件冲突。

| 功能 | SEND channel | RECEIVE channel | 状态 |
|---|---|---|---|
| 既有源分类设置缺口 | `library:set-source-category` | —（fire-and-forget 语义） | 发送方已核实（`library.ts:306`），登记 SEND（登记表 P2） |
| 既有源更新通知 | — | `library:source-updated` | 发送方已核实（`library.ts:318`），登记 RECEIVE（登记表 P2） |
| 刮削状态信息 | — | `library:scrape-status-info` | 发送方已核实（`library.ts:650-652`，死通道转正），登记 RECEIVE（登记表 P2） |
| B1 连接测试 | `library:test-source` | `library:test-source-result` | 已批准新增 |
| B2 编辑源 | `library:update-source` | `library:source-updated` | 已批准新增；若既有事件 payload 不兼容，应增加 `library:update-source-result`，不要复用同名不同结构 |
| B3 最近播放 | `library:history` | `library:history-info` | 已批准新增（通道名与 limit≤50 以登记表 §2 为准） |

### 5.1 命名冲突处理

用户审查中指出 `library:source-updated` 既是旧 UI 缺失的 RECEIVE event，也是 B2 编辑源成功后自然需要的事件。OpenCode 必须先查当前 emitter：

- 如果现有 event 的 payload 已经是安全 source view model 且语义符合“任何 source update 已完成”，B2 可以复用；
- 如果现有 event 是另一个用途或 payload 不兼容，B2 请求响应应使用独立 `library:update-source-result`，并在成功后按现有约定另发 source-updated；
- 不得让旧 UI 现有 listener 因 payload 改变而回归。

所有 request/result 使用 `requestId`。事件 listener 必须能够 off，并在 React 卸载时清理。

---

## 6. 重点测试与验收矩阵

| 测试域 | 自动化测试 | 手动/集成验证 | 通过标准 |
|---|---|---|---|
| 构建隔离 | main `tsc`、renderer typecheck、Vite build | 启动 React scaffold | 输出目录不互相清理，main entry 不变 |
| CSP | 静态检查 production HTML | Electron file renderer 真实加载 | 不含 unsafe-inline、connect-src none、本地图片可显示 |
| Preload | isolation 测试 | file、loopback dev、remote page | 仅允许 file 与精确 loopback dev URL |
| Shell switch | resolver unit tests | classic / react / missing React bundle | default classic，React failure fallback once |
| IPC whitelist | static/test pin channel sets | React UI 发一条安全测试请求 | 无未授权 channel，无广播 |
| B1 local | mocked fs test | 测试一个真实本地目录及不存在路径 | 状态正确，时延有限，错误脱敏 |
| B1 SMB | fs path mock + platform condition | 在目标操作系统测实际 SMB share | 仅验证 OS 路径权限，不引入新协议 |
| B1 WebDAV | mocked axios/status tests | 测已知合法 WebDAV root（如本地测试服务器） | PROPFIND shallow probe、无递归扫描 |
| B2 source update | JSON/SQLite store tests | 编辑源路径/名称、WebDAV 密码替换 | 存储更新正确，凭据永不回 renderer |
| B3 history | limit/DTO/sort tests | 有历史/无历史状态验证 | 空数组有效、limit 有界、字段最小化 |
| Package | output existence tests | 安装包解包检查 | React + classic + login + mpv-overlay 资源都在 |
| Legacy regression | Node suite | 扫描、刮削、MPV、托盘/更新 smoke | 已有能力无回归 |

### 6.1 建议的自动化用例文件

以下文件名是新增建议，若项目已有同类测试则扩展已有文件，不重复建立测试框架：

- `tests/uiShellResolver.test.cjs`
- `tests/preloadDevOrigin.test.cjs`
- `tests/librarySourceTest.test.cjs`
- `tests/libraryUpdateSource.test.cjs`
- `tests/libraryHistoryIpc.test.cjs`
- `tests/rendererPackageContents.test.cjs`
- 更新 `tests/rendererIsolation.test.cjs`

测试文件命名必须符合当前 `node --test tests/*.test.cjs` glob，否则不会被现有 `npm test` 执行。

### 6.2 必须运行的命令

```bash
npm run compile
npm test
npm run renderer:build
npm run start:ui2
npm run build:win      # Windows runner
npm run build:mac      # macOS runner
npm run build:linux    # Linux runner
```

不是每台开发机都要本地执行三个平台安装包；其他平台由 CI matrix 执行。但最终发布门禁必须有三平台 CI 结果。若现有脚本名称不同，按仓库实际脚本映射并记录。

---

## 7. 回滚方案

### 7.1 最快回滚（不回滚代码）

将 `uiShell` 设置为 `classic`，重启后应用继续加载 `resource/library/index.html`。此操作用于 React renderer 出现 UI 问题但主进程和 preload 没有故障的情况。

### 7.2 React 产物加载失败

`loadLibraryPage()` 自动回退 classic；记录 `uiShell=react`、失败阶段和错误 code，不记录用户路径或凭据。不要删除 React 产物或循环重试。

### 7.3 Phase 1 代码回滚

- 回退 Vite/React 包依赖、配置和 renderer 目录；
- 还原 `loadLibraryPage()` 为 classic 路径；
- 保留或单独回退 B1/B2/B3 IPC，避免与 UI scaffold rollback 混成一个大提交；
- 不回滚用户数据库，不清理 `~/.fntv`，不删除用户媒体源或观看历史；
- 不回滚 `third_party` 下载产物或改写 MPV 配置。

### 7.4 推荐提交切分

按以下逻辑提交，确保容易 revert：

1. `chore(ui2): add renderer build pipeline`
2. `feat(ui2): add classic/react shell resolver and fallback`
3. `fix(preload): align renderer IPC allowlists`
4. `feat(library): add source connection test IPC`
5. `feat(library): expose safe source update IPC`
6. `feat(library): expose recent history IPC`
7. `test(ui2): add packaging and renderer isolation coverage`

若用户采用 squash merge，可合并提交，但仍按上述工作包顺序执行和验证。

---

## 8. 后续阶段路线图（非 Phase 1 的编码范围）

| 阶段 | 目标 | 主要功能 |
|---|---|---|
| Phase 2 | Apple 风格 App Shell | 主题、Tokens、Sidebar、Toolbar、TitleBar、路由、隐私模式入口/裁剪、Cmd/Ctrl+K |
| Phase 3 | 首页与媒体库 | 首页紧凑布局、继续观看（接 B3）、电影/剧集/动漫/其他视频分类、筛选、分页策略、详情入口 |
| Phase 4 | 媒体源与任务 | 媒体源向导（接 B1）、源编辑（接 B2）、扫描/刮削的真实状态和错误、Task Center MVP |
| Phase 5 | 详情、播放和设置 | 现有详情/收藏/观看状态映射、MPV 播放入口、字幕/弹幕现有控制说明、真实存在的设置与 About |
| Phase 6 | 逐步切换与回归 | 默认 UI 切换为 React 的发布决策、跨平台、长期回归和 classic deprecation plan |

**切换默认值的门槛：** Phase 1 完成不代表可切默认；必须等 Phase 2–5 用户路径完整、三平台 CI 和实际安装包测试通过、旧业务无回归，再单独批准把普通用户 `uiShell` 默认值由 classic 改为 react。

### 8.1 明确延后或取消项

- category=other 在 Phase 3 落到 `/library/others`；
- 大库分页/虚拟列表作为 Phase 3 的 catalog 专项评估；
- 不做独立“媒体库健康”页；
- 不新增 source enabled 字段；
- 不做 FN Media 内置字幕/弹幕配置页，MPV portable_config 只提供说明/目录入口（若现有安全能力允许）；
- 不做 cast/crew；
- 不增加 Task Center taskId、取消按钮或持久化记录，直到后端确实有相应能力；
- fnOS login、play-movie、preload 注入插件、dormant fnos-adapter 保持原样。

---

## 9. OpenCode 执行规则

1. 在仓库根目录启动 OpenCode，确保它读取项目根 `AGENTS.md`。
2. 先检查 `.trellis/`、`.agents/skills/`、`.codex/`：优先遵循当前项目规范；Codex 目录只做历史参考，不把其中工具命令当作 OpenCode 必需步骤。
3. 根 `AGENTS.md` 已存在时不要运行 `/init` 覆盖它；只在确有必要时提出最小追加内容，并先展示 diff。
4. 不创建或修改用户全局 `~/.config/opencode/` 配置；不为本计划强加新的 `opencode.json`、agent、skill 或 plugin。
5. 先用 OpenCode Plan/Read-only 审查任务完成 P1-00，再逐工作包实现；如果 OpenCode 当前版本支持子 agent，可以分配只读审计、测试审查等任务，但同一时间只能有一个 agent 修改共享构建配置或 preload/library handler。
6. 每个工作包结束都要运行该工作包的最小验证；出现失败先定位，不可用跳过测试或删除断言的方式“修绿”。
7. 不允许对 main/preload/数据库做无关重构；不允许静默扩大 IPC allowlist。
8. 每个提交前检查 `git diff --check`、`git status --short`，并确认没有 `ui2-renderer/` 构建产物、凭据、用户配置或第三方二进制意外进入 Git。
9. 用户未要求自动提交/推送，因此 OpenCode 不得未经确认 commit、push、release 或修改 GitHub secrets。
10. 最终报告必须记录真实 HEAD SHA、改动文件、命令输出摘要、打包与手动验证结果。

OpenCode 官方规则说明项目级 `AGENTS.md` 会作为项目指令加载；项目 config 的 `instructions` 可引入额外文件，但本项目已有 AGENTS.md，因此 Phase 1 不需要为载入这份计划而新建全局配置。计划文件通过主会话明确引用即可。

---

## 10. Phase 1 风险登记

| 风险 | 影响 | 缓解 |
|---|---|---|
| Vite dev HTTP 页面不触发 preload API 暴露 | React dev 页面能显示但无法 IPC | 增加精确 loopback dev origin allowlist 并测试 remote rejection |
| CSP 与 file:// bundle 资源路径不匹配 | 生产白屏 | `base:'./'` + 打包后 Electron smoke test |
| Vite build 输出被 clean/tsc 清空 | builder 缺 renderer | renderer 输出与 dest 分离为根 `ui2-renderer/`，构建顺序固定 |
| electron-builder.files 漏加产物 | dev 可用但安装包白屏 | 精确新增 `ui2-renderer`，检查 app.asar contents |
| `uiShell` 放入错误 config store | 凭据配置污染或启动时 config schema 出错 | 使用通用非敏感 preference store，不进入 fnOS token/cookie config |
| `library:source-updated` 语义冲突 | 旧 UI listener 回归 | 先核对现有 emitter/payload，必要时新建 update result channel |
| WebDAV test 复用递归扫描 | 测试耗时、产生误报/过载 | 新增单次 PROPFIND depth 0 测试 helper |
| SMB 路径行为跨平台差异 | 测试误报 | 沿用 Node fs 访问当前平台路径，错误状态区分；真实 SMB 在对应平台测 |
| B2 更新密码操作语义不清 | 意外清空或覆盖凭据 | keep/replace/clear 显式三态，空字符串默认 keep |
| WatchedEntry 暴露过多内部字段 | 路径或内部元数据泄露 | 主进程投影最小 HistoryItemViewModel |
| preload allowlist 测试不完整 | 运行时静默失败或过度开放 | 测试静态集合与真实 handler 双向对应 |
| 过早切换 React 默认 | 用户无法回退 | Phase 1 default classic，默认切换单独审批 |
| OpenCode 项目协作规则冲突 | agent 不遵循工作流 | 开工先读取 AGENTS/Trellis，报告冲突，不覆盖文件 |

---

## 11. 最终交付清单

Phase 1 交付时，OpenCode 必须提供：

- [ ] `docs/ui2/phase1/BASELINE.md`
- [ ] `docs/ui2/phase1/IMPLEMENTATION_LOG.md`
- [ ] `docs/ui2/phase1/TEST_REPORT.md`
- [ ] `docs/ui2/phase1/ROLLBACK.md`
- [ ] React renderer 源码与 Vite 配置
- [ ] 独立 renderer TS config
- [ ] `start:ui2` 开发启动命令
- [ ] `uiShell` resolver + classic fallback
- [ ] preload exact dev-origin allowlist
- [ ] IPC allowlist 已修复并测试
- [ ] B1 source connection test IPC
- [ ] B2 update source IPC（credentials safe）
- [ ] B3 recent history IPC（bounded limit + safe DTO）
- [ ] strict production CSP
- [ ] electron-builder files / `.gitignore` / CI/build scripts 更新
- [ ] Node tests 全部通过
- [ ] 当前平台安装包 smoke test 记录
- [ ] 三平台 CI artifact 记录

## 12. 最终给 OpenCode 的执行口令

完整提示词见单独文件 `FN_Media_UI2_OpenCode_Phase1_Prompts.md`。执行原则是：**先 P1-00 只读基线，再按 P1-01 到 P1-11 顺序实施；B1/B2/B3 已批准，不再等待产品审批，但接口字段必须以真实 SourceConfig/WatchedEntry 和现有凭据 helper 为准。**

---

## 13. 执行修订（2026-11-14 决策确认，OpenCode Phase 1 前置工程任务）

> 本节记录实施前已由产品负责人确认的四项工程决策，优先于前文冲突表述。

### 13.1 docs 目录白名单入库

- 保持 `docs/` 整体忽略，仅在 `.gitignore` 末尾放行 `docs/ui2/`：

```gitignore
# Keep docs ignored except FN Media UI 2.0 records
!/docs/
/docs/*
!/docs/ui2/
!/docs/ui2/**
```

- 纳入版本管理的记录：`BASELINE.md`、`CURRENT_STATE_AUDIT.md`、`IPC_CONTRACT_MAP.md`、`MIGRATION_LOG.md`、`UI2_DECISION_GAPS.md`，以及 UI 2.0 规格、实施计划与决策登记表。
- 验证命令：`git check-ignore -v docs/ui2/phase1/BASELINE.md`（不忽略）、`git check-ignore -v docs/other.md`（仍忽略）。
- 审计/记录文档不得包含密码、Token、绝对用户目录等敏感内容。

### 13.2 package-lock.json 纳入跟踪 + npm ci

- 移除 `.gitignore` 中 `package-lock.json` 忽略行（不顺带放开其他构建产物）。
- 使用项目当前 Node/npm 生成 `package-lock.json`（lockfileVersion 3），与 `package.json` 一并提交；CI Node 固定 22（npm 10），lockfile 兼容。
- `package.json` 增加 `engines.node >=22.13.0`（`node:sqlite` 在 22.13 起无需实验开关）。
- 本地与 CI 统一使用 `npm ci`（`--omit=optional --no-audit --no-fund`），不再以 `npm install` 作为常规安装方式。
- 已知本机注意：Node 24（npm 11）下 Electron 38 的 postinstall 解压可能静默中断（`ELECTRON_SKIP_BINARY_DOWNLOAD` 未设置时也可能出现）；表现为 `node_modules/electron/dist` 缺 `electron.exe`。修复方式：用缓存 zip 手动解压到 `dist/` 并写入 `path.txt`，或改用 Node 22 安装。CI（Node 22）不受影响。

### 13.3 启动入口统一

- 不在 `main.ts` 另造窗口加载逻辑；保留 `main.ts` 现有启动路径，由 `winctrl.loadLibraryPage` 统一根据 `uiShell` 选择 classic 或 React 页面。
- React 资源缺失或加载失败时只回退一次到 `resource/library/index.html`；普通用户缺省值保持 `classic`。

### 13.4 Release CI 与 PR CI 门禁

- `release.yml`：安装改用 `npm ci`；新增 `npm test` 步骤，测试通过后才允许平台打包；保留 Node 22 / Go 1.24 / mpv-config zip 下载解压顺序与平台 matrix。macOS 的 `dmg-license` 安装改为 `--no-save`，不修改 package.json/lockfile。
- 新增 `.github/workflows/pr-ci.yml`：针对向 `ui2-integration`（及 `main`）提交的 Pull Request 执行 `npm ci → npm run compile → npm test`。
- 测试顺序：构建（tsc → dest）→ 测试（现有 Node CJS 测试基于 dest 产物）→ renderer 构建（P1-02 引入后）→ 打包。保留现有 Node CJS 测试体系，不因引入 Vite 而替换为 Vitest；React 组件测试未来独立增加。
- Renderer 构建脚本将在 P1-02 引入（建议命名 `renderer:build`），P1-09 负责接入 release.yml 与 PR CI 的打包前步骤。
