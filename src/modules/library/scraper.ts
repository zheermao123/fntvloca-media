import fs from 'fs';
import path from 'path';
import * as log from '../logger';
import type { LibraryStore } from './store';
import type { ItemMetadataPatch, LibraryItem, Show } from './types';
import { TmdbClient, createDefaultTransport, pickBestResult } from './tmdb';
import type { ScraperConfig, SearchResult, TmdbTransport } from './tmdb';
import { extractTmdbIdHint } from './episodeContext';

export type ScrapeProgress = {
    done: number;
    total: number;
    title: string;
};

export type ScrapeSummary = {
    scraped: number;
    failed: number;
    skipped: number;
};

export type ScraperOptions = {
    store: LibraryStore;
    cacheDir: string;
    config: ScraperConfig;
    transport?: TmdbTransport;
    delayMs?: number;
    delayFn?: (ms: number) => Promise<void>;
};

const MAX_SEASONS = 20;

export class LibraryScraper {
    private readonly store: LibraryStore;
    private readonly cacheDir: string;
    private readonly client: TmdbClient;
    private readonly apiKey: string;
    private readonly delayMs: number;
    private readonly delayFn: (ms: number) => Promise<void>;

    constructor(options: ScraperOptions) {
        this.store = options.store;
        this.cacheDir = options.cacheDir;
        this.client = new TmdbClient(options.config, options.transport ?? createDefaultTransport());
        this.apiKey = options.config.apiKey ?? '';
        this.delayMs = options.delayMs ?? 250;
        this.delayFn = options.delayFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    }

    private assertApiKey(): void {
        if (this.apiKey.trim().length === 0) {
            throw new Error('TMDB API key is not configured');
        }
    }

    searchMovie(query: string, year?: number): Promise<SearchResult[]> {
        return this.client.searchMovie(query, year);
    }

    searchTv(query: string, year?: number): Promise<SearchResult[]> {
        return this.client.searchTv(query, year);
    }

    async scrapeLibrary(options?: { onProgress?: (progress: ScrapeProgress) => void }): Promise<ScrapeSummary> {
        this.assertApiKey();
        const summary: ScrapeSummary = { scraped: 0, failed: 0, skipped: 0 };
        const movies = this.store.listItems({ kind: 'movie' }).filter((i) => i.metadataSource !== 'tmdb');
        const shows = this.store.listShows().filter((s) => s.tmdbId === null);
        const total = movies.length + shows.length;
        let done = 0;

        for (const movie of movies) {
            try {
                const ok = await this.scrapeMovie(movie);
                if (ok) {
                    summary.scraped += 1;
                } else {
                    summary.skipped += 1;
                }
            } catch (error) {
                summary.failed += 1;
                log.w('[scraper] movie scrape failed:', movie.title, error);
            }
            done += 1;
            options?.onProgress?.({ done, total, title: movie.title });
            await this.delayFn(this.delayMs);
        }

        for (const show of shows) {
            try {
                const ok = await this.scrapeShow(show);
                if (ok) {
                    summary.scraped += 1;
                } else {
                    summary.skipped += 1;
                }
            } catch (error) {
                summary.failed += 1;
                log.w('[scraper] show scrape failed:', show.title, error);
            }
            done += 1;
            options?.onProgress?.({ done, total, title: show.title });
            await this.delayFn(this.delayMs);
        }

        log.i(
            `[scraper] library scrape done scraped=${summary.scraped} skipped=${summary.skipped} failed=${summary.failed}`
        );
        return summary;
    }

