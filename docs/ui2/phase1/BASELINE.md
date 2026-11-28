# UI 2.0 Phase 1 基线核验（BASELINE）

生成时间：2026-11-14
执行方式：OpenCode 总控提示词（只读基线，不修改生产代码）

## 1. 仓库状态

| 项 | 值 |
|---|---|
| HEAD SHA（核验时） | `b97b0502fba455067c58851e4d20a8c4b3f4ce3a`（b97b050 chore: v3.2.9，2026-11-14） |
| 原分支 | `main` |
| 工作分支 | `feature/ui2-phase1`（按 AGENTS.md 要求创建特性分支；未 commit/push） |
| 未提交更改（已保护，未覆盖） | `M AGENTS.md`；`?? FN_Media_UI2_Phase1_OpenCode_Package/`；`?? fn_media_ui2_demo.html` |
| 禁止操作 | 未执行 reset / clean / stash / commit / push |

**注意**：`.gitignore` 第 10 行为 `docs` —— `docs/ui2/`（含本文件）**不会被 Git 跟踪**。若希望文档入库，需维护者决定是否调整 `.gitignore`（见 §5.1）。

## 2. 环境与工具

- 本地：Node **v24.16.0**，npm **11.13.0**
- CI（release.yml）：Node **22**、Go **1.24**、python 3.11；mpv 配置由 `QiaoKes/fntv-mpv-config` 发布 zip 下载
- Electron **v38.0.0**；TypeScript **^5.5.4**；electron-builder **^26.0.12**
- `rg`（ripgrep）**不可用**（CommandNotFoundException）→ 已用 `Select-String` / Grep 工具等价完成通道核实
- `.agents/skills/`：仅 Trellis 流程类技能（trellis-before-dev / check / continue 等），**无 TS/Electron/构建专项技能**；Trellis 技能已被 OpenCode 自动发现（system prompt 可见）
- 当前无任何 renderer/Vite 痕迹：`src/renderer`、`vite.config.ts`、`ui2-renderer/` 均不存在（P1-01 全新引入）

## 3. 校验结果（基线）

| 命令 | 结果 |
|---|---|
| `npm run compile` | 通过（exit 0，无 TS 错误） |
| `npm test`（compile + `node --test tests/*.test.cjs`） | **196 tests / 196 pass / 0 fail** |

## 4. 文件路径映射（提示词引用 → 实际）

| 目标 | 实际位置 | 说明 |
|---|---|---|
| preload API/白名单 | `src/preload/index.ts` | SEND/RECEIVE 白名单；`electronAPI` 仅在 `file:` 页面 expose（P1-05 需加 dev origin allowlist） |
| 主窗口 | `src/main/common/mainwin.ts` | `nodeIntegration:false`、`contextIsolation:true`、`sandbox:false`、`partition:persist:fntv`、preload=`dest` |
| 页面加载 | `src/main/common/winctrl.ts:82-85` `loadLibraryPage()` | `loadFile(resource/library/index.html)`；启动时由 `src/main/main.ts:97` 直接调用（fnOS 自动登录当前未启用） |
| library IPC handler | `src/main/handlers/plugins/library.ts` | 见 §4.1 通道核实 |
| store | `src/modules/library/store.ts`（接口）+ `sqliteStore.ts`/`jsonStore.ts` | 双实现同步；`listHistory(limit)` 已存在 |
| WebDAV | `src/modules/library/webdav.ts` | `buildPropfindBody` / `parsePropfindResponse` / `scanWebdavFolder`；axios timeout 默认 15000ms；B1 单探针可复用（Depth:0 新函数） |
| source 类型 | `src/modules/library/types.ts` | `SourceConfig{id,type,name,config:Record<string,string>,createdAt,lastScanAt}`、`NewSource`；WebDAV 凭据字段 `passwordEnc` |
| 凭据加解密 | `src/modules/library/credentials.ts` | safeStorage 密文前缀 `safe-storage:v1:`；Linux 拒绝 basic_text |
| 偏好存储 | `src/modules/fn_config/config.ts` | **通用偏好存储**（scraper/mpv/隐私/exitMode 等），满足"uiShell 可放入"条件；非仅 token/cookie |
| 隔离测试 | `tests/rendererIsolation.test.cjs` | 断言 `dest/main/common/mainwin.js`（nodeIntegration/contextIsolation）与登录页桥接 |
| 测试集合 | `tests/*.test.cjs` | 30 个文件；全部基于 `dest/**` 编译产物做文件/模块断言 |

