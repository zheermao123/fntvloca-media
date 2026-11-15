# UI 2.0 批次 A 实施记录

- 基线：`feat/ui2-default` @ 3.4.3 / `a22e00b`
- 版本：3.4.4
- 来源：`docs/ui2/ISSUES_INVENTORY.md` 批次 A

## 已实施

| 编号 | 内容 | 实现要点 |
|---|---|---|
| F1 | 首页最近播放 | `library:history` renderer 接线，`RecentlyPlayedSection`，最近 12 条 |
| F4 | 详情页 backdrop | 详情 DTO 映射 `backdropPath`，Hero 背景图 + 渐变遮罩 |
| F10 | 源空状态文案 | 改为引导右上角“添加媒体源”，不再要求回经典界面 |
| F12 | 视图偏好跨重启 | `LibraryPreferencesProvider` 读写 localStorage，含白名单校验 |
| U1 | 主题切换入口 | 顶栏明/暗切换，使用现有 `ThemeProvider` |
| U2 | 分辨率角标 | 电影取文件分辨率，剧集取本季最高分辨率；`2160p` 显示 `4K` |
| U3 | 继续观看进度条 | 继续观看卡片与季卡渲染原生 `progress`，无内联样式 |
| U4 | 全局 Toast | `ToastProvider` + `useToast`，收藏与已看操作反馈失败/成功 |
| U5 | hover 缩放与播放浮层 | 卡片缩放、播放圆形浮层；不改变点击语义 |
| U6 | 玻璃材质 | 侧栏 28px、顶栏 22px backdrop blur + 半透明 surface |
| U8 | 快捷键平台提示 | macOS 显示 `⌘ K`，其他平台 `Ctrl K` |
| U9 | 首页问候语 | 按本地时段显示早上好/下午好/晚上好 |

## 未包含

- U12（窗口 minHeight）需维护者确认后再调整，本批未改。
- U11 仅做暗色基础冒烟，完整全页/弹窗暗色走查留待后续视觉验收。

## 验证

- `npm test`：281/281 通过（新增分辨率、历史映射、进度断言）。
- `npm run renderer:build`：通过。
- 源码 Electron 冒烟：首页问候语/最近播放/分辨率角标/进度条显示；明暗切换生效；详情 backdrop 存在；收藏 Toast 正常；无运行时异常。
- 打包版验证与最终安装记录见交付说明。
