import type { LibraryItem } from './types';

function resolutionRank(resolution: string | null): number {
    const match = /^(\d{3,4})p/i.exec(resolution ?? '');
    return match ? Number(match[1]) : 0;
}

/**
 * 电影多版本只按“同源 + 同一 TMDB ID”分组，绝不使用标题/年份猜测。
 * 无 TMDB ID 的电影只返回自身；选集版本在同一分组中返回。
 */
export function pickMovieVersions(item: LibraryItem, candidates: readonly LibraryItem[]): LibraryItem[] {
    if (item.kind !== 'movie' || !item.tmdbId) {
        return [item];
    }
    const versions = candidates.filter(
        (candidate) =>
            candidate.kind === 'movie' &&
            candidate.sourceId === item.sourceId &&
            candidate.tmdbId === item.tmdbId
    );
    if (!versions.some((candidate) => candidate.id === item.id)) {
        versions.push(item);
    }
    return versions.sort(
        (a, b) =>
            resolutionRank(b.resolution) - resolutionRank(a.resolution) ||
            b.fileSize - a.fileSize ||
            a.filePath.localeCompare(b.filePath)
    );
}
