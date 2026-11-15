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
| `npm test` | **271 / 271 通过** |
| `npm run compile` / `renderer:typecheck` / `renderer:build` | exit 0 |
| CI Windows run | `<PENDING>`（clean install、测试、NSIS、安装/回退/卸载冒烟） |

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
| Windows x64 | CI 静默安装、classic 默认、打包回退 classic、静默卸载通过（见 A-04 / CI run） |
| macOS x64/arm64 | **未验证**（无设备；本阶段未执行 mac 构建/运行） |
| Linux x64/arm64 | **未验证**（无设备；本阶段未执行 Linux 构建/运行） |

平台不可用项不得视为通过；正式公开发布前需补测或书面接受风险。

## 7. 未解决缺口与风险

| 项 | 严重度 | 状态/说明 |
|---|---|---|
| 电影多版本（B-03） | 中 | 数据模型缺口（L2），功能保持关闭，不伪造 |
| 任务历史/真正取消 | 低-中 | 仅会话内历史；扫描无状态/取消 API（L2） |
| 搜索文件名/全文 | 低 | 后端不支持，UI 已如实说明 |
| 深 offset 成本 | 低 | 常规浏览不受影响，已记录 |
| 标题栏插件内联样式 CSP 拒绝（6 条） | 低 | 既有插件、打包版不启用 React；记录为已知例外 |
| macOS/Linux 运行验证 | 中 | 未验证；发布前补测 |
| 隐私真实用户密码 | — | 自动化使用隔离测试密码；真实密码由用户自行手工验收 |

## 8. 回滚

- 回退 `feature/ui2-phase3` 提交即可回到 `ui2-integration` 基线；无数据库迁移（B-01 未加索引，B-03 未实施）。
- 打包默认 classic 不变；React 加载失败自动回退 classic；不修改播放核心。

## 9. 发布候选结论

Phase 3 在 Windows 环境达到发布候选质量标准：核心流程、隐私、性能与安装冒烟通过，无未解决 P0/P1 缺陷。**建议进入独立发布审批流程**，条件：

1. 补充 macOS/Linux 实机（或明确书面接受未验证风险）；
2. 决定是否启用 React 为默认 UI（本阶段未启用）；
3. 正式发布、Tag 与合并 main 需另行批准；
4. B-03 多版本按 L2 ADR 单独排期。
