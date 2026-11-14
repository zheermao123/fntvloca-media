import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { usePrivacyState } from '../../app/PrivacyStateProvider';
import { CATEGORY_META, resolveCategoryFromSegment } from '../../app/routes';
import { queryCatalog } from '../../services/library/libraryService';
import { mapCatalogEntries } from '../../services/library/library.mapper';
import type { CatalogEntryDto, MediaCardModel } from '../../services/library/library.types';
import { LibraryPageHeader } from './LibraryPageHeader';
import { LibraryToolbar } from './LibraryToolbar';
import { MediaGrid } from './MediaGrid';
import { MediaListView } from './MediaListView';
import { LibraryLoadingState } from './LibraryLoadingState';
import { LibraryEmptyState } from './LibraryEmptyState';
import { LibraryErrorState } from './LibraryErrorState';
import { mapLibraryRows } from './library.mapper';
import type { FavoriteFilterKey, SortKey, ViewMode, WatchedFilterKey } from './library.types';

const QUERY_LIMIT = 600;

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; entries: CatalogEntryDto[] };

export function LibraryPage() {
    const { category: segment } = useParams();
    const category = resolveCategoryFromSegment(segment);
    const privacy = usePrivacyState();

    const [sort, setSort] = useState<SortKey>('added');
    const [watched, setWatched] = useState<WatchedFilterKey>('all');
    const [favorite, setFavorite] = useState<FavoriteFilterKey>('all');
    const [view, setView] = useState<ViewMode>('grid');
    const [state, setState] = useState<LoadState>({ status: 'loading' });

    const load = useCallback(async () => {
        if (!category) {
            return;
        }
        setState({ status: 'loading' });
        try {
            const entries = await queryCatalog({
                category,
                sort,
                watched: watched === 'all' ? undefined : watched === 'watched',
                favorite: favorite === 'all' ? undefined : favorite === 'fav',
                limit: QUERY_LIMIT,
                private: privacy.active,
            });
            setState({ status: 'success', entries });
        } catch (error) {
            setState({ status: 'error', message: error instanceof Error ? error.message : '加载失败' });
        }
    }, [category, sort, watched, favorite, privacy.active]);

    useEffect(() => {
        void load();
    }, [load]);

    if (!category) {
        return <Navigate to="/home" replace />;
    }

    const cards: MediaCardModel[] = useMemo(
        () => (state.status === 'success' ? mapCatalogEntries(state.entries) : []),
        [state]
    );
    const rows = useMemo(
        () => (state.status === 'success' ? mapLibraryRows(state.entries) : []),
        [state]
    );
    const count = state.status === 'success' ? state.entries.length : 0;
    const title = privacy.active ? '隐私库' : CATEGORY_META[category].label;

    return (
        <section className="app-page" aria-label={title}>
            <LibraryPageHeader title={title} count={count} capped={count >= QUERY_LIMIT} />
            <LibraryToolbar
                sort={sort}
                watched={watched}
                favorite={favorite}
                view={view}
                onSortChange={setSort}
                onWatchedChange={setWatched}
                onFavoriteChange={setFavorite}
                onViewChange={setView}
            />
            {state.status === 'loading' ? <LibraryLoadingState /> : null}
            {state.status === 'error' ? <LibraryErrorState message={state.message} onRetry={() => void load()} /> : null}
            {state.status === 'success' && state.entries.length === 0 ? (
                <LibraryEmptyState privacy={privacy.active} />
            ) : null}
            {state.status === 'success' && state.entries.length > 0
                ? view === 'grid'
                    ? <MediaGrid cards={cards} />
                    : <MediaListView rows={rows} />
                : null}
        </section>
    );
}
