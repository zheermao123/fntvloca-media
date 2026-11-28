# 批次 H：剧集刮削搜索/补刮与日志路径修复

- 版本：3.5.7
- 来源：`docs/ui2/ISSUES_INVENTORY.md` §八（F16 / F17 / D4）

## F16 搜索词清洗

- 新增 `cleanSearchQuery`：
  - 去掉画质/编码/发行噪音；
  - 去掉【已完结】【更新至】等状态标签；
  - 去掉“F 非自然死亡”这类单字母发布前缀；
  - 保留标题数字（如“半泽直树2”）。
- `scrapeShow` 使用清洗后的标题搜索并比较结果；带本季年份无结果时回退无年份，仍无结果时回退去掉尾部季号的主标题。
- 测试覆盖半泽直树、半泽直树2、F 非自然死亡、Game of Thrones。

## F17 已刮削剧补刮

- `scrapeLibrary` 已刮削剧的纳入条件扩展为：存在 `metadata_source === 'filename'` 的剧集。
- `scrapeShow` 优先使用已知 `tmdbId` 直接取详情，不再依赖搜索。
- `refreshEpisodes` 当前季没有匹配集号时，会按集号在其他季就近匹配：
  - 兼容“全剧绝对集号”（怪兽8号 S02E13-23 -> TMDB 第1季 E13-23）；
  - 兼容终章/特别篇错季（灵笼 S01E14/15 -> TMDB Specials）；
  - 不覆盖正常匹配，只处理未匹配项。
- 真实库验证：
  - 怪兽8号 S02E13-23 已获取 TMDB 集名；
  - 灵笼 S01E14/15 已获取“终章 上/下”；
  - 罗小黑战记 E41-45 已获取 TMDB 集名；
  - 重复刮削不会重复搜索。

## D4 日志路径

- 打包版 logger 改为 `~/.fntv/logs/app.log`，与应用配置/媒体库同目录。
- 旧版历史日志仍在 `%APPDATA%\fntv\logs`。
- README 数据路径表已更新。

## 验证

- `npm test`：296/296。
- 真实 TMDB 补刮已验证：
  - 怪兽8号 S02E13-23 已获取 TMDB 集名；
  - 灵笼 S01E14/15 已获取“终章 上/下”；
  - 罗小黑战记 E41-45 已获取 TMDB 集名；
  - 半泽直树2 与非自然死亡刮削成功，获得 TMDB ID/海报/集名；
  - 半泽直树第一季也验证刮削成功；两季均挂 TMDB 55925，按季显示两张卡片；
  - 重复刮削不会重复搜索。
- 打包版验证：
  - CI run `46106923949` 成功；
  - `FNMedia_3.5.7_win_x64.exe` 139,666,430 字节，SHA256 `3F727061CA1A1A38F2D6F4A5A87C2FA06B0989C2DCB26917105215A6FDAF2A6D`；
  - 已安装 3.5.7，安装前备份 `C:\Users\Administrator\.fntv-backup-20261128-121033-pre357`；
  - 打包版详情页可见 TMDB 集名；`~/.fntv/logs/app.log` 存在。

## 正式 Release

- Tag / Release：`v3.5.7`
- Release URL：`https://github.com/zheermao123/fntvloca-media/releases/tag/v3.5.7`
- PR：`#6`，已合并到 `release`（merge commit `4cab863c78a724a118ef67e8d3d05a249e1f8032`）
- Release CI run：`46107910182`（Windows/macOS/Linux/Release Job 全部成功）
- Windows EXE：139,665,048 字节，SHA256 `04B49E07232562509807B599CDEE6DEB1E084F445DF900247C93C799EED32BCE`
- 产物：Windows x64 EXE、macOS arm64/x64 DMG、Linux arm64/x86_64 AppImage。
