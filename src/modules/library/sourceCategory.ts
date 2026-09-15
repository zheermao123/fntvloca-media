import type { SourceConfig } from './types';

/**
 * 源内容类型（对齐飞牛影视"内容类型"）：仅用于管理/筛选，不影响解析与刮削。
 * - movie: 电影
 * - tv: 剧集（含国产剧/美剧等）
 * - anime: 动漫
 * - other: 其他视频
 */
export type SourceCategory = 'movie' | 'tv' | 'anime' | 'other';

export const SOURCE_CATEGORIES: readonly SourceCategory[] = ['movie', 'tv', 'anime', 'other'];

export const SOURCE_CATEGORY_LABELS: Record<SourceCategory, string> = {
    movie: '电影',
    tv: '剧集',
    anime: '动漫',
    other: '其他视频',
};

/** 按源名称/路径猜测内容类型（显式配置优先，此函数用于无配置时的默认值） */
export function guessSourceCategory(name: string, ...hints: string[]): SourceCategory {
    const text = [name, ...hints].filter((part) => typeof part === 'string' && part.length > 0).join(' ').toLowerCase();
    if (/动漫|番剧|新番|anime|アニメ/.test(text)) {
        return 'anime';
    }
    if (/电影|影片|片库|影厅|movie|film/.test(text)) {
        return 'movie';
    }
    if (/剧集|电视剧|国产剧|美剧|日剧|韩剧|英剧|综艺|纪录片|series|drama|tv/.test(text)) {
        return 'tv';
    }
    return 'other';
}

export function normalizeCategory(value: unknown): SourceCategory | null {
    return typeof value === 'string' && (SOURCE_CATEGORIES as readonly string[]).includes(value)
        ? (value as SourceCategory)
        : null;
}

/** 读取源的分类：显式配置优先，缺失时按名称/路径猜测（保证旧数据可用） */
export function categoryOfSource(source: Pick<SourceConfig, 'name' | 'config'>): SourceCategory {
    const explicit = normalizeCategory(source.config?.category);
    if (explicit !== null) {
        return explicit;
    }
    return guessSourceCategory(source.name, source.config?.rootPath ?? '', source.config?.url ?? '');
}

/** 是否隐私源（仅隐私模式可见，正常界面完全不展示） */
export function isPrivateSource(source: Pick<SourceConfig, 'config'>): boolean {
    return source.config?.private === '1';
}
