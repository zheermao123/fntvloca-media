/** library:item / library:show 回复 → MediaDetailModel（纯函数，可单测） */
import type { EpisodeRowModel, MediaDetailModel, MetaItem } from './detail.types';

export type DetailItemDto = {
    id: string;
    kind: 'movie' | 'episode';
    title: string;
    year: number | null;
    posterPath: string | null;
    overview: string | null;
    rating: number | null;
    runtime: number | null;
    filePath: string;
    fileSize: number;
    resolution: string | null;
    season: number | null;
    episode: number | null;
    episodeTitle: string | null;
};

export type DetailStateDto = {
    watched: boolean;
    positionTs: number;
    durationTs: number;
    lastPlayedAt: number | null;
};

export type DetailShowDto = {
    id: string;
    title: string;
    year: number | null;
    posterPath: string | null;
    overview: string | null;
};

export function formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '未知大小';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function basenameOf(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter((part) => part.length > 0);
    return parts.length > 0 ? parts[parts.length - 1] : filePath;
}

export function progressPercent(state: DetailStateDto | undefined): number {
    if (!state || state.durationTs <= 0 || state.positionTs <= 0) {
        return 0;
    }
    return Math.min(100, Math.round((state.positionTs / state.durationTs) * 100));
}

/** 续播点：优先最近的进行中集，否则第一集未看，否则第一集 */
export function pickResumeEpisode(
    episodes: readonly DetailItemDto[],
    states: Readonly<Record<string, DetailStateDto>>
): DetailItemDto | null {
    if (episodes.length === 0) {
        return null;
    }
    let best: DetailItemDto | null = null;
    let bestPlayedAt = 0;
    for (const episode of episodes) {
        const state = states[episode.id];
        if (state && !state.watched && state.positionTs > 0 && (state.lastPlayedAt ?? 0) > bestPlayedAt) {
            best = episode;
            bestPlayedAt = state.lastPlayedAt ?? 0;
        }
    }
    if (best) {
        return best;
    }
    const firstUnwatched = episodes.find((episode) => states[episode.id]?.watched !== true);
    return firstUnwatched ?? episodes[0];
}

export function toEpisodeRows(
    episodes: readonly DetailItemDto[],
    states: Readonly<Record<string, DetailStateDto>>
): EpisodeRowModel[] {
    return episodes.map((episode) => {
        const state = states[episode.id];
        const pct = progressPercent(state);
        const stateText = state?.watched ? '✓ 已看' : pct > 0 ? `已看 ${pct}%` : '';
        const season = episode.season ?? 0;
        const number = episode.episode ?? 0;
        return {
            id: episode.id,
            label: `S${String(season).padStart(2, '0')}E${String(number).padStart(2, '0')}`,
            title: episode.episodeTitle || episode.title,
            stateText,
        };
    });
}

export function mapMovieDetail(item: DetailItemDto): MediaDetailModel {
    const meta: MetaItem[] = [];
    if (item.year) {
        meta.push({ label: '年份', value: String(item.year) });
    }
    meta.push({ label: '类型', value: '电影' });
    if (item.resolution) {
        meta.push({ label: '清晰度', value: item.resolution.toUpperCase() });
    }
    if (item.runtime) {
        meta.push({ label: '时长', value: `${item.runtime} 分钟` });
    }
    if (item.rating) {
        meta.push({ label: '评分', value: `★ ${item.rating}` });
    }
    return {
        kind: 'movie',
        title: item.title,
        poster: item.posterPath,
        overview: item.overview,
        meta,
        file: {
            name: basenameOf(item.filePath),
            sizeLabel: formatFileSize(item.fileSize),
            resolution: item.resolution,
        },
        episodes: [],
        playTargetId: item.id,
        playLabel: '播放',
    };
}

export function mapSeasonDetail(
    show: DetailShowDto,
    season: number,
    episodes: readonly DetailItemDto[],
    states: Readonly<Record<string, DetailStateDto>>
): MediaDetailModel {
    const sorted = [...episodes].sort(
        (a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0)
    );
    const resume = pickResumeEpisode(sorted, states);
    const resumeState = resume ? states[resume.id] : undefined;
    const resumePct = progressPercent(resumeState);
    const meta: MetaItem[] = [];
    if (show.year) {
        meta.push({ label: '年份', value: String(show.year) });
    }
    meta.push({ label: '类型', value: '剧集' });
    meta.push({ label: '第 ' + season + ' 季', value: '全 ' + sorted.length + ' 集' });
    if (resumePct > 0) {
        meta.push({ label: '续播进度', value: `${resumePct}%` });
    }
    return {
        kind: 'season',
        title: `${show.title} 第 ${season} 季`,
        poster: show.posterPath,
        overview: show.overview,
        meta,
        file: resume
            ? {
                  name: basenameOf(resume.filePath),
                  sizeLabel: formatFileSize(resume.fileSize),
                  resolution: resume.resolution,
              }
            : null,
        episodes: toEpisodeRows(sorted, states),
        playTargetId: resume ? resume.id : null,
        playLabel: resumePct > 0 ? '继续播放' : '播放',
    };
}
