import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { usePrivacyState } from '../../app/PrivacyStateProvider';
import { fetchContinueWatching } from '../../services/library/libraryService';
import { mapContinueEntries } from '../../services/library/library.mapper';
import type { ContinueEntryDto } from '../../services/library/library.types';
import { LibraryPageHeader } from '../library/LibraryPageHeader';
import { MediaGrid } from '../library/MediaGrid';
import { LibraryLoadingState } from '../library/LibraryLoadingState';
import { LibraryErrorState } from '../library/LibraryErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { PlayIcon } from '../../components/icons';

type State =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; entries: ContinueEntryDto[] };

export function ContinueWatchingPage() {
    const privacy = usePrivacyState();
    const [state, setState] = useState<State>({ status: 'loading' });
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (privacy.active) {
            return;
        }
        let active = true;
        setState({ status: 'loading' });
        fetchContinueWatching(false, 50)
            .then((entries) => {
                if (active) {
                    setState({ status: 'success', entries });
                }
            })
            .catch((error: unknown) => {
                if (active) {
                    setState({ status: 'error', message: error instanceof Error ? error.message : '加载失败' });
                }
            });
        return () => {
            active = false;
        };
    }, [privacy.active, reloadKey]);

    const cards = useMemo(
        () => (state.status === 'success' ? mapContinueEntries(state.entries) : []),
        [state]
    );

    if (privacy.active) {
        return <Navigate to="/privacy" replace />;
    }

    return (
        <section className="app-page" aria-label="继续观看">
            <LibraryPageHeader
                title="继续观看"
                count={state.status === 'success' ? state.entries.length : 0}
                capped={false}
            />
            {state.status === 'loading' ? <LibraryLoadingState /> : null}
            {state.status === 'error' ? (
                <LibraryErrorState message={state.message} onRetry={() => setReloadKey((value) => value + 1)} />
            ) : null}
            {state.status === 'success' && state.entries.length === 0 ? (
                <EmptyState
                    icon={<PlayIcon size={26} />}
                    title="暂无继续观看"
                    description="开始播放电影或剧集后，进度会出现在这里。"
                />
            ) : null}
            {state.status === 'success' && state.entries.length > 0 ? <MediaGrid cards={cards} /> : null}
        </section>
    );
}
