# UI 2.0 Phase 2 — 实施日志（PHASE2_IMPLEMENTATION_LOG）

## 已批准的 Phase 2 决策（2026-11-14）

1. **路由**：`react-router-dom@7` + **HashRouter**（file:// 兼容；category=other → `/library/others`；隐私切换/锁定清理缓存；不改 classic/react 加载与回退）。
2. **标题栏**：复用 preload 注入的 `#custom-titlebar`（顶部预留 32px；交互控件 `-webkit-app-region: no-drag`；不建第二套标题栏、不改 titlebar 插件）。
3. **播放反馈**：Phase 2 维持 fire-and-forget（只调 `play-library-item`；不虚构播放状态；`play-library-item-result` 作为后续独立需求）。

补充执行约束：不因 UI 需求扩展主进程接口（G1–G7 按基线处理）；不触碰播放底层（media.ts/MPV/字幕/弹幕/smart_skip）；严格阶段验收（compile/test/typecheck/build + 隐私/键盘/窗口检查 + 日志 + 停止等确认）；打包默认 classic 底线不变。

---

## P2-01 设计系统与基础组件（2026-11-14）

### 范围

Apple 风格 Light 默认设计系统：tokens、reset/global/组件样式、主题 Provider、基础交互组件与图标、海报组件。

### 文件清单

**新增 `src/renderer/styles/`**
- `tokens.css`：颜色/字体/间距/圆角/阴影/层级/动效/布局 tokens；`[data-theme='dark']` Dark 预留
- `reset.css`：盒模型、表单与基础元素归一
- `global.css`：背景/字体/滚动条/焦点环/`::selection`/视觉隐藏工具类
- `components.css`：Button/IconButton/Input/Dialog/Dropdown/Tooltip/Skeleton/EmptyState/ErrorState/Poster 样式（全部引用 tokens）

**新增 `src/renderer/theme/`**
- `theme.ts`：`ThemeMode/ResolvedTheme`、`DEFAULT_THEME_MODE='light'`、`resolveTheme`
- `ThemeProvider.tsx`：Light 默认；`data-theme` 运行时应用；system 模式监听 `prefers-color-scheme`；`useTheme`

**新增 `src/renderer/components/`**
- `icons/index.tsx`：内联线性 SVG 图标（Play/Star/Search/Close/ChevronDown/ChevronLeft/Folder/Settings/Scan/Sparkles/Film/MoreHorizontal/Check），无 emoji、无图标库
- `ui/Button.tsx`（variant/size/loading/block/icon，`aria-busy`）
- `ui/IconButton.tsx`（必填 `aria-label`）
- `ui/Input.tsx`（label/error，`aria-invalid`+`role=alert`，forwardRef）
- `ui/Dialog.tsx`（Portal、Escape 关闭、Tab 焦点循环、焦点恢复、`role=dialog`/`aria-modal`）
- `ui/Dropdown.tsx`（`aria-haspopup=menu`、role=menu/menuitem、方向键导航、Esc/外点关闭、焦点恢复）
- `ui/Tooltip.tsx`（纯 CSS data-tooltip，悬停/聚焦显示）
- `ui/Skeleton.tsx`（text/rect/circle，shimmer 动画）
- `ui/EmptyState.tsx` / `ui/ErrorState.tsx`（含重试按钮，`role=alert`）
- `media/PosterImage.tsx`（2:3 比例、lazy、加载失败/缺图占位、本地路径经 `toFileUrl`）

**新增 `src/renderer/utils/fileUrl.ts`**：Windows/UNC 路径 → `file://`（与 classic 同规则）

**修改**
- `src/renderer/main.tsx`：引入 4 个样式文件 + `ThemeProvider` 包裹 App
- `src/renderer/app.css`：改用 tokens（去除硬编码色值）
- `src/renderer/index.html`：`<html data-theme="light">`（避免主题闪烁）

**测试**
- `tests/ui2DesignSystem.test.cjs`（5 项）：tokens 完整性 + Dark 预留；设计系统文件齐全；**renderer 无内联 style 属性**（严格 CSP 兼容）；基础组件 ARIA 断言；主题默认 light + `data-theme` 运行时应用

### 命令与结果

