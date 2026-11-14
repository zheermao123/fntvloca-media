# FN Media UI 2.0 完整设计与实施规格书

> **文档状态：** 实施基线定稿（可交由 Codex 执行）
> **仓库基线：** https://github.com/zheermao123/fntvloca-media（本地 checkout 已核对：origin 即该 fork，main @ `b97b050`，v3.2.9；Codex 启动时仍须复核 HEAD）  
> **版本：** 1.3（定稿·时序修订版：B1/B2/B3 后端 IPC 随 Phase 1 落地、UI 随 Phase 3/4 接线；契约不变）  
> **定稿日期：** 2026-11-14（v1.2）；v1.3 修订同日（采纳 Phase 1 实施计划"后端先行"时序，登记表 P3）  
> **配套文档：** `FN_Media_UI2_v1_3_Decision_Register.md`（决策登记表 v1.3）  
> **产品：** FN Media  
> **视觉方向：** Apple 风格  
> **默认主题：** Light  
> **前端方案：** React + TypeScript  
> **运行容器：** Electron（沿用现有应用壳与原生能力）  
> **核心原则：** 重构呈现层，不重写已稳定的业务层。

---

## 0. 给 Codex 的执行摘要

本项目的目标不是另做一个媒体播放器，也不是把现有业务逻辑整体推倒重写，而是在**完整保留 FN Media 既有业务能力**的前提下，将当前界面升级为 Apple 风格的桌面媒体管理体验，并把前端从原生 JavaScript 单页逐步迁移到 React。

### 0.1 已确认决策

| 项目 | 决策 |
|---|---|
| 视觉方向 | Apple：克制、清晰、留白、精细层级、柔和材质、低噪音交互 |
| 默认主题 | Light；首次启动默认浅色，后续允许用户切换 Dark / System |
| 前端 | React + TypeScript |
| 应用容器 | 保留 Electron，不迁移到 Web-only 架构 |
| 业务层 | 优先复用现有 IPC、主进程服务、数据库、扫描器、刮削器和 MPV 集成 |
| 迁移策略 | 渐进式替换 UI，不进行一次性全量重写 |

### 0.2 不可违反的实施原则

1. **先盘点，后改造。** Codex 第一阶段必须先读取仓库，建立现有功能、IPC、数据库、事件、配置、菜单与快捷键清单。不得仅凭本文推测现有接口。
2. **业务能力不得因 UI 改造而减少。** 所有既有操作必须在新界面中有入口，或有明确且可访问的新入口。
3. **不复制业务逻辑。** React 页面不得直接访问文件系统、SQLite、SMB/WebDAV、系统代理、MPV 或 Node API；统一通过现有 preload / IPC 边界调用主进程。
4. **不伪造成功状态。** 扫描、刮削、播放、下载更新、网络测试等操作只有在真实后端确认后才能显示成功；模拟数据只允许出现在 Storybook/演示环境。
5. **兼容现有数据。** 不因 UI 改造重建数据库、不清空用户配置、不改写媒体文件、不改变既有路径语义。
6. **渐进迁移。** 每个阶段都应可构建、可运行、可回滚；优先以适配器包装旧接口，等新 UI 稳定后再考虑服务端整理。
7. **视觉规范集中管理。** 色彩、字体、间距、圆角、阴影、动效、组件状态统一使用 Design Tokens，不在页面中散落硬编码。
8. **尊重桌面应用习惯。** 支持键盘操作、窗口缩放、原生菜单/托盘、系统主题、路径选择器、原生通知与多窗口/播放窗口（以现状为准）。

### 0.3 Codex 首轮必须交付的盘点报告

在写任何大规模 UI 代码之前，先生成 `docs/ui2/CURRENT_STATE_AUDIT.md`，内容至少包括：

- 仓库目录树、入口文件、构建脚本、Electron 版本、Node 版本、打包方式。
- 当前页面/弹窗/侧边栏/设置项/菜单项/快捷键列表。
- 当前 preload 暴露的 API、IPC channel、参数、返回值、事件订阅与取消订阅方式。
- SQLite 表、配置文件、迁移机制、关键数据结构（只记录结构，不输出真实用户隐私数据）。
- 扫描、媒体识别、TMDB 刮削、媒体源、MPV 播放、字幕、弹幕、跳过片头、观看进度、收藏、隐私模式、托盘、更新、代理、安全相关模块及代码位置。
- 所有当前功能在 UI 中的触发入口与执行结果反馈方式。
- 已知缺陷、未完成能力、重复实现、潜在安全风险。
- 本文各功能项与实际代码/API 的映射；无法确认的项目标记 `NEEDS_VERIFICATION`，不得自行补造接口。

盘点完成后再按本文的阶段计划实施。若本文与实际仓库代码冲突，以**现有可运行行为和数据兼容性**为准，先在报告中说明冲突，再提出最小改造方案。

### 0.4 基于当前仓库核对的强制修订

本节优先级高于本文此前与之冲突的通用建议。当前公开 `main` 分支可见的实现包括：`src/main/common/mainwin.ts` 的平台差异窗口配置、`src/main/common/winctrl.ts` 的旧库页加载路径、`src/preload/index.ts` 的 IPC 白名单与插件加载、`resource/library/index.html` 的 CSP，以及 `package.json` / `.github/workflows/release.yml` 的构建打包流程。Codex 必须在当前工作树重新核对文件是否一致，不可把公开分支的文件状态直接视为本地 checkout 的绝对事实。

| 项目 | UI 2.0 强制决策 | 原因 / 边界 |
|---|---|---|
| Electron sandbox | **Phase 1/2 维持 `sandbox: false`**；保留 `contextIsolation: true`、`nodeIntegration: false` 和 IPC 白名单。Sandbox 化单独立项，不与 React 迁移绑定 | 当前 preload 使用 Node `fs` / `path` / `require` 读取并加载插件。`sandbox: false` 是兼容性债务，不代表安全风险已消失；React 端不得因此获得 Node 能力 |
| 窗口标题栏 | **保留现有平台策略**：macOS 保留原生交通灯与 hiddenInset；Windows/Linux 保留 frameless、自绘窗控和拖拽区域 | UI 2.0 只重做自绘标题栏的 Apple 风格视觉，不改变窗口装饰模型、拖拽区、窗口按钮 IPC 或平台生命周期 |
| 构建和打包 | React renderer 单独由 Vite 构建；主进程/preload 继续由现有 `tsc` 构建。新 renderer 产物目录必须加入 `electron-builder.files`，开发/生产入口、CI、`.gitignore` 和安装包验收同步修改 | 只让 dev 能启动而生产包缺资源视为 Phase 1 未完成。保留现有 `resource/library` 作为 classic UI 回退资源，不得被新构建覆盖 |
| CSP | 生产 renderer 去掉 `script-src` 的 `'unsafe-inline'`；保留 `connect-src 'none'`，禁止 renderer 通过 fetch/XHR/WebSocket 直连网络；`img-src` 必须允许本地缓存所需的 `file:`，并保留项目实际使用的 `data:` / `'self'` | TMDB / WebDAV / 更新等网络操作继续由主进程执行。Vite 开发态若使用 HMR，只允许对本机开发服务器开放精确 host/port 的临时 CSP，不得把该例外带入生产包 |
| Hero | **以本文 §5.1 为准**：不使用 demo 中约 310 px 的营销式大 Hero；首页采用紧凑页头 + 内容模块 | Demo 是视觉探索稿，不是最终信息层级约束 |
| 媒体库健康 | **不设置独立一级页面**；源可达性/最近扫描放在“媒体源”，扫描与刮削结果放在“任务” | 避免重复导航；健康状态只展示后端真实可知的信息 |
| 搜索快捷键 | 全局搜索使用 **`Cmd/Ctrl + K`**；不将 `Cmd/Ctrl + F` 绑定为全局搜索 | 避免与页面查找/文本查找心智冲突。若既有快捷键已经占用，Phase 0 必须先映射再迁移 |
| 旧 UI 回退 | 新增配置键 `uiShell: 'classic' | 'react'`，存在旧配置或缺省时视为 `classic`；Phase 1 默认不切换普通用户；确认 React 包可加载后再由发布阶段切换默认值 | 保留一处可逆的 UI 入口，且 classic 页面资源必须继续随包分发 |

### 0.5 已批准的新增 IPC 契约（2026-11-14 产品负责人批准；时序见登记表 P3）

以下新增接口不是"复用现有 IPC"，必须在首轮审计报告中列入新增契约并映射挂点。**B1/B2/B3 已全部批准**。实施时序（v1.3 修订）：**后端 IPC、preload 白名单登记与测试随 Phase 1 落地**（Phase 1 实施计划工作包 P1-06/P1-07/P1-08）；**React UI 接线**随 Phase 3（B3）/ Phase 4（B1/B2）。UI 未接线前不显示相关按钮。

| 编号 | 新增能力 | IPC（请求 → 回复） | 落地阶段 |
|---|---|---|---|
| B1 | 媒体源连接测试 | `library:test-source` → `library:test-source-result` | Phase 1（后端）/ Phase 4（UI） |
| B2 | 编辑媒体源 | `library:update-source` → 复用 `library:source-updated` | Phase 1（后端）/ Phase 4（UI） |
| B3 | 最近播放历史 | `library:history` → `library:history-info` | Phase 1（后端）/ Phase 3（UI） |

**B1 契约：** 两种调用形态——`{ sourceId }`（测已存源）或 `{ type: 'local'|'webdav', rootPath?|url?, username?, password? }`（向导测未保存配置）。local/SMB(UNC) 用主进程 `fs.stat`；webdav 由 `webdav.ts` 新增 `probeWebdav`（PROPFIND Depth:0，超时 5s）；不新增 SMB 认证协议。返回 `{ reachable: true, latencyMs }` 或 `{ reachable: false, reason: 'auth'|'not_found'|'network'|'timeout', message }`（401/403 → auth）；`message` 必须脱敏（剥离 URL 内嵌凭据）。

**B2 契约：** `{ id, name?, rootPath?, url?, username?, password?, category? }` 部分更新语义。`type` 与 `private` 标记不可改；password 仅在非空时重新 `encryptSecret`，省略保留旧密文；local 新路径 `localRootExists` 查重（排除自身）；路径/url 变更后 UI 提示是否立即重扫；隐私源仅解锁后可编辑（镜像 `list-sources` 行为）；`set-source-category` 保留供旧 UI，React 走新通道。

