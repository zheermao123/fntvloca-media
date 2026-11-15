# UI 2.0 集成验收报告（Integration Acceptance）

日期：2026-11-15
分支：`ui2-integration` @ `d400139bc67e883036b0fa0f9021ec809b8034b8`（PR #1 合并提交）
环境：Windows 10.0.26100 / Electron 38.0.0 / 本机 Node 24.16.0；CI Node 22.23.4 / npm 10.9.9
功能状态：**冻结**（验收期间未新增产品功能；仅测试脚本与文档变更）

## 1. 验收范围与结果

| 验收项 | 结果 | 证据 |
|---|---|---|
| Electron 启动 / classic 默认入口 | 通过 | 安装后启动标题「媒体库 v3.2.9」、`#titlebar` 存在、无 React 根节点 |
| React file:// 加载 | 通过 | p207 12 步回归（真实库，console errors 0） |
| React 资源缺失回退 classic | 通过 | 临时移走 `ui2-renderer` 后启动加载 `resource/library/index.html` |
| 隐私进入/退出/页面回跳 | 通过 | 隔离 E2E 18 步（错误/正确密码、快速操作、锁定回退、历史后退、直达路由、重启、解锁中关闭） |
| 媒体库分页/分类/搜索/详情 | 通过 | 真实库 12 步；17k 电影大库分页；详情播放按钮/续播入口可见（未自动发起实际播放） |
| 媒体源测试/重扫/密码编辑 | 通过 | 本地源 test/rename；WebDAV 源添加、密码 replace/clear，`passwordEnc` 始终不下发 renderer |
| 扫描/刮削/任务中心 | 通过 | 任务页触发扫描并生成会话历史；无 TMDB Key 时刮削失败如实显示；监听清理 |
| 大型媒体库性能 | 通过 | 17k 电影：首屏 120 张 87ms；加载更多 65–77ms/页；480 卡 unique=480、DOM 5,884、heap≈10MB |
| Windows 安装/升级/卸载/回滚 | 通过 | 合并后 CI 产物安装→启动→卸载→官方 v3.2.9 回滚 |

## 2. 关键 CI 与产物

- 合并后 Windows CI run：`43676835518`（ref `ui2-integration`，commit `d400139`，`publish=false`）
  - 274/274 tests、Windows NSIS 构建、CI 安装/默认/回退/卸载冒烟通过；Release Job skipped。
- 产物：`FNMedia_3.2.9_win_x64.exe`，139,653,954 字节，SHA256 `62FA6B8DE8584CDEC80AAF8A810B63AD4F5C263DABED688018677DA4AE83F69A`。
- 本机升级验证：安装后 `app.asar` 含 `dest/modules/library/sort.js`（合并代码），classic 启动正常。
- 卸载验证：静默卸载后安装目录/可执行文件移除。
- 回滚验证：重新安装官方 v3.2.9（SHA256 `C4E54AC74F0D8CC3D41663380A154A1B692106CE43B949F8167CB80D38BE7E64`），`app.asar` 不含 `sort.js`，classic 启动正常，应用保持运行。

## 3. 门禁

| 命令 | 结果 |
|---|---|
| `npm test` | **274 / 274 通过** |
| `npm run compile` | exit 0 |
| `npm run renderer:typecheck` | exit 0 |
| `npm run renderer:build` | exit 0 |

## 4. 验收发现的问题

- 无新增阻塞问题。合并前审查发现的 P2-01（首页继续观看未渲染）与 P2-02（SQLite/JS 排序不一致）已在 PR #1 合并前修复，并由 274 项测试与大库回归覆盖。
- 本次验收未修改产品代码；未发现需要回滚的功能回归。

## 5. 已知限制（非本次阻塞）

| 项 | 严重度 | 说明 |
|---|---|---|
| macOS/Linux 实机验证 | 中（已接受） | 用户 2026-11-15 取消并接受未验证风险；仅有构建产物不代表运行验收 |
| R3 发布门禁 | 已缓解 | 2026-11-15 后续已完成 Environment 配置、release 分支 RC 同步与正向审批门禁验证；最终发布仍待版本与审批决策（见 `docs/ui2/release/FORMAL_RELEASE_GATE_REPORT.md`） |
| B-03 电影多版本 | 中 | 数据模型缺少稳定版本组标识（L2 ADR），功能保持关闭 |
| 扫描状态/取消 | 低-中 | 无主进程状态查询/取消接口；任务历史仅当前会话 |
| 搜索能力 | 低 | 仅标题/剧集名，不支持文件名/全文 |
| 深 offset | 低 | 前缀成本线性增长（16,800 offset ≈124ms） |
| 标题栏插件 CSP | 低 | 6 条内联样式拒绝为已知例外；打包版不启用 React |
| 自动播放验证 | 低 | 集成验收只验证播放入口/目标，未自动启动 MPV 实际播放 |

## 6. React 默认 UI 决策

**本次未切换，classic 仍为默认入口。** 是否将 React 设为默认 UI 属于单独决策，建议在以下条件满足后再评审：

1. `release` Environment 与人工审批已配置；
2. release 分支已同步；正向审批门禁已验证（run 在 Environment 审批处取消，未批准发布）；
3. 跨平台风险由发布负责人书面确认（当前用户已接受未验证）；
4. 明确回滚演练与发布审批流程。

在此之前保持 classic 默认与 React 可选验证路径。

## 7. 结论

- 集成验收（第二步）**通过**（Windows）。
- 功能冻结与验收报告（第三步）**完成**；无待修复的集成缺陷。
- 正式发布准备（第四步）**仍待管理员配置**，未执行 Tag/Release/默认 UI 切换。

证据目录：`docs/ui2/integration/evidence/`（E2E 结果/日志、截图、CI/安装信息）。
