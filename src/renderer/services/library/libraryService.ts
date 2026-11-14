/** 媒体库查询适配（复用既有 library:catalog / library:show / library:item） */
import { invoke } from '../desktop/desktopBridge';
import { LIBRARY_CATEGORIES } from '../../app/routes';
import { mapCatalogEntries, summarizeCategory } from './library.mapper';
import type { CatalogEntryDto, CatalogQuery, HomeOverview } from './library.types';

const OVERVIEW_LIMIT = 600;
const RECENT_LIMIT = 12;

export async function queryCatalog(params: CatalogQuery): Promise<CatalogEntryDto[]> {
    const result = await invoke<{ entries?: CatalogEntryDto[]; error?: string }>(
        'library:catalog',
        params,
        'library:catalog-info'
    );
    if (!result || result.error) {
        throw new Error(result?.error || '目录查询失败');
    }
    return result.entries ?? [];
}

export async function fetchHomeOverview(): Promise<HomeOverview> {
    const perCategory = await Promise.all(
        LIBRARY_CATEGORIES.map((category) =>
            queryCatalog({ category, limit: OVERVIEW_LIMIT }).then((entries) => ({ category, entries }))
        )
    );
    const categories = perCategory.map(({ category, entries }) =>
        summarizeCategory(category, entries.length, OVERVIEW_LIMIT)
    );
    const recent = await queryCatalog({ sort: 'added', limit: RECENT_LIMIT });
    return { categories, recent: mapCatalogEntries(recent) };
}
