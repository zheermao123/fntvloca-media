# ADR B-01：媒体库目录分页、总数与计数口径（L2）

- 状态：**待批准**（未实施）
- 日期：2026-11-15
- 分支：`feature/ui2-phase3`
- 关联计划：`docs/ui2/PHASE3_IMPLEMENTATION_PLAN.md` B-01
- 变更等级：**L2**（修改既有 `library:catalog` 主进程查询/回复协议；如需索引还涉及数据库 schema）

## 1. 背景与实测

### 真实用户库

- 规模：76 源 / 345 剧 / 11,598 条目；目录卡仅 **111** 张（剧集按季聚合）。
- `buildCatalog` 实测（3 次）：电影 2.0–2.7ms、剧集 9.5–13.5ms、全部分类 14.1–15.5ms。

### 等价 17,000+ fixture（17,000 电影 + 500 剧 × 8 集 = 21,000 条目）

| 查询 | 返回 | 耗时中位 |
|---|---|---|
| 电影 `limit=600` | 600 | **131.7ms** |
| 剧集 `limit=600` | 500 | **119.3ms** |
| 全部分类 `limit=600` | 600 | **145.6ms** |
| 全部无 limit | 17,500 | **150.4ms / +168.8MB heap** |

复现脚本：`scripts/phase3-bench-catalog.cjs`（隔离临时库，不读取真实用户数据）。

## 2. 问题

1. `buildCatalog` 的 `limit` 是**全量构建 + 排序后 slice**，不是查询下推：电影 17k 时 `limit=600` 依然扫描/排序全部条目。
2. API 只有 `limit`，无 `offset`/`total`，renderer 无法稳定分页，也无法诚实显示“总数/是否还有更多”。
3. 首页当前发起 4 次分类 catalog + 1 次最近添加；每次都可能全量构建（fixture 下约 5 × 120–150ms CPU 与瞬时内存）。
4. 分类计数以 `entries.length` 推断（G1）；超过 600 时口径不准确。
5. 隐私库与公开库需要独立分页/计数，不能复用同一缓存结果。

## 3. 方案对比

| 方案 | 内容 | 评价 |
|---|---|---|
| A. **扩展既有 `library:catalog`** | 增加 `offset`；回复增加 `total/hasMore/limit/offset`；主进程用 SQL 聚合 + 稳定排序下推 | 改动集中、复用现有通道与 preload 白名单；仍是 L2 协议变更 |
| B. 新 `library:catalog-page` 通道 | 新 IPC + preload 白名单 + 渲染层适配 | 协议更清晰，但需扩展白名单（L2）并维护双通道 |
| C. 仅 renderer 伪分页 | 反复拉全量后客户端切片 | **拒绝**：全量传输/内存更大，无法获得准确总数，隐私缓存风险高 |
| D. SQLite 索引/视图 | 在 items/shows/watch_state 上建索引或聚合视图 | 可显著降低聚合成本，但属于 schema 变更（L2），需独立批准 |

## 4. 推荐方案（A）

- `CatalogQuery` 增加 `offset?: number`。
- 回复保持兼容：`{ entries, total, limit, offset, hasMore }`（旧字段保留；旧调用方只读 entries）。
- 主进程改造：
  - 电影：SQL `WHERE`（kind/visibility/category/query/watched/favorite）+ `ORDER BY <stable> LIMIT/OFFSET`，`COUNT(*)` 单独返回。
  - 剧集：按 `(show_id, season)` 聚合（COUNT episodes、SUM watched、MAX added/lastPlayed），再排序分页；续播集选择在页内完成，避免每页全剧集扫描。
  - 稳定排序：`addedAt DESC, id DESC` / `title ASC, id ASC` 等，确保分页无重复/遗漏。
- 计数：`total` 与当前筛选/可见性同口径；`hasMore = offset + entries.length < total`。
- 隐私：公开/隐私使用独立参数与查询；禁止跨模式缓存复用。
- Renderer：媒体库“加载更多”或分页；切分类/筛选/排序/搜索/隐私切换时重置 offset；首页改用 `total`（每类 `limit=1` 或专用 counts），移除“全量拉取计数”。

## 5. 影响与风险

- 影响文件：`src/modules/library/catalog.ts`、`src/main/handlers/plugins/library.ts`、`src/renderer/services/library/*`、`src/renderer/pages/{library,home}/*`、测试。
- 风险：SQL 聚合与现有 `buildCatalog` 语义必须逐项对齐（播放进度、收藏、季海报、续播、隐私）；需 fixture 对拍（旧实现 vs 新实现）。
- 性能目标：17k fixture 下分类首屏 **< 50ms**（主进程），返回 60–120 条/页；总数准确；连续翻页无重复/遗漏。
- 虚拟列表：待分页落地后按真实 DOM/滚动测量再决定，不在本 ADR 默认引入。

## 6. 回滚

- 不修改数据库 schema（若批准索引则单独迁移 + 回滚脚本）。
- Renderer 保留旧 `limit` 调用路径；回滚主进程改动即可恢复全量切片行为。

## 7. 待用户批准

1. 是否批准按方案 A 扩展既有 `library:catalog`（offset + total/hasMore）？
2. 是否批准在实现中视测量结果新增 SQLite 索引（schema 变更）？若否，将仅做 SQL 聚合，不加索引。

未获批准前不修改主进程查询协议或数据库。
