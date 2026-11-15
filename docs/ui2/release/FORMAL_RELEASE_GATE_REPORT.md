# 正式发布门禁执行报告

日期：2026-11-15
集成分支：`ui2-integration` @ `37d09c9`（本报告修订后可能前进，以当时 git HEAD 为准）
发布分支：`release` @ `5ed6d1e`（RC + 文档同步；本报告提交后 release 会再前进一次文档提交）
目标：完成第四阶段正式发布门禁五项工作，不执行 Tag/Release/正式发布。

## 1. 工作项状态

| # | 工作项 | 状态 | 说明 |
|---|---|---|---|
| 1 | 配置 GitHub release Environment | **已完成** | `release` 已创建；Required reviewers = `zheermao123`；部署分支策略仅 `release` |
| 2 | 同步发布工作流到 release 分支 | **已完成** | `ui2-integration` 以普通 merge 同步到 `release`（`56f8c7c`，`[skip ci]`）；含新 workflow、`--publish never`、274 测试与 UI2 RC |
| 3 | 验证发布正向路径 | **已完成（已取消，未发布）** | run `43678693453`：ref `release`、`publish=true`、`platform=all`；三平台构建成功，Release Job 等待 Environment 审批（pending=1），随后取消 |
| 4 | 验证发布负向路径 | **已完成** | feature 分支 / `publish=false` / 非 all 平台 Release Job 均 skipped；无 Tag/Release |
| 5 | 形成最终发布审查报告 | **本文件** | 汇总 CI、产物哈希、验收、回滚与风险 |

## 2. Environment 配置

- 环境：`release`
- Protection rules：`required_reviewers` + `branch_policy`
- Required reviewer：`zheermao123`（仓库维护者）
- 部署分支策略：仅 `release`
- 证据：`docs/ui2/release/evidence/environment-release.json`、`environment-branch-policies.json`

说明：Required reviewer 已实际阻止 Release Job 自动执行；本次验证未点击/调用任何审批。

## 3. release 分支同步

- 同步提交：`56f8c7c chore(release): sync UI 2.0 RC from ui2-integration [skip ci]`
- 内容：`ui2-integration` 全部 Phase 3 RC、R3 workflow（publish=true/ref=release/platform=all + environment）、`--publish never`、274 测试、集成验收文档。
- 推送使用 `[skip ci]`，未触发 push 构建；workflow 的 Release Job 仅在 `workflow_dispatch` 下允许，普通 push 不可能发布。
- 版本仍为 `3.2.9`；未创建新 Tag。

## 4. 验证运行

### 正向路径（release 分支）

| 项 | 结果 |
|---|---|
| Run | `43678693453` |
| Ref / Inputs | `release` / `publish=true` / `platform=all` |
| Build（Windows/macOS/Linux） | 全部 success |
| Release Job | **waiting（Environment 审批）**，pending_deployments=1 |
| 处理 | 请求取消，最终 `completed/cancelled`；pending 清零 |
| Tag/Release | 未创建（仍为 v3.2.9 及更早） |

macOS/Linux 构建成功仅代表产物可构建，**不代表实机运行验收通过**。

### 负向路径

| Run | Ref | publish | platform | 结果 |
|---|---|---|---|---|
| `43671797192` | `feature/ui2-phase3` | true | all | Release Job **skipped**；无 Tag/Release（Linux 构建失败为修复前测试 mock 问题） |
| `43672093244` | `feature/ui2-phase3` | false | windows | Build/Artifact 成功；Release Job **skipped** |
| `43677973103` | `feature/ui2-phase3` | true | windows | Build 成功；Release Job **skipped**（非 all） |

## 5. 已就绪的发布输入

- 合并后 Windows CI：run `43676835518`（commit `d400139`，274/274，NSIS，安装/回退/卸载冒烟通过）。
- 安装包：`FNMedia_3.2.9_win_x64.exe`，SHA256 `62FA6B8DE8584CDEC80AAF8A810B63AD4F5C263DABED688018677DA4AE83F69A`。
- 集成验收：`docs/ui2/integration/ACCEPTANCE_REPORT.md`。
- 回滚方案：`docs/ui2/integration/ROLLBACK.md`。
- 已接受风险：macOS/Linux 未实机验证（用户 2026-11-15 接受）；B-03 多版本 L2 缺口；扫描无状态/取消接口；搜索不支持文件名；深 offset 成本；标题栏插件 CSP 已知例外。

