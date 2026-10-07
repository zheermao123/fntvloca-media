import type { LibraryStore } from './store';

/**
 * 一次性迁移：历史整剧收藏（show:{showId}）→ 按季收藏（season:{showId}:{season}）。
 * 对该剧每个已有季各写一条季收藏，然后删除旧键；幂等（迁移后不再存在 show: 键）。
 */
export function migrateShowFavoritesToSeasons(store: LibraryStore): number {
    let migrated = 0;
    for (const key of store.listFavoriteKeys()) {
        const match = /^show:(.+)$/.exec(key);
        if (!match) {
            continue;
        }
        const showId = match[1];
        const seasons = new Set(
            store
                .listItems({ showId })
                .map((item) => item.season ?? 1)
        );
        for (const season of seasons) {
            if (!store.getFavorite('season', `${showId}:${season}`)) {
                store.setFavorite('season', `${showId}:${season}`, true);
                migrated += 1;
            }
        }
        store.setFavorite('show', showId, false);
    }
    return migrated;
}