**B3 契约：** `{ limit? }` 服务端钳制上限 50、缺省 20；返回 `{ entries: WatchedEntry[] }`（与 `library:continue` 同构，按 lastPlayedAt 倒序）；隐私过滤套用与 continue 相同的可见性规则（`takeContinueByVisibility` 同款）。

无论实现进度如何，Codex 都必须完成现有接口盘点与类型映射；对应 IPC 未实现前，UI 不显示、不做假交互、不通过其它通道绕过。IPC DTO 细节（requestId 配对、状态枚举细化、credentials 三态等）以 Phase 1 实施计划 P1-06~P1-08 的合约草案为实施参考；本节保留产品级契约（通道命名、能力边界、脱敏规则、limit 上限），两者冲突时以本节与登记表 §2 为准。

### 0.6 当前仓库核对附注

截至本修订版核对时，公开 `main` 可见 `package.json` 使用 `tsc` 编译主进程，并通过 `node --test tests/*.test.cjs` 执行现有测试；`electron-builder.files` 当前可见 `dest`、`build`、`resource/login`、`resource/library`、`resource/mpv-overlay`。release workflow 会下载 MPV 配置包后执行平台构建。若本地分支与上述信息不同，以 Codex 实际 checkout 为准，并在 `CURRENT_STATE_AUDIT.md` 记录差异。

### 0.7 定稿补充核验（v1.2 新增，效力等同 §0.4）

以下结论已在本地 checkout（v3.2.9）逐项核验，Codex 在 Phase 0 直接采纳并复核即可：

| 编号 | 结论 | 依据 |
|---|---|---|
| P1（preload 插件注入守卫） | preload 对**所有页面**无条件 `require` 插件（`src/preload/index.ts:99-103`）；`titlebar.ts:9-11` 以 `#custom-titlebar`/`#titlebar` 元素存在为跳过条件。**React AppShell 顶栏必须包含 `id="titlebar"` 元素**作为注入守卫（零侵入），该契约登记进 `IPC_CONTRACT_MAP.md`；Phase 0 同时核验 playButton/playMaskButton 在 React DOM 上 no-op | 否则旧插件会向 React 页注入 z-index 99999 的透明标题栏与 Win/Linux 窗控，与自绘标题栏冲突 |
| P2（白名单补漏转正） | `library:scrape-status-info`、`library:source-updated` 登记 RECEIVE（主进程均有真实发送方：`library.ts:650-652`、`library.ts:318`）；`library:set-source-category` 登记 SEND；`library:scrape-status` handler 保留供 React 任务中心轮询 | `scrape-status` 现为死通道（旧 UI 从未调用），登记后转为 React 可用能力 |
| 预答 1（catalog 上限成因） | 600 条上限来自旧 UI 自行传参 `limit: 600`（`resource/library/index.html` loadItems），store 层无硬顶但**无 offset**；Phase 3 分页设计据此实施（加 offset/total，排序需唯一 tie-breaker） | Phase 0 只需复核，不必重新排查 |
| 预答 2（隐私模式隐藏清单） | `body.privacy-mode` 隐藏 `#kindTabs`/`#scrapeBtn`/`#settingsBtn`（`index.html:123`）+ 源弹窗分类下拉 + 详情页重刮/手动匹配按钮（`:773`）；React 裁剪规则（§4.2/D5）照此执行 | 同上 |
| 预答 3（WebDAV 全链路） | WebDAV 已完整接入：`add-source` → `scanSource` → 播放鉴权头注入（`webdav.test.cjs` 5 用例） | 同上 |
| 预答 4（updateSource/listHistory） | 均未暴露 IPC（`set-source-category` 仅包 category 字段）；已分别转正为 B2/B3 契约（§0.5） | 同上 |

---

## 1. 产品目标与范围

### 1.1 产品定位

FN Media 是一个以本地媒体库为核心的桌面媒体管理与播放应用。它连接用户的本地目录及网络媒体源，对电影、剧集、动漫等媒体进行扫描、识别、元数据整理与浏览，并调用 MPV 完成播放；同时管理观看进度、字幕、弹幕、片头片尾跳过等观影体验。

UI 2.0 的任务是把这些能力组织成一套清晰、稳定、可扩展的桌面产品体验：

- **媒体优先：** 封面、标题、观看状态、进度和媒体信息始终清晰可见。
- **任务可感知：** 扫描、刮削、网络测试、更新等后台操作有统一的任务反馈。
- **设置可理解：** 高级配置按场景组织，不将大量技术选项堆在一个长页面中。
- **操作有反馈：** 每项真实操作都有进行中、成功、失败、取消等状态。
- **长期可维护：** React 组件、设计系统、业务服务和 Electron 桥接层职责分离。

### 1.2 本次范围（必须实现）

- Apple 风格应用外壳、主导航、工具栏、浅色主题和暗色/跟随系统主题能力。
- 首页、媒体库、电影/剧集/动漫浏览、详情、收藏/合集（以现有数据能力为准）。
- 媒体源管理：本地目录、SMB、WebDAV（以当前已支持类型为准），新增、编辑、删除、连接测试与状态展示（B1/B2 已批准，随 Phase 4 实现）。
- 媒体扫描、识别、刮削、重新匹配、手动修正元数据与任务进度。
- MPV 播放入口与现有播放控制能力的 UI 映射。
- 字幕、弹幕、跳过片头/片尾、观看状态、续播与历史记录的 UI 映射；不把 MPV portable_config 内的外部配置伪装成应用内可编辑设置。
- 收藏、隐私模式、托盘、更新、代理和现有实际设置的可发现入口；不存在的设置项以说明/帮助替代，不新增虚构开关。
- 空状态、加载状态、错误状态、权限不足、离线/服务不可用等状态设计。
- 响应式窗口布局、键盘导航、可访问性和自动化测试。

### 1.3 本次不做（除非仓库现有能力已具备）

- 不自行增加新的媒体协议、下载器、转码器或媒体服务器。
- 不把 MPV 替换成 HTML5 video 或其他播放内核。
- 不擅自改变 TMDB 等元数据来源、匹配规则或用户密钥管理方式。
- 不新增云端账户体系、云同步、社交功能或付费体系。
- 不擅自更改数据库 schema；确有必要时必须先提交迁移设计和回滚策略。
- 不将原生桌面应用改造成浏览器网站。
- 本次 UI 迁移不重构 fnOS 遗留链路：`resource/login` 登录页、`play-movie`、preload 注入插件（包括 playButton/titlebar）以及 dormant 的 `phase5 fnos-adapter` 均保持原样；除非未来单独立项，不迁移、不删除、不重命名、不调整加载顺序。
- 不将远程网页、第三方脚本或媒体元数据作为可信指令执行。

---

## 2. 现有业务能力保留清单

以下清单是 UI 2.0 的功能保留基线。已知现有应用涉及这些能力；Codex 必须在首轮盘点中逐项核对真实实现，并将结果标记为 `EXISTS`、`PARTIAL`、`BROKEN`、`NOT_FOUND` 或 `NEEDS_VERIFICATION`。UI 2.0 不得把现有 `EXISTS` 能力删掉或降级。

| 能力域 | 必须保留的用户能力 | UI 2.0 的可见入口/反馈 |
|---|---|---|
| 媒体源 | 添加、编辑（B2 已批准）、移除本地媒体目录 | 媒体源；显示路径、类型、最近探测状态。**不提供启用/禁用状态**（源模型没有 enabled 字段） |
| 网络媒体源 | SMB、WebDAV 源配置与连接（逐项核实真实接入路径） | 媒体源向导；凭据输入使用安全控件；连接测试（B1 已批准）；不得展示“启用/禁用”字段 |
| 媒体扫描 | 扫描单个源、扫描全部、增量/手动扫描（以现状为准） | 媒体源操作、任务中心；显示阶段、进度、结果 |
| 文件识别 | 从文件名/目录识别电影、剧集、季/集、动漫等 | 详情、匹配修正；失败项目可定位与重试 |
| 元数据刮削 | TMDB 搜索、匹配、封面/背景/简介等元数据写入（以现状为准） | 详情页、匹配弹窗、刮削任务；保留原有配置 |
| 手动修正 | 用户可纠正错误匹配或元数据（以现状为准） | 详情编辑/重新匹配；保存前后明确反馈 |
| 播放 | 调用 MPV 播放文件、续播或从头播放 | 卡片、详情、继续观看；启动失败明确报错 |
| 观看状态 | 记录播放进度、已看/未看、继续观看（以现状为准） | 继续观看、详情状态、历史/已看标记；最近播放历史（B3 已批准，Phase 3 实现） |
| 字幕 | 保留当前字幕查找、加载、切换和偏好能力 | 播放相关设置或播放菜单；状态可见 |
| 弹幕 | 保留当前弹幕配置、加载和显示控制能力 | 播放相关设置或播放菜单；不可用时说明原因 |
| 片头片尾 | 保留跳过片头/片尾规则与控制能力 | 播放设置/播放 OSD；清晰区分自动跳过与手动跳过 |
| 收藏 | 收藏/取消收藏及收藏列表（以现状为准） | 收藏按钮与收藏视图；状态即时同步 |
| 隐私模式 | 保留现有隐私模式的实际行为和持久化方式 | 工具栏/菜单可快速切换；启用状态明显但不过度打扰 |
| 系统托盘 | 最小化到托盘、托盘菜单、恢复窗口（以现状为准） | 继续使用原生托盘；设置中说明行为 |
| 应用更新 | 检查、下载/安装、版本提示、更新状态（以现状为准） | 设置/关于/更新；显示当前版本和真实状态 |
| 代理 | 保留当前代理配置及其作用范围 | 网络/高级设置；保存后提供测试或状态反馈（若已有） |
| 安全 | 保留现有安全限制、凭据处理和权限控制 | 不在 renderer 暴露 Node 能力；安全说明合并到“关于 / 安全与隐私”，不设置不存在的安全开关 |

### 2.1 迁移完成的功能定义

每项能力只有同时满足以下条件，才算完成迁移：

1. 用户可在新 UI 中找到入口；
2. 使用真实现有业务接口完成操作；
3. 加载、成功、失败、取消等状态准确；
4. 数据结果与旧版一致，且重启后符合原有持久化规则；
5. 有至少一条自动化或手动回归用例；
6. 不因新 UI 的状态管理而重复触发扫描、重复写入或覆盖用户数据。