    async scrapeItem(itemId: string): Promise<ScrapeSummary> {
        this.assertApiKey();
        const item = this.store.getItem(itemId);
        if (!item) {
            return { scraped: 0, failed: 0, skipped: 0 };
        }
        if (item.kind === 'movie') {
            try {
                const ok = await this.scrapeMovie(item);
                return ok ? { scraped: 1, failed: 0, skipped: 0 } : { scraped: 0, failed: 0, skipped: 1 };
            } catch (error) {
                log.w('[scraper] manual movie scrape failed:', item.title, error);
                return { scraped: 0, failed: 1, skipped: 0 };
            }
        }
        const show = item.showId ? this.store.getShow(item.showId) : null;
        if (!show) {
            return { scraped: 0, failed: 0, skipped: 0 };
        }
        try {
            const ok = await this.scrapeShow(show);
            return ok ? { scraped: 1, failed: 0, skipped: 0 } : { scraped: 0, failed: 0, skipped: 1 };
        } catch (error) {
            log.w('[scraper] manual show scrape failed:', show.title, error);
            return { scraped: 0, failed: 0, skipped: 1 };
        }
    }

    async applyMovieMatch(itemId: string, tmdbId: number): Promise<void> {
        this.assertApiKey();
        const item = this.store.getItem(itemId);
        if (!item) {
            throw new Error(`Item not found: ${itemId}`);
        }
        const detail = await this.client.getMovie(tmdbId);
        if (!detail) {
            throw new Error(`TMDB movie not found: ${tmdbId}`);
        }
        await this.writeMovieMetadata(item, detail);
    }

    async applyShowMatch(showId: string, tmdbId: number): Promise<void> {
        this.assertApiKey();
        const show = this.store.getShow(showId);
        if (!show) {
            throw new Error(`Show not found: ${showId}`);
        }
        const tv = await this.client.getTv(tmdbId);
        if (!tv) {
            throw new Error(`TMDB show not found: ${tmdbId}`);
        }
        await this.writeShowMetadata(show, tv);
        await this.refreshEpisodes(show.id, tv);
    }

    private async scrapeMovie(item: LibraryItem): Promise<boolean> {
        await this.delayFn(this.delayMs);
        // 目录/文件名内嵌 TMDB ID（如 ｛tmdb-813032｝）时直接按 ID 取详情，跳过搜索
        const hint = extractTmdbIdHint(item.filePath);
        if (hint !== null) {
            const hinted = await this.client.getMovie(hint);
            if (hinted) {
                await this.writeMovieMetadata(item, hinted);
                return true;
            }
        }
        // 防御：纯数字/超短标题（历史脏数据或异常命名）不做在线搜索，避免乱匹配
        const normalizedTitle = item.title.trim();
        if (normalizedTitle.length < 2 || /^\d{1,4}$/.test(normalizedTitle)) {
            log.w(`[scraper] skip low-quality title: ${item.title}`);
            return false;
        }
        const results = await this.client.searchMovie(item.title, item.year ?? undefined);
        const best = pickBestResult(results, item.title, item.year);
        if (!best) {
            return false;
        }
        const detail = await this.client.getMovie(best.id);
        if (!detail) {
            return false;
        }
        await this.writeMovieMetadata(item, detail);
        return true;
    }

    private async writeMovieMetadata(
        item: LibraryItem,
        detail: Awaited<ReturnType<TmdbClient['getMovie']>> & object
    ): Promise<void> {
        const posterPath = await this.cacheImage('movie', detail.id, 'poster', detail.posterPath, 'w342');
        const backdropPath = await this.cacheImage('movie', detail.id, 'backdrop', detail.backdropPath, 'w780');
        this.store.updateItemMetadata(item.id, {
            title: detail.title.length > 0 ? detail.title : item.title,
            overview: detail.overview,
            rating: detail.voteAverage,
            runtime: detail.runtime,
            tmdbId: `${detail.id}`,
            posterPath,
            backdropPath,
            metadataSource: 'tmdb',
        });
    }

