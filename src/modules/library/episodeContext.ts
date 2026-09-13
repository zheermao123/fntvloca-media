import path from 'path';
import { parseVideoName } from './parser';

export type FolderEpisodeContext = {
    showTitle: string;
    year: number | null;
    season: number;
    episode: number;
};

const CN_NUMBERS: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

const SPECIAL_PATTERN = /特别版|特别篇|special[\s._-]*edition/i;
const YEAR_IN_NAME = /[（(]\s*(19\d{2}|20\d{2})\s*[）)]/;

/** 解析季目录名：S01 / Season 2 / 第X季 → 季号；否则返回 null */
export function parseSeasonDirName(name: string): number | null {
    const trimmed = name.trim();
    let match = /^[sS](\d{1,2})$/.exec(trimmed);
    if (match) {
        return Number(match[1]);
    }
    match = /^[sS]eason[\s._-]*(\d{1,2})$/i.exec(trimmed);
    if (match) {
        return Number(match[1]);
    }
    match = /^第\s*([一二三四五六七八九十\d]{1,3})\s*季/.exec(trimmed);
    if (match) {
        const raw = match[1];
        if (/^\d+$/.test(raw)) {
            return Number(raw);
        }
        if (raw === '十') {
            return 10;
        }
        const tens = /^十([一二三四五六七八九])$/.exec(raw);
        if (tens) {
            return 10 + CN_NUMBERS[tens[1]];
        }
        const simple = CN_NUMBERS[raw];
        return simple ?? null;
    }
    return null;
}

/** 清理目录名作为剧名：去 [组] 前缀、去年份括号、分隔符归一 */
export function cleanDirectoryTitle(name: string): string {
    let title = name.replace(/^\[[^\]]*\]/, ' ');
    title = title.replace(/[（(]\s*(19\d{2}|20\d{2})\s*[）)]/g, ' ');
    title = title.replace(/[._]+/g, ' ');
    title = title.replace(/\s+/g, ' ');
    return title.replace(/^[\s\-–—]+|[\s\-–—_.]+$/g, '').trim();
}

function extractDirectoryYear(name: string): number | null {
    const match = YEAR_IN_NAME.exec(name);
    if (!match) {
        return null;
    }
    const year = Number(match[1]);
    return Number.isFinite(year) ? year : null;
}

function extractTrailingEpisode(stem: string): number | null {
    // 纯数字文件名：01 / 108（限制 1-999，排除 4 位年份样式）
    if (/^\d{1,3}$/.test(stem)) {
        const value = Number(stem);
        return value >= 1 ? value : null;
    }
    // 标题+数字粘连：琅琊榜01 / 唐朝诡事录 02 / 沉默的荣耀03
    const glued = /^(.+?)[\s._-]*(\d{1,3})$/.exec(stem);
    if (!glued) {
        return null;
    }
    const prefix = glued[1];
    const value = Number(glued[2]);
    if (value < 1 || value > 200) {
        return null;
    }
    // 前缀需包含文字（中文或字母），且不能以数字结尾（避开 Blade Runner 2049 这类）
    if (!/[\u4e00-\u9fffA-Za-z]/.test(prefix) || /\d$/.test(prefix)) {
        return null;
    }
    return value;
}

export type FolderEpisodeOptions = {
    /** 所在文件夹的视频文件数量；纯数字/粘连模式要求 ≥2，避免把单片电影文件夹当剧集 */
    folderVideoCount?: number;
};

const MAX_EPISODE = 999;

/**
 * 基于目录结构解析剧集上下文（Kodi/Jellyfin 惯例）：
 * - 剧名 = 最近的"非季样式"目录名
 * - 季号 = 季目录名（S01/第X季/Season N），无季目录时为 1
 * - 集数 = 文件名中的集数标记，或纯数字 / 标题+数字粘连
 * 仅当文件确实呈现剧集特征时返回结果；电影（无集数特征）返回 null。
 */
export function resolveFolderEpisodeContext(
    relativeDirs: string[],
    fileName: string,
    options?: FolderEpisodeOptions
): FolderEpisodeContext | null {
    const dirs = relativeDirs.filter((d) => d.length > 0);
    if (dirs.length === 0) {
        return null;
    }
    // 特别版/特别篇：交由文件名解析，独立成条目（避免与正片集数错位）
    if (SPECIAL_PATTERN.test(fileName)) {
        return null;
    }

    let season: number | null = null;
    let showDir: string | null = null;
    for (let i = dirs.length - 1; i >= 0; i -= 1) {
        const seasonValue = parseSeasonDirName(dirs[i]);
        if (seasonValue !== null && season === null) {
            season = seasonValue;
            continue;
        }
        showDir = dirs[i];
        break;
    }
    if (!showDir) {
        return null;
    }

    const extension = path.extname(fileName);
    const stem = extension.length > 0 ? fileName.slice(0, -extension.length) : fileName;

    const parsed = parseVideoName(fileName);
    let episode = parsed.episode;
    if (episode === null && (options?.folderVideoCount ?? 0) >= 2) {
        episode = extractTrailingEpisode(stem);
    }
    if (episode === null || episode < 1 || episode > MAX_EPISODE) {
        return null;
    }

    const showTitle = cleanDirectoryTitle(showDir);
    if (showTitle.length === 0) {
        return null;
    }

    const dirYear = extractDirectoryYear(showDir) ?? extractDirectoryYear(dirs.join('/'));
    return {
        showTitle,
        year: dirYear,
        season: season ?? parsed.season ?? 1,
        episode,
    };
}