### 4.1 通道核实（真实发送/接收方）

| 通道 | 发送方 | 接收方 | 状态 |
|---|---|---|---|
| `library:set-source-category` | `resource/library/index.html:1119`（SEND） | `src/main/handlers/plugins/library.ts:306` | 真实配对，SEND 白名单缺项 |
| `library:source-updated` | `library.ts:318/321`（reply） | `resource/library/index.html:1120`（onceReply） | 真实配对，RECEIVE 白名单缺项 |
| `library:scrape-status-info` | `library.ts:651`（reply，running/lastSummary） | **无** | 死通道（转正供 React 轮询） |

## 5. 与实施计划的差异 / 需注意

1. **`docs/` 被 .gitignore 忽略**：`docs/ui2/` 与本文档均不可入库；README 建议的 `docs/ui2/` 提交需维护者先调整 `.gitignore`（或改为 `!docs/ui2` 例外）。
2. **仓库未跟踪任何 lockfile**：`package-lock.json` 在 `.gitignore` 中 → 提示词"只更新仓库当前实际跟踪的 lockfile"实际无对象；`npm install` 会生成被忽略的本地 lockfile。是否将 lockfile 纳入跟踪建议维护者决策。
3. **rg 不可用**：通道核实与后续检索统一用 `Select-String` / Grep 工具，效果等价。
4. **UI2 文档位置**：原始位于 `FN_Media_UI2_Phase1_OpenCode_Package/`（未跟踪）；已复制到 `docs/ui2/` 供引用。
5. **启动即加载本地库页面**：`main.ts` 启动链路为 log → 证书处理 → proxy → 窗口 → 插件 → 托盘 → 窗口事件 → `loadLibraryPage` → 延迟更新检查。uiShell 解析应落在 `winctrl.loadLibraryPage` 或 `main.ts:97` 调用点；当前无 uiShell 概念。
6. **build.files 现状**：`dest / build / resource/login / resource/library / resource/mpv-overlay`（P1-09 需追加 `ui2-renderer`；`extraFiles` 负责 third_party）。
7. **release.yml 现状**：无 `npm test` 步骤；Node 22 / Go 1.24 / 平台 matrix（win/mac/linux）/ mpv-config zip 下载→解压顺序必须保留（P1-09 增补）。
8. **测试模式约定**：现有测试读取 `dest/**` 编译产物与源码文件文本（非从 src import）→ 新 UI2 测试建议沿用 node:test + 产物/文件断言；`rendererIsolation.test.cjs` 是文件级断言先例。
9. **classic 路径必须保留**：`resource/library/index.html` 为单文件原生 JS（约 1450 行），是回退与缺省路径（uiShell 默认 classic）。
10. **未提交修改保护**：`AGENTS.md` 的用户修改未被触碰；本次未执行任何破坏性 git 操作。

## 6. 下一批任务建议（按计划顺序）

1. **P1-01 + P1-02（React/Vite 基础设施）**：
   - main/preload 维持 `tsc → dest`；新增 `src/renderer`（独立 `tsconfig.renderer.json`）
   - Vite production 输出根目录 `ui2-renderer/`（base 支持 `file://`），不覆盖 `resource/library`
   - 依赖仅新增 react/react-dom 及 vite/@vitejs/plugin-react 等构建依赖（不升级无关依赖）
   - 验收：`npm run compile` 通过、renderer 独立 typecheck、`npm run renderer:build` 产出 `ui2-renderer/index.html`、无 CDN、production HTML 无 inline script
2. 需维护者先确认的两个计划冲突点：
   - `docs/` 是否调整 gitignore 以便文档入库
   - 是否需要将 package-lock.json 纳入跟踪（当前被忽略）