---

## 3. 视觉设计系统：Apple 风格

### 3.1 设计关键词

**Quiet / Refined / Native / Content-first / Clear hierarchy**。

采用 Apple 生态常见的视觉语法作为方向参考，不复制 Apple 商标、系统图标、专有界面或受保护素材。整体应像一款精致的 macOS 媒体应用，而不是网页后台管理系统。

- 留白优先，界面不堆叠分割线与边框。
- 以排版、间距、背景层级建立信息层次。
- 卡片采用柔和圆角，阴影极轻；非所有元素都做成卡片。
- 强调色只用于主要动作、当前选中态和重要状态，不用大面积高饱和渐变。
- 媒体海报是主视觉，装饰性 UI 不得抢占内容焦点。
- 动效轻量、短促、可被系统减少动态效果设置关闭。
- 图标统一使用 Lucide 风格线性图标；避免混用多套图标语言。

### 3.2 默认主题与主题行为

- 首次安装/无历史偏好时默认 `Light`。
- 主题设置提供：`浅色 Light`、`深色 Dark`、`跟随系统 System`。
- 用户主动选择后持久化；切换主题不重启应用。
- `System` 模式通过系统外观变化实时更新。
- 所有页面、弹窗、下拉菜单、Tooltip、Toast、任务中心和设置控件必须支持三种主题状态。
- Light 是设计、截图、验收的基准主题；Dark 作为第二主题完整实现，不允许只给页面背景换黑色。

### 3.3 色彩 Token

以下为 UI 2.0 起始值，允许在视觉验收后微调，但必须集中维护在 token 文件中。颜色应使用语义变量，不在业务组件中直接写色值。

| Token | Light 建议值 | 用途 |
|---|---|---|
| `--color-canvas` | `#F5F5F7` | 应用最外层背景 |
| `--color-surface` | `#FFFFFF` | 主内容表面 |
| `--color-surface-secondary` | `#F2F2F5` | 次级面板、卡片底色 |
| `--color-surface-elevated` | `rgba(255,255,255,.86)` | 浮层、弹窗、顶部材质 |
| `--color-text-primary` | `#1D1D1F` | 主文本 |
| `--color-text-secondary` | `#6E6E73` | 次级文本 |
| `--color-text-tertiary` | `#8E8E93` | 辅助说明、占位信息 |
| `--color-separator` | `rgba(60,60,67,.14)` | 极弱分隔线 |
| `--color-accent` | `#007AFF` | 主操作、链接、焦点 |
| `--color-success` | `#248A3D` | 成功/已完成 |
| `--color-warning` | `#B7791F` | 警告/待处理 |
| `--color-danger` | `#D70015` | 错误/危险操作 |
| `--color-focus-ring` | `rgba(0,122,255,.35)` | 键盘焦点环 |

Dark 主题必须采用独立的语义映射，例如深灰背景（避免纯黑大面积铺底）、更高对比度的主文本和相应状态色。禁止在组件里用 `if (dark) '#fff' else '#000'` 这种散落判断。

### 3.4 字体与排版

- 优先使用系统字体栈：`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`。
- Windows 不要求安装额外字体；macOS 使用系统 San Francisco 字体回退。
- 中文文本要选择可用的系统中文字体回退，确保 Windows/macOS 不出现方框。
- 字重以 400 / 500 / 600 为主；避免大量 700 粗体。
- 字号建议：页面标题 28–32 px；区块标题 18–22 px；卡片标题 14–16 px；正文 13–15 px；说明 11–12 px。
- 行高：正文 1.45–1.6；标题 1.15–1.25。
- 标题、数字、日期和媒体元数据应有稳定的基线对齐。

### 3.5 间距、圆角与阴影

统一采用 4 px 基础间距：`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64`。

| 项目 | 建议值 |
|---|---|
| 应用主导航宽度 | 展开 224–248 px；窄屏可折叠至 68 px |
| 顶部工具栏高度 | 56–64 px |
| 页面左右内边距 | 28–40 px；窗口缩小时降至 20–24 px |
| 大卡片圆角 | 18–24 px |
| 普通卡片圆角 | 14–18 px |
| 控件圆角 | 9–12 px |
| 胶囊/标签 | 999 px |
| 浮层阴影 | 0 8px 30px rgba(0,0,0,.08)；暗色主题相应减弱 |
| 卡片边框 | 默认无；需要边界时用弱分隔色 |

### 3.6 图标、材质与动效

- 图标统一 16 / 18 / 20 / 24 px 尺寸体系，默认 1.75–2 px 描边。
- 按钮图标不可单独承担含义；图标按钮必须有 Tooltip 和可访问名称。
- 顶栏、侧栏或浮层可使用轻微半透明材质，但要保证文字对比度；大面积背景不要过度模糊。
- 页面切换 160–220 ms；弹窗 180–240 ms；Hover 120–160 ms。
- 常用缓动：`cubic-bezier(.2,.8,.2,1)`。
- 支持 `prefers-reduced-motion`；减少动效时取消非必要位移和缩放。

---

## 4. 信息架构与应用导航

### 4.1 桌面主框架

布局采用三层结构：

1. **应用导航侧栏：** 一级功能入口与媒体分类；
2. **顶部工具栏：** 当前页面标题/面包屑、搜索、筛选、视图切换、任务入口、用户偏好入口；
3. **主内容区：** 页面内容、海报网格、列表或设置表单。

必须保留现有平台窗口策略：macOS 使用系统交通灯（`frame: true`、`titleBarStyle: hiddenInset`）；Windows/Linux 使用无边框窗口和页面自绘窗控/拖拽区（`frame: false`）。React 侧必须实现平台感知的 TitleBar：自绘区准确设置 `-webkit-app-region: drag`，按钮与可交互控件设置 `no-drag`；窗口最小化、最大化/还原、关闭继续调用现有窗口 IPC。不得强制所有平台改用系统标题栏，也不得改变交通灯位置和窗口生命周期。

### 4.2 主导航结构

建议导航如下，具体分类必须映射到真实数据库和业务能力，不得为了菜单完整而创建空功能：

- **概览**：最近新增、继续观看、最近播放、快速操作。
- **媒体库**：统一媒体集合，支持筛选与视图切换。
  - 电影
  - 剧集
  - 动漫（如果现有数据模型能够区分）
  - 其他（`category=other`，必须有可发现入口 `/library/others`）
- **收藏**：用户收藏列表（若现有能力有独立收藏数据）。
- **媒体源**：本地/SMB/WebDAV 来源管理。
- **任务**：当前扫描/刮削实时状态与最近结果摘要；不承诺取消、任务持久化或完整任务历史。
- **设置**：外观、刮削、播放、网络/代理、隐私、关于/更新。不存在的“媒体库扫描设置”“字幕/弹幕设置”“安全设置”不做虚构表单；相关说明按 §5.8 处理。

侧栏底部展示应用版本/状态或设置入口，不在侧栏放置大量次要操作。导航项应支持当前选中、Hover、焦点、禁用和错误计数等状态。隐私模式开启时必须复刻旧 UI 的导航裁剪行为：隐藏分类浏览入口、刮削入口和设置入口；只保留隐私模式下真实允许的内容视图及安全退出/锁定入口。裁剪规则必须以旧版实际行为为准，不允许只隐藏视觉入口却仍在路由或快捷键中暴露同一功能。

### 4.3 页面路由与 URL 状态

使用 React Router（Electron 内建议 HashRouter，或按现有路由基础决定）；避免手写复杂的页面 `innerHTML` / `display:none` 路由。

建议路由：

| 路由 | 页面 |
|---|---|
| `/home` | 概览首页 |
| `/library` | 全部媒体库 |
| `/library/movies` | 电影 |
| `/library/series` | 剧集 |
| `/library/anime` | 动漫（需核实分类模型） |
| `/library/others` | 其他视频（`category=other`） |
| `/favorites` | 收藏 |
| `/sources` | 媒体源管理 |
| `/tasks` | 任务中心 |
| `/settings/appearance` | 外观 |
| `/settings/scraper` | 刮削与元数据 |
| `/settings/playback` | 播放 |
| `/settings/network` | 网络/代理 |
| `/settings/privacy` | 隐私 |
| `/settings/about` | 关于/更新 |

路由可以根据真实功能合并或省略。详情优先采用可深链的详情路由或侧滑详情面板，需支持浏览器前进/后退语义（Electron 内仍可实现）。

---

## 5. 页面与交互详细规格

### 5.1 概览首页 `/home`

**目标：** 用户打开应用后，在 3 秒内理解媒体库状态，并能继续观看或快速开始主要操作。

#### 页面组成（由上至下）

1. 顶部欢迎区：简洁问候/“媒体库”标题；避免使用占据半屏的营销式 Hero。
2. **继续观看**：横向卡片或大尺寸媒体卡，展示海报、标题、季/集、进度条、剩余时间（如后端已提供），主按钮“继续播放”。
3. **最近添加**：按真实添加时间排序；展示 5–10 项，提供“查看全部”。
4. **最近播放**：B3 已批准，通过 `library:history` 获取真实历史（limit 服务端钳制 ≤50）；无记录时不显示空洞模块。
5. **媒体库摘要**：电影/剧集/动漫/其他数量可以由客户端对完整 catalog 结果汇总；如果 catalog 仍受 600 条上限或分页影响，只能标记为“当前载入数量”或暂不展示总数，不能将局部结果冒充全库总数。媒体源状态、最近扫描时间仅显示真实可获取字段。
6. 快捷操作：添加媒体源、扫描媒体库、打开任务中心。

**交互：**

- 点击媒体卡进入详情；点击播放按钮调用真实 MPV 播放接口。
- 继续观看必须使用后端真实播放位置；若无进度，从头播放或按既有逻辑处理。
- 快速扫描启动后应立即给出任务反馈，但不能在尚未收到后端确认时显示“已完成”。
- 媒体库为空时提供明确 CTA：添加本地目录 / 添加网络源（仅显示受支持类型）。
- 最近新增加载失败时保留模块标题与重试入口，不将错误吞成空列表。

### 5.2 媒体库 `/library` 及分类页

**目标：** 高效浏览大规模海报集合，并快速定位、筛选和排序。

#### 页面骨架

