import axios from 'axios';

export const DEFAULT_TMDB_API_BASE = 'https://api.themoviedb.org/3';
export const DEFAULT_TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
export const DEFAULT_TMDB_LANGUAGE = 'zh-CN';

export type ScraperConfig = {
    apiKey: string;
    apiBaseUrl?: string;
    imageBaseUrl?: string;
    language?: string;
};

export type TmdbTransport = {
    getJson(url: string): Promise<unknown>;
    getBinary(url: string): Promise<Buffer>;
};

export type SearchResult = {
    id: number;
    title: string;
    date: string | null;
    posterPath: string | null;
    overview: string | null;
    voteAverage: number | null;
};

export type MovieDetail = {
    id: number;
    title: string;
    overview: string | null;
    runtime: number | null;
    voteAverage: number | null;
    posterPath: string | null;
    backdropPath: string | null;
};

export type TvDetail = {
    id: number;
    name: string;
    overview: string | null;
    firstAirDate: string | null;
    posterPath: string | null;
    backdropPath: string | null;
    seasonNumbers: number[];
};

export type SeasonEpisodeInfo = {
    episodeNumber: number;
    name: string | null;
    stillPath: string | null;
};

export type SeasonDetail = {
    name: string | null;
    overview: string | null;
    posterPath: string | null;
    episodes: SeasonEpisodeInfo[];
};

export function createDefaultTransport(): TmdbTransport {
    return {
        async getJson(url: string): Promise<unknown> {
            try {
                const response = await axios.get(url, { timeout: 15000 });
                return response.data as unknown;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return null;
                }
                throw error;
            }
        },
        async getBinary(url: string): Promise<Buffer> {
            const response = await axios.get(url, {
                timeout: 30000,
                responseType: 'arraybuffer',
            });
            return Buffer.from(response.data as ArrayBuffer);
        },
    };
}

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord | null {
    return value !== null && typeof value === 'object' ? (value as RawRecord) : null;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mapResults(raw: unknown, titleKey: 'title' | 'name', dateKey: string): SearchResult[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const results: SearchResult[] = [];
    for (const entry of raw) {
        const record = asRecord(entry);
        if (!record || typeof record.id !== 'number') {
            continue;
        }
        results.push({
            id: record.id,
            title: asString(record[titleKey]) ?? '',
            date: asString(record[dateKey]),
            posterPath: asString(record.poster_path),
            overview: asString(record.overview),
            voteAverage: asNumber(record.vote_average),
        });
    }
    return results;
}

export function pickBestResult(
    results: SearchResult[],
    targetTitle: string,
    targetYear: number | null
): SearchResult | null {
    if (results.length === 0) {
        return null;
    }
    const normalize = (value: string): string =>
        value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
    const target = normalize(targetTitle);
    const exact = results.filter((r) => normalize(r.title) === target);
    const pool = exact.length > 0 ? exact : results;
    if (targetYear === null) {
        return pool[0];
    }
    return [...pool].sort((a, b) => {
        const distance = yearDistance(a, targetYear) - yearDistance(b, targetYear);
        if (distance !== 0) {
            return distance;
        }
        // 年份相同（或无日期）时优先高评分条目，避免误选同年的花絮/纪录片
        return (b.voteAverage ?? 0) - (a.voteAverage ?? 0);
    })[0];
}

function yearDistance(result: SearchResult, targetYear: number): number {
    const raw = result.date;
    if (!raw || raw.length < 4) {
        return 1000;
    }
    const year = Number(raw.slice(0, 4));
    if (!Number.isFinite(year)) {
        return 1000;
    }
    return Math.abs(year - targetYear);
}

type RawList = { results?: unknown };

export class TmdbClient {
    private readonly config: ScraperConfig;
    private readonly transport: TmdbTransport;

    constructor(config: ScraperConfig, transport: TmdbTransport) {
        this.config = config;
        this.transport = transport;
    }

    imageUrl(remotePath: string, size: string): string {
        const base = (this.config.imageBaseUrl ?? DEFAULT_TMDB_IMAGE_BASE).replace(/\/+$/, '');
        return `${base}/${size}${remotePath}`;
    }

    async getBinary(url: string): Promise<Buffer> {
        return this.transport.getBinary(url);
    }

    private url(pathname: string, params: Record<string, string | number | undefined>): string {
        const base = (this.config.apiBaseUrl ?? DEFAULT_TMDB_API_BASE).replace(/\/+$/, '');
        const search = new URLSearchParams();
        search.set('api_key', this.config.apiKey);
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && `${value}`.length > 0) {
                search.set(key, `${value}`);
            }
        }
        if (!search.has('language')) {
            search.set('language', this.config.language ?? DEFAULT_TMDB_LANGUAGE);
        }
        return `${base}${pathname}?${search.toString()}`;
    }

    async searchMovie(query: string, year?: number): Promise<SearchResult[]> {
        const data = (await this.transport.getJson(
            this.url('/search/movie', { query, year })
        )) as RawList;
        return mapResults(data.results, 'title', 'release_date');
    }

    async searchTv(query: string, year?: number): Promise<SearchResult[]> {
        const data = (await this.transport.getJson(
            this.url('/search/tv', { query, first_air_date_year: year })
        )) as RawList;
        return mapResults(data.results, 'name', 'first_air_date');
    }

    async getMovie(id: number): Promise<MovieDetail | null> {
        const data = asRecord(await this.transport.getJson(this.url(`/movie/${id}`, {})));
        if (!data || typeof data.id !== 'number') {
            return null;
        }
        return {
            id: data.id,
            title: asString(data.title) ?? '',
            overview: asString(data.overview),
            runtime: asNumber(data.runtime),
            voteAverage: asNumber(data.vote_average),
            posterPath: asString(data.poster_path),
            backdropPath: asString(data.backdrop_path),
        };
    }

    async getTv(id: number): Promise<TvDetail | null> {
        const data = asRecord(await this.transport.getJson(this.url(`/tv/${id}`, {})));
        if (!data || typeof data.id !== 'number') {
            return null;
        }
        const seasons: number[] = [];
        if (Array.isArray(data.seasons)) {
            for (const entry of data.seasons) {
                const season = asRecord(entry);
                const number = season ? asNumber(season.season_number) : null;
                if (number !== null) {
                    seasons.push(number);
                }
            }
        }
        return {
            id: data.id,
            name: asString(data.name) ?? '',
            overview: asString(data.overview),
            firstAirDate: asString(data.first_air_date),
            posterPath: asString(data.poster_path),
            backdropPath: asString(data.backdrop_path),
            seasonNumbers: seasons,
        };
    }

    async getSeason(tvId: number, season: number): Promise<SeasonDetail | null> {
        const data = asRecord(await this.transport.getJson(this.url(`/tv/${tvId}/season/${season}`, {})));
        if (!data || !Array.isArray(data.episodes)) {
            return null;
        }
        const episodes: SeasonEpisodeInfo[] = [];
        for (const entry of data.episodes) {
            const record = asRecord(entry);
            if (!record || typeof record.episode_number !== 'number') {
                continue;
            }
            episodes.push({
                episodeNumber: record.episode_number,
                name: asString(record.name),
                stillPath: asString(record.still_path),
            });
        }
        return {
            name: asString(data.name),
            overview: asString(data.overview),
            posterPath: asString(data.poster_path),
            episodes,
        };
    }
}
