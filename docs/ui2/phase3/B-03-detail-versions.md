# B-03 详情与多版本（缺口记录）

日期：2026-11-15
分支：`feature/ui2-phase3`
ADR：`docs/ui2/phase3/adr/B-03-movie-versions.md`

## 结论

- 播放 IPC 支持按 `itemId` 播放任意条目；但当前数据模型没有电影“版本组”键，`library:item` 的电影 `versions` 实际恒为空（仅 showId 存在时才取 siblings）。
- 因此**不实现多版本选择器**，避免无效 UI；B-03 其余能力（元数据/文件信息/观看状态/续播/季集切换/异步过期保护）已具备并纳入回归。
- 详情页继续使用单文件播放入口；播放保持 fire-and-forget。

## 后续所需（L2）

- 数据模型增加稳定 `versionGroupKey` 或复用 movie group；
- 详情 DTO 返回按组查询的 versions（itemId/文件名/大小/分辨率）；
- 迁移/回填仅对可判定安全的同组文件，跨 public/private 不合并。

本项在批准前保持关闭，不阻塞其余 B 项与发布候选评估。
