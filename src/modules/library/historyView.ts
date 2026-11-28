/**
 * B3 最近播放历史（Phase 1 后端）。
 * 服务端钳制 limit（默认 20、最小 1、最大 50）；DTO 白名单化，不泄露路径等内部字段。
 */
import type { LibraryItem, WatchedEntry } from './types';

export const HISTORY_DEFAULT_LIMIT = 20;
export const HISTORY_MAX_LIMIT = 50;

export function clampHistoryLimit(raw: unknown): number {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return HISTORY_DEFAULT_LIMIT;
    }
    const value = Math.floor(raw);
    if (value < 1) {
        return 1;
    }
    if (value > HISTORY_MAX_LIMIT) {
        return HISTORY_MAX_LIMIT;
    }
    return value;
}

export type HistoryItemView = {
    itemId: string;
    title: string;
    kind: LibraryItem['kind'];
    showId: string | null;
    season: number | null;
    episode: number | null;
    episodeTitle: string | null;
    posterPath: string | null;
    year: number | null;
    watched: boolean;
    positionTs: number;
    durationTs: number;
    progressPct: number;
    lastPlayedAt: number | null;
};

/** WatchedEntry → 渲染层白名单视图（剔除 filePath/sourceId/mtime 等内部字段） */
export function toHistoryItemView(entry: WatchedEntry): HistoryItemView {
    const { item, state } = entry;
    const progressPct =
        state.durationTs > 0
            ? Math.min(100, Math.max(0, Math.round((state.positionTs / state.durationTs) * 100)))
            : 0;
    return {
        itemId: item.id,
        title: item.title,
        kind: item.kind,
        showId: item.showId,
        season: item.season,
        episode: item.episode,
        episodeTitle: item.episodeTitle,
        posterPath: item.posterPath,
        year: item.year,
        watched: state.watched,
        positionTs: state.positionTs,
        durationTs: state.durationTs,
        progressPct,
        lastPlayedAt: state.lastPlayedAt,
    };
}
