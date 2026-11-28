# UI 2.0 契约变更补记（D1 / D2）

日期：2026-11-15  
基线：3.5.0 / `feat/ui2-default`

## D1：titlebar 契约由“阻止注入”改为“注入 + 适配”

- 规格 §0.7 / 登记表 P1 原要求 React 顶栏提供 `id="titlebar"`，让旧 preload titlebar 插件跳过注入。
- 实际实现采用反向兼容：保留 preload 注入的 `#custom-titlebar`，React 顶栏不再要求 `id="titlebar"`；通过 CSP 外部样式适配布局与主题。
- 决策理由：classic 与 React 共用同一 preload；强制禁止注入会让 React 窗口失去 Windows/Linux 自定义最小化/最大化/关闭按钮，或需要复制一套窗口控件 IPC。
- 约束：
  - 注入标题栏必须遵守 CSP，不新增内联样式/脚本；6 条内联样式拒绝为已登记例外。
  - 所有可交互元素保持 `-webkit-app-region: no-drag`；拖拽区只由注入标题栏提供。
  - 若后续移除 preload 注入，必须同时实现 React 窗口控件与拖拽区，并更新本节。
- 验证：`tests/preloadUiShell.test.cjs`、`tests/ui2Shell.test.cjs`；打包版标题栏按钮可用。

## D2：preload 插件在 React 页的两种共存策略

1. **注入 + 适配**：`titlebar` 插件继续向 React 页面注入 `#custom-titlebar`，样式由 React CSS 适配。
2. **React 页禁用**：`playButton` / `playMaskButton` 通过 `src/preload/core/uiShell.ts#isUi2ReactDocument` 判断页面；React 页直接 no-op，避免劫持 React 的播放按钮并误发 `play-movie`。

- 识别规则：file:// 且路径包含 `/ui2-renderer/`，或开发态固定 loopback（`http://127.0.0.1:5273` / `http://localhost:5273`）。
- 新增 preload DOM 插件时必须二选一并写测试：
  - 仅在 classic 生效 → 使用 `isUi2ReactDocument` 守卫；
  - 需要 React 生效 → 只做注入/适配，不接管 React 事件，不发送 classic 专用 IPC。
- 播放统一入口：React 使用 `play-library-item`；`play-movie` 仅保留给 classic/fnOS 注入按钮。
- 验证：`tests/preloadUiShell.test.cjs`、`tests/ui2PrivacyParity.test.cjs`、打包版点击播放实测。

## 相关文档

- 规格：`FN_Media_UI2_v1_3_Spec.md` §0.7 / T28
- 隐私：`integration/PRIVACY_PARITY.md`
- 批次记录：`BATCH_A_IMPLEMENTATION.md`、`BATCH_B_C_IMPLEMENTATION.md`
