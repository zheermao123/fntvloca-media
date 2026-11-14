import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { parseMediaRoute } from '../../services/library/library.mapper';
import { fetchItemInfo, fetchShowInfo, playLibraryItem } from '../../services/media/mediaService';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { ChevronLeftIcon } from '../../components/icons';
import { DetailHero } from './DetailHero';
import { OverviewSection } from './OverviewSection';
import { FileInfoSection } from './FileInfoSection';
import { mapMovieDetail, mapSeasonDetail } from './detail.mapper';
import type { MediaDetailModel } from './detail.types';

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; model: MediaDetailModel };

export function MediaDetailPage() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const parsed = useMemo(() => parseMediaRoute(id ?? '', location.search), [id, location.search]);
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const requestSeqRef = useRef(0);

    const load = useCallback(async () => {
        if (!id) {
            setState({ status: 'error', message: '缺少媒体 ID' });
            return;
        }
        const seq = ++requestSeqRef.current;
        setState({ status: 'loading' });
        try {
            if (parsed.kind === 'season') {
                const result = await fetchShowInfo(parsed.showId, parsed.season);
                if (requestSeqRef.current === seq) {
                    setState({
                        status: 'success',
                        model: mapSeasonDetail(result.show, parsed.season, result.episodes, result.states),
                    });
                }
            } else {
                const result = await fetchItemInfo(parsed.itemId);
                if (requestSeqRef.current === seq) {
                    setState({ status: 'success', model: mapMovieDetail(result.item) });
                }
            }
        } catch (error) {
            if (requestSeqRef.current !== seq) {
                return;
            }
            setState({ status: 'error', message: error instanceof Error ? error.message : '加载失败' });
        }
    }, [id, parsed]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <section className="app-page">
            <button type="button" className="app-back" onClick={() => navigate(-1)}>
                <ChevronLeftIcon size={14} />
                返回
            </button>
            {state.status === 'loading' ? (
                <div className="detail-hero" aria-hidden="true">
                    <div className="detail-hero__poster">
                        <Skeleton variant="rect" />
                    </div>
                    <div className="detail-hero__body">
                        <Skeleton variant="text" />
                        <Skeleton variant="text" />
                        <Skeleton variant="text" />
                    </div>
                </div>
            ) : null}
            {state.status === 'error' ? (
                <ErrorState title="媒体详情加载失败" description={state.message} onRetry={() => void load()} />
            ) : null}
            {state.status === 'success' ? (
                <div className="detail-page">
                    <DetailHero model={state.model} />
                    <OverviewSection overview={state.model.overview} />
                    <FileInfoSection file={state.model.file} />
                    {state.model.episodes.length > 0 ? (
                        <section className="detail-section">
                            <h3 className="detail-section__title">剧集列表</h3>
                            <div className="detail-episodes">
                                {state.model.episodes.map((episode) => (
                                    <button
                                        key={episode.id}
                                        type="button"
                                        className="detail-episode"
                                        onClick={() => playLibraryItem(episode.id)}
                                        title="播放该集"
                                    >
                                        <span className="detail-episode__num">{episode.label}</span>
                                        <span className="detail-episode__title">{episode.title}</span>
                                        <span className="detail-episode__state">{episode.stateText}</span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
