# UI 2.0 Phase 2 — 基线审计（PHASE2_BASELINE）

生成时间：2026-11-14
执行口径：Phase 2 Prompt 0（只审计，不实施页面、不改业务代码）

## 1. 仓库状态

| 项 | 值 |
|---|---|
| 分支（审计时） | `feature/ui2-phase2`（基于 `ui2-integration`，Phase 2 工作分支） |
| HEAD | `74302df`（docs: 补全 Phase 1 Git 记录） |
| Tag | `ui2-phase1-complete` → `74302df`（与 HEAD 一致） |
| 工作区未提交（用户文件，未触碰） | `M AGENTS.md`、`?? FN_Media_UI2_Phase1_OpenCode_Package/`、`?? fn_media_ui2_demo.html` |
| Phase 1 验收 | 217/217 测试、compile/typecheck/build 通过（见 `docs/ui2/phase1/PHASE1_FINAL.md`） |

## 2. 真实源码树（Phase 2 相关）

```
src/
├── main/
│   ├── main.ts                    # 启动链路（proxy→窗口→插件→loadLibraryPage→更新检查）
│   ├── common/
│   │   ├── mainwin.ts             # 主窗口：frame=isMac；frameless(Win/Linux)；contextIsolation=true/sandbox=false
│   │   ├── winctrl.ts             # loadLibraryPage（classic/react 双壳）+ 全屏/输入法/窗口显示
│   │   ├── uiShell.ts             # uiShell 解析（Phase 1）
│   │   └── preferences.ts         # 通用偏好（macCloseAction 等，fn_config 存储）
│   └── handlers/plugins/
│       ├── library.ts             # 媒体库全部 IPC（含 B1/B2/B3）
│       ├── media.ts               # play-library-item / play-movie / MPV 生命周期
│       ├── wincontrol.ts          # window-minimize / maximize / close
│       ├── update.ts / config.ts / auth.ts / tray.ts / logger.ts / mpvConfig.ts
├── modules/library/               # store(sqlite/json)、catalog、privacy、scanner、scraper、playback、webdav 等
├── preload/
│   ├── index.ts                   # 桥接白名单（SEND/RECEIVE）+ dev-origin allowlist
│   ├── core/devOrigin.ts          # 精确 loopback 白名单（Phase 1）
│   └── plugins/titlebar.ts        # 注入 #custom-titlebar（拖拽 + Win/Linux 自绘窗控）
└── renderer/                      # Phase 1 最小 React 壳
    ├── index.html                 # 生产 CSP（connect-src 'none'）
    ├── main.tsx / App.tsx / app.css / bridge.d.ts
resource/
├── library/index.html            # classic 旧 UI（单页原生 JS，约 1700 行）
├── login/index.html              # 登录页
└── mpv-overlay/                  # mpv 插件补丁覆盖层（uosc_danmaku + mpv.conf）
```

## 3. 旧 UI（classic）对照

### 3.1 结构与能力

单页应用（无路由）：`#titlebar`（自绘标题栏 + `#winMin/#winMax/#winClose`）→ `#topbar`（隐私入口 `#privacyMenuBtn`▾ / 搜索框 / 分类 Tabs / 观看状态 / 收藏状态 / 排序 / 视图切换 / 扫描 / 刮削 / 源管理 / 设置）→ `#continueSection`（继续观看）→ `#sectionTitle` + `#grid` / `#listView` → `#detail`（侧滑详情：电影条目详情 + 季详情）→ `#modal`（源管理 / 刮削设置 / 隐私密码 / TMDB 手动匹配）。

### 3.2 分类枚举（与主进程一致）

`SourceCategory = 'movie' | 'tv' | 'anime' | 'other'`（`src/modules/library/sourceCategory.ts`）；旧 UI Tabs：`all/movie/tv/anime/other`，`all` 不传 `category`。Phase 2 路由映射：`/library/movies→movie`、`/library/tv→tv`、`/library/anime→anime`、`/library/others→other`。

### 3.3 数据入口（旧 UI 调用点）