| 命令 | 结果 |
|---|---|
| `npm run renderer:typecheck` | exit 0 |
| `npm run renderer:build` | exit 0（CSS 11.36 KB / JS 220.55 KB；生产 HTML `connect-src 'none'`，无内联样式） |
| `npm test` | **222 / 222 通过**（217 + 5 新增） |
| `npm run compile` | exit 0（main/preload 未改动） |
| file:// 渲染证据 | 开发版（`FNTV_UI_SHELL=react`）截图：tokens 生效、preload 注入标题栏窗控正常（`C:\Users\Administrator\AppData\Local\Temp\opencode\ui2-p201-design.png`） |

### DoD 自检（P2-01）

- [x] 变更文件清单明确
- [x] 无未说明 IPC / DB 字段 / 新依赖（本阶段零依赖新增）/ 构建配置变化
- [x] compile / test / typecheck / build 全绿
- [x] 组件具备必要状态（hover/focus/disabled/loading）与 ARIA；无 emoji 图标；无 CSS-in-JS、无内联样式（CSP 兼容）
- [x] 隐私/键盘/窗口行为无退化（本阶段未接业务与路由）
- [x] 无 console error / CSS 加载失败（构建产物内联链接本地资产）
- [x] 日志记录测试与证据

### 遗留与下一步

- 组件尚未被页面使用（P2-02 起接入）；路由依赖（react-router-dom@7）将在 P2-02 安装（已获批准）
- 渲染层纯函数单测（theme/fileUrl）暂以源码断言替代；P2-04 mapper 测试时增加 renderer 测试编译方案（不改现有 Node CJS 测试体系）
- G3 播放结果反馈、G2 扫描状态按基线缺口处理，不在 Phase 2 扩展
- **等待用户确认后进入 P2-02（App Shell、窗口与路由）**

---

## P2-02 App Shell、窗口与路由（2026-11-14）

### 已批准决策落地

- 路由：安装 `react-router-dom@^7.18.5`，使用 **HashRouter**；`category=other → /library/others`；路由切换不依赖服务器回退
- 标题栏：**复用 preload 注入的 `#custom-titlebar`**（实测 32px、Win/Linux 3 个自绘按钮）；React 未创建第二套窗控（因此未新增 WindowControls/MacTrafficLights 组件，与计划文件清单的差异本日志记录）；`app-window` 定位从 `top: 32px` 开始
- 播放：维持 fire-and-forget（本阶段未接播放）

### 文件清单

**新增 `src/renderer/app/`**：`routes.ts`（路由常量/分类映射）、`bridge.ts`（preload 薄封装 + onceReply 超时）、`AppBootstrap.tsx`（ErrorBoundary→Theme→Privacy→Router）、`AppRouter.tsx`（HashRouter 路由表）、`AppShell.tsx`（布局 + Cmd/Ctrl+K 搜索入口 + 占位搜索弹层）、`PrivacyStateProvider.tsx`（privacy-begin/unlock/lock 真实接线 + 密码门禁 Dialog）、`AppErrorBoundary.tsx`

**新增 `src/renderer/layout/`**：`WindowFrame.tsx`（标题栏下方内容区）、`Sidebar.tsx`（品牌/导航/管理/隐私入口/真实版本号 get-version）、`PrimaryNavigation.tsx`（NavLink 活动态）、`PageHeader.tsx`（标题 + 搜索触发，Ctrl K 提示）、`MainRegion.tsx`

**新增 `src/renderer/pages/`**：`home/HomePage`、`library/LibraryPage`（`:category` 解析，非法段重定向首页）、`detail/MediaDetailPage`（返回按钮）、`sources/SourcesPage`、`tasks/TasksPage`（诚实空态，标注接入阶段）

**其他**：`components/icons/index.tsx` 增加 Home/Tv/Lock 图标；`styles/shell.css`（布局全部 tokens + 交互元素 `-webkit-app-region: no-drag`）；`main.tsx` 改为挂载 `AppBootstrap`；**删除** 旧壳 `App.tsx` 与 `app.css`

**测试**：`tests/ui2Shell.test.cjs`（5 项）：HashRouter/路由表/other 映射、标题栏预留与 no-drag、文件清单、Ctrl/Cmd+K 与隐私接线

### 命令与结果

| 命令 | 结果 |
|---|---|
| `npm run renderer:typecheck` | exit 0 |
| `npm run renderer:build` | exit 0（CSS 14.92 KB / JS 275.52 KB，含 react-router-dom） |
| `npm test` | **227 / 227 通过**（222 + 5 新增） |
| `npm run compile` | exit 0 |
| CDP 运行时实测（dev electron `--remote-debugging-port=9222`） | 标题栏注入=true/32px/3 按钮；首页标题=首页；侧栏=首页/电影/剧集/动漫/其他视频/媒体源/任务状态/进入隐私模式；`/library/others`→标题「其他视频」且导航活动态正确、hash 正确；`/library/anime`→动漫；`/media/abc123`→媒体详情+返回按钮；隐私入口→密码输入弹窗（privacy-begin/unlock 真实接线），关闭正常 |
| 截图 | `C:\Users\Administrator\AppData\Local\Temp\opencode\ui2-p202-shell.png`（Apple 风格导航壳 + 注入窗控 + 真实版本 3.2.9） |

