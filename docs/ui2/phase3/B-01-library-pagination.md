# B-01 媒体库分页、排序、筛选与大库性能

日期：2026-11-15
分支：`feature/ui2-phase3`
ADR：`docs/ui2/phase3/adr/B-01-catalog-pagination.md`（已按方案 A 实施）

## 实施内容

### 主进程 / Store

- `CatalogQuery` 新增 `offset`；`buildCatalogPage` 返回 `{ entries, total, limit, offset, hasMore }`，`buildCatalog` 保留为仅返回 entries 的兼容包装。
- 稳定排序：所有排序增加 entry key（`movie:id` / `season:showId:season`）作为最终 tie-breaker，分页无重复/遗漏。
- 电影：新增 `LibraryStore.queryMovieCatalog`，SQLite 路径使用 SQL 下推（条件/计数/排序/`LIMIT OFFSET`）；JSON store 提供等价内存实现。
- 剧集：一次性读取全部 episode 并按 show 分组（不再每剧一次查询），批量读取 watch state（不再逐集查询）；季聚合仍在内存完成。
- 首页计数：`fetchHomeOverview` 改为每分类 `limit=1` 读取真实 `total`，不再以 600 上限推断。

### Renderer

- 媒体库每页 120 条，“加载更多”按 `offset` 追加；分类/排序/筛选/隐私切换时重置并丢弃过期响应（请求序号 + in-flight 锁）。
- 计数显示真实 `total`；不再出现“600+ 估算”。
- 网格/列表视图共享分页数据；搜索仍使用 `limit=50`（标题搜索能力未变）。

## 测试与命令

| 命令 | 结果 |
|---|---|
| `npm test` | **265 / 265 通过**（新增 4 项分页/总数/隐私隔离测试） |
| `npm run compile` / `renderer:typecheck` / `renderer:build` | 全部 exit 0 |
| 真实库 file:// 回归（12 步） | 通过，console errors 0 |
| 隐私 E2E（隔离 fixture，15 步） | 通过 |

## 大库性能（21,000 条目 fixture：17k 电影 + 500 剧 × 8 集）

主进程（`scripts/phase3-bench-catalog.cjs`）：

| 查询 | 改前 | 改后 |
|---|---|---|
| 电影首屏 `limit=600` / 现 `limit=120` | 131.7ms（全量构建后切片） | **42.1ms**（SQL 下推） |
| 全部首屏 `limit=120` | 145.6ms | **40.6ms** |
| 深 offset（16800） | 不适用 | 123.2ms（按前缀线性成本，已记录） |
| 全量无 limit（兼容旧路径） | 150.4ms | 110.1ms |

真实 Electron（`scripts/phase3-large-library-check.cjs`，隔离 profile + file:// React）：

- 首屏 120 张：**159ms**（页面内 performance.now，含路由与 React 渲染）；总数显示 17,000。
- 加载更多：第 2 页 74ms、第 3 页 126ms、第 4 页 87ms。
- 480 张时 DOM 节点 5,884、JS heap ≈10MB；480 张卡无重复（unique=480）。
- 结论：**无需引入虚拟列表**（暂不增加依赖）；深 offset 与更大 DOM 规模留待后续测量。

## 隐私与计数口径

- 公开/隐私目录使用独立查询与 `total`；新增测试验证两者总数与内容隔离。
- 总数与当前筛选（kind/category/visibility/watched/favorite/query）同口径；`hasMore = offset + 当前页条数 < total`。
- 未新增 SQLite 索引（测量未显示必要；如后续需要，按 ADR 另行批准）。

## 已知限制

1. 电影 SQL 分页 + 剧集内存聚合的合并排序按“offset+limit 前缀”取样，深 offset 成本线性增长；常规浏览（前数百条）稳定。
2. 剧集聚合仍为内存完成；超大规模剧集库（>10 万 episode）需后续评估 SQL GROUP BY。
3. 未实现虚拟列表；480 张卡片时 DOM/内存仍可接受。
4. 分类计数现在准确，但首页仍发起 4 次分类查询（每次 limit=1）；后续可评估专用 counts 接口。

## 回滚

- 回退 `library:catalog` 的 offset/total 回复与 renderer 分页 UI，即可恢复 Phase 2 行为；`buildCatalog` 兼容包装保证旧调用可用。
- 无数据库迁移；无需恢复数据。
