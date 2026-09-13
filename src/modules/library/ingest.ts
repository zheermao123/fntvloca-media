import path from 'path';
import * as log from '../logger';
import type { LibraryStore } from './store';
import type { ScanResult } from './scanner';
import { buildShowKey, parseVideoName } from './parser';
import { findPosterForVideo, loadNfoMetadata } from './nfo';
import type { LibraryItem } from './types';

export type IngestOptions = {
    readNfo?: boolean;
};

export type IngestSummary = {
    added: number;
    updated: number;
    removed: number;
    skipped: number;
};

type NameParseResult = ReturnType<typeof parseVideoName>;

function originalTitleOf(filePath: string): string {
    const base = path.basename(filePath, path.extname(filePath));
    return base.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function enrichWithNfo(videoPath: string, parsed: NameParseResult): Promise<Partial<LibraryItem>> {
    const enrich: Partial<LibraryItem> = {};
    try {
        const meta = await loadNfoMetadata(videoPath);
        if (meta) {
            if (meta.title) {
                enrich.title = meta.title;
            }
            if (meta.plot) {
                enrich.overview = meta.plot;
            }
            if (meta.rating !== null) {
                enrich.rating = meta.rating;
            }
            if (meta.runtime !== null) {
                enrich.runtime = meta.runtime;
            }
            if (meta.tmdbId) {
                enrich.tmdbId = meta.tmdbId;
            }
            if (meta.year !== null) {
                enrich.year = meta.year;
            }
            if (meta.season !== null && parsed.season === null) {
                enrich.season = meta.season;
            }
            if (meta.episode !== null && parsed.episode === null) {
                enrich.episode = meta.episode;
            }
            if (meta.title || meta.plot || meta.tmdbId) {
                enrich.metadataSource = 'nfo';
            }
        }
        const poster = await findPosterForVideo(videoPath);
        if (poster) {
            enrich.posterPath = poster;
        }
    } catch (error) {
        log.w('[library] nfo enrich failed for', videoPath, error);
    }
    return enrich;
}

export async function ingestScanResult(
    store: LibraryStore,
    sourceId: string,
    scan: ScanResult,
    options?: IngestOptions
): Promise<IngestSummary> {
    const readNfo = options?.readNfo !== false;
    const summary: IngestSummary = { added: 0, updated: 0, removed: 0, skipped: 0 };
    const showIdsByGroupKey = new Map<string, string>();
    const keptIds = new Set<string>();

    for (const file of scan.files) {
        const parsed = parseVideoName(path.basename(file.path));
        if (parsed.isSample || parsed.title.length === 0) {
            summary.skipped += 1;
            continue;
        }

        let showId: string | null = null;
        let title = parsed.title;
        let year = parsed.year;

        if (parsed.episode !== null) {
            const groupKey = buildShowKey(parsed.title, parsed.year);
            let cachedShowId = showIdsByGroupKey.get(groupKey);
            if (!cachedShowId) {
                const result = store.upsertShow({
                    sourceId,
                    groupKey,
                    title: parsed.title,
                    year: parsed.year,
                });
                cachedShowId = result.show.id;
                showIdsByGroupKey.set(groupKey, cachedShowId);
            }
            showId = cachedShowId;
        }

        const enrich = readNfo ? await enrichWithNfo(file.path, parsed) : {};
        if (enrich.title) {
            title = enrich.title;
        }
        if (enrich.year !== undefined && enrich.year !== null) {
            year = enrich.year;
        }

        const { item, created } = store.upsertItem({
            sourceId,
            kind: parsed.episode !== null ? 'episode' : 'movie',
            showId,
            title,
            originalTitle: originalTitleOf(file.path),
            year,
            season: enrich.season ?? parsed.season,
            episode: enrich.episode ?? parsed.episode,
            episodeTitle: parsed.episodeTitle,
            filePath: file.path,
            fileSize: file.size,
            mtime: file.mtime,
            resolution: parsed.resolution,
        });

        const hasEnrichment =
            enrich.title !== undefined ||
            enrich.overview !== undefined ||
            enrich.rating !== undefined ||
            enrich.runtime !== undefined ||
            enrich.tmdbId !== undefined ||
            enrich.posterPath !== undefined;
        if (hasEnrichment) {
            store.updateItemMetadata(item.id, enrich);
        }

        if (created) {
            summary.added += 1;
        } else {
            summary.updated += 1;
        }
        keptIds.add(item.id);
    }

    const removed = store.removeItemsExcept(sourceId, [...keptIds]);
    summary.removed = removed.length;

    const source = store.getSource(sourceId);
    if (source) {
        store.updateSource({ ...source, lastScanAt: Date.now() });
    }

    log.i(
        `[library] ingest source=${sourceId} added=${summary.added} updated=${summary.updated} removed=${summary.removed} skipped=${summary.skipped}`
    );
    return summary;
}
