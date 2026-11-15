import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { usePrivacyState } from '../../app/PrivacyStateProvider';
import { fetchHomeOverview } from '../../services/library/libraryService';
import type { HomeOverview } from '../../services/library/library.types';
import { ErrorState } from '../../components/ui/ErrorState';
import { HomeHeader } from './HomeHeader';
import { LibraryOverview, LibraryOverviewSkeleton } from './LibraryOverview';
import { RecentlyAddedSection, RecentlyAddedSkeleton } from './RecentlyAddedSection';
import { ContinueWatchingSection } from './ContinueWatchingSection';
import { RecentlyPlayedSection } from './RecentlyPlayedSection';
import { CategoryQuickLinks } from './CategoryQuickLinks';
import { HomeEmptyState } from './HomeEmptyState';

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; data: HomeOverview };

export function HomePage() {
    const privacy = usePrivacyState();
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const requestSeqRef = useRef(0);

    const load = useCallback(async () => {
        const seq = ++requestSeqRef.current;
        setState({ status: 'loading' });
        try {
            const data = await fetchHomeOverview();
            if (requestSeqRef.current !== seq) {
                return;
            }
            setState({ status: 'success', data });
        } catch (error) {
            if (requestSeqRef.current !== seq) {
                return;
            }
            setState({ status: 'error', message: error instanceof Error ? error.message : '加载失败' });
        }
    }, []);

    useEffect(() => {
        if (privacy.active) {
            return;
        }
        void load();
    }, [load, privacy.active]);

    if (privacy.active) {
        return <Navigate to="/privacy" replace />;
    }

    if (state.status === 'loading') {
        return (
            <section className="app-page">
                <HomeHeader />
                <LibraryOverviewSkeleton />
                <RecentlyAddedSkeleton />
            </section>
        );
    }

    if (state.status === 'error') {
        return (
            <section className="app-page">
                <ErrorState title="媒体库加载失败" description={state.message} onRetry={() => void load()} />
            </section>
        );
    }

    const totalCount = state.data.categories.reduce((sum, category) => sum + category.count, 0);
    if (totalCount === 0) {
        return (
            <section className="app-page">
                <HomeHeader />
                <HomeEmptyState />
            </section>
        );
    }

    return (
        <section className="app-page">
            <HomeHeader />
            <CategoryQuickLinks />
            <ContinueWatchingSection items={state.data.continueWatching} />
            <RecentlyPlayedSection items={state.data.recentPlayed} />
            <LibraryOverview categories={state.data.categories} />
            <RecentlyAddedSection items={state.data.recent} />
        </section>
    );
}
