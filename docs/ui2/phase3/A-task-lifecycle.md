# 批次 A-02 扫描/刮削生命周期与重复触发

日期：2026-11-14
分支：`feature/ui2-phase3`

## 结论

- 扫描：主进程新增单飞守卫，**同一时刻只允许一个扫描任务**；重复触发返回“已有扫描任务在进行中”，完成/异常后释放。
- 渲染层：长等待使用可取消 `onceReplyCancellable`；离页/卸载时 abort 并移除 IPC 监听；进度订阅在结束时清理。
- 刮削：任务页通过 `library:scrape-status` 读取真实运行状态，进度事件来自 `library-scrape-progress`，完成/失败来自 `library-scrape-done`；不虚构百分比或成功状态。
- 结论：**渲染层生命周期与主进程重复触发边界通过行为测试**；主进程扫描真正取消仍不具备（已知限制）。

## 状态与数据来源

| 状态 | 来源 | 真实性说明 |
|---|---|---|
| 扫描运行中 | 渲染层 `scanPending`（触发后到 `scan-done`） | 仅代表本页面发起的等待；离开页面后无法查询主进程扫描状态 |
| 扫描完成/失败 | `library:scan-done` 汇总/错误 | 真实回包 |
| 扫描重复触发 | 主进程单飞守卫回包错误 | 真实拒绝 |
| 刮削运行中 | `library:scrape-status` + `scrape-started` | 真实状态 |
| 刮削进度 | `library-scrape-progress` | 真实事件（done/total/title） |
| 刮削完成/失败 | `library-scrape-done` | 真实汇总/错误 |

## 实现与测试

- `src/main/handlers/plugins/scanGuard.ts`：`createSingleFlight()`（并发返回 `started:false`，`finally` 释放）。
- `src/main/handlers/plugins/library.ts`：`runScan` 改用单飞守卫，不再使用模块内 `scanning` 布尔。
- `src/renderer/app/bridge.ts`、`services/library/{sourcesService,tasksService}.ts`、`pages/{sources,tasks}`：取消/清理/in-flight 锁（`e8e0b1e` 基线，本批次补测试）。
- `tests/libraryScanGuard.test.cjs`（3 项）：并发拒绝、完成后释放、异常后释放。
- `tests/ui2TasksService.test.cjs`（5 项）：触发参数、取消清理、done 汇总、进度订阅/退订、状态查询。
- `tests/ui2Lifecycle.test.cjs`：生命周期契约（请求序号、abort 引用、主进程单飞）。

## 命令与结果

| 命令 | 结果 |
|---|---|
| `npm test` | 261/261 通过 |
| `npm run compile` / `renderer:typecheck` / `renderer:build` | 全部 exit 0 |

## 已知限制

1. **渲染层取消 ≠ 主进程停止**：AbortSignal 只取消等待与监听；主进程扫描会继续完成。UI 未声称“已取消扫描”。
2. **扫描无状态查询接口**：离页重进后无法得知主进程是否仍在扫描；按钮回到空闲态，但重复触发会被主进程单飞守卫拒绝，并显示真实错误。不伪造“正在运行”。
3. **刮削进度仅在任务页挂载期间可见**；离页后重新进入仅能通过 `scrape-status` 得知 running，不显示历史百分比。
4. 未新增主进程取消接口/任务持久化（属 L2，未获授权）。

## 回滚

回滚 `scanGuard` 使用点与新增测试即可恢复原行为；不涉及数据库/IPC 协议变更。
