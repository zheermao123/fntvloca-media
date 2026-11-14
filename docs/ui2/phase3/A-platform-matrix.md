# 批次 A-05 Windows 回归与跨平台缺口

日期：2026-11-14
分支：`feature/ui2-phase3`
环境：Windows 10.0.26100 / Electron 38.0.0 / 本机 Node 24（CI Node 22）

## Windows x64 回归（通过）

在真实用户媒体库（17,000+ 条目）上以 file:// React 构建运行 CDP 验收（12 步全通过）：

- App Shell、样式加载（样式表规则数/背景色/链接色断言）
- 窗口控制：`#custom-titlebar` 存在，`min-btn/max-btn/close-btn` 齐全
- 媒体库电影/剧集、电影详情、季详情（含剧集列表）
- 全局搜索（Ctrl+K）结果跳转
- 媒体源（真实 6 个源，位置脱敏）/ 任务页
- 隐私入口弹窗
- console errors = 0；非预期安全策略违规 = 0；标题栏插件内联样式拒绝 6 条（已知例外）

证据：`evidence/p207-result.json`、`evidence/ui2-p207-library.png`、`evidence/ui2-p207-detail.png`、`evidence/ui2-p207-classic.png`。

隐私与安装相关回归分别见 `A-privacy-e2e.md` 与 `A-install-smoke.md`。

## 播放语义

播放按钮保持 fire-and-forget：仅显示“已发起播放…”，不显示“播放成功”。本批次未修改播放链路。

## 跨平台矩阵

| 平台 | 构建 | 运行 | 结论 |
|---|---|---|---|
| Windows x64 | CI NSIS 成功（见 A-install-smoke） | CI 安装+启动冒烟、本机 file:// React 回归 | 通过（见备注） |
| macOS x64/arm64 | 本批次未执行 | 未执行（无可用设备） | **未验证** |
| Linux x64/arm64 | 本批次未执行 | 未执行（无可用设备） | **未验证** |

未验证原因：当前执行环境仅有 Windows；跨平台运行不能由交叉编译成功替代。仓库 CI 支持对应矩阵，但本批次未触发（避免产生未审阅的跨平台产物）。此项保留为批次 C/发布前阻塞验证。

## 备注与限制

- Windows 安装冒烟在 CI runner 隔离环境完成；未在本机覆盖用户现有安装。
- 标题栏插件内联样式被生产 CSP 拒绝为已知兼容性例外（插件未修改；打包版不启用 React）。
- macOS 原生交通灯与 Linux 自绘窗控未实机验证，不得视为通过。