- 标题：媒体库 / 电影 / 剧集 / 动漫。
- 工具栏：搜索、类型筛选、年份、评分、观看状态、媒体源筛选、排序、网格/列表切换。
- 结果区：响应式海报网格；分页/虚拟滚动策略根据当前数据规模选型。
- 底部或工具栏展示结果数量与当前筛选摘要。

#### 卡片规范

电影/剧集海报比例优先使用元数据源提供的 poster 比例（常见接近 2:3），禁止图片变形；缺图时使用统一占位视觉。

卡片基础信息：

- 海报；
- 标题；
- 年份或剧集季数；
- 观看状态（未看/观看中/已看，依据真实状态）；
- 可选评分（仅在真实有数据时显示）；
- Hover 后显示轻量操作：播放/继续、收藏、更多。

**禁止：** 在小卡片上塞入长简介、过多标签和多个按钮；使用全尺寸阴影或粗边框。

#### 筛选与搜索

- 搜索应覆盖现有支持的标题、别名、文件名等字段；实际搜索范围以当前搜索服务为准。
- 输入防抖建议 250–350 ms；卸载页面或新请求发起时取消过期请求。
- 多筛选组合必须在 UI 上可见；“清除筛选”可一键恢复。
- 排序项仅展示后端真实支持的字段，例如标题、添加时间、上映年份、最近播放等。
- 网格与列表视图切换后，筛选条件应保留。
- 无结果与无媒体两种状态要区分：前者显示“没有符合条件的结果”，后者显示添加媒体源入口。

### 5.3 媒体详情

详情可以用侧滑面板或独立页面。推荐桌面宽屏采用**右侧/全屏详情面板**，保留媒体库上下文；深链或窗口较窄时转为独立页面。

**内容区：**

- 背景图（有则显示，无则使用主题背景）；
- 海报、标题、年份、类型、评分、时长/季集信息（仅真实可用字段）；
- 主操作：播放/继续观看；次操作：收藏、标记已看/未看、更多；
- 简介、季/集列表、媒体文件位置和技术信息（按实际数据提供）；本版不做演职员/演员表（cast/crew），现有刮削器未拉取该数据，后端无相应字段；
- 元数据来源和匹配状态（必要时进入编辑/重新匹配）。

**重新匹配流程：**

1. 打开搜索弹窗；
2. 输入关键词或使用当前标题预填；
3. 显示候选结果、年份和类型；
4. 用户选择候选项并确认；
5. 后端完成匹配/刮削后再刷新详情；
6. 失败时保留原信息，并显示错误原因与重试入口。

禁止用户误触一次就覆盖大量元数据。对批量修改或覆盖字段必须提供明确确认。

### 5.4 媒体源管理 `/sources`

**目标：** 用户能看懂媒体从哪里来、源是否可访问、扫描是否完成。

每个媒体源行/卡片至少展示：

- 名称；
- 类型（本地目录 / SMB / WebDAV，按真实支持类型）；
- 路径或主机地址（凭据绝不展示）；
- 最近扫描时间、媒体数量（后端可提供时）；
- 最近探测状态：正常、不可达、认证失败、未探测；该状态为运行时探测结果，不代表源存在持久化 enabled 开关；
- 操作：扫描、编辑（B2）、测试连接（B1）、移除；对应按钮仅在 IPC 实际实现并登记白名单后启用，实现前不显示。

#### 新增/编辑向导

采用分步表单，减少技术参数一次性暴露：

1. 选择源类型；
2. 输入名称和路径/服务器地址；
3. 输入认证信息（如需要）；
4. 选择现有扫描选项（仅展示已支持配置）；
5. 测试连接（B1 已批准；IPC 实现前跳过该步，不显示假测试）；
6. 保存并可选择立即扫描。编辑流程（B2 已批准）复用同一表单；`type` 与 `private` 标记不可更改，路径/url 变更后提示是否立即重扫。

校验要求：

- 必填项即时校验，错误信息紧贴字段；
- 密码/Token 使用 password 控件，默认遮蔽；
- 不在日志、Toast、URL、前端状态持久化中输出凭据；
- 编辑源失败不覆盖原配置；
- 删除源需确认，并清楚说明删除配置是否会删除媒体文件。默认只移除源配置，不得删除用户原始媒体文件，除非现有功能明确且用户二次确认。

### 5.5 任务中心 `/tasks`

将扫描、刮削的当前运行状态与最近结果摘要集中呈现。连接测试等短时操作只显示在触发位置；更新仍使用现有更新 UI/状态，不伪装成统一持久任务系统。任务中心只展示真实后台状态，不构造虚假进度。

任务列表字段：任务名称、类型、目标源/项目、开始时间、当前阶段、进度（如果后端提供）、状态、结果摘要。操作仅允许查看详情/打开目标等现有能力，不展示后端不支持的取消、暂停或通用重试按钮。

本版本任务中心 MVP 仅显示当前进程内扫描/刮削的实时状态，以及最近一次结果摘要。当前后端没有 `taskId`、取消接口或持久化任务记录，因此 v1 不实现任务取消、暂停、跨重启恢复、完整历史列表或通用 `queued/cancelled/paused` 状态。状态只使用现有后端实际可观察的 running / succeeded / failed 等信号，不合成进度。连接测试（B1 已批准）作为短时操作反馈，不承诺作为持久任务记录。

任务详情只能展示当前进程实际提供的字段：例如后端确实暴露的已处理数、成功/失败数、当前文件或阶段、错误摘要与开始时间。不得为了填满界面而推算字段；长日志默认折叠。由于当前任务状态没有持久化，应用重启或进程退出后不恢复本次运行任务，也不展示伪造的历史记录。

操作规则：

- v1 不显示“取消任务”按钮；重试仅在现有业务接口明确支持时显示。
- 不允许 UI 自行推断完成百分比；
- 进度事件订阅在组件卸载时必须取消；
- 同一个任务事件不得重复注册；
- 窗口内路由切换或组件重挂载后，应重新读取当前进程的实时状态；应用重启或主进程退出后不恢复任务状态。

### 5.6 播放体验与 MPV

UI 2.0 不替换 MPV。播放窗口、内嵌播放页或外部窗口必须复用当前已验证的启动方式。

**必须保留并验证：**

- 从媒体卡片、详情、继续观看和文件项调用 MPV；
- 续播与从头播放语义；
- 播放失败错误反馈；
- 当前播放相关入口；字幕/弹幕控制仅保留旧版已存在的播放中控制，不新增 FN Media 内部配置表单；设置页仅提供 MPV `portable_config` 说明和（若已有安全 IPC）打开目录入口；
- 观看进度/状态回传；
- 跳过片头/片尾控制；
- MPV 单实例/多实例行为（按现状）。

**播放前行为：**

- 主按钮优先“继续观看”；没有观看记录时显示“播放”。
- 若一部剧有多集，详情页应允许选择具体集数，不默认播放错误集数。
- 若路径不可访问，向用户说明来源不可访问并提供定位/重试，不显示无意义“播放失败”。

**播放中与 OSD：**

- UI 可展示当前媒体标题、字幕/弹幕状态、跳过提示等，但必须与 MPV 真实状态同步。
- 自动跳过触发与手动点击跳过应使用不同的反馈文案。
- 不要把所有 MPV 高级参数搬入主播放界面；MPV `portable_config` 中的高级项由 MPV 配置文件管理，不复制为 FN Media 设置表单。

### 5.7 收藏与隐私模式

- 收藏按钮在卡片、详情和列表中状态一致；操作有短暂即时反馈，最终以服务端响应为准。
- 收藏视图提供搜索/排序（仅在后端支持时）。
- 隐私模式入口应便于快速切换，可放顶栏菜单/应用菜单；展示明确开关状态。
- 隐私模式的具体影响必须以当前实现为准，UI 文案不能扩大承诺。Codex 需盘点它是否影响最近播放、历史记录、日志或其他数据，再按真实行为说明。
- 隐私模式切换失败时不得假装成功；切换中应防止重复触发。

### 5.8 设置中心 `/settings/*`

设置页采用左侧二级导航 + 右侧表单内容，避免一张超长页面。只为真实存在并有后端读写能力的设置建可编辑页面；没有后端配置项的分组降级为说明或删除，不做看起来可操作但实际无效的表单。

建议分组：

| 分组 | 内容 |
|---|---|
| 外观 | Light/Dark/System；界面密度、动画偏好仅在真正实现持久化后出现 |
| 刮削 | 现有 TMDB API Key、API 地址、图片地址、语言等真实设置；保留“强制重刮”既有操作语义 |
| 播放 | 仅展示现有应用实际管理的 MPV/播放设置；字幕和弹幕配置属于 MPV `portable_config` 文件体系，不伪装成 FN Media 内部配置 |
| MPV 配置帮助 | 说明 portable_config 所在位置、打开配置目录（仅在已有安全 API 可调用时提供按钮）和文档链接；无应用内字幕/弹幕开关 |
| 网络 | 现有代理配置与实际作用范围；没有独立连接测试实现时不添加测试控件 |
| 隐私 | 隐私模式的现有行为和数据影响说明 |
| 关于 | 应用版本、检查更新、更新状态、开源/许可信息，以及只读的“安全与隐私”说明 |

**设置表单规范：**

- 每个设置项提供名称、简短解释、控件、默认值/当前值（如有）。
- 保存策略与当前实现一致：即时保存或页面底部“保存/取消”，不要在不同设置页随意混用。
- 有未保存更改时，导航离开应提示；但仅在确实存在本地未保存状态时提示。
- 危险操作单独分组，使用危险色和二次确认。
- 高级设置默认折叠，避免影响普通用户。

---

## 6. 关键组件规范

### 6.1 组件清单

