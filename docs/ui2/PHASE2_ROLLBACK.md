# UI 2.0 Phase 2 — 回滚说明（PHASE2_ROLLBACK）

日期：2026-11-14
适用范围：`feature/ui2-phase2` 分支（Phase 2 未推送、未发布）

## 1. 默认行为（无需回滚）

- 安装包/打包环境：`resolveUiShell` 对 `isPackaged=true` **始终加载 classic**；普通用户升级后看到的仍是经典界面。
- 开发环境：仅当显式设置 `FNTV_UI_SHELL=react` 时才尝试 React；去掉该环境变量即回到 classic。
- 资源缺失/加载失败：main 侧既有逻辑回退 classic（只回退一次），ui2-renderer 缺失不影响启动。

已验证：未设置环境变量启动 → `#titlebar` 存在、无 `.app-shell-root`、标题「媒体库 v3.2.9」（证据 `p207-classic-result.json`）。

## 2. 关闭 React 壳（运行时回滚）

1. 打包版：无需操作（始终 classic）。
2. 开发版：不设置或清除 `FNTV_UI_SHELL` / `FNTV_UI2_DEV_URL` 后重启 Electron。
3. 如需保留构建产物但禁用：删除/重命名 `ui2-renderer/` 后，`FNTV_UI_SHELL=react` 也会自动回退 classic。

## 3. 代码回滚

Phase 2 提交（均在 `feature/ui2-phase2`，未推送）：

| 阶段 | 提交 |
|---|---|
| P2-00 基线审计 | f24ab6e |
| P2-01 设计系统 | 4933e03 |
| P2-02 App Shell/路由 | ca24640 |
| P2-03 首页 | fb0c70c |
| P2-04 媒体库 | 677a988 |
| P2-05 详情/播放 | 782a814 |
| P2-06 搜索/源/任务 | b3f2dc4 |
| P2-07/08 验收与文档 | 见分支最新提交 |

回滚方式（需用户明确授权后执行，禁止未经授权 reset/clean）：

- 保留 Phase 1：`git checkout ui2-integration`（tag `ui2-phase1-complete`，74302df）。
- 撤销单个阶段：`git revert <sha>`（依次从 P2-08 往回）。
- 放弃整条分支：切回 `ui2-integration` 后删除本地分支（仅在确认无未提交改动时）。

## 4. 数据与主进程回滚

- Phase 2 **无数据库迁移**、无新 IPC、无 preload 白名单变更、无 media/MPV/字幕/弹幕/smart_skip 修改。
- Phase 1 的 B1/B2/B3 IPC（`library:test-source`、`library:update-source`、`library:history`）已随 `ui2-integration` 存在；回退到该点仍保留。
- 因此回滚 UI 不需要恢复数据库或配置；用户媒体库、收藏、观看记录不受影响。

## 5. 安装包/版本回滚

- Phase 2 未发布任何安装包；当前安装版为 v3.2.9。
- 如需回到旧版本：重装 `v3.2.9` 安装包（`https://github.com/zheermao123/fntvloca-media/releases/download/v3.2.9/FNMedia_3.2.9_win_x64.exe`）即可，无需数据迁移。

## 6. 验证过的回退动作

- 生产/打包：classic 默认启动验证通过（窗控/标题正常）。
- file:// React：可通过不设置环境变量恢复正常经典体验。