### DoD 自检（P2-02）

- [x] 变更文件清单明确（含删除项）
- [x] 无未说明 IPC（仅使用既有 privacy-begin/unlock/lock、get-version）、无 DB 变更；新增 1 个已批准依赖 react-router-dom
- [x] compile / test / typecheck / build 全绿
- [x] 路由打开正确页面占位；导航 active 正确；`category=other → /library/others`
- [x] 拖拽区不遮挡交互控件（内容区从 32px 下方开始，交互元素 no-drag）；键盘焦点可见（global focus-visible）
- [x] 隐私状态由可信 API 提供，门禁弹窗真实可用；未解锁不展示隐私数据（本阶段尚无隐私数据展示）
- [x] 未改变 main/窗口行为、未改 preload 白名单、未绕过 classic 回退、未改 CSP/sandbox

### 遗留与下一步

- 页面内容为诚实占位（P2-03 首页 / P2-04 媒体库 / P2-05 详情 / P2-06 搜索·源·任务）；搜索弹层明确标注 P2-06 接入，无假按钮
- 隐私模式的数据级过滤随 P2-04 接入（provider 已具备模式状态与门禁）
- **等待用户确认后进入 P2-03（首页）**

---

## P2-03 首页（2026-11-14）

用户指令「一直执行到完成」：P2-03 起连续执行剩余阶段，不再逐阶段等待确认；每阶段仍执行 DoD 检查（compile/test/typecheck/build + 运行时验证 + 日志）。

### 文件清单

- **新增** `src/renderer/pages/home/`：`HomePage.tsx`、`HomeHeader.tsx`、`LibraryOverview.tsx`、`RecentlyAddedSection.tsx`、`CategoryQuickLinks.tsx`、`HomeEmptyState.tsx`
- **新增** `src/renderer/components/media/`：`MediaCard.tsx`、`PosterImage.tsx`
- **新增** `src/renderer/services/desktop/desktopBridge.ts`、`src/renderer/services/library/library.types.ts`、`library.mapper.ts`、`libraryService.ts`
- **新增** `tsconfig.renderer.test.json`（services/utils/bridge 编译到 `tmp/renderer-test`，供 node:test 使用）
- **修改** `pages.css`（首页布局）、`package.json`（renderer:test-compile）
- **删除** P2-02 首页占位

### 关键实现

- 首页真实数据：4 分类 `library:catalog` 计数 + 最近添加 12 条；分类卡跳转、海报缺图占位、加载/错误/空态
- 映射纯函数 `mapCatalogEntry/seasonStatusText/parseMediaRoute` 可单测；路由 `?season=` 约定成型

### 命令与结果

| 命令 | 结果 |
|---|---|
| `npm run renderer:typecheck` / `renderer:build` | exit 0 |
| `npm test` | **233 / 233 通过**（227 + 6 新增） |

提交：`fb0c70c feat(ui2): build home dashboard`

---

## P2-04 媒体库分类页（2026-11-14）

### 文件清单

- **新增** `src/renderer/pages/library/`：`library.types.ts`、`library.mapper.ts`（`mapLibraryRows`）、`LibraryPageHeader.tsx`、`LibraryToolbar.tsx`、`MediaGrid.tsx`、`MediaListView.tsx`、`LibraryLoadingState.tsx`、`LibraryEmptyState.tsx`、`LibraryErrorState.tsx`
- **修改** `LibraryPage.tsx`（重写）、`components/icons/index.tsx`（GridIcon/ListIcon）、`styles/pages.css`、`tests/ui2LibraryMapper.test.cjs`、`tsconfig.renderer.test.json`

### 关键实现

- 四分类共用页面：`/library/movies|tv|anime|others`；隐私模式走 `private: true` 并显示「隐私库」
- 工具栏仅提供真实接口支持项：排序（最近添加/标题/年份/最近播放）、观看状态、收藏状态、网格/列表切换
- loading 骨架、空态（区分隐私锁）、错误重试、600 条上限提示
- 列表复用卡片映射（同一路由/状态语义）