| 组件 | 职责 | 关键状态 |
|---|---|---|
| `AppShell` | 应用主布局、主题、路由容器 | 正常、窄窗、侧栏折叠 |
| `Sidebar` | 一级导航 | 默认、选中、Hover、焦点、徽标 |
| `TopBar` | 搜索、任务入口、快捷操作 | 固定/滚动、搜索展开 |
| `GlobalSearch` | 全局搜索 | 空、输入、加载、结果、无结果、失败 |
| `MediaPosterCard` | 媒体海报卡片 | 默认、Hover、焦点、加载、缺图、已看、观看中 |
| `MediaGrid` | 网格布局 | 加载骨架、空、结果、错误 |
| `MediaList` | 列表视图 | 同上 |
| `MediaDetailPanel` | 详情容器 | 打开、关闭、加载、错误 |
| `PlayButton` | 播放/续播 | 可用、启动中、不可用 |
| `FavoriteButton` | 收藏开关 | 已收藏、未收藏、请求中、失败 |
| `SourceCard` / `SourceRow` | 媒体源信息 | 正常、断开、认证失败、扫描中 |
| `SourceWizard` | 添加/编辑媒体源 | 分步、校验错误、测试中、保存中 |
| `TaskCenter` | 当前任务状态与最近结果摘要 | 空闲、执行中、成功、失败（仅限后端实际可观察状态） |
| `SettingsSection` | 设置内容布局 | 默认、修改中、保存中、错误 |
| `ToastProvider` | 全局反馈 | 成功、警告、错误、信息 |
| `ConfirmDialog` | 危险/不可逆操作确认 | 打开、关闭、确认中 |
| `EmptyState` | 无数据引导 | 按页面提供 CTA |
| `ErrorState` | 错误和重试 | 网络、权限、文件、服务错误 |
| `Skeleton` | 内容占位 | 组件尺寸一致 |

### 6.2 组件工程规则

- 组件只负责展示和用户交互，不直接调用 Electron IPC。
- 与业务服务交互的逻辑放在 feature hook / service 层。
- 组件输入通过明确的 TypeScript props 定义；避免 `any`、过度可选 props 和跨组件隐式全局变量。
- 组件状态必须考虑加载/禁用/错误；不能只实现正常态。
- 卡片与按钮必须有 `aria-label` 或可读文本；Tooltip 不能成为唯一的可访问名称。
- 复用组件不代表所有页面必须统一成同一布局；使用设计系统建立一致性，不牺牲页面场景差异。

---

## 7. 前端技术方案

### 7.1 技术选型

| 层 | 方案 | 说明 |
|---|---|---|
| UI | React + TypeScript | 新界面组件体系与类型约束 |
| 构建 | Vite 专用于 React renderer；现有 `tsc` 继续构建 Electron main/preload | 必须增加 renderer build 脚本、Vite 配置、独立产物目录、开发入口、builder files、CI 和 `.gitignore` 修改；不得只保证开发态可运行 |
| 路由 | React Router | Electron 内优先 HashRouter，兼容文件协议/打包路径 |
| 样式 | CSS Variables + CSS Modules 或 Tailwind（选一种为主） | Design Tokens 是唯一色彩/尺寸源；不得两套体系无边界混用 |
| 原子 UI | Radix UI primitives / shadcn 风格封装 | 对话框、菜单、Popover、Tooltip、Switch 等；最终视觉由项目自有 token 控制 |
| 图标 | Lucide React | 全项目统一尺寸/描边 |
| 服务端状态 | TanStack Query（建议） | 缓存、请求状态、失效刷新；需按项目规模决定是否引入 |
| UI 状态 | React state + Zustand（仅跨页面共享时） | 不把所有状态都放全局 Store |
| 表单 | React Hook Form + Zod（建议） | 媒体源向导、设置表单校验 |
| 动效 | CSS transition 优先；必要时 Motion | 避免重动画与过度依赖 |
| 测试 | Vitest + React Testing Library；Playwright/Electron E2E（按现有环境） | 单元、组件、关键流程回归 |

**依赖版本原则：** Codex 先读取现有 `package.json`、锁文件、Electron 与 Node 兼容范围，再选择可兼容的稳定版本并锁定依赖。禁止无依据地升级 Electron、大版本构建工具或播放相关依赖。不要在本文中硬编码未经仓库验证的最新版本号。

### 7.2 推荐目录结构

按现有项目实际结构调整，但尽量形成以下边界：

```text
src/
  main/                       # Electron 主进程；保留现有业务模块
  preload/                    # contextBridge API；白名单暴露
  renderer/
    app/
      App.tsx
      router.tsx
      providers/
      layouts/
    components/
      ui/                     # Button, Dialog, Tooltip, Switch...
      media/                  # PosterCard, MediaGrid, MediaDetail...
      feedback/               # Toast, EmptyState, ErrorState, Skeleton...
    features/
      home/
      library/
      media-detail/
      sources/
      tasks/
      favorites/
      settings/
      playback/
    services/
      desktop-api.ts          # preload API 的类型化适配
      media.service.ts
      source.service.ts
      task.service.ts
      settings.service.ts
    stores/                   # 仅放跨页面 UI 状态
    hooks/
    styles/
      tokens.css
      themes.css
      globals.css
    types/
  shared/
    contracts/                # 主进程与 renderer 共用的数据契约
    constants/
    utils/

 docs/
   ui2/
     CURRENT_STATE_AUDIT.md
     DESIGN_TOKENS.md
     IPC_CONTRACT_MAP.md
     MIGRATION_LOG.md
```

如果仓库采用其他结构，不要为了匹配本文而机械移动稳定文件；重点是让 React renderer、Electron main、preload bridge 和共享契约边界清晰。

### 7.3 Electron 安全边界

必须核查并维持以下安全原则：

- `contextIsolation: true`；
- `nodeIntegration: false`；
- **本次暂不启用 sandbox**：维持 `sandbox: false` 以兼容当前 preload 的 Node 模块/插件加载；将 sandbox 化作为独立安全技术债项目，前置条件是把插件加载迁出 preload、缩减 preload 依赖并完成跨平台回归。
- renderer 不直接访问 `fs`、`path`、`child_process`、SQLite、环境变量或任意 Node 模块；
- preload 只通过 `contextBridge.exposeInMainWorld` 暴露明确白名单 API；
- IPC channel 不允许 renderer 任意指定执行命令/文件路径操作；主进程必须校验参数与路径范围；
- 外部 URL 使用安全的 allowlist/系统浏览器打开策略；
- 生产 renderer CSP 至少满足：`default-src 'self'`、`script-src 'self'`（移除 `unsafe-inline`）、`connect-src 'none'`、`img-src 'self' file: data:`、`object-src 'none'`、`base-uri 'none'`；`style-src` 优先只允许本地样式资源，若组件确需 inline style 必须先评估并记录，不得为方便而放宽 script-src。Vite HMR 的开发 CSP 只能放行指定 localhost/127.0.0.1 host/port，生产包不得包含该例外。
- 凭据不进入 URL、DOM data 属性、调试日志、分析事件或不必要的 localStorage；
- 所有 IPC 错误需脱敏，不能把堆栈、token、密码回传到普通 UI。

如果当前仓库尚未满足这些原则，Codex 必须先记录风险，避免与 UI 重构混在一个大改动中；高风险问题应单独修复并测试。特别注意：当前 preload 在 `src/preload/index.ts` 中读取目录并 `require` 插件，所以 `sandbox: false` 在本轮是显式兼容决策，不得为了符合通用模板而强行打开 sandbox。

---

## 8. React 与现有业务层的集成契约

### 8.1 分层架构

```text
React 页面 / 组件
        |
Feature hooks / Query hooks
        |
Renderer service adapters（类型化）
        |
window.fnMedia（preload 暴露的有限 API）
        |
IPC（参数校验、错误归一化、事件推送）
        |
Electron main / 现有业务服务
        |
SQLite / 文件系统 / SMB-WebDAV / TMDB / MPV / updater / tray
```

### 8.2 适配器策略

- 首轮盘点现有 API 后，建立 React 专用类型声明和 typed adapter；不要让 React 页面直接使用任意 channel 字符串。现有 legacy renderer 的通用 API 可暂时保留；新 React API 应按具体业务方法封装。
- 若现有 preload API 已足够，React adapter 直接包装，不改变 IPC channel。
- 若现有接口不统一，在 renderer service adapter 中统一调用形态；必要时新增薄的 preload 包装，但不复制底层业务逻辑。
- 每个新增 IPC 必须有：参数 schema、返回类型、错误类型、权限/路径校验、测试。B1/B2/B3 已批准，最终契约见 §0.5；后端实现随 Phase 1（实施计划 P1-06~08），UI 接线随 Phase 3/4（登记表 P3）。
- 对已有事件订阅必须返回 disposer，React `useEffect` cleanup 必须调用 disposer。
- 本版不为了任务 UI 强行给现有扫描/刮削增加 `taskId`、取消或持久化；任务中心 v1 仅适配当前进程内 bool 与事件状态。未来若立项实现真正任务系统，再另行升级契约。

### 8.3 类型契约示例（仅说明形态，不是既有 API）

下面是建议的类型边界示例。**Codex 必须根据真实代码映射和改写，不得直接假设仓库已有这些方法。**

```ts
export type OperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; retryable?: boolean } };

export interface DesktopApi {
  // 示例：实际方法名和参数必须以 CURRENT_STATE_AUDIT 为准。
  getLibrarySummary(): Promise<OperationResult<LibrarySummary>>;
  listMedia(query: MediaQuery): Promise<OperationResult<MediaPage>>;
  playMedia(input: PlayMediaInput): Promise<OperationResult<PlayResult>>;
  onTaskUpdate(callback: (event: TaskUpdateEvent) => void): () => void;
}
```

### 8.4 错误处理规范

将底层错误整理成用户可以理解的类别：

- `NOT_FOUND`：媒体文件或源不存在；
- `PERMISSION_DENIED`：权限不足；
- `AUTH_FAILED`：网络源认证失败；
- `NETWORK_UNAVAILABLE`：网络不可用；
- `TIMEOUT`：连接或请求超时；
- `INVALID_CONFIG`：配置字段错误；
- `UNSUPPORTED`：当前操作不支持；
- `BUSY`：任务/播放器正在执行冲突操作；
- `UNKNOWN`：无法分类的错误。

展示时提供：发生了什么、用户下一步能做什么、是否可重试。技术细节仅放入可复制的诊断信息，敏感字段必须脱敏。

### 8.5 缓存和数据一致性

- 媒体库列表、详情和统计信息由 Query 层统一缓存；增删改/刮削后按实际资源失效对应缓存。
- 播放进度以主进程/现有持久层为权威来源；renderer 不自行将播放进度写进另一套存储。
- 收藏状态和媒体状态使用同一真实数据源，不允许卡片与详情状态长期不一致。
- 乐观更新仅用于可安全回滚的操作；失败时恢复旧状态并提示。
- 窗口关闭、应用退出、路由切换时妥善取消请求或清理事件订阅。

