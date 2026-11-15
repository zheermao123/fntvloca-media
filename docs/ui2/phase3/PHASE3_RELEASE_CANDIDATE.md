# Phase 3 发布候选报告（Release Candidate）

日期：2026-11-15
分支：`feature/ui2-phase3`
基线：`ui2-integration` @ `e8e0b1e`
状态：**建议进入正式发布审批；不自动授权合并 main、打 tag、创建 Release 或切换默认 UI。**

## 1. 批次完成情况

| 批次 | 结果 | 关键记录 |
|---|---|---|
| A 基础可靠性与发布风险 | 通过（Windows） | `A-privacy-e2e.md`、`A-task-lifecycle.md`、`A-ci-publish-safety.md`、`A-install-smoke.md`、`A-platform-matrix.md` |
| B-01 分页/大库性能 | 通过 | `B-01-library-pagination.md` |
| B-02 任务中心 | 通过（受既有接口限制） | `B-02-task-center.md` |
| B-03 详情多版本 | **阻塞（L2 数据模型缺口）** | `B-03-detail-versions.md`、ADR |
| B-04 搜索 | 通过（标题搜索 + 分类过滤） | `B-04-search.md` |
| B-05 首页 | 通过 | `B-05-home.md` |
| B-06 媒体源 | 通过（测试/编辑/重扫/凭据脱敏） | `B-06-sources.md` |

## 2. 门禁与测试

| 项 | 结果 |
|---|---|
| `npm test` | **274 / 274 通过**（追加首页继续观看渲染回归 + SQLite/JSON 中文多页排序测试） |
| `npm run compile` / `renderer:typecheck` / `renderer:build` | exit 0 |
| CI Windows run | `43669168400`（clean install、271 测试、NSIS、安装/回退/卸载冒烟全部通过） |

## 3. C-01 完整业务流程回归

- 真实库 file:// React（12 步）：App Shell/样式/窗口控件/电影/剧集/详情/搜索/源/任务/隐私弹窗，console errors 0，非预期安全违规 0。
- 隐私 E2E（隔离数据目录，16 步）：错误/正确密码、快速重复、私有库/详情/搜索、锁定回跳、历史后退、直达路由、锁定搜索、公开库、重启、解锁中关闭、源测试/编辑/凭据脱敏。
- 大库 E2E（17k 电影 + 500 剧 × 8 集）：首页继续观看出现；分页首屏/加载更多/总数/无重复/暂停无虚拟列表。
- 任务中心：行为测试覆盖触发/取消/订阅清理/状态查询；会话历史纯函数测试；扫描幂等重试入口存在。

## 4. C-02 性能（21,000 条目 fixture）

- 主进程首屏：电影 42ms（改前 132ms）、剧集 28ms、全分类 41ms。
- 真实 Electron 首屏 120 张：约 69–93ms（多次运行波动）；加载更多 60–80ms/页；480 卡时 DOM 5,884、heap ≈10MB；无重复。
- 深 offset（16,800）约 124ms（前缀成本，已知限制）；全量无 limit 112ms（兼容路径）。

## 5. C-03 安全与隐私

- 生产 CSP：`style-src 'self'`、`script-src 'self'`、`connect-src 'none'`；构建产物无 `unsafe-inline`/`unsafe-eval`/localhost/ws。
- 开发 CSP 仅 `style-src` 放行 `unsafe-inline`（Vite 注入），有回归测试。
- 媒体源 DTO 不包含 `passwordEnc`；测试/错误文案不展示原始路径或凭据；隐私模式源地址隐藏。
- preload 白名单未新增；未新增远程连接能力；隐私门禁在主进程执行。

## 6. C-04 安装包与平台矩阵

| 平台 | 结果 |
|---|---|
| Windows x64 | run `43669168400`：CI 静默安装、classic 默认、打包回退 classic、静默卸载通过；产物 `FNMedia_3.2.9_win_x64.exe`（139653889 字节，SHA256 `8C7D53606D1650779C31B22F5A50F490EB1C64A5F8E14617D91D797841A2EFE2`） |
| macOS x64/arm64 | **验证已取消（用户 2026-11-15 决定接受未验证风险；不阻塞发布候选结论）** |
| Linux x64/arm64 | **验证已取消（用户 2026-11-15 决定接受未验证风险；不阻塞发布候选结论）** |

