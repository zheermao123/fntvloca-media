/**
 * 中文标题工具：
 * - hasCJK：判断文本是否含中日韩统一表意文字（用于判断 TMDB 是否给了中文名）
 * - extractChineseTitle：从发布文件名/目录名中提取中文名（TMDB 各中文版本都无译名时的兜底）
 */

export function hasCJK(text: string | null | undefined): boolean {
    return typeof text === 'string' && /[\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
}

/** 制作/字幕/发行等噪音词（用于清洗候选名） */
const NOISE_PATTERN =
    /(DIY|简繁中字|簡繁中字|繁简中字|繁體中字|繁体中文|简体中字|简体中文|官方中字|特效字幕|双语字幕|双语|中字|国语|国配|台配|粤语|导评|原盘|蓝光|杜比视界|次世代|BluRay|Blu-?ray|UHD|REMUX|BDJ|BDMV|1080[pi]|2160p|720p|4K|AVC|HEVC|H\.?26[45]|x264|x265|DTS(-HD)?|TrueHD|Atmos|LPCM|FLAC|AAC|AC3|DD[Pp]?[0-9.]*|菜单|菜单修改|修改|修复|重制|收藏版)/gi;

/** 中文片段（允许中文标点、数字、间隔号） */
const CJK_SEGMENT = /[\u3400-\u4dbf\u4e00-\u9fff][\u3400-\u4dbf\u4e00-\u9fff0-9：:·・、，,！!？?‘’“”"'\- 　]{1,40}/;

/**
 * 从发布名中提取中文标题候选：
 * 1) 依次尝试各 `[...]`/`【...】`/`(...)` 段，再尝试整串
 * 2) 清洗噪音词后取第一段中文
 */
export function extractChineseTitle(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string' || raw.length === 0) {
        return null;
    }
    const candidates: string[] = [];
    for (const match of raw.matchAll(/[\[【（(]([^\]】）)]*)[\]】）)]/g)) {
        if (match[1].length > 0) {
            candidates.push(match[1]);
        }
    }
    candidates.push(raw);

    for (const candidate of candidates) {
        const cleaned = candidate.replace(NOISE_PATTERN, ' ');
        const segment = CJK_SEGMENT.exec(cleaned);
        if (!segment) {
            continue;
        }
        const value = segment[0]
            .replace(/[\s\-：:·・、，,]+$/, '')
            .trim();
        if (value.length >= 2) {
            return value;
        }
    }
    return null;
}

/** 取第一个"含中文"的候选，否则回退到第一个非空值 */
export function preferChinese(first: string | null | undefined, ...fallbacks: Array<string | null | undefined>): string {
    const values = [first, ...fallbacks];
    for (const value of values) {
        const trimmed = (value ?? '').trim();
        if (trimmed.length > 0 && hasCJK(trimmed)) {
            return trimmed;
        }
    }
    for (const value of values) {
        const trimmed = (value ?? '').trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    return '';
}
