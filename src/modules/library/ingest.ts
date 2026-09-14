import path from 'path';
import * as log from '../logger';
import type { LibraryStore } from './store';
import type { ScanResult } from './scanner';
import { buildShowKey, parseVideoName } from './parser';
import { resolveFolderEpisodeContext, isExtraMaterial, isNoisyNonEpisodeName } from './episodeContext';
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

/** 相对源根目录的目录链（不含文件名），支持本地路径与 URL */
function relativeDirsOf(filePath: string, rootPath: string): string[] {
    let relative = filePath;
    if (rootPath.length > 0 && filePath.startsWith(rootPath)) {
        relative = filePath.slice(rootPath.length);
    }
    const segments = relative
        .replace(/\\/g, '/')
        .split('/')
        .filter((segment) => segment.length > 0);
    segments.pop();
    return segments;
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
    const sourceInfo = store.getSource(sourceId);
    const sourceRoot = sourceInfo?.config.rootPath ?? sourceInfo?.config.url ?? '';

    // 每目录视频数量：用于区分"剧集文件夹"与"单片电影文件夹"
    const videosPerDir = new Map<string, number>();
    for (const scanned of scan.files) {
        const dir = path.dirname(scanned.path);
        videosPerDir.set(dir, (videosPerDir.get(dir) ?? 0) + 1);
    }

    for (const file of scan.files) {
        const fileName = path.basename(file.path);
        const parsed = parseVideoName(fileName);
        if (parsed.isSample || isExtraMaterial(fileName)) {
            summary.skipped += 1;
            continue;
        }

        // 文件夹感知：剧名取目录、季号取季目录、集数取文件名数字（Kodi/Jellyfin 惯例），
        // 解析不出剧集特征时回退为文件名解析（电影、根目录文件等）。
        const folderCtx = resolveFolderEpisodeContext(relativeDirsOf(file.path, sourceRoot), fileName, {
            folderVideoCount: videosPerDir.get(path.dirname(file.path)) ?? 0,
        });
        // 方括号发布命名（如 [DBD-Raws][Kaijuu 8 Gou][01][1080P]）清洗后文件名为空，
        // 但只要目录能推导出剧名（folderCtx）就仍然有效；两者都没有才跳过。
        if (parsed.title.length === 0 && (folderCtx === null || folderCtx.showTitle.length === 0)) {
            summary.skipped += 1;
            continue;
        }

        let showId: string | null = null;
        let title = folderCtx ? folderCtx.showTitle : parsed.title;
        let year = folderCtx ? (folderCtx.year ?? parsed.year) : parsed.year;
        let season = folderCtx ? folderCtx.season : parsed.season;
        let episode = folderCtx ? folderCtx.episode : parsed.episode;
        if (!folderCtx && episode !== null && isNoisyNonEpisodeName(fileName)) {
            episode = null;
        }

        if (episode !== null) {
            // 分组键只使用目录派生年份：文件名里的年份（如 "一人之下 2026.S06E01"）不参与分组，避免同剧按季拆散
            const keyYear = folderCtx ? folderCtx.year : null;
            const groupKey = buildShowKey(title, keyYear);
            let cachedShowId = showIdsByGroupKey.get(groupKey);
            if (!cachedShowId) {
                const result = store.upsertShow({
                    sourceId,
                    groupKey,
                    title,
                    year,
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
            kind: episode !== null ? 'episode' : 'movie',
            showId,
            title,
            originalTitle: originalTitleOf(file.path),
            year,
            season: enrich.season ?? season,
            episode: enrich.episode ?? episode,
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
