/** 主进程 CatalogEntry DTO → 渲染层 MediaCardModel（纯函数，可单测） */
import { CATEGORY_META } from '../../app/routes';
import type { LibraryCategory } from '../../app/routes';
import type { CatalogEntryDto, MediaCardModel } from './library.types';

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
export function summarizeCategory(category: LibraryCategory, count: number, limit: number): { category: LibraryCategory; count: number; capped: boolean } {
    return { category, count, capped: count >= limit };
}
