# UI 2.0 Phase 2 规划 — Apple 风格媒体库界面

> 状态：规划稿（Phase 1 完成后启动）
> 依据：`FN_Media_UI2_v1_3_Spec.md`（视觉与交互准则、§0.5 IPC 契约）、`FN_Media_UI2_v1_3_Decision_Register.md`（B1/B2/B3 时序：B3→Phase 3，B1/B2→Phase 4）
> 基线：`ui2-integration` @ `ui2-phase1-complete`

## 1. 目标与边界

**目标**：把 React 最小壳推进为**完整、可日常使用的 Apple 风格媒体管理界面**（浏览、搜索、筛选、详情、继续观看、隐私模式入口、播放触发）。

**边界（不做）**：
- B1（连接测试）/ B2（编辑源）的 UI 接线 → Phase 4
- B3（播放历史）的 UI 接线 → Phase 3
- 不改数据库 schema、扫描/刮削/播放/MVP/代理等既有链路
- 不改变 uiShell 默认值（普通用户仍 classic；React 由开发/灰度开关控制）
- 不引入 CSS 框架/组件库（自建轻量设计系统，控制体积与风格一致性）

## 2. 设计语言（Apple 风格基线）

| 维度 | 规范 |
|---|---|
| 风格 | 克制、内容优先、低噪音；大留白 + 细腻排版 + 极轻边框 |
| 圆角 | 卡片 12px、按钮 8px、海报 10px |
| 字体 | `-apple-system, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif`；正文 13-14px，标题 17-22px，辅助 11-12px |
| 颜色 | Light-first：背景 `#f5f5f7`、卡面 `#ffffff`、主文字 `#1d1d1f`、次文字 `#6e6e73`、强调色 `#0071e3`；预留 Dark tokens（Phase 2 末实现跟随系统） |
| 动效 | 150-200ms ease-out；悬停轻微上浮/阴影加深；不做弹跳 |
| 图标 | 内联 SVG（线性、1.5px 描边），不引图标库 |
| 交互 | 单击 = 打开详情；悬停显示播放/收藏操作；`Cmd/Ctrl+K` 全局搜索（沿用既有快捷键决策） |

## 3. 信息架构与组件

### 3.1 布局壳
- 顶部工具栏：窗口控制区（Windows/Linux frameless 自绘按钮，macOS 隐藏交通灯由系统处理）+ 全局搜索框 + 视图切换（网格/列表）+ 设置入口
- 左侧栏（可折叠）：内容分类（全部/电影/剧集/动漫/其他）、隐私模式入口（▾ 下拉：进入隐私模式/隐私源管理，沿用既有交互决策）、源筛选
- 主内容区：继续观看横向行（复用 `library:continue`）+ 媒体网格/列表

### 3.2 组件清单（`src/renderer/components/`）
| 组件 | 职责 | 数据来源 |
|---|---|---|
| `Toolbar` | 搜索、视图切换、窗口按钮 | 本地状态 |
| `Sidebar` | 分类/隐私/源筛选 | `library:catalog`（category/private 参数）、`library:list-sources` |
| `ContinueRow` | 继续观看卡片（剧名 + SxxExx + 进度） | `library:continue` / `library-playback-ended` 刷新 |
| `MediaGrid` / `MediaList` | 季卡/电影卡（海报、进度、收藏、观看状态） | `library:catalog`（limit 600 沿用）、`library:set-favorite`、`library:set-watched` |
| `SeasonDetail` | 季详情（集列表、续播、收藏、标记已看） | `library:show`、`library:item` |
| `MovieDetail` | 电影详情 | `library:item` |
| `PrivacyGate` | 隐私模式密码/解锁 | `library:privacy-*` |
| `EmptyState` / `Toast` / `Skeleton` | 空态/提示/加载占位 | 本地 |

### 3.3 播放
- 复用既有 `play-library-item`（含智能跳过/弹幕/字幕/进度回写），React 不新增播放逻辑
- 播放入口：卡片悬停播放按钮、详情页「播放/续播」、继续观看卡片

## 4. 实施里程碑

| 里程碑 | 内容 | 验收 |
|---|---|---|
| M2-1 设计系统 | tokens（颜色/间距/字号/圆角/阴影）、基础组件（Button/Input/Select/Modal/Toast/Skeleton）、Dark tokens | Storybook 轻量预览页或独立 `/design` 路由；无内联样式（CSP 兼容） |
| M2-2 布局与浏览 | Toolbar + Sidebar + 网格/列表 + 搜索/排序/筛选联调 | 与 classic 数据一致（卡片数/排序/筛选）；搜索防抖；键盘可达 |
| M2-3 继续观看与详情 | ContinueRow、SeasonDetail、MovieDetail、收藏/已看交互 | 播放结束即时刷新；收藏按季独立；已看切换与 classic 一致 |
| M2-4 隐私模式 | PrivacyGate、隐私库浏览、模式切换隔离 | 未解锁不可见隐私数据；切换无缓存泄漏；退出即锁定 |
| M2-5 打磨与验收 | 空态/错误态/加载骨架、Dark 模式、性能（600 卡虚拟化）、可访问性、截图对比 spec | Lighthouse 级自检、滚动 60fps、内存稳定、E2E 清单通过 |

## 5. 技术方案要点

- 状态管理：轻量自研 store（`useSyncExternalStore`）或 Zustand（二选一，倾向零依赖自研，控制体积）
- 数据层：`src/renderer/api/` 封装 preload 桥接（requestId 关联、超时、错误码归一），类型对齐 `library:*` 契约
- 虚拟化：自研窗口化（固定行高/列表）或 `@tanstack/react-virtual`（按体积评估）
- 样式：CSS Modules + CSS 变量（tokens），禁止 inline style（CSP `style-src 'self'`）
- 路由：无路由库，按视图状态机切换（Library / Detail / Privacy）
- 测试：组件逻辑纯函数化 + node:test；关键交互用 dev Electron + CDP 手工/脚本验证（沿用现有测试体系，不引入 Vitest）

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| 600 卡渲染性能 | 虚拟化 + 图片 lazy + 骨架占位 |
| 隐私数据泄漏（渲染缓存） | 切换模式时清空 React 缓存 store；隐私组件卸载即释放 |
| CSP 限制（无 inline style/script） | 设计系统全部外链 CSS；无 CDN |
| classic/react 双壳行为漂移 | 共享同一 IPC 契约与数据口径；迁移期双壳并行对照 |
| React 侧回归影响 classic | uiShell 默认 classic 不变；打包恒 classic，灰度开关另行评审 |

## 7. 启动顺序建议

1. M2-1 设计系统 + M2-2 布局/浏览（先只读展示，最大价值面）
2. M2-3 详情与交互（收藏/已看/播放）
3. M2-4 隐私模式
4. M2-5 打磨 + 灰度评估（是否调整普通用户缺省需产品负责人明确批准）
5. Phase 3（B3 历史 UI）在 M2-2 后可与 M2-3 并行
