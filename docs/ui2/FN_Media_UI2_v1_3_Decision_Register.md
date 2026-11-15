# FN Media UI 2.0 — 仓库核对决策登记表 v1.3（定稿·时序修订版）

> 目标：把代码现状、推荐决策和产品已批准的范围分开，避免 Codex 自行扩大功能。
> 定稿日期：2026-11-14。B1/B2/B3 已获产品负责人批准；补充核验结论（P1/P2 与 §3 预答）一并纳入。
> **v1.3 修订（2026-11-14）：** 新增 P3——采纳 Phase 1 实施计划的"后端先行"时序：B1/B2/B3 后端 IPC、白名单登记与测试随 Phase 1（P1-06~P1-08）落地，React UI 接线随 Phase 3（B3）/ Phase 4（B1/B2）。契约本身（通道命名 `library:history`、limit≤50 等）不变，仍以本表 §2 为准。

## 1. 可直接写入实施基线的决策

| 编号 | 决策 | 影响阶段 | 理由 |
|---|---|---|---|
| A1 | 继续 `sandbox: false`；保留 `contextIsolation: true`、`nodeIntegration: false`、IPC 白名单。Sandbox 化独立立项 | Phase 1/2 | 当前 preload 依赖 Node `fs/path/require` 加载插件，强行切换会破坏架构 |
| A2 | 保留平台现状：macOS native traffic lights；Windows/Linux frameless + 自绘窗控/拖拽区 | Phase 2 | Apple 视觉不等于强制系统标题栏；避免改动窗口行为 |
| A3 | Vite 只构建 React renderer；`tsc` 继续构建 main/preload；新增独立产物目录，纳入 builder files、scripts、CI、gitignore | Phase 1 | 防止开发可运行但安装包白屏 |
| A4 | 生产 CSP 移除 `script-src unsafe-inline`；保留 `connect-src 'none'`、`img-src file:`；HMR 允许的 localhost 例外仅开发态 | Phase 1/2 | renderer 只走 IPC，海报使用本地缓存 |
| C1 | 首页不做 310px 营销式 Hero；采用紧凑页头 + 内容模块 | Phase 3 | 原规格优先于早期 demo 探索稿 |
| C2 | 不设独立媒体库健康页；源状态在媒体源、扫描/刮削结果在任务页 | Phase 2/4 | 减少重复信息架构 |
| C3 | 全局搜索快捷键 `Cmd/Ctrl+K`；不抢占 `Cmd/Ctrl+F` | Phase 2/3 | 更符合全局命令面板习惯 |
| B4 | 不增加 source `enabled` 字段和启用/禁用开关 | Phase 4 | 无数据模型，且没有迁移框架；避免 SQLite 改 schema |
| B5 | 不做 FN Media 内置字幕/弹幕配置页；提供 MPV portable_config 说明/目录入口（仅在有安全 API 时） | Phase 5 | 当前配置属于 MPV 文件体系 |
| B6 | 删除不存在的媒体库/扫描配置表单；仅显示真实只读状态 | Phase 5 | 避免假设置 |
| B7 | 不做独立安全设置页；安全说明并入“关于 / 安全与隐私” | Phase 5 | 当前无真实可调设置 |
| B8 | 类别计数由客户端汇总；只有完整数据可用时才标记全库总数 | Phase 3 | `countItems` 不按 category，且 catalog 有数量上限风险 |
| D1 | `category=other` 提供 `/library/others` | Phase 3 | 不让其他视频从路由和主要浏览入口中消失 |
| D2 | `resource/login`、`play-movie`、preload 插件注入、dormant fnos-adapter 不在本次 UI 重构范围 | 全程 | 避免触碰 legacy fnOS 兼容代码 |
| D3 | 使用 `uiShell: 'classic' | 'react'`；缺省 classic；React bundle 不存在时回退 classic | Phase 1/6 | 一键回滚，降低发布风险 |
| D4 | Phase 1 检查并修复实际 IPC 白名单缺口，且与 `rendererIsolation.test.cjs` 联动 | Phase 1 | 防止新 UI 重蹈旧 UI 静默失败问题 |
| D5 | React 隐私模式下的导航/路由/快捷键裁剪与旧 UI 一致 | Phase 2/5 | 不仅隐藏侧栏，还要阻止通过路由/快捷键访问 |
| D6 | 不做 cast/crew 演职员信息展示 | Phase 3 | 刮削器当前不拉取、后端无字段 |
| D7 | Task Center v1 仅实时状态 + 最近结果摘要；不做 taskId、取消、持久化历史 | Phase 4 | 后端当前只有进程内状态/事件 |
| D8 | 现有 `node --test tests/*.test.cjs` 保留；React 组件测试可引入 Vitest 并存；更新 isolation 测试 | Phase 1 | 不推翻现有测试体系 |
| P1 | React AppShell 顶栏必须包含 `id="titlebar"` 元素，作为 preload 插件注入守卫（零侵入方案 A）；该契约登记进 `IPC_CONTRACT_MAP.md`；Phase 0 同时核验 playButton/playMaskButton 在 React DOM 上 no-op | Phase 1/2 | preload 对所有页面无条件加载插件（`src/preload/index.ts:99-103`），`titlebar.ts:9-11` 以 `#custom-titlebar`/`#titlebar` 元素存在为跳过条件；React 页无此 id 会被注入 z-index 99999 的旧标题栏与窗控，与自绘标题栏冲突 |
| P2 | `library:scrape-status-info`、`library:source-updated` 登记 RECEIVE 白名单（主进程均有真实发送方，`library.ts:318`、`library.ts:650-652`）；`library:set-source-category` 登记 SEND。`library:scrape-status` 保留 handler 供 React 任务中心轮询，不删除 | Phase 1 | 属白名单补漏；`scrape-status` 当前为死通道（旧 UI 从未调用），登记后转为 React 可用能力 |
| P3 | B1/B2/B3 实施时序调整为**后端先行**：后端 IPC、preload 白名单登记与测试随 Phase 1 落地（实施计划 P1-06/P1-07/P1-08）；React UI 接线随 Phase 3（B3）/ Phase 4（B1/B2）。契约（通道命名、limit≤50、脱敏规则）仍以本表 §2 为准，实施计划中的契约偏差以本表为准修正 | Phase 1/3/4 | Phase 1 本就要动 preload 白名单与 `rendererIsolation.test.cjs`，一次完成后端薄 IPC 可避免 Phase 3/4 反复碰主进程；UI 未接线前不显示相关按钮 |

