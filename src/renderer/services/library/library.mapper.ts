/** 主进程 CatalogEntry DTO → 渲染层 MediaCardModel（纯函数，可单测） */
import { CATEGORY_META } from '../../app/routes';
import type { LibraryCategory } from '../../app/routes';
import type { CatalogEntryDto, ContinueEntryDto, MediaCardModel } from './library.types';

function encodeId(id: string): string {
    return encodeURIComponent(id);
}

export function movieRoute(itemId: string): string {
    return `/media/${encodeId(itemId)}`;
}

export function seasonRoute(showId: string, season: number): string {
    return `/media/${encodeId(showId)}?season=${season}`;
}

export function seasonStatusText(watchedCount: number, episodeCount: number, progressPct: number): string {
    if (progressPct > 0) {
        return `已看 ${watchedCount}/${episodeCount} · 观看中 ${progressPct}%`;
    }
    if (episodeCount > 0 && watchedCount >= episodeCount) {
        return '已看完';
    }
    if (watchedCount > 0) {
        return `已看 ${watchedCount}/${episodeCount}`;
    }
    return '未看';
}

export function mapCatalogEntry(entry: CatalogEntryDto): MediaCardModel {
    if (entry.type === 'movie') {
        return {
            key: `movie:${entry.item.id}`,
            kind: 'movie',
            title: entry.item.title,
            year: entry.item.year,
            poster: entry.item.posterPath,
            subtitle: CATEGORY_META.movie.label,
            badges: [],
            statusText: entry.watched ? '已看' : '未看',
            route: movieRoute(entry.item.id),
        };
    }
    const showSeasonLabel = entry.seasonCount > 1 || entry.season !== 1;
    const badges: string[] = [];
    if (showSeasonLabel) {
        badges.push(`第 ${entry.season} 季`);
    }
    badges.push(`全 ${entry.episodeCount} 集`);
    return {
        key: `season:${entry.show.id}:${entry.season}`,
        kind: 'season',
        title: entry.show.title,
        year: entry.show.year,
        poster: entry.show.posterPath,
        subtitle: null,
        badges,
        statusText: seasonStatusText(entry.watchedCount, entry.episodeCount, entry.progressPct),
        route: seasonRoute(entry.show.id, entry.season),
        favorite: entry.favorite,
        favoriteTarget: { type: 'season', id: entry.show.id, season: entry.season },
    };
}

export function mapCatalogEntries(entries: readonly CatalogEntryDto[]): MediaCardModel[] {
    return entries.map(mapCatalogEntry);
}

export type ParsedMediaRoute = { kind: 'movie'; itemId: string } | { kind: 'season'; showId: string; season: number };

/** 解析 /media/:id（?season=）为详情类型；无 season 视为电影/条目详情 */
export function parseMediaRoute(id: string, search: string): ParsedMediaRoute {
    const params = new URLSearchParams(search);
    const seasonRaw = params.get('season');
    if (seasonRaw !== null && Number.isFinite(Number(seasonRaw))) {
        return { kind: 'season', showId: id, season: Number(seasonRaw) };
    }
    return { kind: 'movie', itemId: id };
}

/** 分类计数（用于首页概览；按真实 catalog 查询结果计数） */
export function summarizeCategory(category: LibraryCategory, count: number, limit?: number): { category: LibraryCategory; count: number; capped: boolean } {
    return { category, count, capped: limit !== undefined && count >= limit };
}

export function mapContinueEntries(entries: readonly ContinueEntryDto[]): MediaCardModel[] {
    return entries.map((entry) => {
        const { item, state } = entry;
        const isEpisode = item.kind === 'episode' && item.showId !== null;
        const season = item.season ?? 1;
        const pct =
            state.durationTs > 0 ? Math.min(100, Math.max(0, Math.round((state.positionTs / state.durationTs) * 100))) : 0;
        const subtitle = isEpisode
            ? `S${String(season).padStart(2, '0')}E${String(item.episode ?? 0).padStart(2, '0')}${
                  item.episodeTitle ? ` · ${item.episodeTitle}` : ''
              }`
            : null;
        return {
            key: `continue:${item.id}`,
            kind: isEpisode ? 'season' : 'movie',
            title: isEpisode ? entry.showTitle ?? item.title : item.title,
            year: item.year,
            poster: item.posterPath,
            subtitle,
            badges: [],
            statusText: pct > 0 ? `观看中 ${pct}%` : '继续观看',
            route: isEpisode && item.showId ? seasonRoute(item.showId, season) : movieRoute(item.id),
        };
    });
}