---

## 9. 交互与无障碍规范

### 9.1 键盘操作

- Tab / Shift+Tab：按视觉顺序移动焦点；
- Enter / Space：激活按钮、菜单项和卡片可操作元素；
- Escape：关闭弹窗、Popover、侧滑面板或清空可取消的搜索状态；
- Cmd/Ctrl+K：聚焦全局搜索；Cmd/Ctrl+F 不绑定全局搜索，保留给系统/页面查找语义或不做自定义处理；
- 方向键：菜单、网格或列表中的移动按成熟组件惯例实现，不得打断常规文本输入。
- 保留现有应用快捷键；新增快捷键需在菜单/设置中可发现，并检查与 MPV/操作系统的冲突。

### 9.2 可访问性

- 正文与背景满足 WCAG AA 对比度目标；次级文本不能浅到不可读。
- 所有输入都有 label；错误通过 `aria-describedby` 关联。
- Dialog 打开时管理焦点，关闭后回到触发控件。
- 卡片不能只依赖 Hover 才能播放或收藏；键盘焦点时也能看到主要操作。
- 状态变化（扫描完成、连接失败）通过合适的 live region 告知辅助技术。
- 图片缺失时使用语义化 alt/占位，不把长简介作为 alt 文本。
- 颜色不是唯一状态表达方式；成功/失败应配合文字或图标。

### 9.3 响应式窗口行为

虽然是桌面应用，也必须支持用户缩放窗口：

| 窗口宽度 | 行为 |
|---|---|
| ≥ 1440 px | 侧栏展开；海报网格约 6–8 列（根据卡片最小宽度自动计算） |
| 1100–1439 px | 侧栏展开；网格约 4–6 列 |
| 800–1099 px | 侧栏可折叠；网格约 3–4 列 |
| 640–799 px | 侧栏默认窄栏/抽屉；网格约 2–3 列 |
| < 640 px | 优先保证主要操作可用；详情切换为单列/全屏面板 |

以上列数是布局目标，不应硬编码固定列数。使用 CSS Grid 的 `minmax()` / `auto-fill` 或等效自适应方案。避免横向滚动整个页面；特定横向媒体轨道除外。

---

## 10. 性能要求

- 首屏优先加载导航、标题和可见内容；非首屏详情/设置可按路由懒加载。
- 媒体海报使用缩略图或现有缓存资源，不在 renderer 对大图进行同步处理。
- 图片设置合理 `loading="lazy"`、尺寸占位和失败回退，避免布局抖动。
- 大型媒体库不得一次性渲染全部 DOM；当前 catalog 若确为无 offset 且最多返回 600 条，前端虚拟列表不能解决数据被截断。Phase 3 必须先量化典型库规模，再选择增加 `offset/limit/total`（或 cursor）分页 IPC；分页参数应可选并向后兼容旧调用，排序必须稳定且有唯一 tie-breaker。
- 长列表滚动保持流畅；避免每条任务更新都触发全页面重渲染。
- 主题切换不应重载页面或重新查询整个媒体库。
- 主进程繁重扫描/刮削不得运行在 renderer 主线程；保持当前任务执行架构。
- 开发与生产构建中禁止无意输出敏感内容或完整 IPC payload。

**性能验收基线：** 在代表性中型媒体库测试数据下，页面应先绘制骨架/结构，再呈现数据；搜索有明确加载/取消状态；滚动无明显卡顿。具体时间阈值需在 Codex 盘点硬件与当前数据量后定标，不得捏造现有性能数据。分页能力的决策归 Phase 3，不得为了视觉交付在 renderer 截断/假分页。

---

## 11. 数据、配置与兼容性约束

1. 不改变数据库主键、媒体文件路径、播放记录语义或配置文件格式，除非单独提出迁移方案。
2. 如新增 UI 偏好（主题、侧栏折叠、网格/列表视图等），优先放在现有设置存储机制中；不要擅自另建数据库。
3. 新字段必须有默认值、兼容旧版本策略和回滚策略。
4. 不将 API key、密码、Token 等写入前端日志、错误报告、屏幕截图或导出的普通配置中。
5. 卸载 UI 2.0 或回滚旧版时，不能破坏旧版可读取的数据。
6. 任何批量刮削、重新扫描、删除媒体源等可能造成数据变化的操作必须有范围说明和确认。
7. 不将缓存清理与媒体文件删除混为一谈；UI 文案必须清楚区分。

---

## 12. 分阶段迁移与实施计划

### Phase 0：仓库审计与基线冻结

**目标：** 明确真实能力和接口，形成迁移地图。

任务：

- 读取仓库所有入口、package scripts、Electron 配置、preload、IPC handlers。
- 建立功能矩阵、页面矩阵、事件订阅矩阵、设置项矩阵。
- 识别当前 HTML/CSS/JS 中业务逻辑和展示逻辑的耦合点。
- 记录数据库读写位置、扫描/刮削任务状态来源、MPV 调用入口。
- 检查现有自动化测试与构建流程。
- 形成 `CURRENT_STATE_AUDIT.md` 和 `IPC_CONTRACT_MAP.md`。

**验收：** 功能保留清单逐项有映射或明确缺口；构建命令可执行；无代码行为变更。

### Phase 1：React 基础设施、构建链与安全桥接

**目标：** 让 React renderer 可在 Electron 中运行，但不迁移复杂页面。

任务：

- 安装/配置 React + TypeScript + Vite；保持主进程/preload 的 `tsc` 构建不变，建立独立 renderer tsconfig / Vite config（按实际现有 tsconfig 结构调整）。
- 为 renderer 配置独立产物目录（建议 `resource/library-react/`），设置相对资源路径（例如 Vite `base: './'`），不得覆盖 `resource/library/` classic 页面。
- 增加 `build:renderer` / React 开发启动脚本；串联现有 `compile`、`build:win`、`build:mac`、`build:linux`。开发态 HMR 若启用，CSP 仅允许本地 dev server；生产包严格 `connect-src 'none'`。
- 配置 renderer 入口、路由、类型检查、lint、test。
- 建立 React typed desktop API 声明与 service adapter；保持现有 IPC channel。
- 修复已知 preload 白名单缺口：`library:set-source-category` 应登记在 SEND；`library:source-updated`、`library:scrape-status-info` 应在确认对应主进程发送方后登记在 RECEIVE。逐项检查 renderer 实际使用的全部 channel，禁止只补单个问题而漏掉其它调用。
- 按 Phase 1 实施计划 P1-06~P1-08 实现 B1/B2/B3 后端薄 IPC（契约见 §0.5、登记表 P3）：`library:test-source`、`library:update-source`、`library:history`，含 DTO、参数校验、错误脱敏、单元测试与白名单登记；本阶段不做对应 UI。
- 同步更新 `rendererIsolation.test.cjs` / 对应安全测试，使 IPC 白名单与测试断言联动。
- 建立全局错误处理、Toast、主题 provider、token 文件。
- 配置 React 生产 CSP：移除 `script-src 'unsafe-inline'`，保留 `connect-src 'none'` 与 `img-src file:`；必要的开发态 CSP 例外只能放行本机 Vite server。保持本阶段 `sandbox: false`，另立 sandbox 化任务。
- 新增 `uiShell: 'classic' | 'react'` 配置开关，默认/缺省 `classic`；主进程通过一个入口选择 `resource/library/index.html` 或 `resource/library-react/index.html`，React 页面加载失败时自动回退 classic 并记录日志。
- 增加 React renderer smoke test。
- 调整 `electron-builder.files` 以纳入 React 构建产物；保留 classic UI、login 和 mpv-overlay 等既有资源；调整 `.gitignore` 忽略 Vite 缓存、临时构建目录但不误忽略必要打包目录。
- 更新 `.github/workflows/release.yml`：在第三方 MPV 配置下载/解压步骤之后，确保 renderer build 运行在 electron-builder 之前；Windows/macOS/Linux 三个平台的包内均包含 React 产物。

**验收：** Electron 应用可启动 React 空壳；`uiShell=classic` 可正常加载原 UI，`uiShell=react` 可加载 React UI；React 资源确实进入三平台安装包；React 加载失败可回退；全部原有 IPC 白名单安全测试通过；B1/B2/B3 后端 IPC 单测与最小集成验证通过（无需 UI）；所有既有业务服务仍可调用。

### Phase 2：设计系统、应用外壳与平台窗口适配

**目标：** 建立 UI 2.0 的视觉基础和可复用骨架。

任务：

- 建立 Light / Dark / System tokens。
- 实现 AppShell、Sidebar、TopBar、PageContainer、Dialog、Popover、Tooltip、Toast、Button、Input、Select、Switch、Skeleton。
- 适配窗口宽度、焦点状态和现有平台标题栏策略：macOS 原生交通灯；Windows/Linux 自绘窗控与拖拽区。
- 加入基础键盘导航和 reduced-motion。

**验收：** 所有核心组件在 Light/Dark 下无对比度或布局问题；导航和空白占位页稳定；不影响托盘/窗口生命周期。

### Phase 3：媒体浏览与首页

**目标：** 完成最常用的内容浏览体验。

任务：

- 先实现全局媒体列表 service hook；对接真实列表与分页。
- 实现 PosterCard、MediaGrid、MediaList、搜索、过滤、排序、空状态和错误状态。
- 实现首页继续观看、最近新增、最近播放（B3 UI 接线，复用 Phase 1 落地的 `library:history`）和媒体库摘要。
- 实现媒体详情页/侧滑面板。
- 对接播放入口、收藏、观看状态、详情信息。

**验收：** 中型数据集滚动、搜索、筛选正常；点击播放调用真实 MPV；详情数据与旧版一致。

### Phase 4：媒体源、扫描与任务中心

**目标：** 迁移媒体源管理和后台任务操作。

任务：

- 实现源列表、添加、编辑（B2）、移除与连接测试（B1）的 UI 接线（后端 IPC 已于 Phase 1 落地，契约见 §0.5）；未接线前不显示对应按钮。
- 不增加 source `enabled` 字段，不修改 SQLite schema。
- 实现扫描入口、任务事件订阅和 Task Center。
- 实现刮削、重新匹配、失败列表和重试（仅限后端支持）。
- 按任务中心 MVP 只处理当前进程内扫描/刮削实时状态和最近结果摘要；不显示取消按钮、不做任务历史持久化。正确处理窗口关闭、重复触发和事件订阅清理。

