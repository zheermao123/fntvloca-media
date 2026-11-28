# UI 2.0 集成验收回滚方案

> 当前正式版：**v3.5.7**（2026-11-28）。下方第 1–4 节为 2026-11-15 的历史演练记录，保留作为流程依据；当前回滚目标为上一个正式版 v3.3.0。

## 0. 当前正式版回滚

1. 停止当前应用，记录当前版本与数据目录（`~/.fntv`）。
2. 运行安装目录的 `Uninstall*.exe /S`。
3. 安装官方 v3.3.0 安装包（上一个正式版）：
   - 文件：`FNMedia_3.3.0_win_x64.exe`
   - SHA256：`5C733306A54F696A5AC80E8BB120BC04CF479DB29F18D284826EB3406873E025`
4. 启动验证：v3.3.0 正常启动，`~/.fntv` 中的源、条目、观看记录、收藏、隐私密码与 TMDB 配置仍可读取。
5. v3.5.7 相较 v3.3.0 未引入数据库 schema 迁移；回滚不涉及数据转换。日志路径在 v3.5.7 改为 `~/.fntv/logs`，旧日志仍保留在 `%APPDATA%\fntv\logs`。

## 历史记录：v3.2.9 回滚演练

日期：2026-11-15
适用：`ui2-integration` @ `d400139`（Phase 3 合并后）

## 1. 安装包回滚（已实测）

1. 停止应用（`Get-Process` 匹配 `Programs\fntv`）。
2. 运行已安装目录的 `Uninstall*.exe /S`，确认安装目录移除。
3. 安装官方 v3.2.9 安装包：
   - 文件：`FNMedia_3.2.9_win_x64.exe`
   - SHA256：`C4E54AC74F0D8CC3D41663380A154A1B692106CE43B949F8167CB80D38BE7E64`
4. 启动验证：标题「媒体库 v3.2.9」、classic 默认、`app.asar` 不含 Phase 3 `sort.js`。

> 本流程已在集成验收中实际执行并通过。

## 2. 代码回滚

- 合并提交：`d400139`（PR #1，merge commit）。
- 如需在集成分支回滚：`git revert -m 1 d400139`（需用户明确授权；禁止 force push）。
- 也可从 `ui2-integration` 重新切出上一稳定点（Phase 2 合并后 `e8e0b1e`）进行发布构建。
- 不得删除/重写历史；不得合并 main 或创建 Tag 作为回滚手段。

## 3. 数据与配置

- Phase 3 未做数据库迁移、未新增 DB 索引、未新增 IPC/preload 白名单。
- B-03 多版本未实施；回滚不涉及用户媒体库、收藏、观看记录。
- 配置目录与隐私密码哈希不受影响。
- React 仍为可选入口；回滚后 classic 默认不变。

## 4. 发布侧回滚

- 未创建正式 Tag/Release；如未来发现发布问题，撤销/删除 Release 需单独授权。
- CI 预览构建仅上传 Actions Artifact；`--publish never` 与 R3 Release Job 条件防止隐式发布。
- `release` Environment 已配置 Required reviewer 与仅 release 分支策略；正式发布仍需用户明确授权，最终候选产物的 Run/SHA256 需在审批前重新记录并核对。
