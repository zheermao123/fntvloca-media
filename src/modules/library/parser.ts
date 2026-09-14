export type ParsedVideoName = {
    title: string;
    year: number | null;
    season: number | null;
    episode: number | null;
    episodeTitle: string | null;
    resolution: string | null;
    isSample: boolean;
};

const RESOLUTION_PATTERN = /\b(2160p?|4k|1080[pi]?|720p|576p|480p)\b/i;

const YEAR_PATTERN = /(?:^|[\s._\-\[)(])(1[89]\d{2}|20\d{2})(?![\dPp])(?=$|[\s._\-\[)\]])/g;

const SE_PATTERN = /(?:^|[\s._\-\[])[sS](\d{1,2})[\s._\-]?[eE](\d{1,3})(?![\dPp])/;

const X_PATTERN = /(?:^|[\s._\-\[)(])(\d{1,2})[xX](\d{2,3})(?!\d)/;

const SEASON_WORD_PATTERN = /[sS]eason[\s._-]*(\d{1,2})\b/;

const EPISODE_WORD_PATTERN = /(?:[eE]pisode|\b[eE][pP])[\s._-]*(\d{1,3})\b/;

const EPISODE_TOKEN_PATTERN = /(?:^|[\s._\-\[])e[pP]?(\d{1,3})(?!\d)/i;

const CHINESE_SEASON_PATTERN = /第\s*([一二三四五六七八九十\d]{1,3})\s*季/;

const CN_DIGITS: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function chineseSeasonToNumber(raw: string): number | null {
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

const CHINESE_EPISODE_PATTERN = /第\s*(\d{1,4})\s*[集話话]/;

const TRAILING_EPISODE_PATTERN = /(?:^|[\s_-])(\d{1,4})$/;

const RELEASE_TAG_PATTERN = /\b(BluRay|Blu-?ray|BDRip|BRRip|WEB-?DL|WEBRip|HDTV|DVDRip|DVD|HDR10?(\+)?|DV|DoVi|x264|x265|h\.?264|h\.?265|HEVC|AV1|AAC\d?|AC3|EAC3|DTS(-?HD)?|TrueHD|Atmos|10bit|8bit|60fps|Remux|REMUX|Proper|PROPER|Repack|REPACK|Extended|Unrated|Remastered|Internal|iNTERNAL|Dual[- ]?Audio|HD(-?CAM)?|Cam|Rip|RARBG|YTS|YIFY|EVO|AMIABLE|GECKOS|NgG|NNHD|WiKi|CHDBits|FRDS|DBG|ADWeb|SMURF|TNH|V\d{1,2})\b/g;

const KNOWN_EXTENSIONS = new Set([
    '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.ts', '.m2ts', '.mts',
    '.webm', '.rmvb', '.rm', '.mpg', '.mpeg', '.m4v', '.vob', '.iso', '.strm',
    '.tp', '.trp', '.3gp', '.ogv', '.divx', '.f4v', '.asf', '.dv',
]);

const VIDEO_EXTENSIONS = [
    '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.ts', '.m2ts', '.mts',
    '.webm', '.rmvb', '.rm', '.mpg', '.mpeg', '.m4v', '.vob', '.iso', '.strm',
];

function stripExtension(name: string): string {
    const dot = name.lastIndexOf('.');
    if (dot <= 0) {
        return name;
    }
    const ext = name.slice(dot).toLowerCase();
    if (ext.length <= 6 && KNOWN_EXTENSIONS.has(ext)) {
        return name.slice(0, dot);
    }
    return name;
}

function matchResolution(name: string): string | null {
    const match = RESOLUTION_PATTERN.exec(name);
    if (!match) {
        return null;
    }
    const token = match[1].toLowerCase();
    if (token === '4k' || token === '2160' || token === '2160p') {
        return '2160p';
    }
    if (token === '1080i') {
        return '1080i';
    }
    return token;
}

type Marker = {
    start: number;
    end: number;
    kind: 'seasonEpisode' | 'season' | 'episode';
    season: number | null;
    episode: number | null;
};

function findSeasonEpisodeMarkers(name: string): Marker[] {
    const markers: Marker[] = [];
    const se = SE_PATTERN.exec(name);
    if (se) {
        markers.push({
            start: se.index,
            end: se.index + se[0].length,
            kind: 'seasonEpisode',
            season: Number(se[1]),
            episode: Number(se[2]),
        });
    }
    const x = X_PATTERN.exec(name);
    if (x) {
        markers.push({
            start: x.index,
            end: x.index + x[0].length,
            kind: 'seasonEpisode',
            season: Number(x[1]),
            episode: Number(x[2]),
        });
    }
    const seasonWord = SEASON_WORD_PATTERN.exec(name);
    if (seasonWord) {
        markers.push({
            start: seasonWord.index,
            end: seasonWord.index + seasonWord[0].length,
            kind: 'season',
            season: Number(seasonWord[1]),
            episode: null,
        });
    }
    const episodeWord = EPISODE_WORD_PATTERN.exec(name);
    if (episodeWord) {
        markers.push({
            start: episodeWord.index,
            end: episodeWord.index + episodeWord[0].length,
            kind: 'episode',
            season: null,
            episode: Number(episodeWord[1]),
        });
    }
    const episodeToken = EPISODE_TOKEN_PATTERN.exec(name);
    if (episodeToken) {
        markers.push({
            start: episodeToken.index,
            end: episodeToken.index + episodeToken[0].length,
            kind: 'episode',
            season: null,
            episode: Number(episodeToken[1]),
        });
    }
    const chineseSeason = CHINESE_SEASON_PATTERN.exec(name);
    if (chineseSeason) {
        const value = chineseSeasonToNumber(chineseSeason[1]);
        if (value !== null) {
            markers.push({
                start: chineseSeason.index,
                end: chineseSeason.index + chineseSeason[0].length,
                kind: 'season',
                season: value,
                episode: null,
            });
        }
    }
    const chineseEpisode = CHINESE_EPISODE_PATTERN.exec(name);
    if (chineseEpisode) {
        markers.push({
            start: chineseEpisode.index,
            end: chineseEpisode.index + chineseEpisode[0].length,
            kind: 'episode',
            season: null,
            episode: Number(chineseEpisode[1]),
        });
    }
    return markers;
}

function findLastYear(name: string): { year: number | null; index: number } {
    const matches = [...name.matchAll(YEAR_PATTERN)];
    for (let i = matches.length - 1; i >= 0; i -= 1) {
        const match = matches[i];
        const tokenStart = match.index + match[0].indexOf(match[1]);
        if (tokenStart > 0) {
            return { year: Number(match[1]), index: tokenStart };
        }
    }
    return { year: null, index: -1 };
}

function cleanText(raw: string): string {
    let text = raw.replace(/\[[^\]]*\]/g, ' ');
    text = text.replace(RELEASE_TAG_PATTERN, ' ');
    text = text.replace(/\b(2160p?|4k|1080[pi]?|720p|576p|480p)\b/gi, ' ');
    // 切片可能留下不完整的括号（如中文包装名被年份截断），一并清洗
    text = text.replace(/[\[\]()（）]/g, ' ');
    text = text.replace(/[._]+/g, ' ');
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/^[\s\-–—]+|[\s\-–—_.]+$/g, '');
    return text.trim();
}

function emptyResult(title: string): ParsedVideoName {
    return {
        title,
        year: null,
        season: null,
        episode: null,
        episodeTitle: null,
        resolution: null,
        isSample: false,
    };
}

export function parseVideoName(input: string): ParsedVideoName {
    if (typeof input !== 'string' || input.length === 0) {
        return emptyResult('');
    }
    const base = stripExtension(input.trim());
    if (base.length === 0) {
        return emptyResult('');
    }

    const resolution = matchResolution(base);
    const isSample = /\bsample\b/i.test(base);
    const markers = findSeasonEpisodeMarkers(base);
    const { year, index: yearIndex } = findLastYear(base);

    let season: number | null = null;
    let episode: number | null = null;
    let titleEnd = base.length;
    let episodeStart = -1;

    const seasonEpisode = markers.find((m) => m.kind === 'seasonEpisode');
    const seasonOnly = markers.find((m) => m.kind === 'season');
    const episodeOnly = markers.find((m) => m.kind === 'episode');

    if (seasonEpisode) {
        season = seasonEpisode.season;
        episode = seasonEpisode.episode;
        titleEnd = Math.min(titleEnd, seasonEpisode.start);
        episodeStart = seasonEpisode.end;
        // 多集文件（S01E01-E02）：仍记为第一集，吞掉区间标记避免混入集标题
        const rangeTail = /^[\s._-]*[eE]\d{1,3}(?!\d)/.exec(base.slice(episodeStart));
        if (rangeTail) {
            episodeStart += rangeTail[0].length;
        }
    } else {
        if (seasonOnly) {
            season = seasonOnly.season;
            titleEnd = Math.min(titleEnd, seasonOnly.start);
        }
        if (episodeOnly) {
            episode = episodeOnly.episode;
            titleEnd = Math.min(titleEnd, episodeOnly.start);
            episodeStart = episodeOnly.end;
        }
    }

    if (year !== null && yearIndex >= 0) {
        titleEnd = Math.min(titleEnd, yearIndex);
    }
    if (resolution) {
        const resIndex = base.toLowerCase().indexOf(
            resolution === '2160p' ? '2160' : resolution.slice(0, 4)
        );
        if (resIndex >= 0) {
            titleEnd = Math.min(titleEnd, resIndex);
        }
    }

    let title = cleanText(base.slice(0, titleEnd));
    if (title.length === 0) {
        title = cleanText(base);
    }

    let episodeTitle: string | null = null;
    if (episodeStart >= 0) {
        const rawEpisodeTitle = base.slice(episodeStart);
        const cleaned = cleanText(rawEpisodeTitle);
        if (cleaned.length > 0) {
            episodeTitle = cleaned;
        }
    }

    if (episode === null && season === null) {
        const withoutBrackets = base.replace(/\[[^\]]*\]/g, ' ').trimEnd();
        const trailing = TRAILING_EPISODE_PATTERN.exec(withoutBrackets);
        if (trailing) {
            const candidate = Number(trailing[1]);
            const before = cleanText(withoutBrackets.slice(0, trailing.index));
            if (before.length > 0 && candidate >= 1) {
                title = before;
                episode = candidate;
            }
        }
    }

    return { title, year, season, episode, episodeTitle, resolution, isSample };
}

export function buildShowKey(title: string, year?: number | null): string {
    const normalized = String(title)
        .toLowerCase()
        .replace(/[\s._\-–—:'"!,?()\[\]]+/g, '');
    return `${normalized}@${year ?? ''}`;
}
