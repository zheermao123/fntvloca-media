import path from 'path';
import { parseVideoName } from './parser';

export type FolderEpisodeContext = {
    showTitle: string;
    year: number | null;
    season: number;
    episode: number;
};

const CN_DIGITS: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

/** 中文数字（一~十九及纯数字）转 int */
export function chineseToNumber(raw: string): number | null {
    if (/^\d+$/.test(raw)) {
        return Number(raw);
    }
    if (raw === '十') {
        return 10;
    }
    const tens = /^十([一二三四五六七八九])$/.exec(raw);
    if (tens) {
        return 10 + CN_DIGITS[tens[1]];
    }
    const compound = /^([一二三四五六七八九])十([一二三四五六七八九])$/.exec(raw);
    if (compound) {
        return CN_DIGITS[compound[1]] * 10 + CN_DIGITS[compound[2]];
    }
    const scored = /^([一二三四五六七八九])十$/.exec(raw);
    if (scored) {
        return CN_DIGITS[scored[1]] * 10;
    }
    return CN_DIGITS[raw] ?? null;
}

const SPECIAL_DIR_PATTERN = /^(specials?|特别篇|特别版|番外(篇)?|sp)$/i;
const VERSION_DIR_PATTERN = /^(日语版?|国语版?|粤语版?|中配版?|台配|原声|原版|双语版?|tv动画|tv版|tv|web版|bd版?)$/i;
const SPECIAL_FILE_PATTERN = /特别版|特别篇|番外|specials?[\s._-]*edition/i;
const EXTRAS_PATTERN = /\[(nc)?(op|ed)\d{0,2}\]|\[pv\d?\]|\[cm\]|\[menu\]|定档PV|正式PV|预告片?|花絮/i;
const YEAR_IN_NAME = /[（(]\s*(19\d{2}|20\d{2})\s*[）)]/;

export type SeasonDirInfo = { season: number; showPrefix: string | null };

/** 解析季目录名：S01 / Season 2 / 第X季 / Specials(0) / "灵笼 S01 4K (2019)" */
export function parseSeasonDir(name: string): SeasonDirInfo | null {
    const trimmed = name.trim();
    if (SPECIAL_DIR_PATTERN.test(trimmed)) {
        return { season: 0, showPrefix: null };
    }
    let match = /^[sS](\d{1,2})$/.exec(trimmed);
    if (match) {
        return { season: Number(match[1]), showPrefix: null };
    }
    match = /^[sS]eason[\s._-]*(\d{1,2})$/i.exec(trimmed);
    if (match) {
        return { season: Number(match[1]), showPrefix: null };
    }
    match = /^第\s*([一二三四五六七八九十\d]{1,3})\s*季/.exec(trimmed);
    if (match) {
        const value = chineseToNumber(match[1]);
        return value === null ? null : { season: value, showPrefix: null };
    }
    match = /^[sS](\d{1,2})(?:[\s._(（-].*)?$/.exec(trimmed);
    if (match) {
        return { season: Number(match[1]), showPrefix: null };
    }
    // "S01 2016" / "S02 4K" / "灵笼 S01 4K (2019)" / "一人之下 S03 4K"
    match = /^(.*?)[\s._-]+[sS](\d{1,2})(?:[\s._(（-].*)?$/.exec(trimmed);
    if (match) {
        const prefix = match[1].trim();
        return { season: Number(match[2]), showPrefix: prefix.length > 0 ? prefix : null };
    }
    return null;
}

/** 兼容旧接口：仅返回季号 */
export function parseSeasonDirName(name: string): number | null {
    return parseSeasonDir(name)?.season ?? null;
}

export function cleanDirectoryTitle(name: string): string {
    let title = name.replace(/^\[[^\]]*\]/, ' ');
    title = title.replace(/[（(]\s*(19\d{2}|20\d{2})\s*[）)]/g, ' ');
    title = title.replace(/[\s._-]+[sS]\d{1,2}[\s._-]*\d*[kKpP]?.*$/g, ' ');
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

/** 花絮/特典等非正片内容 */
export function isExtraMaterial(fileName: string): boolean {
    return EXTRAS_PATTERN.test(fileName);
}

function extractEpisodeNumber(stem: string): number | null {
    if (/^\d{1,3}$/.test(stem)) {
        const value = Number(stem);
        return value >= 1 ? value : null;
    }
    // [01] / [63] / [001]（首个纯数字方括号，限 1-200）
    const bracket = /\[(\d{1,3})\]/.exec(stem);
    if (bracket) {
        const value = Number(bracket[1]);
        if (value >= 1 && value <= 200) {
            return value;
        }
    }
    // 前导集号：01 - 标题 / 01.标题 / 01 标题
    const leading = /^(\d{1,3})\s*[-–—.]\s*\S/.exec(stem);
    if (leading) {
        const value = Number(leading[1]);
        if (value >= 1 && value <= 200) {
            return value;
        }
    }
    // 下划线/连字符中的集号：怪獣8号_第二季_13_1080P
    const mid = /[_-](\d{1,3})[_-]/.exec(stem);
    if (mid) {
        const value = Number(mid[1]);
        if (value >= 1 && value <= 200) {
            return value;
        }
    }
    // 标题+数字粘连：琅琊榜01
    const glued = /^(.+?)[\s._-]*(\d{1,3})$/.exec(stem);
    if (glued) {
        const prefix = glued[1];
        const value = Number(glued[2]);
        if (value >= 1 && value <= 200 && /[\u4e00-\u9fffA-Za-z]/.test(prefix) && !/\d$/.test(prefix)) {
            return value;
        }
    }
    return null;
}

export type FolderEpisodeOptions = {
    folderVideoCount?: number;
};

const MAX_EPISODE = 999;

export function resolveFolderEpisodeContext(
    relativeDirs: string[],
    fileName: string,
    options?: FolderEpisodeOptions
): FolderEpisodeContext | null {
    const dirs = relativeDirs.filter((d) => d.length > 0);
    if (dirs.length === 0) {
        return null;
    }
    const isSpecial = SPECIAL_FILE_PATTERN.test(fileName);

    let season: number | null = null;
    let showDir: string | null = null;
    let showPrefixFromSeasonDir: string | null = null;
    for (let i = dirs.length - 1; i >= 0; i -= 1) {
        const info = parseSeasonDir(dirs[i]);
        if (info !== null && season === null) {
            season = info.season;
            if (info.showPrefix) {
                showPrefixFromSeasonDir = info.showPrefix;
            }
            continue;
        }
        if (VERSION_DIR_PATTERN.test(dirs[i])) {
            continue;
        }
        showDir = dirs[i];
        break;
    }
    const showSource = showPrefixFromSeasonDir ?? showDir;
    if (!showSource) {
        return null;
    }

    const extension = path.extname(fileName);
    const stem = extension.length > 0 ? fileName.slice(0, -extension.length) : fileName;

    const parsed = parseVideoName(fileName);
    let episode = parsed.episode;
    if (episode === null && ((options?.folderVideoCount ?? 0) >= 2 || isSpecial)) {
        episode = extractEpisodeNumber(stem);
    }
    if (episode === null && isSpecial) {
        episode = 1;
    }
    if (episode === null || episode < 1 || episode > MAX_EPISODE) {
        return null;
    }

    const showTitle = cleanDirectoryTitle(showSource);
    if (showTitle.length === 0) {
        return null;
    }

    const dirYear = extractDirectoryYear(showSource) ?? extractDirectoryYear(dirs.join('/'));
    return {
        showTitle,
        year: dirYear,
        season: isSpecial ? 0 : (season ?? parsed.season ?? 1),
        episode,
    };
}
