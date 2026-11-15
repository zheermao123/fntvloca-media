# R3 正式发布门禁收尾记录

日期：2026-11-15
分支：`feature/ui2-phase3`
修改前 HEAD：`6911785`
工作流修改提交：`771fff8`
仓库：`zheermao123/fntvloca-media`

## 1. 执行前检查

- 当前分支正确；HEAD `6911785`。
- 工作区存在**既有用户改动**（未触碰、未提交）：`AGENTS.md`、`FN_Media_UI2_Phase1_OpenCode_Package/`、`fn_media_ui2_demo.html`。
- 现有 Release Job 条件缺少来源分支限制。
- `origin/release` 仍为旧 workflow（含 `release_tag`，无 `publish` 输入），与 `feature/ui2-phase3` 不一致。
- GitHub Environments API：`total_count=0`；`environments/release` 返回 404 → **`release` Environment 尚未创建/未配置 Required reviewers**。

## 2. 代码修改

仅修改 `.github/workflows/release.yml`：

```diff
       github.repository == 'zheermao123/fntvloca-media' &&
       github.event_name == 'workflow_dispatch' &&
+      github.ref == 'refs/heads/release' &&
       github.event.inputs.publish == 'true' &&
       github.event.inputs.platform == 'all'
```

最终 Release Job 条件（同时满足）：

- `success()` 且 `check-commit.should-skip != 'true'`
- 仓库为 `zheermao123/fntvloca-media`
- 事件为 `workflow_dispatch`
- `github.ref == 'refs/heads/release'`
- `publish == 'true'`
- `platform == 'all'`
- 绑定 `environment: release`

Build Job 未修改；预览构建（`publish=false`）不受影响。

## 3. 静态检查

| 检查项 | 结果 |
|---|---|
| YAML 语法 | Python `yaml.safe_load` 通过 |
| 四项条件齐全 | 通过（dispatch + ref + publish + platform） |
| `environment: release` 仍绑定 | 通过 |
| Build Job 未被修改 | 通过（diff 仅 1 行） |
| 预览构建能力保留 | 通过（`publish=false` 可正常构建） |

## 4. 验证运行

### 负向验证（非 release 分支 + 正式参数）

- run `43671797192`，ref `feature/ui2-phase3`，inputs：`publish=true`、`platform=all`。
- `Create Release` Job：**skipped**。
- 无新 Tag、无新 Release。
- 备注：Linux Build 失败（独立既有构建问题），导致整体 run 失败；Windows/macOS Build 成功。由于 Release Job 含 `success()`，该 run 不能单独隔离证明分支条件，但 Job 条件静态检查已确认 `ref` 限制。

### 预览构建

- run `43672093244`，ref `feature/ui2-phase3`，inputs：`publish=false`、`platform=windows`。
- Build Job：success；Artifact 正常上传。
- `Create Release` Job：**skipped**。
- 无新 Tag、无新 Release（仍为 v3.2.9 及更早）。

### 从 release 分支的正向预览

**未执行**。原因：`origin/release` 仍是不含 `publish` 输入的旧 workflow；若要执行必须先更新 release 分支（超出本次授权范围）。发布前需先将新 workflow 同步到 release 分支，再执行一次 `publish=false` 预览。

## 5. GitHub Environment 人工审批

- 当前仓库 Environments：`count=0`；`release` 环境不存在。
- **Required reviewers 尚未配置**；`environment: release` 无法提供实际人工审批保护（GitHub 可能隐式创建无保护环境）。
- 管理员待办（需要仓库管理员在 Settings → Environments 操作）：
  1. 创建 Environment `release`；
  2. 配置 Required reviewers（仅限有发布权限的维护者）；
  3. 建议限制 Deployment branches 仅 `release`；
  4. 配置后重新确认 API 可读取 `protection_rules`。

## 6. 结论

**R3 代码门禁已完成，人工审批配置待确认。**

- 正式 Release 现已强制来源于 `release` 分支，且必须 `workflow_dispatch` + `publish=true` + `platform=all`。
- 非 release 分支即使选择正式参数也不会创建 Release（Job 条件服务端判定）。
- 预览构建正常，Release Job 跳过。
- 在 Required reviewers 配置完成前，不应执行正式发布；从 release 分支的正向预览也需在 workflow 同步后补做。
