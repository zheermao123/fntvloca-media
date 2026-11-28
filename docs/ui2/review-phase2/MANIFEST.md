# Phase 2 审查包（源码 patch + 运行时/CI 证据）

生成时间：2026/11/14 21:49:51
HEAD：952e99bf9368e99cf8cc33f4b314aefb178efeef
基线：ui2-integration 合并前 74302df
发布边界：未打 tag、未创建 Release、React 非默认 UI

## Patch 文件
- phase2-review.patch：283225 字节，SHA256=a77af571550396792212ea925944e73bd7cf7fbbeb2c2752a85ca48436f42584
- phase2-review-csp.patch：2432 字节，SHA256=dc9b6fb75e887a3aedd750a4d9b71f48418c61a88c6058aa5ec78804347b3d84
- phase2-review-lifecycle.patch：86843 字节，SHA256=cfb078a954a23f9aa7d1074cb957732558c21e10bbae1afe2b4ab51cf0854ef2
- 完整 patch 基线：`git diff --binary 74302df...HEAD -- . ":(exclude)docs/ui2/review-phase2"`

## CI 记录
- run 43601112843（SHA 952e99b）：clean install + 256 tests + Windows 安装包 + 安装冒烟全部成功；Release 跳过
- 冒烟日志：`evidence/ci-install-smoke.log`（default / packaged-fallback 均为 classic）
- 历史：43598158857 首次成功；43597938525 因 --omit=optional 缺 rolldown 绑定失败

## 证据清单
- evidence/build-artifact-index.html：725 字节，SHA256=f834f83eaf626978988ef66a1db69ffa6942b78254a756f40168d8843eee93a1
- evidence/ci-build-info.json：325 字节，SHA256=e95d20366122d01f742c2bc562ab5fa0a8fbab6c32449ec625d4c036581201b6
- evidence/ci-classic-result.json：350 字节，SHA256=e7ae2c6ff497949bf835dcf83dd5e42d7774a478e2bfde6512c67336c59535c6
- evidence/ci-install-smoke.log：100 字节，SHA256=3a4602b49a5e065db4130091eba5352a105189d95e4020ab4970d3691a973c9b
- evidence/ci-installed-classic-result.json：341 字节，SHA256=2fadfa5c3877a8c624185cb085e2f75105282ae5ccbe722d3432459a19b57561
- evidence/p207-classic-result.json：350 字节，SHA256=e7ae2c6ff497949bf835dcf83dd5e42d7774a478e2bfde6512c67336c59535c6
- evidence/p207-dev-result.json：3004 字节，SHA256=0ade74cf1e1927b8345dcb49e75db90fc239f5b0f7d623522f6a0b913e8fa30e
- evidence/p207-react-result.json：329 字节，SHA256=275506fec21b84ef2db1c09d9d1daf1d8971beb98791dc45b79515c2ff4325c2
- evidence/p207-result.json：6370 字节，SHA256=ae987e0ebcefe3f20229b95f2b12dd868b37a14d03901eca6fb25ec32f68fee5
- evidence/privacy-e2e-result.json：945 字节，SHA256=5f02183a317904172d4b68e5886fdadab14584fe0443240e2166538fcddabcf4
- evidence/ui2-p207-classic.png：996030 字节，SHA256=83f48e0bf4240cc0b542c12b7adfebdc546317f3edb356c61b6810750a6fda5e
- evidence/ui2-p207-detail.png：205933 字节，SHA256=2e11ebea9f131ca268fbb791e06e8882b6c89cf89fd24d114ac6357258316899
- evidence/ui2-p207-dev-detail.png：51744 字节，SHA256=a6d18e2167f3e05c839783ead3c2916d16589e3b4b1318f43630a2efa25bf49d
- evidence/ui2-p207-dev-library.png：34040 字节，SHA256=29f7f0261fd59edd4d918b0c670b058f908872d92d44b8356e90564fadb266a9
- evidence/ui2-p207-dev-privacy.png：87568 字节，SHA256=252ae462ff2f55293e23ae8961c61795ef21a14744714872a3f2b4e310ca3386
- evidence/ui2-p207-dev-search.png：66905 字节，SHA256=a9a4a8213f0b55cdac6d5c9a6b52df1f3af2f0dca32f66d40074444028ef031b
- evidence/ui2-p207-dev-season-detail.png：39069 字节，SHA256=57aa6caec697e95f7f721577126a926946b2272121e3b2c457222ddeb8808cd2
- evidence/ui2-p207-dev-sources.png：58319 字节，SHA256=facb686adef5b34f62051b1272a0c03c73c559a2fa88bdab078ccfa3fffbe899
- evidence/ui2-p207-dev-tasks.png：38375 字节，SHA256=25325639852abc4aa7ccf81d62ce3aecc6ffaaf5be89154e914eba78e91d4850
- evidence/ui2-p207-dev-tv.png：40730 字节，SHA256=ed401860a311ca3a775acedd6c25ff41455dd0f7efcb194fd0d77409c784250c
- evidence/ui2-p207-file-library.png：1105599 字节，SHA256=ab6ff933940a0218bca82ce0ea433e0cdd97d33ca5ef9712da1c12c6e157a742
- evidence/ui2-p207-library.png：1105385 字节，SHA256=bf3942afa2c238bc82015f3ff81c1157da8d04cfdc07f710cd1a230830937fd6
- evidence/ui2-p207-privacy.png：185843 字节，SHA256=136394f6170e27b406e72bc70e77d35ce8f6024e2ab2e1c642e9decacc08a21b
- evidence/ui2-p207-search.png：344518 字节，SHA256=c69cf258f9d54d6373bd63e1d07bbbebeeb90fe5339a3543340feebb66529784
- evidence/ui2-p207-season-detail.png：39066 字节，SHA256=a33ab166ff9a35e3709777b7c1de4aa67beef13f75bfe9847cb761fbd57b4f92
- evidence/ui2-p207-sources.png：58315 字节，SHA256=cc33e06bd8c118d60afa01fc358900f2c5531faef114d73877ae73ce0f30f565
- evidence/ui2-p207-tasks.png：38371 字节，SHA256=af3c1365ef7c2a23063e82395b3673736cbd9ddd8152b49ff59ebcfa40811122
- evidence/ui2-p207-tv.png：358509 字节，SHA256=1feb4950b641d1c6dbfdfa700c12d732f1880caa85b3a7af8a597d0fd0357d4b
- evidence/ui2-privacy-e2e.png：31288 字节，SHA256=be112db9e7b4e6b2c1efae0755082c7bd2228de83f9fa1b77a630afb225f9cf5

## 近期提交（合并后修复）
```
952e99b fix(ui2): close release blockers
0d5ded3 docs(ui2): record phase 2 merge into ui2-integration
4279f31 feat(ui2): merge Phase 2 into ui2-integration
581f002 docs(ui2): add phase 2 source and CI review package
```
