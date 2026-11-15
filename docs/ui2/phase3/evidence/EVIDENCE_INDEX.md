# Phase 3 验证证据索引

日期：2026-11-15
分支：`feature/ui2-phase3`
最终功能提交：`54ae250`
最终 CI：run `43669168400`（commit `54ae250`，Windows，271/271）
产物：`FNMedia_3.2.9_win_x64.exe`，SHA256 `8C7D53606D1650779C31B22F5A50F490EB1C64A5F8E14617D91D797841A2EFE2`

说明：macOS/Linux 实机验证已由用户于 2026-11-15 取消并接受未验证风险。

| 文件 | 大小 | SHA256 | 内容 |
|---|---|---|---|
| FNMedia_3.2.9_win_x64.exe.blockmap | 146529 | `882611d02ba39f221fe911e8d1a27c5e59a1208ef4c993b915bf53e6339510cc` | CI 安装包 blockmap（产物元数据） |
| ci-artifact-sha256.txt | 66 | `1993428b6eed76308a28fe0bbda12d2cc345c39f48357556d995da5701f51245` | CI 安装包 SHA256 |
| ci-build-info.json | 424 | `2be0f621d3469255699cbf0a23e6fc07cdb1f838e126e9a9ff704cb2ef3171ef` | 最终 CI run、commit、测试数、安装冒烟与 Release 状态 |
| ci-install-smoke.log | 242 | `2c1520f8a1988fd88bf965f3a2fed6caae17551846158d585d574e416c65bb30` | CI 安装后 classic 默认/回退/卸载日志 |
| p207-classic-result.json | 341 | `2fadfa5c3877a8c624185cb085e2f75105282ae5ccbe722d3432459a19b57561` | classic 默认启动校验 |
| p207-final.log | 12896 | `496aa3edfd1ce8e8d84cdee78b67186f01fb0d7a75de1ca12ed17983d51c0b72` | 真实库回归完整日志（含样式/CSP/控制台检查） |
| p207-result.json | 6527 | `ba6ac6a4c32b3be036aa18b7c2f77073aba3542609fe6710121a0025b64dec9f` | 真实库 file:// React 12 步回归结果 |
| phase3-bench-final.log | 2832 | `555ea309d22348fcc2cbbd432e173918b7b7c82aa44c9fdc5cbd749347ff1bf1` | 21k fixture 目录分页主进程基准 |
| phase3-large-library-result.json | 1002 | `80dd4169c3308d467df0d7f06f1cc2c27d4267d21f9a0f7fcf9516bc015d5120` | 17k 电影真实 Electron 分页结果（首屏/加载更多/DOM/heap/唯一性） |
| privacy-e2e-result.json | 3481 | `3ae10d04eeff657e2dbd98b8c69539134bd610d60cb60a8ab391d5cc636f97c1` | 隐私 E2E 16 步（含私有源测试/编辑、锁定回退、重启） |
| privacy-e2e.log | 6664 | `8ef6fa9149f50026f1fb7cd43a3328fa104ccf616f21b40fdf7e8f27606aebaa` | 隐私 E2E 完整日志 |
| release-gate-runs.json | 738 | `71f0ea55216a9835c90234d8aed7e748db2788e1e44a94e07ea57d56e196eeb0` | R3 门禁负向/预览 run、环境状态与 Tag/Release 未变更记录 |
| test-suite-summary.txt | 247 | `7c15aa5150efcd0a1b2e6af217125ddc71e845eacbcb569399f49929e752c227` | 本地完整测试摘要（271/271） |
| ui2-p207-classic.png | 996030 | `83f48e0bf4240cc0b542c12b7adfebdc546317f3edb356c61b6810750a6fda5e` | classic 默认界面 |
| ui2-p207-detail.png | 205933 | `2e11ebea9f131ca268fbb791e06e8882b6c89cf89fd24d114ac6357258316899` | 真实库电影详情 |
| ui2-p207-library.png | 1105385 | `bf3942afa2c238bc82015f3ff81c1157da8d04cfdc07f710cd1a230830937fd6` | 真实库媒体库（file:// React） |
| ui2-p3-home.png | 39913 | `a4b4c37083634900c254bcbbe196918bf36beec79804be540c39445e1ad683cf` | 首页（准确计数 + 继续观看） |
| ui2-p3-search.png | 359370 | `ceef63cb2cddeb5bea1dfd24e0d99b8db4221892bd9e33aafb8ed4c30e516307` | 全局搜索（分类过滤 + 真实匹配数） |
| ui2-p3-sources.png | 64415 | `ff31fa8ddeb734eaf1ac4f1ac35abbda862413952297ab4284cb2af17755c857` | 媒体源（测试/编辑/重扫入口） |
| ui2-p3-tasks.png | 41786 | `5e10a422abf979e1a20755d02b89476a1b8c994f66658fad8ed738f79bba4535` | 任务页（真实状态与会话历史区域） |
| ui2-privacy-e2e.png | 25391 | `1fadb45f58e18bfd301fa6d231f8217174fa505bdb0d70f90e817f948d2534f6` | 隐私 E2E 解锁态 |
