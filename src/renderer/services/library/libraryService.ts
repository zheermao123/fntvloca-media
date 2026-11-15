/** 媒体库查询适配（复用既有 library:catalog / library:show / library:item） */
import { invoke } from '../desktop/desktopBridge';
import { LIBRARY_CATEGORIES } from '../../app/routes';
import { mapCatalogEntries, summarizeCategory } from './library.mapper';
import type { CatalogEntryDto, CatalogPage, CatalogQuery, HomeOverview } from './library.types';

const RECENT_LIMIT = 12;

export async function queryCatalogPage(params: CatalogQuery): Promise<CatalogPage> {
    const result = await invoke<Partial<CatalogPage> & { error?: string }>(
        'library:catalog',
        params,
        'library:catalog-info'
    );
    if (!result || result.error) {
        throw new Error(result?.error || '目录查询失败');
    }
    const entries = result.entries ?? [];
    const total = typeof result.total === 'number' ? result.total : entries.length;
    const offset = typeof result.offset === 'number' ? result.offset : params.offset ?? 0;
    const limit = result.limit ?? params.limit ?? null;
    const hasMore = typeof result.hasMore === 'boolean' ? result.hasMore : offset + entries.length < total;
    return { entries, total, limit, offset, hasMore };
}

export async function queryCatalog(params: CatalogQuery): Promise<CatalogEntryDto[]> {
    return (await queryCatalogPage(params)).entries;
}

export async function fetchHomeOverview(): Promise<HomeOverview> {
    const perCategory = await Promise.all(
        LIBRARY_CATEGORIES.map(async (category) => {
            const page = await queryCatalogPage({ category, limit: 1 });
            return { category, total: page.total };
        })
    );
    const categories = perCategory.map(({ category, total }) => summarizeCategory(category, total));
    const recent = await queryCatalogPage({ sort: 'added', limit: RECENT_LIMIT });
    return { categories, recent: mapCatalogEntries(recent.entries) };
}