- 列表/搜索/排序/筛选：`library:catalog`（index.html:415 `loadItems`）
- 季详情：`library:show`（:553）；电影/剧集条目详情：`library:item`（:726）
- 继续观看：`library:continue`（:367）
- 播放：`play-library-item`（:873 `playItem`）
- 收藏：`library:set-favorite`；观看状态：`library:set-watched`
- 源管理：`library:list-sources` / `add-source` / `remove-source` / `set-source-category` / `pick-folder`
- 扫描/刮削：`library:scan` → `library:scan-done`；`library:scrape` → `library-scrape-started/progress/done`；`library:scrape-status` → `library:scrape-status-info`（旧 UI 未使用，React 可轮询）
- 隐私：`library:privacy-begin/unlock/set-password/lock/reset` → `privacy-state/privacy-result`
- 设置：`library:settings-get/set`；刮削手动匹配：`library:search-tmdb` → `library:search-results`；`library:apply-match` → `library:match-applied`
- 版本：`get-version` → `version-info`；播放结束推送：`library-playback-ended`

## 4. Renderer API 清单（preload 白名单 → main handler）

| 能力 | SEND 通道 | 参数 | 回复通道 / 回包 | handler |
|---|---|---|---|---|
| 目录查询（列表/搜索/筛选） | `library:catalog` | `{kind?('all'|'movie'|'episode'), category?, watched?, favorite?, query?, sort?('added'|'title'|'year'|'recentPlayed'), limit?(UI 用 600), private?}` | `library:catalog-info` `{entries: CatalogEntry[], locked?}` | library.ts:398 |
| 条目详情 | `library:item` | `{id}` | `library:item-info` `{item, show, watchState, favorite, episodes, versions}` / `{error}` | library.ts:364 |
| 季详情 | `library:show` | `{id, season?}` | `library:show-info` `{show, season, seasonInfo, favorite, episodes, states}` / `{error}` | library.ts:424 |
| 继续观看 | `library:continue` | `{private?}` | `library:continue-info` `{entries:[{item,state,showTitle}]}` | library.ts:603 |
| 播放 | `play-library-item` | `{itemId}` | **无回包**（详见缺口 G3） | media.ts:778 |
| 收藏 | `library:set-favorite` | `{type:'movie'|'show'|'season', id, season?, favorite}` | `library:favorite-set` `{success, favorite?, error?}` | library.ts:697 |
| 观看状态 | `library:set-watched` | `{id, watched}` | `library:watched-set` `{success,error?}` | library.ts:655 |
| 源列表 | `library:list-sources` | `{private?}` | `library:sources-info` `{sources:[{id,type,name,config,createdAt,lastScanAt,itemCount,category}], locked?}` | library.ts:246 |
| 添加源 | `library:add-source` | `{type,name,rootPath?,url?,username?,password?,category?,private?}` | `library:source-added` `{source}` / `{error}` | library.ts:197 |
| 移除源 | `library:remove-source` | `{id}` | `library:source-removed` `{success,error?}` | library.ts:329 |
| 源分类 | `library:set-source-category` | `{id, category}` | `library:source-updated` `{success,error?}` | library.ts:310 |
| 选择文件夹 | `library:pick-folder` | `{multiple?}` | `library:pick-folder-result` `{path, paths}` | library.ts:182 |
| 扫描 | `library:scan` | `{}`（全部 local）或 `{sourceId}` | `library:scan-done` `{added,updated,removed,skipped,removedSources?,error?}` | library.ts:342 |
| 刮削 | `library:scrape` | `{force?}` | `library:scrape-started` `{started}|{error}`；进度 `library-scrape-progress` `{done,total}`；结束 `library-scrape-done` `{summary}|{error}` | library.ts:755 |
| 刮削状态 | `library:scrape-status` | `{}` | `library:scrape-status-info` `{running, lastSummary}` | library.ts:791 |
| 刮削设置 | `library:settings-get/set` | `{apiKey?, apiBaseUrl?, imageBaseUrl?, language?}` | `library:settings-info` / `library:settings-set` | library.ts:895/899 |
| TMDB 搜索/匹配 | `library:search-tmdb` / `library:apply-match` | `{query}` / `{itemId, tmdbId}` | `library:search-results` / `library:match-applied` | library.ts:817/860 |
| 隐私 | `library:privacy-begin/unlock/set-password/lock/reset` | `{password?}` 视通道 | `library:privacy-state` `{hasPassword, unlocked}`；`library:privacy-result` `{success, unlocked?, error?, reset?}` | library.ts:255-300 |
| 版本 | `get-version` | 无 | `version-info` `{version}` | update.ts:38 |
| 窗口控制 | `window-minimize/maximize/close` | 无 | 无回包 | wincontrol.ts:32-34 |
| 播放结束推送 | （main → renderer） | — | `library-playback-ended` | media.ts EXIT |
| B1/B2/B3（Phase 2 不接线） | `library:test-source` / `library:update-source` / `library:history` | 见 Phase 1 契约 | `library:test-source-result` / `library:source-updated` / `library:history-info` | library.ts:467/530/581 |

