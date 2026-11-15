import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { usePrivacyState } from '../../app/PrivacyStateProvider';
import { useLibraryPreferences } from '../../app/LibraryPreferencesProvider';
import { CATEGORY_META, resolveCategoryFromSegment } from '../../app/routes';
import { queryCatalogPage } from '../../services/library/libraryService';
import { mapCatalogEntries } from '../../services/library/library.mapper';
import type { CatalogEntryDto, MediaCardModel } from '../../services/library/library.types';
import { LibraryPageHeader } from './LibraryPageHeader';
import { LibraryToolbar } from './LibraryToolbar';
import { MediaGrid } from './MediaGrid';
import { MediaListView } from './MediaListView';
import { LibraryLoadingState } from './LibraryLoadingState';
import { LibraryEmptyState } from './LibraryEmptyState';
import { LibraryErrorState } from './LibraryErrorState';
import { Button } from '../../components/ui/Button';
import { mapLibraryRows } from './library.mapper';


const PAGE_SIZE = 120;

type PageData = {
    entries: CatalogEntryDto[];
    total: number;
    hasMore: boolean;
};

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | ({ status: 'success'; loadingMore: boolean } & PageData);

export function LibraryPage() {
    const { category: segment } = useParams();
    const category = resolveCategoryFromSegment(segment);
    const privacy = usePrivacyState();

    const { sort, watched, favorite, view, update } = useLibraryPreferences();
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const requestSeqRef = useRef(0);
    const loadingMoreRef = useRef(false);

    const queryBase = useMemo(
        () => ({
            category: category ?? undefined,
            sort,
            watched: watched === 'all' ? undefined : watched === 'watched',
            favorite: favorite === 'all' ? undefined : favorite === 'fav',
            private: privacy.active,
        }),
        [category, sort, watched, favorite, privacy.active]
    );

    const load = useCallback(async () => {
        if (!category) {
            return;
        }
        const seq = ++requestSeqRef.current;
        loadingMoreRef.current = false;
        setState({ status: 'loading' });
        try {
            const page = await queryCatalogPage({ ...queryBase, offset: 0, limit: PAGE_SIZE });
            if (requestSeqRef.current !== seq) {
                return;
            }
            setState({
                status: 'success',
                entries: page.entries,
                total: page.total,
                hasMore: page.hasMore,
                loadingMore: false,
            });
        } catch (error) {
            if (requestSeqRef.current !== seq) {
                return;
            }
            setState({ status: 'error', message: error instanceof Error ? error.message : '加载失败' });
        }
    }, [category, queryBase]);

    useEffect(() => {
        void load();
    }, [load]);

    const loadMore = useCallback(async () => {
        if (state.status !== 'success' || !state.hasMore || loadingMoreRef.current) {
            return;
        }
        loadingMoreRef.current = true;
        const seq = requestSeqRef.current;
        const offset = state.entries.length;
        setState({ ...state, loadingMore: true });
        try {
            const page = await queryCatalogPage({ ...queryBase, offset, limit: PAGE_SIZE });
            if (requestSeqRef.current !== seq) {
                return;
            }
            setState({
                status: 'success',
                entries: [...state.entries, ...page.entries],
                total: page.total,
                hasMore: page.hasMore,
                loadingMore: false,
            });
        } catch (error) {
            if (requestSeqRef.current !== seq) {
                return;
            }
            setState({ status: 'error', message: error instanceof Error ? error.message : '加载更多失败' });
        } finally {
            loadingMoreRef.current = false;
        }
    }, [state, queryBase]);

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
    const count = state.status === 'success' ? state.total : 0;
    const title = privacy.active ? '隐私库' : CATEGORY_META[category].label;

    return (
        <section className="app-page" aria-label={title}>
            <LibraryPageHeader title={title} count={count} capped={false} />
            <LibraryToolbar
                sort={sort}
                watched={watched}
                favorite={favorite}
                view={view}
                onSortChange={(value) => update({ sort: value })}
                onWatchedChange={(value) => update({ watched: value })}
                onFavoriteChange={(value) => update({ favorite: value })}
                onViewChange={(value) => update({ view: value })}
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
            {state.status === 'success' && state.hasMore ? (
                <div className="library-page__more">
                    <Button variant="secondary" loading={state.loadingMore} onClick={() => void loadMore()}>
                        加载更多（已显示 {state.entries.length} / {state.total}）
                    </Button>
                </div>
            ) : null}
        </section>
    );
}
