import fs from 'fs';
import path from 'path';
import type { LibraryStore } from './store';
import type { LibraryItem } from './types';

export type LibraryPlaySource =
    | { kind: 'file'; path: string }
    | { kind: 'url'; url: string };

export type LibraryPlayEntry = {
    itemGuid: string;
    title: string;
    episodeTitle: string | null;
    tvTitle: string;
    seasonNumber: number;
    episodeNumber: number;
    ts: number;
    duration: number;
    /** 跳过片头片尾的存储键：剧集用剧集组ID（同组共享），电影用条目ID */
    skipKey: string;
    source: LibraryPlaySource;
};

export type LibraryPlaylist = {
    entries: LibraryPlayEntry[];
    currentIndex: number;
};

const STRM_EXTENSION = '.strm';

type ReadStrmFn = (filePath: string) => string | null;

function defaultReadStrm(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch {
        return null;
    }
}

function resolveSource(filePath: string, readStrm: ReadStrmFn): LibraryPlaySource {
    if (filePath.toLowerCase().endsWith(STRM_EXTENSION)) {
        const content = readStrm(filePath);
        const url = content !== null ? content.trim().split(/\r?\n/)[0]?.trim() ?? '' : '';
        if (url.length > 0 && /^https?:\/\//i.test(url)) {
            return { kind: 'url', url };
        }
    }
    return { kind: 'file', path: filePath };
}

function resumeTs(store: LibraryStore, item: LibraryItem): number {
    const state = store.getWatchState(item.id);
    if (!state || state.watched || state.positionTs <= 0) {
        return 0;
    }
    return state.positionTs;
}

function compareItems(a: LibraryItem, b: LibraryItem): number {
    const seasonA = a.season ?? 0;
    const seasonB = b.season ?? 0;
    if (seasonA !== seasonB) {
        return seasonA - seasonB;
    }
    const episodeA = a.episode ?? 0;
    const episodeB = b.episode ?? 0;
    if (episodeA !== episodeB) {
        return episodeA - episodeB;
    }
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

function toEntry(store: LibraryStore, item: LibraryItem, showTitle: string, readStrm: ReadStrmFn): LibraryPlayEntry {
    return {
        itemGuid: item.id,
        title: item.episodeTitle ?? item.title,
        episodeTitle: item.episodeTitle,
        tvTitle: showTitle,
        seasonNumber: item.season ?? 0,
        episodeNumber: item.episode ?? 0,
        ts: resumeTs(store, item),
        duration: 0,
        skipKey: item.kind === 'episode' && item.showId ? item.showId : item.id,
        source: resolveSource(item.filePath, readStrm),
    };
}

export function buildLibraryPlaylist(
    store: LibraryStore,
    itemId: string,
    options?: { readStrm?: ReadStrmFn }
): LibraryPlaylist | null {
    const readStrm = options?.readStrm ?? defaultReadStrm;
    const item = store.getItem(itemId);
    if (!item) {
        return null;
    }

    if (item.kind === 'episode' && item.showId) {
        const show = store.getShow(item.showId);
        const showTitle = show ? show.title : item.title;
        const siblings = store
            .listItems({ showId: item.showId })
            .sort(compareItems)
            .map((sibling) => toEntry(store, sibling, showTitle, readStrm));
        if (siblings.length === 0) {
            return null;
        }
        let currentIndex = siblings.findIndex((entry) => entry.itemGuid === item.id);
        if (currentIndex < 0) {
            currentIndex = 0;
        }
        return { entries: siblings, currentIndex };
    }

    return { entries: [toEntry(store, item, '', readStrm)], currentIndex: 0 };
}

const SUBTITLE_EXTENSIONS = new Set(['.srt', '.ass', '.ssa', '.sup', '.vtt', '.sub']);

export async function findSidecarSubtitles(videoPath: string): Promise<string[]> {
    const dir = path.dirname(videoPath);
    const base = path.basename(videoPath, path.extname(videoPath));
    let names: string[];
    try {
        names = await fs.promises.readdir(dir);
    } catch {
        return [];
    }
    const lowerBase = base.toLowerCase();
    const matches: string[] = [];
    for (const name of names) {
        const ext = path.extname(name).toLowerCase();
        if (!SUBTITLE_EXTENSIONS.has(ext)) {
            continue;
        }
        const lowerName = name.toLowerCase();
        const stem = lowerName.slice(0, lowerName.length - ext.length);
        if (stem === lowerBase || stem.startsWith(`${lowerBase}.`)) {
            matches.push(path.join(dir, name));
        }
    }
    return matches.sort((a, b) => a.localeCompare(b));
}
