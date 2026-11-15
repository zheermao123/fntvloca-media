# B-06 媒体源管理完善

日期：2026-11-15
分支：`feature/ui2-phase3`

## 实现

- 媒体源页新增“测试连接”（`library:test-source`）：显示正常/延迟或失败原因（auth/not_found/network 等），不显示原始错误路径/凭据。
- 新增“编辑”弹窗（`library:update-source`）：名称、内容分类、本地 rootPath / WebDAV URL、用户名；密码留空保持、可勾选清除；保存后刷新列表。
- 保留单源重新扫描与隐私模式地址隐藏。
- 主进程 `library:list-sources` 返回值移除 `passwordEnc`（新增 `toRendererSource` 纯函数；渲染层永不接触凭据密文）。
- 隐私源测试/编辑受主进程解锁门禁约束。

## 测试与证据

- `tests/sourceView.test.cjs`：渲染 DTO 仅移除 passwordEnc，保留展示字段。
- `tests/ui2SourcesTasks.test.cjs`：测试结果文案（成功/认证/网络/路径不存在）不含原始路径或凭据。
- 隔离隐私 E2E 新增步骤：私有源 `test-source` 可访问 → `update-source` 改名 → `list-sources` 反映新名称且 config 不含 passwordEnc；随后完整隐私流程通过（16 步）。
- 总测试 271/271。

## 已知限制

- `library:history` 是播放历史而非“源编辑历史”；本页不伪造源操作历史。播放历史由首页继续观看使用。
- 不支持新增/删除源（沿用既有 UI 范围）；SMB/新扫描协议未扩展。
- 编辑弹窗未对 WebDAV 密码做强度校验（沿用后端 planSourceUpdate 语义）。
