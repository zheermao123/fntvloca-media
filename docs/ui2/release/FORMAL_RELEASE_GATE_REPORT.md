# 正式发布门禁执行报告

日期：2026-11-15
集成分支：`ui2-integration` @ `2385590`
发布分支：`release` @ `56f8c7c`（UI 2.0 RC 同步）
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

## 7. 边界确认

- 未合并 main；
- 未创建/推送新 Tag；
- 未创建/修改 GitHub Release 资产；
- 未批准 Environment 部署；
- 未上传正式发行包；
- 未切换 React 默认 UI；
- 临时验证分支已删除。
