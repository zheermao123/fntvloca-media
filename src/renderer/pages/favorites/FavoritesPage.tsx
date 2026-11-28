import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { usePrivacyState } from '../../app/PrivacyStateProvider';
import { useLibraryPreferences } from '../../app/LibraryPreferencesProvider';
import { queryCatalogPage } from '../../services/library/libraryService';
import { mapCatalogEntries } from '../../services/library/library.mapper';
import type { CatalogEntryDto, MediaCardModel } from '../../services/library/library.types';
import { LibraryPageHeader } from '../library/LibraryPageHeader';
import { MediaGrid } from '../library/MediaGrid';
import { LibraryLoadingState } from '../library/LibraryLoadingState';
import { LibraryErrorState } from '../library/LibraryErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { StarIcon } from '../../components/icons';
import { Button } from '../../components/ui/Button';

const PAGE_SIZE = 120;

type State =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; entries: CatalogEntryDto[]; total: number; hasMore: boolean; loadingMore: boolean };

export function FavoritesPage() {
    const privacy = usePrivacyState();
    const { sort } = useLibraryPreferences();
    const [state, setState] = useState<State>({ status: 'loading' });
    const seqRef = useRef(0);
    const loadingMoreRef = useRef(false);

    const load = useCallback(async () => {
        const seq = ++seqRef.current;
        setState({ status: 'loading' });
        try {
            const page = await queryCatalogPage({ favorite: true, sort, offset: 0, limit: PAGE_SIZE });
            if (seqRef.current !== seq) {
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
            if (seqRef.current === seq) {
                setState({ status: 'error', message: error instanceof Error ? error.message : '加载失败' });
            }
        }
    }, [sort]);

    useEffect(() => {
        void load();
    }, [load]);

    const loadMore = useCallback(async () => {
        if (state.status !== 'success' || !state.hasMore || loadingMoreRef.current) {
            return;
        }
        loadingMoreRef.current = true;
        const seq = seqRef.current;
        const offset = state.entries.length;
        setState({ ...state, loadingMore: true });
        try {
            const page = await queryCatalogPage({ favorite: true, sort, offset, limit: PAGE_SIZE });
            if (seqRef.current !== seq) {
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
            if (seqRef.current === seq) {
                setState({ status: 'error', message: error instanceof Error ? error.message : '加载更多失败' });
            }
        } finally {
            loadingMoreRef.current = false;
        }
    }, [state, sort]);

    const cards: MediaCardModel[] = useMemo(
        () => (state.status === 'success' ? mapCatalogEntries(state.entries) : []),
        [state]
    );

    if (privacy.active) {
        return <Navigate to="/privacy" replace />;
    }

    return (
        <section className="app-page" aria-label="收藏">
            <LibraryPageHeader title="收藏" count={state.status === 'success' ? state.total : 0} capped={false} />
            {state.status === 'loading' ? <LibraryLoadingState /> : null}
            {state.status === 'error' ? <LibraryErrorState message={state.message} onRetry={() => void load()} /> : null}
            {state.status === 'success' && state.entries.length === 0 ? (
                <EmptyState
                    icon={<StarIcon size={26} />}
                    title="暂无收藏"
                    description="在媒体卡片或详情页点击星标，即可把电影或剧集加入收藏。"
                />
            ) : null}
            {state.status === 'success' && state.entries.length > 0 ? <MediaGrid cards={cards} /> : null}
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
