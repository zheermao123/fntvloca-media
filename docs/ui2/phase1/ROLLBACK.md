# UI 2.0 Phase 1 — 回滚说明（ROLLBACK）

## 1. 当前状态

- 工作分支：`feature/ui2-phase1`（基于 `main@b97b050`，chore: v3.2.9）
- 全部变更**未 commit / push**；工作树中的生产代码修改可用 git 直接丢弃回滚
- 用户已有未提交更改（`AGENTS.md`、`FN_Media_UI2_Phase1_OpenCode_Package/`、`fn_media_ui2_demo.html`）与本任务无关，回滚时**不要**动它们

## 2. 回滚方式

### 2.1 完全回滚（放弃 Phase 1 前置+P1-01~P1-11 全部改动）

1. 确认安装版应用未在运行（避免误触）
2. 丢弃工作树改动（仅限本任务文件，需人工核对）：
   - 已修改：`.gitignore`、`.github/workflows/release.yml`、`package.json`、`tsconfig.json`、`src/main/common/winctrl.ts`
   - 新增（删除即可）：`.github/workflows/pr-ci.yml`、`package-lock.json`、`docs/ui2/`、`scripts/ui2-dev.mjs`、`src/main/common/uiShell.ts`、`src/preload/core/devOrigin.ts`、`src/renderer/`、`tests/uiShell.test.cjs`、`tests/libraryPageUrl.test.cjs`、`tests/sourceTest.test.cjs`、`tests/sourceEdit.test.cjs`、`tests/historyView.test.cjs`、`tsconfig.renderer.json`、`vite.config.ts`、`ui2-renderer/`（生成目录）
   - 保留：`AGENTS.md`（用户改动）、`FN_Media_UI2_Phase1_OpenCode_Package/`、`fn_media_ui2_demo.html`
3. `npm run compile && npm test` 回归 217 项（回滚后为 196 项基线 + 本轮前已有用例）

### 2.2 仅禁用 UI 2.0（保留代码）

- 不设置 `FNTV_UI_SHELL=react` 时应用**默认 classic**（打包环境恒 classic），无需任何操作
- 删除 `ui2-renderer/` 或忽略环境变量即可让开发环境也回退 classic
- preload 新增白名单通道与三个新 handler 对旧 UI 无副作用（旧 UI 不使用它们）

### 2.3 回滚 release.yml / pr-ci.yml

- `release.yml` 的两处改动可用 git diff 精确还原：`npm install` → `npm ci`、新增 `npm test`/renderer 构建步骤、dmg-license `--no-save`
- `pr-ci.yml` 为新增文件，删除即恢复原状（原仓库无 PR CI）

## 3. 数据与安全影响

- 无数据库 schema 变更；无用户数据迁移
- 新增 IPC 均为只读/受控写（B2 编辑、B1 探测），密码仅以现有 safeStorage 密文落盘；回滚不涉及数据清理
- `docs/` 白名单仅为 git 跟踪范围调整，不影响运行时

## 4. 构建产物回滚

- `release/`、`ui2-renderer/` 均为生成目录（已 gitignore），可直接删除
- 安装包回滚：重装上一版本 `FNMedia_3.2.9_win_x64.exe`（GitHub Releases 保留）