## 2. 已批准的新增 IPC（2026-11-14 产品负责人批准；实施时序见 P3）

实施时序（P3）：后端 IPC、preload 白名单登记与测试随 **Phase 1** 落地（实施计划 P1-06~P1-08）；React UI 接线随 **Phase 3（B3）/ Phase 4（B1/B2）**。UI 未接线前不显示相关按钮。

### B1 连接测试 `library:test-source` → `library:test-source-result`

- **调用形态（两种）**：`{ sourceId }`（探测已存源）或 `{ type: 'local'|'webdav', rootPath?|url?, username?, password? }`（向导第 5 步探测未保存配置）
- **实现**：local/SMB(UNC) = 主进程 `fs.stat` 判定目录存在；webdav = `webdav.ts` 新增轻量 `probeWebdav`（PROPFIND Depth:0，超时 5s），不新增 SMB 认证协议
- **返回**：成功 `{ reachable: true, latencyMs }`；失败 `{ reachable: false, reason: 'auth'|'not_found'|'network'|'timeout', message }`（HTTP 401/403 → auth）；`message` 必须脱敏（剥离 URL 内嵌凭据，不回显密码）
- **UI 门控**：向导第 5 步、源行"测试"按钮
- **测试**：探测分类单测（mock HTTP 状态码/超时/路径）+ 参数校验

### B2 编辑源 `library:update-source` → 复用回复 `library:source-updated`