    private async scrapeShow(show: Show): Promise<boolean> {
        await this.delayFn(this.delayMs);
        // 任一剧集路径内嵌 TMDB ID 时直接按 ID 取详情，跳过搜索
        const hintedId = this.store
            .listItems({ showId: show.id })
            .map((i) => extractTmdbIdHint(i.filePath))
            .find((value): value is number => value !== null);
        if (hintedId !== undefined) {
            const tv = await this.client.getTv(hintedId);
            if (tv) {
                await this.writeShowMetadata(show, tv);
                await this.refreshEpisodes(show.id, tv);
                return true;
            }
        }
        const results = await this.client.searchTv(show.title, show.year ?? undefined);
        const best = pickBestResult(results, show.title, show.year);
        if (!best) {
            return false;
        }
        const tv = await this.client.getTv(best.id);
        if (!tv) {
            return false;
        }
        await this.writeShowMetadata(show, tv);
        await this.refreshEpisodes(show.id, tv);
        return true;
    }

    private async writeShowMetadata(show: Show, tv: Awaited<ReturnType<TmdbClient['getTv']>> & object): Promise<void> {
        const posterPath = await this.cacheImage('tv', tv.id, 'poster', tv.posterPath, 'w342');
        const backdropPath = await this.cacheImage('tv', tv.id, 'backdrop', tv.backdropPath, 'w780');
        const year = tv.firstAirDate && tv.firstAirDate.length >= 4 ? Number(tv.firstAirDate.slice(0, 4)) : null;
        this.store.updateShowMetadata(show.id, {
            title: tv.name.length > 0 ? tv.name : show.title,
            year: year !== null && Number.isFinite(year) ? year : show.year,
            overview: tv.overview,
            posterPath,
            backdropPath,
            tmdbId: `${tv.id}`,
        });
    }

    private async refreshEpisodes(showId: string, tv: Awaited<ReturnType<TmdbClient['getTv']>> & object): Promise<void> {
        const episodes = this.store.listItems({ showId });
        if (episodes.length === 0) {
            return;
        }
        const seasons = new Set<number>();
        for (const episode of episodes) {
            seasons.add(episode.season ?? 1);
        }
        for (const season of seasons) {
            if (season < 0 || season > MAX_SEASONS) {
                continue;
            }
            const detail = await this.client.getSeason(tv.id, season);
            if (!detail) {
                continue;
            }
            const seasonPoster = await this.cacheImage(
                'tv',
                tv.id,
                `season_${season}_poster`,
                detail.posterPath,
                'w342'
            );
            this.store.upsertSeason({
                showId,
                season,
                posterPath: seasonPoster,
                name: detail.name,
                overview: detail.overview,
            });
            const byEpisode = new Map(detail.episodes.map((e) => [e.episodeNumber, e]));
            for (const episode of episodes) {
                if ((episode.season ?? 1) !== season) {
                    continue;
                }
                const match = byEpisode.get(episode.episode ?? -1);
                if (!match) {
                    continue;
                }
                const patch: ItemMetadataPatch = { metadataSource: 'tmdb' };
                if (match.name) {
                    patch.episodeTitle = match.name;
                }
                const stillPath = await this.cacheImage(
                    'tv',
                    tv.id,
                    `still_${season}_${episode.episode ?? 0}`,
                    match.stillPath,
                    'w185'
                );
                if (stillPath) {
                    patch.posterPath = stillPath;
                }
                this.store.updateItemMetadata(episode.id, patch);
            }
        }
    }

    private async cacheImage(
        keyType: string,
        keyId: number,
        role: string,
        remotePath: string | null,
        size: string
    ): Promise<string | null> {
        if (!remotePath) {
            return null;
        }
        const fileName = `${keyType}_${keyId}_${role}.jpg`;
        const filePath = path.join(this.cacheDir, fileName);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        const url = this.client.imageUrl(remotePath, size);
        try {
            const buffer = await this.client.getBinary(url);
            await fs.promises.mkdir(this.cacheDir, { recursive: true });
            await fs.promises.writeFile(filePath, buffer);
            return filePath;
        } catch (error) {
            log.w('[scraper] image download failed:', url, error);
            return null;
        }
    }
}
