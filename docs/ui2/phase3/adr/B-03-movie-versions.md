# ADR B-03：电影多版本展示/切换（数据模型缺口，L2）

- 状态：**阻塞（未实施）**
- 日期：2026-11-15
- 分支：`feature/ui2-phase3`

## 现状核查

1. 播放链路 `play-library-item` 只接受 `itemId`，可以播放任意条目（包括同电影的不同文件）。
2. `library:item` 的 `versions` 语义：
   - `versions` 被赋值为 `siblings`；
   - 但 `siblings` 仅在 `item.showId` 存在时查询，电影条目的 `showId` 为 `null`，因此电影 `versions` **始终为空**。
3. 即使补充“同标题电影”查询，也没有稳定的**版本组标识**：同一电影的不同文件目前是互不关联的独立 item（title/year 相同不代表同一版本组，可能误合并不同影片）。
4. 因此当前无法诚实地展示/切换版本；做一个 UI 选择器会是无效功能。

## 决定

- 不实现多版本选择器；不伪造 `versions` 数据。
- B-03 其余能力（真实元数据、文件信息、观看状态、续播、季/集切换、异步过期保护）已在 Phase 2/B-01 实现并通过回归。

## 建议方案（需批准，L2）

- 在 ingest/数据模型增加稳定的 `versionGroupKey`（例如规范化标题+年份+可选 TMDB ID），或复用 show 模型的 movie 分组；
- `library:item` 返回 `versions`（按组查询，包含 itemId/文件名/大小/分辨率）；
- 播放仍使用现有 `play-library-item`（itemId），无需新播放协议；
- 迁移/回填策略：仅对可判定安全的同组文件回填；无法判定的保持独立，不自动合并；
- 隐私：版本组不得跨 public/private 源合并。

## 影响与回滚

- 需要数据库 schema/迁移与详情 DTO 变更（L2），按 ADR 审批后实施；当前无代码改动，无回滚需求。
- 在批准前，详情页保持单文件播放入口。
