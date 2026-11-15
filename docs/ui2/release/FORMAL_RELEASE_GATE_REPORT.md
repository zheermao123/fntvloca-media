# 正式发布门禁执行报告

日期：2026-11-15
分支：`ui2-integration` @ `2458c85`
目标：完成第四阶段正式发布门禁五项工作，不执行 Tag/Release/正式发布。

## 1. 工作项状态

| # | 工作项 | 状态 | 说明 |
|---|---|---|---|
| 1 | 配置 GitHub release Environment | **已完成** | 环境 `release` 已创建；Required reviewers = `zheermao123`；部署分支策略仅 `release` |
| 2 | 同步发布工作流到 release 分支 | **阻塞（未执行）** | `origin/release` 仍为旧 v3.2.9：无 `renderer:build` 脚本、无 UI2 代码；直接同步新 workflow 会在构建阶段失败 |
| 3 | 验证发布正向路径 | **未执行（依赖 #2）** | 需要 release 分支具备与已验证 workflow 兼容的代码后才能执行；不得在旧代码上触发 `publish=true/platform=all` 以免产生正式发布 |
| 4 | 验证发布负向路径 | **已完成** | feature 分支 / `publish=false` / 非 all 平台的 Release Job 均为 skipped；无 Tag/Release |
| 5 | 形成最终发布审查报告 | **本文件** | 已汇总 CI、产物哈希、验收、回滚与风险 |

## 2. Environment 配置（已完成）

- 环境：`release`
- Protection rules：`required_reviewers` + `branch_policy`
- Required reviewer：`zheermao123`（仓库维护者）
- 部署分支策略：仅 `release`
- 证据：`docs/ui2/release/evidence/environment-release.json`、`environment-branch-policies.json`

说明：GitHub `workflow_dispatch` 要求 workflow 存在于默认分支，无法用临时 workflow 单独验证审批弹窗；因此正向审批门禁需在同步后的 release 分支上验证。

## 3. release 分支同步阻塞

`origin/release` @ `d02a79d`（v3.2.9）现状：

- `package.json` 无 `renderer:build` 脚本；
- 无 UI2 `src/renderer`/Vite 构建链；
- 测试仍为旧版本（Linux `safeStorage` mock 问题未修复）；
- workflow 为旧版（`release_tag`、push 自动发布路径）。

已合并的 `ui2-integration` 新 workflow 依赖 `renderer:build` 与 274/274 测试环境。**仅同步 workflow 会在 Compile/Renderer 构建阶段失败**；因此未修改 release 分支，也未执行正式参数的正向构建。

## 4. 负向路径验证（已完成）

| Run | Ref | publish | platform | 结果 |
|---|---|---|---|---|
| `43671797192` | `feature/ui2-phase3` | true | all | Release Job **skipped**；无 Tag/Release（Linux 构建失败为修复前测试 mock 问题） |
| `43672093244` | `feature/ui2-phase3` | false | windows | Build/Artifact 成功；Release Job **skipped** |
| `43677973103` | `feature/ui2-phase3` | true | windows | Build 成功；Release Job **skipped**（非 all 平台） |

当前 Tags 仍为 `v3.2.9 / v3.2.8 / v3.2.7`，未创建新 Release。

## 5. 已就绪的发布输入

- 合并后 Windows CI：run `43676835518`（commit `d400139`，274/274，NSIS，安装/回退/卸载冒烟通过）。
- 安装包：`FNMedia_3.2.9_win_x64.exe`，SHA256 `62FA6B8DE8584CDEC80AAF8A810B63AD4F5C263DABED688018677DA4AE83F69A`。
- 集成验收：`docs/ui2/integration/ACCEPTANCE_REPORT.md`。
- 回滚方案：`docs/ui2/integration/ROLLBACK.md`。
- 已接受风险：macOS/Linux 未实机验证（用户 2026-11-15 接受）；B-03 多版本 L2 缺口；扫描无状态/取消接口；搜索不支持文件名；深 offset 成本；标题栏插件 CSP 已知例外。

## 6. 需要用户决策

要让正向路径可验证，需要明确以下之一：

1. **将 `ui2-integration` 作为 Release Candidate 同步到 `release` 分支**（保留参数/环境门禁，仍不自动发布），然后同步 workflow 并执行 `workflow_dispatch + publish=true + platform=all`；在 Environment 审批处等待并取消，不批准发布。
2. **暂时保持 release 分支冻结**，在正式发布审批时再同步 RC 代码与 workflow，随后执行正向门禁验证。
3. 其他指定方案。

在完成该决策前，**R3 代码门禁与 Environment 配置已完成，release 分支同步与正向审批验证待授权**；不得执行正式 Tag/Release。

## 7. 边界确认

- 未合并 main；
- 未修改 `release` 分支；
- 未创建/推送 Tag；
- 未创建 GitHub Release；
- 未上传正式发行包；
- 未切换 React 默认 UI；
- 临时验证分支已删除（本地与远端）。