**验收：** 本地/SMB/WebDAV 的现有路径可按旧逻辑使用；扫描与刮削结果真实可见；无重复任务、事件泄漏或凭据泄露。

### Phase 5：播放、字幕弹幕与高级能力

**目标：** 完成播放相关设置与用户偏好入口。

任务：

- 保留字幕、弹幕和跳过片头/片尾能力；字幕/弹幕配置仍由 MPV `portable_config` 管理，设置页只提供文档说明与可用的配置目录入口，不复制配置解析/写入逻辑。
- 迁移收藏、隐私模式、托盘相关设置、代理和更新页面；没有应用内安全设置时，将安全说明并入“关于”。
- 保留原生托盘菜单、更新器和窗口行为。

**验收：** 播放、字幕、弹幕、跳过逻辑与旧版一致；隐私/代理/更新/托盘行为逐项回归。

### Phase 6：收尾、性能、回归与发布

**目标：** 关闭旧 UI 入口并确保可回滚。

任务：

- 对功能保留矩阵逐项验收。
- 执行单元、组件、IPC 集成与 Electron E2E 测试。
- 检查性能、键盘、对比度、错误提示、日志脱敏。
- 完成 Windows、macOS、Linux 构建/安装/升级测试（按当前发布矩阵），同时验证 Vite 资源、classic/react 切换、CI 下载第三方资源和 builder files。
- 清理旧 UI 代码前确认没有尚未迁移的业务逻辑；旧代码仅在确认无调用后删除。
- 更新 README、设置帮助、版本说明与开发文档。

**验收：** 所有保留能力达到迁移完成定义；构建产物可安装运行；升级与用户数据兼容；有明确回滚步骤。

---

## 13. 测试与回归矩阵

### 13.1 必测用户路径

| 编号 | 场景 | 操作路径 | 通过标准 |
|---|---|---|---|
| T01 | 首次启动 | 启动应用 → 无媒体库 | Light 默认主题；显示添加媒体源引导；无空白页 |
| T02 | 添加本地源 | 媒体源 → 添加本地目录 → 保存 | 保存真实成功；源列表出现；可启动扫描 |
| T03 | 网络源认证失败 | 添加 SMB/WebDAV → 故意输入错误凭据 → 测试连接（B1） | 显示认证失败（reason=auth）；不保存错误状态为成功；不泄漏凭据；IPC 未实现前不显示测试按钮 |
| T04 | 扫描媒体库 | 源 → 扫描 → 任务中心 | 真实任务状态、进度和结果；事件正确清理 |
| T05 | 媒体识别 | 扫描结束 → 查看电影/剧集 | 分类、标题和集数与后端结果一致 |
| T06 | 刮削匹配 | 打开错误/待匹配媒体 → 重新搜索 → 选择 | 后端更新成功后详情刷新；失败保留原数据 |
| T07 | 浏览筛选 | 媒体库 → 搜索/年份/状态筛选 → 清除 | 搜索与筛选结果正确；无结果提示准确 |
| T08 | 播放新媒体 | 媒体详情 → 播放 | 使用 MPV；启动失败可见；不使用伪造成功 Toast |
| T09 | 续播 | 播放一段 → 退出 → 再次点击继续观看 | 从真实记录位置恢复；观看状态一致 |
| T10 | 字幕/弹幕 | 播放媒体 → 使用旧版已有的播放中字幕/弹幕控制；设置页打开 MPV 配置指引/配置目录 | 控制与 MPV 真实状态一致；不出现虚构的应用内字幕/弹幕设置；不影响播放启动和进度记录 |
| T11 | 跳过片头片尾 | 启用规则 → 播放对应媒体 | 规则按现有逻辑生效；自动/手动提示区分 |
| T12 | 收藏 | 卡片收藏 → 打开收藏页 → 详情取消 | 状态在各视图一致且持久化 |
| T13 | 隐私模式 | 切换隐私模式 → 执行当前受影响操作 | 行为和旧版一致；UI 状态准确 |
| T14 | 代理 | 修改代理 → 保存；仅当旧版已存在真实测试入口时执行测试 | 配置作用范围与旧版一致；不得为了新 UI 新造无后端支持的测试操作 |
| T15 | 更新 | 检查更新/模拟不可用网络 | 更新状态真实；失败无虚假成功提示 |
| T16 | 托盘 | 最小化/关闭窗口 → 托盘恢复 | 托盘行为与旧版一致；菜单可用 |
| T21 | UI 回退 | `uiShell=classic` / `react` 启动；故意缺失 React bundle | classic 资源可加载；React 缺失时自动回退；不白屏 |
| T22 | IPC 白名单 | 运行 renderer isolation 测试；验证 source category 更新事件 | SEND/RECEIVE 白名单与主进程 channel 对齐；无静默失败 |
| T23 | 隐私模式导航 | 开启隐私模式 → 检查侧栏、路由和快捷键 | 分类/刮削/设置入口按旧 UI 规则隐藏；不能由地址栏/快捷键绕过 |
| T24 | 其他分类 | 访问 `/library/others` 并筛选 `category=other` | other 条目可被浏览、搜索、播放，不丢失在默认分类外 |
| T25 | 大库分页 | 准备超过 600 条测试数据并翻页 | 无重复、无漏项；总数准确；稳定排序；分页边界明确 |
| T26 | 生产 CSP | 在打包应用中检查 CSP 与网络请求 | `script-src` 无 `unsafe-inline`；`connect-src 'none'`；本地海报正常；外网请求只能由主进程完成 |
| T27 | 编辑源（B2） | 修改名称/本地路径/WebDAV 凭据（密码留空）→ 保存 → 重扫 | type/private 不可改；密码留空保留旧凭据；路径查重排除自身；隐私源未解锁拒改；路径变更后出现重扫提示 |
| T28 | preload 插件共存（P1） | 加载 React UI → 检查页面 DOM 与旧插件注入行为 | React 顶栏含 `id="titlebar"`，旧 titlebar 插件不注入；playButton/playMaskButton 在 React DOM 上 no-op |
| T17 | 主题 | Light → Dark → System | 所有页面/弹窗颜色正确；无需重启 |
| T18 | 窗口缩放 | 宽屏 → 窄屏 → 最小可用窗口 | 无重叠/遮挡；主要功能仍可操作 |
| T19 | 键盘操作 | Tab/Enter/Escape 遍历页面和弹窗 | 焦点顺序明确；弹窗焦点可恢复 |
| T20 | 重启兼容 | 修改设置/收藏/观看进度 → 重启 | 数据与配置持久化符合旧版语义 |

### 13.2 自动化测试最低要求

- 服务 adapter：成功、失败、超时分支；仅对实际支持中止的短时请求测试取消/清理，不把它解释成扫描/刮削任务取消。
- 任务事件 hook：订阅一次、卸载解绑、重复事件去重；不测试不存在的任务取消或跨重启恢复。
- 主题 Provider：默认 Light、用户偏好、System 更新。
- Source Wizard：必填校验、连接失败、保存失败、成功流程。
- MediaPosterCard：缺图、加载失败、观看状态、键盘焦点。
- PlayButton：启动中防重复点击、真实错误反馈。
- 关键端到端流程：首次启动、添加源、扫描、浏览、播放、续播、收藏。

---

## 14. 验收标准（Definition of Done）

### 14.1 视觉验收

- 默认启动为 Light；视觉语言统一，接近 Apple 桌面应用的克制感。
- 主导航、顶部工具栏、媒体卡片、详情、设置和任务中心均遵循 Design Tokens。
- 没有无意义的粗边框、过度阴影、大面积渐变或过重的玻璃模糊。
- 海报不变形；缺图、加载失败和无数据均有统一占位。
- 窗口宽度变化时布局合理；所有弹窗、菜单和浮层不越界。
- Light、Dark、System 三种主题在所有页面中完整生效。

### 14.2 功能验收

- 第 2 节中所有 `EXISTS` 功能都完成 UI 映射和回归。
- UI 操作调用真实后端能力，无模拟进度和伪造成功状态。
- 播放继续使用 MPV，播放进度和状态使用现有持久层。
- SMB/WebDAV/本地源的行为与旧版一致；连接测试/编辑源（B1/B2）与最近播放（B3）按 §0.5 已批准契约实现，IPC 未落地前不显示伪入口。
- 收藏、隐私、字幕、弹幕、跳过片头片尾、托盘、更新、代理和安全说明均有可发现入口；不存在的设置不伪装成真实开关。

### 14.3 工程验收

- TypeScript 编译无新增错误；不引入无理由 `any`。
- 构建、打包、启动命令在项目支持平台上通过。
- React renderer 没有直接 Node 访问；IPC 经由 preload 白名单。当前 `sandbox: false` 是已记录的兼容例外，不得在验收报告中写成 sandbox 已启用。
- React 组件卸载时清理事件订阅；不存在持续增长的监听器。
- 数据库、配置和媒体文件兼容；升级/回滚过程有测试。
- 自动化测试和手动回归记录归档在 `docs/ui2/`。

---

## 15. 风险与处理策略

| 风险 | 影响 | 处理策略 |
|---|---|---|
| 现有 UI 与业务逻辑高度耦合 | 拆分时误删业务能力 | Phase 0 建立逐项映射；先 adapter，后替换页面 |
| IPC 接口不规范 | React 页面出现大量特殊处理 | 建立 service adapter；底层接口先保持不变 |
| 扫描/刮削进度事件复杂 | 任务 UI 状态错误或监听泄漏 | 明确事件 schema、任务 ID、dispose 和去重规则 |
| 媒体库数据量大 | 首屏慢、滚动卡顿 | 后端分页、图片懒加载、虚拟列表 |
| 播放器为外部进程 | UI 状态与 MPV 状态不同步 | 以主进程/MPV 事件为权威；建立播放状态回归 |
| 跨平台窗口差异 | 标题栏/拖拽/托盘行为异常 | 保留 macOS 原生交通灯 + Windows/Linux frameless 自绘窗控；三平台分别测试 |
| Vite 资源未进安装包 | 开发态可用、生产包白屏 | Phase 1 同步修改 scripts、electron-builder.files、CI、.gitignore，并对安装包检查 renderer index 和静态资源 |
| Preload 白名单遗漏 | 新 UI 调用静默失败 | Phase 1 全面比对 renderer channel 使用点和 SEND/RECEIVE 集合；更新 rendererIsolation.test.cjs |
| 数据量超过 catalog cap | UI 只展示部分媒体却显示全库统计 | Phase 3 决定并实现 offset/limit/total 或 cursor，不用前端虚拟列表掩盖数据截断 |
| 主题实现零散 | Light/Dark 不一致 | 语义 Design Tokens；禁止局部硬编码色值 |
| 安全边界被前端迁移削弱 | Node/凭据泄露风险 | 审核 preload API、CSP、IPC 校验与日志脱敏 |
| 一次性重写范围过大 | 项目长时间不可运行 | 分阶段替换，阶段通过后再进入下一阶段 |