**store/业务来源**：以上全部经由 `src/modules/library/libraryService.getLibraryStore()`（SQLite，JSON 兜底）与既有 scanner/scraper/playback 模块；renderer 不直接触达。

**隐私门禁**（main 侧可信边界，renderer 仅展示）：
- `library:list-sources`（private=true 未解锁 → `{sources:[],locked:true}`，library.ts:248）
- `library:catalog`（private=true 未解锁 → `{entries:[],locked:true}`；public 排除隐私源，:403-410）
- `library:item`（隐私条目未解锁 → error，:372）、`library:show`（:431）
- `library:continue`（:605-609，`takeContinueByVisibility`）、`library:history`（:585-590）
- `library:set-watched` / `set-favorite`（:722/:730）
- `play-library-item`（media.ts:561-562：隐私未解锁拒绝播放）
- 刮削跳过隐私源（scraper.ts:76/207）

## 5. 窗口与标题栏（三平台）

| 项 | 现状 |
|---|---|
| 窗口 | `mainwin.ts`：`frame: isMac`；macOS `titleBarStyle:'hiddenInset'` + `trafficLightPosition`；Windows/Linux frameless |
| 窗控 IPC | `window-minimize`（minimize）/ `window-maximize`（maximize↔setHalfScreen）/ `window-close`（close），wincontrol.ts:32-34 |
| 标题栏注入 | `preload/plugins/titlebar.ts`：**仅当页面不含 `#titlebar` 时注入** `#custom-titlebar`（32px 固定拖拽区，z-index 99999；Win/Linux 内置 min/max/close 按钮；macOS 仅透明拖拽区）；并设置 `body.padding-top:10px`、`html overflow-y:hidden` |
| 旧 UI | 自带 `<div id="titlebar">` + `#winMin/#winMax/#winClose` → 插件跳过注入 |
| React 影响 | 当前 `src/renderer/index.html` **没有** `#titlebar` → 插件会注入自定义标题栏（Win/Linux 带按钮、macOS 透明拖拽） |

**P2-02 决策点（基线建议）**：React 直接复用注入的 `#custom-titlebar`（零新增 IPC、与登录页行为一致）；布局预留顶部 32px 拖拽高度，交互控件设置 `-webkit-app-region:no-drag`；不改 titlebar 插件生命周期。若改为自绘窗控，需在 React 页面放置 `#titlebar` 占位以抑制注入——涉及 preload 行为，需另行评审。

## 6. React renderer 现状与设施

- 源码：`src/renderer/{index.html, main.tsx, App.tsx, app.css, bridge.d.ts}`（最小壳）
- 依赖：React 19.3 / Vite 8.3 / @vitejs/plugin-react（Phase 1 引入）；无路由库、无 UI 库、无测试库
- 构建：`renderer:typecheck`（`tsconfig.renderer.json`）+ `renderer:build`（Vite → `ui2-renderer/`，base `./`，生产 CSP 严格、dev-only HMR ws 例外）
- 测试：`node:test` + `tests/*.test.cjs`（217 项，基于 `dest/**` 编译产物与文件断言）；React 组件测试设施尚未引入
- 运行时：`src/preload/index.ts` 在 file: 页面与精确 loopback dev origin 暴露 `window.electronAPI`（send/on/once/off/openExternal）+ `window.log`

