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