---

## 16. Codex 工作规则与提交要求

Codex 在整个实施过程中遵守以下规则：

1. 每次开始任务先查看 `CURRENT_STATE_AUDIT.md`、`IPC_CONTRACT_MAP.md` 和当前迁移阶段状态。
2. 每次只实施一个可验证的垂直切片，不在一个提交中同时重写路由、数据库、扫描器、播放器和设置。
3. 未经确认不得删除任何旧函数、IPC channel、数据库字段、配置项或菜单项。明确的范围冻结：`resource/login`、`play-movie`、preload 插件注入（playButton/titlebar）及 dormant fnOS adapter 保持原样。
4. 未迁移功能不得隐藏或移除；可以暂时由旧页面承载，但需在迁移日志标记。
5. 对每个新 UI 入口注明调用的真实 service/API；如果暂时没有后端能力，明确标记“当前不支持”，不得做假交互。
6. 每个阶段结束运行：类型检查、lint、相关测试、生产构建；记录结果。
7. 对无法运行的测试说明原因和影响，不得将跳过测试写成通过。
8. 修改 IPC/preload 或安全相关代码时，提供变更清单和风险说明；Phase 1 必须同步检查 SEND/RECEIVE 白名单及 `rendererIsolation.test.cjs`。
9. 不得强行把 `sandbox` 改为 `true`；不得移除 `contextIsolation` 或开放 `nodeIntegration`。Sandbox 化只能作为独立计划提交。
10. 不得把 source `enabled`、字幕/弹幕 UI 设置、演职员 cast/crew、任务取消/持久化、媒体库扫描偏好等未存在的数据/服务层能力伪造成可用功能。
11. 新增依赖前检查现有锁文件、体积和 Electron 兼容性；避免重复引入同类库。
12. 页面样式必须使用 token；除动态计算外，不散落硬编码颜色、阴影和圆角。
13. 组件必须覆盖加载、空、错误和禁用态；重要操作有防重复触发。
14. 完成阶段后更新 `MIGRATION_LOG.md`，写明改动文件、功能映射、测试结果、未解决问题和回滚方式。

### 16.1 建议的 Codex 首轮任务提示词

可将以下内容作为 Codex 第一个任务直接执行：

> 阅读 `FN_Media_UI2_v1_3_Spec.md`（本文件）与 `FN_Media_UI2_v1_3_Decision_Register.md`，先不要开始大规模编码。审计当前仓库，生成 `docs/ui2/CURRENT_STATE_AUDIT.md`、`docs/ui2/IPC_CONTRACT_MAP.md` 和 `docs/ui2/MIGRATION_LOG.md`。逐项核对规格书第 2 节的所有业务能力，查明对应页面入口、函数、IPC channel、数据库读写和事件订阅。B1/B2/B3 已批准（§0.5），审计须包含其目标契约与现有代码挂点（`webdav.ts` 探测能力、`store.updateSource`、`listHistory`）。§0.7 预答结论直接采纳并复核。不要猜测接口；未知项标记 `NEEDS_VERIFICATION`。不要删除或改写现有业务逻辑，不要改变数据库 schema，不要升级 Electron。完成后给出：1）真实技术栈与构建命令；2）业务能力映射表；3）当前架构图；4）迁移风险；5）Phase 1 的最小实施计划。确保现有应用仍可正常构建和启动。

### 16.2 Phase 1 后续任务提示词

> 基于审计结果实施规格书 Phase 1。新增 React + TypeScript renderer 基础设施，遵循仓库当前 Electron 和构建环境兼容性。优先复用现有 preload/IPC，不得改动扫描、刮削、数据库、MPV、托盘和更新业务实现。建立类型化 desktop API adapter、主题 provider（默认 Light）、全局错误处理和 renderer smoke test。保留旧 UI 可启动/可回滚。完成后运行类型检查、测试、构建，并更新 MIGRATION_LOG.md。若实施需要改变现有主进程或 IPC 契约，先停止该项并列出原因，不要自行扩大范围。

---

## 17. 交付物清单

最终项目至少应形成以下可维护交付物：

- `docs/ui2/CURRENT_STATE_AUDIT.md`：现有项目盘点。
- `docs/ui2/IPC_CONTRACT_MAP.md`：React 到 preload/IPC/主进程的接口映射。
- `docs/ui2/DESIGN_TOKENS.md`：最终颜色、字体、间距、圆角、阴影与动效规范。
- `docs/ui2/MIGRATION_LOG.md`：每阶段改动、验证、风险和回滚记录。
- `FN_Media_UI2_v1_3_Spec.md` 与 `FN_Media_UI2_v1_3_Decision_Register.md`：定稿基线文档（v1.3 时序修订版；随实施进展如有修订须同步更新版本号）。
- `resource/library-react/`（或经审计确认的独立目录）：React renderer 构建产物；`src/renderer/`：React UI 与设计系统实现（具体目录按仓库适配）。
- `uiShell` 回退配置与 classic/react 双入口加载逻辑。
- React bundle 进入 Windows/macOS/Linux 安装包的 CI / electron-builder 验收记录。
- 自动化测试：组件、服务适配器、任务事件和关键 E2E 流程。
- 应用构建产物及 Windows/macOS（以及项目实际支持的其他平台）验收记录。
- 更新后的开发说明与用户可见的设置帮助。

---

## 18. 最终产品体验检查表

发布前逐项确认：

- [ ] 首次启动即为 Light 主题，首页能清楚引导用户添加媒体源。
- [ ] 用户能在概览快速继续观看。
- [ ] 用户能快速浏览电影、剧集、动漫，并搜索、筛选和排序。
- [ ] 海报、详情、收藏与观看状态一致。
- [ ] 本地、SMB、WebDAV 等现有媒体源能力完整保留；不存在 `enabled` 开关。
- [ ] 连接测试与编辑源按 B1/B2 契约可用；首页"最近播放"按 B3 契约真实展示。
- [ ] React 顶栏保留 `id="titlebar"` 注入守卫（P1），旧 preload 插件不与 React UI 冲突。
- [ ] `/library/others` 可浏览 `category=other`。
- [ ] 隐私模式开启时导航裁剪规则与旧 UI 一致。
- [ ] 任务中心符合 v1 MVP 边界：实时状态 + 最近结果摘要，无虚构取消/持久化任务。
- [ ] `uiShell` 可在 classic/react 间切换，React bundle 缺失时可回退。
- [ ] 三平台安装包包含 Vite renderer 产物，CI 仍正确下载并组装第三方 MPV 资源。
- [ ] 扫描、识别、刮削和重新匹配均由真实后端执行，并在任务中心可见。
- [ ] 播放仍由 MPV 完成，续播与观看记录准确。
- [ ] 字幕、弹幕、跳过片头/片尾能力保留。
- [ ] 隐私模式、托盘、更新、代理、安全能力均可访问且行为未退化。
- [ ] Light / Dark / System 主题齐全。
- [ ] 窗口缩放、键盘导航、弹窗焦点和错误反馈正常。
- [ ] 没有伪造的任务进度或成功提示。
- [ ] 没有 renderer 直接访问 Node、文件系统或数据库。
- [ ] 原有用户数据、设置、媒体文件与升级流程兼容。
- [ ] 测试、构建和回滚记录齐全。

---

**规格书结束**  
本文件是 FN Media UI 2.0 的设计与实施基线（v1.2 定稿版）。具体接口名称、数据库字段和执行行为必须以 Codex 对当前 checkout 的首轮审计为准；B1/B2/B3 已获产品负责人批准（2026-11-14），按 §0.5 契约随 Phase 3/4 实现；任何超出本规格范围的业务变化都应先单独说明并获得确认。


## 附录 A：仓库核对参考文件

以下路径是本次修订时核对的公开 `main` 参考位置。Codex 应在实际 checkout 中定位对应文件、确认差异后再动手：

- `src/main/common/mainwin.ts`：平台窗口 frame、macOS traffic lights、`sandbox: false`。
- `src/main/common/winctrl.ts`：当前 `resource/library/index.html` 入口。
- `src/preload/index.ts`：SEND/RECEIVE 白名单、contextBridge API、插件目录加载。
- `resource/library/index.html`：旧 UI CSP、标题栏拖拽区、source category 更新调用。
- `src/modules/library/store.ts`：`updateSource`、`countItems`、`listHistory` 等 store 能力。
- `src/modules/library/webdav.ts`：现有 PROPFIND 解析和 WebDAV 扫描能力。
- `package.json`：现有 `tsc` 构建、`node --test` 测试、electron-builder files 和平台脚本。
- `.github/workflows/release.yml`：第三方 MPV 配置下载、平台构建和 release artifact 流程（Phase 0 唯一仍需完整阅读的文件，见登记表 §3 第 7 项）。
- `src/preload/plugins/titlebar.ts`：旧插件注入守卫（`#custom-titlebar`/`#titlebar` 跳过条件），对应 P1。
- `resource/library/index.html`（loadItems）：catalog `limit: 600` 的传参来源，对应 §0.7 预答 1。

**重要差异提醒：** 本次公开仓库读取到的 `package.json` `files` 列表已包含 `resource/library` 与 `resource/mpv-overlay`；若用户本地审计报告中的列表较短，先检查本地分支/提交是否不同，不得直接覆盖其中任意一方的配置。

**本地 checkout 核对结论（v1.2 定稿时，main @ `b97b050` / v3.2.9）：** `electron-builder.files`、`mainwin.ts` 平台窗口配置（`frame: isMac`、`titleBarStyle: 'hiddenInset'`、`sandbox: false`）、preload 白名单缺口、附录 A 各文件均与本文一致。
