# 飞牛影视正式 Release 记录

## v3.5.7（当前正式版）

- 发布日期：2026-11-28
- Release：`https://github.com/zheermao123/fntvloca-media/releases/tag/v3.5.7`
- Tag：`v3.5.7` → `4cab863c78a724a118ef67e8d3d05a249e1f8032`（release merge commit）
- PR：`#6`（`release-3.5.7` → `release`）
- 发布 CI：run `46107910182`（Windows/macOS/Linux 构建与 Release Job 全部成功）
- 发布内容：UI 2.0 功能补齐、操作记录、刮削/补刮修复、日志路径修复等，见 `CHANGELOG.md`。

### 资产

| 平台 | 文件 | 大小 |
|---|---|---:|
| Windows x64 | `FNMedia_3.5.7_win_x64.exe` | 139,665,048 |
| macOS arm64 | `FNMedia_3.5.7_mac_arm64.dmg` | 139,663,293 |
| macOS x64 | `FNMedia_3.5.7_mac_x64.dmg` | 144,865,030 |
| Linux arm64 | `FNMedia_3.5.7_linux_arm64.AppImage` | 139,202,132 |
| Linux x86_64 | `FNMedia_3.5.7_linux_x86_64.AppImage` | 139,411,512 |

Windows x64 SHA256：`04B49E07232562509807B599CDEE6DEB1E084F445DF900247C93C799EED32BCE`

证据：`evidence/v3.5.7-final-run.json`。

## v3.3.0（历史正式版）

- Release：`https://github.com/zheermao123/fntvloca-media/releases/tag/v3.3.0`
- Tag 指向：`1a40e8d`
- Windows x64 SHA256：`5C733306A54F696A5AC80E8BB120BC04CF479DB29F18D284826EB3406873E025`
- 详细门禁记录：`FORMAL_RELEASE_GATE_REPORT.md`

## 说明

- macOS/Linux 正式资产已完成 CI 构建与上传，但未进行实机运行验收。
- 测试构建与预览构建不列入正式 Release 记录；其 CI run 与哈希见对应批次文档。