- **Payload**：`{ id, name?, rootPath?, url?, username?, password?, category? }` 部分更新语义
- **规则**：`type` 与 `private` 标记不可改（防公开/隐私互转越权）；password 仅在非空时重新 `encryptSecret`，省略则保留旧密文；local 新路径走 `localRootExists` 查重（排除自身）；url/路径变更后 UI 提示"是否立即重扫"
- **隐私门禁**：隐私源仅在解锁后可编辑（镜像 `list-sources` 行为）
- **存量兼容**：`set-source-category` 保留不删（旧 UI 仍用），React 走新通道
- **测试**：凭据保留/重加密、查重排除自身、type/private 拒改、隐私源未解锁拒改

### B3 最近播放 `library:history` → `library:history-info`

- **Payload**：`{ limit?: number }`，服务端钳制上限 50、缺省 20
- **返回**：`{ entries: WatchedEntry[] }`（item + state，与 `library:continue` 同构，按 lastPlayedAt 倒序）
- **隐私**：套用与 continue 相同的可见性过滤（`takeContinueByVisibility` 同款规则）
- **UI**：Phase 3 首页"最近播放"模块；无记录不显示空模块
- **测试**：limit 钳制、隐私过滤、排序

原"批准前不得编码"约束已失效；但第 0.2 节"不伪造成功状态"原则继续适用：探测/编辑/历史在 IPC 实现前不得出现假交互。

## 3. Phase 0 复核项（v1.2 定稿时已预答 5 项，Codex 直接采纳并复核即可）

1. 本地 checkout 与公开 `main` 的 commit 差异 —— **已部分预答**：本地 origin 为 `zheermao123/fntvloca-media`（fork），HEAD `b97b050`（v3.2.9），`electron-builder.files` 含 `dest/build/resource/login/resource/library/resource/mpv-overlay`，与规格书附录 A 一致。Phase 0 仅需再确认与上游 `QiaoKes/fntv-electron` 的差异范围。
2. `library:scrape-status-info` 发送方 —— **已预答**：handler 存在（`library.ts:650-652`）且确有 reply 发送方，但旧 UI 从未调用（死通道）；处置见 P2（登记 RECEIVE 转为 React 能力）。
3. WebDAV 全链路 —— **已预答**：已完整接入（`add-source` → `scanSource` → 播放鉴权头注入，`webdav.test.cjs` 5 用例），Phase 0 只需登记映射。
4. updateSource/listHistory 暴露情况 —— **已预答**：均未暴露 IPC（`set-source-category` 仅包 category 字段）；现分别转正为 B2/B3 契约。
5. 隐私模式隐藏项 —— **已预答**：`body.privacy-mode` 隐藏 `#kindTabs`/`#scrapeBtn`/`#settingsBtn`（`index.html:123`）+ 源弹窗分类下拉 + 详情页重刮/手动匹配按钮（`:773`）；React 裁剪规则照此清单执行（见 D5）。
6. catalog 600 上限 —— **已预答**：上限来自旧 UI 自行传参 `limit: 600`（`index.html` loadItems），store 层无硬顶但**无 offset**；Phase 3 分页设计以此为准（加 offset/total，排序需唯一 tie-breaker）。
7. CI 下载 MPV zip 与 proxy binary 流程 —— **仍需 Phase 0 阅读 `.github/workflows/release.yml` 确认**，确保 renderer build 步骤插入位置不破坏 third_party 组装。

## 4. 结论

定稿完成（v1.3 时序修订版）：A/C/B4–B8/D1–D8/P1/P2/P3 为实施基线决策；B1/B2/B3 已批准并给出最终契约（§2）。下一步执行 Phase 0 审计（§3 预答项直接采纳）；Phase 1 包含构建链、`uiShell` 回退开关、preload 白名单补漏（P2）与 **B1/B2/B3 后端薄 IPC（P1-06~08，P3 后端先行时序）**。Phase 3 完成 B3 UI 接线与 catalog 分页，Phase 4 完成 B1/B2 UI 接线与任务中心 MVP，Phase 5 按 B5–B7 处理设置项边界。实施计划（`FN_Media_UI2_Phase1_Implementation_Plan_v1.0.md`）中与本表冲突的契约细节（B3 通道名、limit 上限）以本表为准，已同步修正。