### 命令与结果

| 命令 | 结果 |
|---|---|
| `npm run renderer:typecheck` / `renderer:build` | exit 0 |
| `npm test` | **234 / 234 通过**（+1 行映射测试） |
| 运行时（P2-07 合并验证） | 电影 41 卡、剧集 40 卡、列表/网格真实数据 |

提交：`677a988 feat(ui2): build categorized media library`

---

## P2-05 媒体详情与播放接线（2026-11-14）

### 文件清单

- **新增** `src/renderer/pages/detail/`：`detail.types.ts`、`detail.mapper.ts`、`MediaDetailPage.tsx`（重写）、`DetailHero.tsx`、`MetadataLine.tsx`、`OverviewSection.tsx`、`FileInfoSection.tsx`、`PrimaryActions.tsx`
- **新增** `src/renderer/services/media/mediaService.ts`（fetchShowInfo/fetchItemInfo/playLibraryItem）
- **修改** `styles/pages.css`、`tests/ui2DetailMapper.test.cjs`、`tsconfig.renderer.test.json`

### 关键实现

- 电影：`library:item` → 标题/元数据/简介/文件信息/播放；季：`library:show?season` → 剧集列表 + 集状态
- 续播纯函数：最近进行中 → 首个未看 → 首集；主按钮「继续播放/播放」fire-and-forget（短暂“已发起播放…”，不虚构成功）
- 文件信息仅展示 basename/大小/清晰度；剧集行可点击播放（沿用既有链路）

### 命令与结果

| 命令 | 结果 |
|---|---|
| `npm run renderer:typecheck` / `renderer:build` | exit 0 |
| `npm test` | **238 / 238 通过**（+4 详情映射测试） |
| 运行时（P2-07 合并验证） | 电影详情《黑客帝国4》元数据/文件齐全；季详情《半泽直树2》9 集 + 续播 |

提交：`782a814 feat(ui2): build media detail page with playback wiring`

---

## P2-06 全局搜索、媒体源、任务页（2026-11-14）

### 文件清单

- **新增** `src/renderer/pages/search/SearchPanel.tsx`（AppShell Dialog 接入，替换占位）
- **新增** `src/renderer/pages/sources/`：`SourcesPage.tsx`、`sources.mapper.ts`
- **新增** `src/renderer/pages/tasks/`：`TasksPage.tsx`、`tasks.mapper.ts`
- **新增** `src/renderer/services/library/sourcesService.ts`、`tasksService.ts`
- **修改** `app/AppShell.tsx`、`styles/pages.css`、`tests/ui2SourcesTasks.test.cjs`、`tsconfig.renderer.test.json`

### 关键实现

- 搜索：Ctrl/Cmd+K 弹层，`library:catalog query` 300ms 防抖、隐私态、最多 50 条、结果跳详情
- 媒体源：`library:list-sources`（本地 `rootPath`/WebDAV URL 脱敏、隐私隐藏地址、类型/上次扫描/条目数）；按源触发 `library:scan` 并等待完成汇总
- 任务：`library:scrape-status` 真实状态、触发刮削（`scrape-started`/进度/`scrape-done` 汇总）、触发扫描；扫描无实时进度如实标注
- 修正：MediaCard 键使用 `key` 字段；preload 监听签名适配

### 命令与结果

| 命令 | 结果 |
|---|---|
| `npm run renderer:typecheck` / `renderer:build` | exit 0 |
| `npm test` | **241 / 241 通过**（+3 源/任务映射测试） |
| 运行时（P2-07 合并验证） | 搜索 8 结果；6 个真实源（`D:\【电影】`）；2 张任务卡；console 0 错误 |

提交：`b3f2dc4 feat(ui2): add global search, sources and tasks pages`

---

## P2-07 证据、集成与运行时验收（2026-11-14）

### 验收执行

- 开发 React 壳（Vite 5273 + 真实 IPC/CDP 9222）：11 个步骤全部通过，证据 `C:\Users\Administrator\AppData\Local\Temp\opencode\p207-result.json`；截图 `ui2-p207-{library,detail,tv,season-detail,search,sources,tasks,privacy}.png`
- file:// React 构建（非 Vite）：电影页 12 卡、console 0 错误 → `p207-react-result.json` / `ui2-p207-file-library.png`
- 默认 classic：`#titlebar` 存在、无 `.app-shell-root`、标题「媒体库 v3.2.9」 → `p207-classic-result.json`
- 打包 smoke：`electron-builder --win --dir`（本地 electronDist 覆盖）；asar 含 `ui2-renderer`（index.html + 2 资产）；打包 exe classic 启动正常
- 验收中发现并修复：媒体源位置未读取本地源 `config.rootPath`（已修 + 单测）

