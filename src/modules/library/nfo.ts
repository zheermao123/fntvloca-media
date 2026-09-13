import fs from 'fs';
import path from 'path';

export type NfoMetadata = {
    title: string | null;
    originalTitle: string | null;
    showTitle: string | null;
    year: number | null;
    season: number | null;
    episode: number | null;
    plot: string | null;
    rating: number | null;
    runtime: number | null;
    tmdbId: string | null;
    thumb: string | null;
};

const ROOT_PATTERN = /<\s*(movie|episodedetails|tvshow)\b/i;

function decodeEntities(text: string): string {
    return text
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();
}

function extractText(xml: string, tag: string): string | null {
    const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
    const match = pattern.exec(xml);
    if (!match) {
        return null;
    }
    const value = decodeEntities(match[1]).trim();
    return value.length > 0 ? value : null;
}

function extractNumber(xml: string, tag: string): number | null {
    const raw = extractText(xml, tag);
    if (raw === null) {
        return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

export function extractNfoMetadata(xml: string): NfoMetadata | null {
    if (typeof xml !== 'string' || xml.trim().length === 0) {
        return null;
    }
    const root = ROOT_PATTERN.exec(xml);
    if (!root) {
        return null;
    }
    const body = xml;

    const title = extractText(body, 'title');
    const plot = extractText(body, 'plot');
    const tmdbFromUniqueid = extractUniqueid(body);
    const tmdbFromTag = extractText(body, 'tmdbid');

    const meta: NfoMetadata = {
        title,
        originalTitle: extractText(body, 'originaltitle'),
        showTitle: extractText(body, 'showtitle'),
        year: extractNumber(body, 'year'),
        season: extractNumber(body, 'season'),
        episode: extractNumber(body, 'episode'),
        plot,
        rating: extractRating(body),
        runtime: extractNumber(body, 'runtime'),
        tmdbId: tmdbFromUniqueid ?? tmdbFromTag,
        thumb: extractText(body, 'thumb'),
    };

    if (
        meta.title === null &&
        meta.year === null &&
        meta.plot === null &&
        meta.season === null &&
        meta.episode === null
    ) {
        return null;
    }
    return meta;
}

function extractUniqueid(xml: string): string | null {
    const pattern = /<uniqueid[^>]*type=["']?tmdb["']?[^>]*>([\s\S]*?)<\/uniqueid>/i;
    const match = pattern.exec(xml);
    if (!match) {
        return null;
    }
    const value = decodeEntities(match[1]).trim();
    return value.length > 0 ? value : null;
}

function extractRating(xml: string): number | null {
    const raw = extractText(xml, 'rating');
    if (raw === null) {
        return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

const POSTER_CANDIDATES = (baseName: string): string[] => [
    `${baseName}-poster.jpg`,
    `${baseName}-poster.png`,
    `${baseName}.jpg`,
    `${baseName}.png`,
    'poster.jpg',
    'poster.png',
    'folder.jpg',
    'folder.png',
    'cover.jpg',
    'cover.png',
];

const EPISODE_POSTER_CANDIDATES = (baseName: string): string[] => [
    `${baseName}-thumb.jpg`,
    `${baseName}-thumb.png`,
];

async function fileExists(candidate: string): Promise<boolean> {
    try {
        const stat = await fs.promises.stat(candidate);
        return stat.isFile();
    } catch {
        return false;
    }
}

async function firstExisting(candidates: string[]): Promise<string | null> {
    for (const candidate of candidates) {
        if (await fileExists(candidate)) {
            return candidate;
        }
    }
    return null;
}

export async function findPosterForVideo(videoPath: string): Promise<string | null> {
    const dir = path.dirname(videoPath);
    const baseName = path.basename(videoPath, path.extname(videoPath));
    const isEpisode = /\bS\d{1,2}E\d{1,3}\b/i.test(baseName) || /第\d+[集話话]/.test(baseName);
    const extra = isEpisode ? EPISODE_POSTER_CANDIDATES(baseName) : [];
    return firstExisting([...extra, ...POSTER_CANDIDATES(baseName)].map((name) => path.join(dir, name)));
}

export async function findNfoForVideo(videoPath: string): Promise<string | null> {
    const dir = path.dirname(videoPath);
    const baseName = path.basename(videoPath, path.extname(videoPath));

    let entries: string[];
    try {
        entries = (await fs.promises.readdir(dir)).filter((name) => name.toLowerCase().endsWith('.nfo'));
    } catch {
        return null;
    }

    const lowerBase = baseName.toLowerCase();
    const prioritized = [
        entries.find((name) => name.toLowerCase() === `${lowerBase}.nfo`),
        entries.find((name) => name.toLowerCase() === 'movie.nfo'),
        entries.find((name) => name.toLowerCase() === 'tvshow.nfo'),
        entries.find((name) => name.toLowerCase() === 'episodedetails.nfo'),
    ];
    const preferred = prioritized.find((value): value is string => value !== undefined);
    if (preferred) {
        return path.join(dir, preferred);
    }
    const fallback = [...entries].sort((a, b) => a.localeCompare(b))[0];
    return fallback ? path.join(dir, fallback) : null;
}

export async function loadNfoMetadata(videoPath: string): Promise<NfoMetadata | null> {
    const nfoPath = await findNfoForVideo(videoPath);
    if (!nfoPath) {
        return null;
    }
    try {
        const xml = await fs.promises.readFile(nfoPath, 'utf-8');
        return extractNfoMetadata(xml);
    } catch {
        return null;
    }
}
