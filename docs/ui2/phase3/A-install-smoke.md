# 批次 A-04 CI 安装包隔离安装与启动冒烟

日期：2026-11-14
分支：`feature/ui2-phase3`
CI run：`43604704680`（commit `67360ce`）
运行环境：GitHub `windows-latest`（Windows Server）+ Node 22.23.4 / npm 10.9.9

## 结论

**通过**。CI 在 runner 隔离环境完成：clean install → 261 项测试 → renderer 构建 → NSIS 安装包生成 → **静默安装** → 启动并用 CDP 校验 → classic 默认与“强制 React 回退”两种入口 → **静默卸载**。Release Job 为 skipped，未创建 Release。

## 产物

| 项 | 值 |
|---|---|
| 文件 | `FNMedia_3.2.9_win_x64.exe` |
| 大小 | 139,650,161 字节 |
| SHA256 | `B26454F7AC2A318BA80B8CCB5F8EF5F5C9810F4ACB37EE53D2E1C06DBD223015` |
| Artifact 名称 | `windows-build`（Actions artifact） |

## 冒烟步骤与证据

| 步骤 | 命令/方式 | 结果 |
|---|---|---|
| 干净安装 | `npm ci --no-audit --no-fund` | 成功 |
| 测试 | `npm test` | 261/261 通过 |
| 构建 | `npm run build:win`（含 `--publish never`） | NSIS 生成成功 |
| 安装 | `Start-Process installer /S -Wait` | 成功 |
| 默认启动 | 启动安装后 exe → CDP 校验 `resources/app.asar/resource/library/index.html` 且标题含「媒体库」 | `classic smoke OK: 媒体库 v3.2.9` |
| 回退启动 | 设置 `FNTV_UI_SHELL=react` + dev URL 后重启打包版，仍加载 classic | `packaged-fallback classic smoke OK` |
| 卸载 | 静默运行 `Uninstall*.exe /S`，等待安装目录移除 | `uninstall smoke OK` |

日志原文（脱敏）：`evidence/ci-install-smoke.log`。

## 隔离与安全

- 全程在 GitHub Actions runner 上执行，**未在本机覆盖用户现有安装**，未读取/迁移真实用户配置或媒体库。
- 不要求真实隐私密码，不涉及私有数据。
- Release 任务因 workflow_dispatch 条件跳过；构建仅上传 Actions artifact。

## 已知限制

- CI 冒烟为无人工交互的 CDP 校验；窗口拖拽/按钮点击等交互细节依赖 Windows 回归（A-05）与后续人工验收。
- 仅 Windows 实机验证；macOS/Linux 状态见 `A-platform-matrix.md`。
- runner 一次性环境，卸载后未做重装循环测试。

## 回滚

无生产代码回滚需求；如 CI 冒烟失败，保留 artifact、日志与 SHA256，停止发布流程并修复后重跑（本批次未发布）。