## 6. 后续发布决策

门禁已就绪，正式发布仍需用户明确授权：

1. 选择要发布的版本号/Tag（当前 package 版本仍为 3.2.9，建议先决定是否递增版本）。
2. 明确批准正式发布后，由维护者在 `release` Environment 审批正向 run，或重新触发 `publish=true/platform=all` 并批准。
3. React 默认 UI 切换仍为独立决策，本次未切换。

## 6.1 P1 审查问题处理状态（2026-11-15）

### P1-01 版本号仍为 v3.2.9（阻塞正式发布）

- 当前 `package.json`/`package-lock.json` 仍为 **3.2.9**；GitHub Release `v3.2.9` 已存在。
- **未擅自改版本号**。需产品决策：3.2.10（补丁）或 3.3.0（功能版本）。
- 决策后需同步：`package.json`、`package-lock.json`、CHANGELOG、发布说明、最终候选构建与哈希记录。
- 在此之前不得批准正式 Release。

### P1-02 release 分支保护（已启用）

已通过 Branch Protection API 启用（个人仓库限制除外）：

- 必须通过 PR；至少 1 个 approving review；
- 需要 `build-and-test` 检查（strict）；
- 要求 last push approval、dismiss stale reviews；
- 禁止 force push、禁止删除分支、要求会话解决；
- `enforce_admins` 在本报告提交后启用（文档提交需要一次 admin 直推）。
- 2026-11-15 用户决定取消第二审批人限制，`required_pull_request_reviews` 已移除；保留 required checks、禁 force/删除、enforce_admins。
- 限制：该仓库为个人仓库，Branch Protection API 不支持 users/teams 推送白名单；无法在 API 层限制“谁可推送”。

### P1-03 Environment 独立审批（部分完成，待决策）

- Required reviewer：`zheermao123`（唯一）。
- `prevent_self_review = false`：发起人可审批自己的运行。
- `can_admins_bypass = false`：已关闭管理员绕过。
- 若要求独立双人审批：需增加第二维护者/团队，并启用 `prevent_self_review=true`；当前未启用，避免无人可审批。

### P1-04 产物哈希追溯（已记录，最终哈希待新版本 Run）

| Run | Ref / Commit | 文件 | 大小 | SHA256 |
|---|---|---|---|---|
| `43676835518` | `ui2-integration` / `d400139` | Windows EXE | 139,653,954 | `62FA6B8DE8584CDEC80AAF8A810B63AD4F5C263DABED688018677DA4AE83F69A` |
| `43678693453` | `release` / `56f8c7c` | Windows EXE | 139,653,714 | `8C4D675B8B0390E5EAD33122DC18EE301B719232FD505DD6181B931C0499B78B` |

正向 Run 其他平台（同一 Run）：

- macOS x64 DMG：144,850,701 / `3381B7936ACB93CE4FC0A40D39C22840E09A063CB828CEC1A457AD357F913614`
- macOS arm64 DMG：139,628,775 / `79774CF5814957B5762F2D654314E3B2E2F49DA39D4FCB7E5ACC09C16C04FB4E`
- Linux x86_64 AppImage：139,398,901 / `1AA4DDE5E60E7D607DE30279D5745012281F45A475CC76A37EBA59D4CA0F99F2`
- Linux arm64 AppImage：139,185,420 / `27A72BC6E6335237C0CC92F72A7E3C22F65645A29B6B0A0C99384C3F1FF741A2`

证据：`docs/ui2/release/evidence/run-artifact-hashes.json`、`p1-status.json`。

**结论：** 验收报告中的 62FA… 仅对应集成验收 Run，不是正向预览/最终发布产物；最终候选必须在版本号确定后重新构建，并将同一 Run 的全部平台文件、大小、SHA256 记录到审批材料，审批与发布后再核对。

## 7. 交付结果与边界

- 已合并 Phase 3 与版本 PR 到集成分支与 release 分支；
- 已创建 Tag/Release **v3.3.0** 并上传正式安装包（经用户授权）；
- 已批准 Environment 部署并核对资产哈希；
- 未合并 main；
- 未切换 React 默认 UI（classic 仍为默认）；
- 临时验证分支已删除。
