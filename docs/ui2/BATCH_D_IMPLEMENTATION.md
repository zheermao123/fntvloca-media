# UI 2.0 批次 D 实施记录

- 基线：v3.5.1 @ `344b904`
- 目标/实际版本：3.5.2
- 来源：`docs/ui2/ISSUES_INVENTORY.md` §八（U13 / F15）
- 计划：`docs/ui2/BATCH_D_IMPLEMENTATION_PLAN.md`

## D-1 页面改名（U13）

采用默认新名「库维护」，5 处全部替换：

- `src/renderer/layout/PrimaryNavigation.tsx`：侧栏导航标签
- `src/renderer/app/AppShell.tsx`：`/tasks` 页面标题
- `src/renderer/pages/tasks/TasksPage.tsx`：`aria-label`、`<h2>`、错误态标题

历史文档/evidence 未改动；无测试/脚本断言旧字符串。

## D-2 扫描“更新”语义（F15）

- `src/modules/library/ingest.ts` 隐私源与公开源两个分支均在 `upsertItem` 前读取 `getItemByPath(sourceId, file.path)`。
- 计数规则：
  - 新建 → `added++`
  - 已存在且 `fileSize` 或 `mtime` 变化 → `updated++`
  - 已存在且文件事实无变化 → 不计
- 纯元数据刷新（NFO/封面）不再虚增“更新”。
- 测试：`tests/libraryIngest.test.cjs` 幂等用例改为 `updated: 0`；新增“仅文件事实变化才计数”用例（无变化 0，改内容后 1）。

## D-3 版本与记录

- `package.json` / `package-lock.json` → 3.5.2
- `CHANGELOG.md` 新增 3.5.2
- 提交切分：`fix(library): count scan updates only when file facts change` → `feat(ui2): rename tasks page to 库维护` → 本记录/版本提交。

## 验证

- `npm test`：287/287（新增 1 用例）。
- `npm run renderer:typecheck`：通过。
- `npm run renderer:build`：通过。
- `rg "任务状态" src`：0 处；`rg "库维护" src`：5 处。
- 真实库/打包版重扫与安装验证待 CI 构建后补充。