平台不可用项不得视为通过；正式公开发布前需补测或书面接受风险。

## 7. 未解决缺口与风险

| 项 | 严重度 | 状态/说明 |
|---|---|---|
| 电影多版本（B-03） | 中 | 数据模型缺口（L2），功能保持关闭，不伪造 |
| 任务历史/真正取消 | 低-中 | 仅会话内历史；扫描无状态/取消 API（L2） |
| 搜索文件名/全文 | 低 | 后端不支持，UI 已如实说明 |
| 深 offset 成本 | 低 | 常规浏览不受影响，已记录 |
| 标题栏插件内联样式 CSP 拒绝（6 条） | 低 | 既有插件、打包版不启用 React；记录为已知例外 |
| macOS/Linux 运行验证 | 中 | 用户已决定取消实机验证并接受风险（2026-11-15）；建议在对应平台发布时再补充说明 |
| 隐私真实用户密码 | — | 自动化使用隔离测试密码；真实密码由用户自行手工验收 |

## 7.1 发布门禁修订（2026-11-15）

- 正式 Release 仅允许：workflow_dispatch + **ref=refs/heads/release** + `publish=true` + `platform=all`；`release` environment 必须配置 Required reviewers（当前未配置，管理员待办）。
- R3 代码门禁已完成，人工审批配置待确认；详见 `R3-release-gate.md`。
- 向 `release` 分支 push 现在只构建并上传 Actions artifacts，不再自动创建 Release/Tag。
- 删除未使用的 `release_tag` 输入，避免“预览上传”语义与实际行为不符。
- Release 描述已改为：Windows 已安装冒烟；macOS/Linux 仅提供构建产物、未实机验证（用户已接受风险）。
- 预览构建（publish=false）验证 run：`43672093244`（Windows）；构建/Artifact 成功，Create Release Job 为 skipped。
- 负向验证 run：`43671797192`（非 release 分支 + publish=true/platform=all）；Release Job skipped，未创建 Tag/Release（Linux 构建失败为独立问题）。
- 从 release 分支的正向预览未执行：origin/release 仍为旧 workflow，需先同步后再补测。

## 8. 回滚

- 回退 `feature/ui2-phase3` 提交即可回到 `ui2-integration` 基线；无数据库迁移（B-01 未加索引，B-03 未实施）。
- 打包默认 classic 不变；React 加载失败自动回退 classic；不修改播放核心。

## 9. 发布候选结论

Phase 3 在 Windows 环境达到发布候选质量标准：核心流程、隐私、性能与安装冒烟通过，无未解决 P0/P1 缺陷。**建议进入独立发布审批流程**，条件：

1. macOS/Linux 实机验证已由用户取消并接受风险（2026-11-15 记录在案）；
2. 决定是否启用 React 为默认 UI（本阶段未启用）；
3. 正式发布、Tag 与合并 main 需另行批准；
4. B-03 多版本按 L2 ADR 单独排期。

## 10. 合并后集成验收（2026-11-15）

- `ui2-integration` @ `d400139`（PR #1 合并提交）完成 Windows 集成验收，详见 `docs/ui2/integration/ACCEPTANCE_REPORT.md`。
- Windows CI run `43676835518`：274/274、NSIS、安装/回退/卸载冒烟通过；产物 SHA256 `62FA6B8DE8584CDEC80AAF8A810B63AD4F5C263DABED688018677DA4AE83F69A`。
- 本机升级/卸载/官方 v3.2.9 回滚实测通过；回滚方案见 `docs/ui2/integration/ROLLBACK.md`。
- 功能冻结；未发现新增集成阻塞问题；React 默认 UI 未切换（单独决策）。
## 11. 正式发布门禁（第四阶段）

- 发布环境与负向路径验证结果见 `docs/ui2/release/FORMAL_RELEASE_GATE_REPORT.md`。
- `release` Environment 已配置 required reviewer 与仅 release 分支策略；正式 Tag/Release 仍未执行。
- release 分支已同步 RC（56f8c7c）；正向 run 43678693453 在 Environment 审批处等待后被取消，未发布；正式 Tag/Release 待用户授权。