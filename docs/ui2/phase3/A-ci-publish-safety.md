# 批次 A-03 CI 预览构建禁止隐式发布

日期：2026-11-14
分支：`feature/ui2-phase3`

## 结论

- 所有 electron-builder 打包入口显式 `--publish never`。
- `release.yml` 权限最小化：workflow 默认 `contents: read`；只有 Release Job 提升为 `contents: write`。
- 移除“上传到既有 prerelease”的预览步骤；手动 preview 构建只上传 Actions artifact。
- 正式发布仍仅由独立 Release Job 在受控条件（push release 分支 / workflow_dispatch 且 platform=all）执行；本批次未创建 Release。

## 构建入口清单与验证

`package.json`：

```
build:win        ... electron-builder --win --publish never
build:mac        ... electron-builder --mac --publish never
build:linux:x64  ... electron-builder --linux AppImage --x64 --publish never
build:linux:arm64... electron-builder --linux AppImage --arm64 --publish never
```

工作流：

- `permissions: contents: read`（顶层，作用于 build/check 等 job）。
- Release job 内 `permissions: contents: write`。
- 删除 `Upload preview release assets`（不再有 `gh release upload` 预览路径）。
- 保留 `Upload build artifacts`（仅 Actions artifact）。

## 证据

- 检查命令：
  - `git grep -n "electron-builder" package.json`
  - `git grep -n "publish never" package.json`
  - `git grep -n "permissions\\|contents:" .github/workflows/release.yml`
  - `git grep -n "release upload\\|Upload preview release assets" .github/workflows`
- CI 验证：run `43604704680`（Windows preview，commit `67360ce`）。构建日志不出现 publishing/release upload；Release Job 为 skipped；仅 artifact 上传。日志同时确认安装/回退/卸载冒烟通过。
- 本批次未执行任何发布动作，未修改版本号。

## 风险与回滚

- 若未来需要“上传到既有 prerelease”，必须新增显式授权 workflow，并保持 `--publish never` 的构建脚本不变。
- 回滚：恢复 `release.yml` 的权限块与预览步骤；不建议恢复隐式发布。
