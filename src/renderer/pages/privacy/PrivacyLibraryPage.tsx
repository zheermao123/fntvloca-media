import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { usePrivacyState } from '../../app/PrivacyStateProvider';
import { queryCatalogPage, fetchContinueWatching } from '../../services/library/libraryService';
import { mapCatalogEntries, mapContinueEntries } from '../../services/library/library.mapper';
import type { CatalogEntryDto, MediaCardModel } from '../../services/library/library.types';
import { LibraryPageHeader } from '../library/LibraryPageHeader';
import { LibraryToolbar } from '../library/LibraryToolbar';
import { MediaGrid } from '../library/MediaGrid';
import { MediaListView } from '../library/MediaListView';
import { LibraryLoadingState } from '../library/LibraryLoadingState';
import { LibraryEmptyState } from '../library/LibraryEmptyState';
import { LibraryErrorState } from '../library/LibraryErrorState';
import { ContinueWatchingSection } from '../home/ContinueWatchingSection';
import { Button } from '../../components/ui/Button';
import { mapLibraryRows } from '../library/library.mapper';
import type { FavoriteFilterKey, SortKey, ViewMode, WatchedFilterKey } from '../library/library.types';

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

export function PrivacyLibraryPage() {
    const privacy = usePrivacyState();
    const [sort, setSort] = useState<SortKey>('added');
    const [watched, setWatched] = useState<WatchedFilterKey>('all');
    const [favorite, setFavorite] = useState<FavoriteFilterKey>('all');
    const [view, setView] = useState<ViewMode>('grid');
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const [continueWatching, setContinueWatching] = useState<MediaCardModel[]>([]);
    const requestSeqRef = useRef(0);
    const loadingMoreRef = useRef(false);

    const queryBase = useMemo(
        () => ({
            sort,
            watched: watched === 'all' ? undefined : watched === 'watched',
            favorite: favorite === 'all' ? undefined : favorite === 'fav',
            private: true,
        }),
        [sort, watched, favorite]
    );

    const load = useCallback(async () => {
        const seq = ++requestSeqRef.current;
        loadingMoreRef.current = false;
        setState({ status: 'loading' });
        try {
            const [page, continueEntries] = await Promise.all([
                queryCatalogPage({ ...queryBase, offset: 0, limit: PAGE_SIZE }),
                fetchContinueWatching(true),
            ]);
            if (requestSeqRef.current !== seq) {
                return;
            }
            setContinueWatching(mapContinueEntries(continueEntries));
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
    }, [queryBase]);

    useEffect(() => {
        if (privacy.active) {
            void load();
        }
    }, [load, privacy.active]);

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

    if (!privacy.active) {
        return <Navigate to="/home" replace />;
    }

    const cards: MediaCardModel[] = state.status === 'success' ? mapCatalogEntries(state.entries) : [];
    const rows = state.status === 'success' ? mapLibraryRows(state.entries) : [];
    const count = state.status === 'success' ? state.total : 0;

    return (
        <section className="app-page" aria-label="隐私库">
            <LibraryPageHeader title="隐私库" count={count} capped={false} />
            {state.status === 'loading' ? <LibraryLoadingState /> : null}
            {state.status === 'error' ? (
                <LibraryErrorState message={state.message} onRetry={() => void load()} />
            ) : null}
            {state.status === 'success' ? (
                <>
                    <ContinueWatchingSection items={continueWatching} />
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
                    {state.entries.length === 0 ? (
                        <LibraryEmptyState privacy />
                    ) : view === 'grid' ? (
                        <MediaGrid cards={cards} />
                    ) : (
                        <MediaListView rows={rows} />
                    )}
                    {state.hasMore ? (
                        <div className="library-page__more">
                            <Button variant="secondary" loading={state.loadingMore} onClick={() => void loadMore()}>
                                加载更多（已显示 {state.entries.length} / {state.total}）
                            </Button>
                        </div>
                    ) : null}
                </>
            ) : null}
        </section>
    );
}