## 7. 缺失接口与缺口清单（只记录，不实施）

| 编号 | 缺口 | 影响 | 建议处理（Phase 2 范围内） |
|---|---|---|---|
| G1 | 无分类计数/统计接口 | 侧栏 LibrarySummary 无法直接取数 | 用既有 `library:catalog`（4 次真实查询，limit 600）加载时计数；不新增通道 |
| G2 | 无"扫描进行中/最近结果"查询接口（`library:scan` 仅事件回包） | Tasks 页无法展示扫描状态 | Phase 2 仅显示刮削实时状态（`library:scrape-status`）；扫描区域显示"暂无可用状态"；记录缺口，不扩展 |
| G3 | `play-library-item` **无成功/失败回包**，播放错误仅主进程日志 | 详情页"播放失败反馈"无法在 renderer 实现 | Phase 2 播放按钮沿用 fire-and-forget 语义（与 classic 一致）；标记缺口，后续由产品决策是否新增 `play-library-item-result` 事件（不在 Phase 2 新增） |
| G4 | `library:catalog` 的搜索只匹配标题/原名为准（剧集按 show.title；电影按 title/originalTitle），不按文件名 | 搜索文案与能力需对齐 | UI 搜索 placeholder 用"搜索标题"；不承诺文件名搜索；记录缺口 |
| G5 | 无路由依赖/实现 | `/library/*`、`/media/:id` 需要路由 | 采用 **hash 路由**（Electron file:// 兼容，无需 server fallback）：优先 `react-router-dom` HashRouter（新增依赖需批准）或轻量自研路由状态机；基线建议 React Router HashRouter |
| G6 | 无 React 组件测试设施（无 jsdom/testing-library） | 组件级测试不可直接跑 | P2 期间用纯函数 mapper/service 测试（node:test）；组件交互用 dev Electron + 手动/脚本验证；不引入 Vitest |
| G7 | 部分已注册通道不在 preload 白名单：`get-nas-proxy`/`set-nas-proxy`、`auto-check-update`、`log-message` | 旧 UI 未使用 | Phase 2 不给 React 使用；如未来需要，先走白名单登记评审 |

## 8. 风险与回归重点

1. **标题栏注入冲突**：React 若自绘窗控且未抑制注入 → 控件重复；按 §5 决策复用注入。
2. **CSP 约束**：生产 `style-src 'self'`、`connect-src 'none'`；不得使用 inline style 属性/CSS-in-JS/远程字体与 CDN（标题栏插件用 DOM style API 属运行时属性设置，不受影响）。
3. **隐私泄漏面**：React 侧缓存（组件 store、搜索历史、路由返回）必须在模式切换/锁定时清空；所有隐私过滤以 main 门禁为准，前端裁剪仅作展示。
4. **大列表性能**：catalog limit 600；先测量再决定虚拟滚动（不提前引入依赖）。
5. **回退路径**：不得改变 `winctrl.loadLibraryPage` 的 classic/react 解析与单次回退；React 任何改动不得影响打包默认 classic。
6. **播放/进度/字幕/弹幕/跳过片头**：Phase 2 仅调用 `play-library-item`，不得触碰 media.ts、mpv 配置与 smart_skip。

## 9. Phase 2 实施顺序与阶段门禁（沿用实施计划 §6）

0. P2-00 审计（本文件）→ 1. P2-01 设计系统 → 2. P2-02 Shell/路由 → 3. P2-03 首页 → 4. P2-04 媒体库 → 5. P2-05 详情/播放接线 → 6. P2-06 搜索/源/任务 → 7. P2-07/08 集成验收。
每阶段 DoD：compile/test/typecheck/build 全绿 + loading/empty/error/success 状态 + 隐私/键盘/窗口无退化 + 实施日志更新 + 停止等待确认。

**需用户/产品批准的决策点（进入对应阶段前确认）**：
1. G5 路由方案（推荐：`react-router-dom@7` HashRouter，新增 1 个运行时依赖）或自研路由。
2. §5 标题栏复用注入方案（推荐）；若要求完全自绘窗控需改 preload 行为。
3. G3 播放结果反馈是否留待后续阶段（Phase 2 按缺口处理）。