### 命令与结果

`npm run compile` / `npm test`（241）/ `npm run renderer:typecheck` / `npm run renderer:build` 全绿。`npm ci` 未执行（Node 24 下 Electron postinstall 已知问题，见验收文档）。

---

## P2-08 文档与交付（2026-11-14）

- 新增 `docs/ui2/PHASE2_ACCEPTANCE.md`（命令、页面、生产/打包证据、缺口与偏差）
- 新增 `docs/ui2/PHASE2_ROLLBACK.md`（默认 classic、运行时/代码/数据/版本回滚）
- 本日志补齐 P2-03 ~ P2-08

### Phase 2 最终状态

- 分支 `feature/ui2-phase2`：P2-00 f24ab6e、P2-01 4933e03、P2-02 ca24640、P2-03 fb0c70c、P2-04 677a988、P2-05 782a814、P2-06 b3f2dc4、P2-07/08 见最新提交；**未推送**
- 测试 241/241；打包默认 classic；React UI 仅开发/显式验证模式可用
- 下一步：等待用户确认合并/推送/发布节奏（Phase 2 不在本次自动推送）
---

## P2-07/08 复审修复：开发模式样式缺失（2026-11-14）

### 问题

- 复审发现开发 React 壳截图只有默认 HTML 样式，而 file:// 构建截图正常；功能断言与“Console errors 0”未覆盖 CSS。
- 根因：开发 CSP `style-src 'self'` 拒绝 Vite 开发模式的 `updateStyle` 内联 `<style>` 注入（以及标题栏插件的内联样式）；生产构建为外链 CSS 不受影响。CSP 拒绝记录在 Log 安全域而非 Runtime console，导致原断言假通过。

### 修复

- `vite.config.ts`：仅 DEVELOPMENT_CSP 改为 `style-src 'self' 'unsafe-inline'`；PRODUCTION_CSP 保持不变。
- 新增 `tests/ui2DevCsp.test.cjs`（2 项）：生产 CSP 严格性 + 开发 CSP 仅样式放宽、脚本仍禁止内联、HMR 仅 loopback。
- 验收脚本增强：样式断言（styleSheets 规则数、body 背景、链接颜色）、Log 安全域采集；区分预期内标题栏内联样式违规（6 条，既有插件、未修改）与非预期违规。
- canonical 运行时截图改为 file:// 构建（样式+海报完整），开发模式修复后截图另存 `ui2-p207-dev-*`。

### 验证

- 开发模式：240 条 CSS 规则、body `rgb(245, 245, 247)`、0 CSP 拒绝；11 步全过。
- file:// 构建：样式断言通过（236 条规则）、11 步全过、non-titlebar security violations 0、console errors 0。
- `npm run compile` / `npm run renderer:typecheck` / `npm run renderer:build` exit 0；`npm test` **243 / 243 通过**。
- 证据：`phase2-evidence\`（更新后的 `ui2-p207-*.png`、`ui2-p207-dev-*.png`、`p207-result.json`、`p207-dev-result.json`）。

### 已知限制（记录，不阻塞验收）

- dev http 源无法加载 `file://` 海报缓存（开发截图仅占位图），验收以 file:// 构建为准。
- file:// React 冒烟存在 6 条标题栏插件内联样式 CSP 拒绝（`titlebarStyleViolations`）；插件未修改，打包版始终 classic、React 不启用。
---

## 发布前审查与 CI 构建（2026-11-14）

- 修复异步生命周期：隐私退出回首页/关闭搜索、解锁防重入、请求序号丢弃过期响应、扫描/刮削等待可取消（commit `853d5b5`）。
- 新增 `tests/ui2Bridge.test.cjs`（取消/超时清理）与 `tests/ui2Lifecycle.test.cjs`（生命周期契约）；**249/249**。
- 干净目录 `npm ci` + 全量测试通过；CI 首次失败定位为 `--omit=optional` 缺少 rolldown 原生绑定，修复后 Windows 构建成功（run `43598158857`，SHA `71da62e`）。
- CI 安装包实测：classic 默认启动正常；`FNTV_UI_SHELL=react` 在打包环境仍回退 classic；asar 含 `ui2-renderer`。
- 分支 `feature/ui2-phase2` 已推送用于 CI；未合并 main、未打 tag、未创建 Release。