# UI 2.0 批次 F 实施记录：操作记录（软件运行期）

- 基线：3.5.4 @ `d119e72`
- 目标/实际版本：3.5.5
- 语义：本次软件运行期间保留；关闭软件/重启后清空；不写数据库。

## 实现

### 全局内存存储

新增 `src/renderer/app/operationLog.ts`：

- `startOperation` / `finishOperation`
- `useOperationLog`（`useSyncExternalStore`）
- `findRunningOperation`、`getOperations`
- 最多保留 100 条，数组按最新在前
- 无 localStorage、无 IPC、无 schema 变更

### 库维护页

- 页面底部改为「操作记录」，说明“本次软件运行期间（关闭软件后清空）”。
- 记录全库扫描与 TMDB 刮削；页面离开后异步任务仍完成并写回记录。
- 进入页面时若后端 `running=true` 且无本地运行记录，补一条 recovered 记录；每 5 秒查询状态，结束后更新。

### 其他入口

- 媒体源：重新扫描、批量添加后的逐源扫描、添加源、移除源。
- 详情页：重新刮削、手动匹配。
- 私有源操作带 `private` 标记；非隐私模式显示“私有源操作（隐私模式下查看详情）”。

## 验证

- `npm test`：290/290（新增 operation log 单元测试）。
- `renderer:typecheck`、`renderer:build`：通过。
- 源码 Electron 冒烟：
  - 初始显示「操作记录」，空态“本次软件启动后暂无操作记录”；
  - 从媒体源页扫描“电影”后，切到首页再回到库维护，记录仍为“扫描媒体源 / 电影 / 成功 / 更新 0”；
  - 无“本次会话任务”旧文案，无运行时异常。
- 打包版 CI/安装验证待补充。

## 边界

- 只存在于 renderer 内存；正常关闭/重启清空，窗口强制刷新也会清空。
- 若需要跨重启审计，需另做 SQLite `operation_log` 持久化，不在本批次范围。
