# UI 2.0 批次 D 实施计划（页面改名 + 扫描"更新"语义修正）

> **基线：** v3.5.1 @ `344b904`（2026-11-15）
> **目标版本：** 3.5.2
> **来源：** `docs/ui2/ISSUES_INVENTORY.md` §八（U13 / F15）
> **执行环境：** OpenCode（仓库根目录会话，遵循 AGENTS.md）
> **性质：** 实施计划——本文档不改动任何产品代码；由执行方按工作包顺序实施

## 决策点（实施前须确认的唯一参数）

**U13 新页面名：定为「库维护」**（默认推荐）。备选：扫描与刮削 / 后台任务 / 任务中心（不推荐，违背 D7 诚实命名）。换名只影响 5 处字符串常量，实施时可整体替换。

命名理由：页面实际承载"扫描 + 刮削"两类维护操作及会话内历史，"库维护"如实概括且不暗示队列/取消能力。

---

## D-1：页面改名（U13）

**改动点（共 5 处，纯字符串替换 `任务状态` → `库维护`）：**

| 文件 | 位置 | 内容 |
|---|---|---|
| `src/renderer/layout/PrimaryNavigation.tsx` | :49 | 侧栏导航标签（管理组，与"媒体源"并列；隐私模式同样渲染该组，自动生效） |
| `src/renderer/app/AppShell.tsx` | :42-44 | `titleForPath` 中 `/tasks` 的页面标题 |
| `src/renderer/pages/tasks/TasksPage.tsx` | :202 | `aria-label="任务状态"` |
| `src/renderer/pages/tasks/TasksPage.tsx` | :205 | `<h2>` 页面标题 |
| `src/renderer/pages/tasks/TasksPage.tsx` | :226 | 错误态标题 `"任务状态加载失败"` |

**不改动：**
- `TasksPage.tsx:206` 描述行"扫描与 TMDB 刮削（数据来自既有主进程任务）"——仍准确，保留
- 历史文档与 evidence（`PHASE2_*`、`evidence/*.json`、`*.patch`）——历史记录，不改
- `tests/`、`scripts/` 均无该字符串断言（已核验：`git grep "任务状态" -- src tests scripts` 仅 src 5 处）

**验证：** `npm run renderer:typecheck` 通过；启动应用确认侧栏、页面标题、aria 均为新名；`/tasks` 功能无回归。

---

## D-2：扫描"更新"计数语义修正（F15）

**根因：** `src/modules/library/ingest.ts` 两个分支均以 `created ? summary.added++ : summary.updated++` 计数——已存在条目（同源同路径）无论文件是否变化一律计"更新"。

**修正规则：**

1. 在两处 `upsertItem` 调用前，先 `store.getItemByPath(sourceId, file.path)` 取旧记录（接口已存在：`store.ts:54`）
2. `created === true` → `added++`（不变）
3. `created === false` 且旧记录存在且 **`fileSize !== file.size || mtime !== file.mtime`** → `updated++`
4. `created === false` 且文件事实无变化 → **不计数**（干净重扫显示"新增 0，更新 0，移除 0"）
5. 涉及位置：隐私分支（`ingest.ts:170-192`）与公开分支（`ingest.ts:244-275`），各加一行注释说明计数语义

**边界与理由：**
- fileSize/mtime 是 store 唯一会因扫描刷新的"文件事实"列；元数据刷新（NFO enrich 走 `updateItemMetadata`）**不构成**"更新"信号——文件没变就不算
- `added`/`removed`/`skipped`（花絮过滤、解析失败）语义不变
- classic UI 的扫描 toast（`resource/library/index.html:1218` 一带）与 React 源页摘要（`sources.mapper.ts:91`）均只显示后端数字，**自动受益，无需改动**
- 性能：每文件多一次 `UNIQUE(source_id, file_path)` 索引查询，相对扫描 I/O 可忽略

**测试调整（`tests/libraryIngest.test.cjs`）：**

| 项 | 改动 |
|---|---|
| :91 `assert.equal(second.updated, 2)` | 改为 `assert.equal(second.updated, 0)`（无变化重扫不再计更新；该用例本名即 "idempotent"，语义对齐） |
| 新增用例 | `counts updated only when file facts change`：初始扫描 added=2 → 原样重扫 updated=**0** → `fs.writeFileSync` 加大其中一个文件内容（size 变化）→ 重扫 added=0、updated=**1**、removed=0 |

**不受影响：** `ui2SourcesTasks.test.cjs:48/52`（喂固定数字测显示格式）、scraper 测试中 `updated` 变量名（无关）。

**验证：** `npm test` 全绿（286 + 新增 1）；真实库重扫一次确认 toast 显示"更新 0"（或与实际改动文件数一致）。

---

## D-3：版本与记录

- `package.json` → `3.5.2`；`CHANGELOG.md` 新增条目：
  - 修正：扫描"更新"仅统计文件信息（大小/修改时间）实际发生变化的条目
  - 调整：任务页更名为"库维护"
- 建议提交切分（沿用仓库惯例 fix/feat + docs 配对）：
  1. `fix(library): count scan updates only when file facts change`
  2. `feat(ui2): rename tasks page to 库维护`
  3. `docs(ui2): record batch D verification`（实施记录写入 `docs/ui2/BATCH_D_IMPLEMENTATION.md`，格式参照 `BATCH_A_IMPLEMENTATION.md`）

---

## 验收标准

1. 无变化全量重扫：React 源页与 classic toast 均显示 `更新 0`
2. 修改任一视频文件内容后重扫该源：`更新 1`；新增/删除文件分别计 `新增`/`移除` 不回归
3. 侧栏、页面标题、aria-label、错误态标题均为新名；隐私模式下导航同步
4. `npm test`、`npm run renderer:typecheck`、`npm run renderer:build` 全部通过
5. 历史文档与 evidence 零改动；无 schema/IPC/白名单变更

## 回滚

按提交 revert 即可；无数据迁移、无 schema 变更、无用户数据影响。

---

**计划结束。** 执行完成后按职责流程交回复核：我方将依据本计划验收标准出具复核报告（属实/不实 + 证据），并更新 `ISSUES_INVENTORY.md` §八处置列。
