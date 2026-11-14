import { useEffect, useState } from 'react';
import { usePrivacyState } from '../../app/PrivacyStateProvider';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { SearchIcon } from '../../components/icons';
import { MediaCard } from '../../components/media/MediaCard';
import { queryCatalog } from '../../services/library/libraryService';
import { mapCatalogEntries } from '../../services/library/library.mapper';
import type { MediaCardModel } from '../../services/library/library.types';

const SEARCH_LIMIT = 50;
const DEBOUNCE_MS = 300;

type SearchState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; cards: MediaCardModel[] };

export function SearchPanel({ onNavigate }: { onNavigate: () => void }) {
    const privacy = usePrivacyState();
    const [query, setQuery] = useState('');
    const [state, setState] = useState<SearchState>({ status: 'idle' });

    useEffect(() => {
        const keyword = query.trim();
        if (!keyword) {
            setState({ status: 'idle' });
            return;
        }
        setState({ status: 'loading' });
        const timer = window.setTimeout(() => {
            queryCatalog({ query: keyword, limit: SEARCH_LIMIT, private: privacy.active })
                .then((entries) => {
                    setState({ status: 'success', cards: mapCatalogEntries(entries) });
                })
                .catch((error: unknown) => {
                    setState({ status: 'error', message: error instanceof Error ? error.message : '搜索失败' });
                });
        }, DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [query, privacy.active]);

    return (
        <div className="search-panel">
            <Input
                label="搜索"
                placeholder="搜索电影、剧集、动漫标题"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                data-autofocus
            />
            <p className="search-panel__hint">按标题搜索（含剧集名），不支持按文件名搜索；结果最多 {SEARCH_LIMIT} 条。</p>
            {state.status === 'idle' ? (
                <EmptyState
                    icon={<SearchIcon size={22} />}
                    title="输入关键词开始搜索"
                    description="搜索会直接查询本地媒体库目录，输入即搜（300ms 防抖）。"
                />
            ) : null}
            {state.status === 'loading' ? (
                <div className="search-panel__results" aria-hidden="true">
                    <Skeleton variant="text" />
                    <Skeleton variant="text" />
                    <Skeleton variant="text" />
                </div>
            ) : null}
            {state.status === 'error' ? (
                <ErrorState title="搜索失败" description={state.message} onRetry={() => setQuery((value) => `${value} `)} />
            ) : null}
            {state.status === 'success' && state.cards.length === 0 ? (
                <EmptyState
                    icon={<SearchIcon size={22} />}
                    title="未找到匹配内容"
                    description="试试更短的关键词，或确认媒体库已完成扫描与收录。"
                />
            ) : null}
            {state.status === 'success' && state.cards.length > 0 ? (
                <div
                    className="media-grid search-panel__results"
                    onClick={(event) => {
                        if (event.target instanceof Element && event.target.closest('a')) {
                            onNavigate();
                        }
                    }}
                >
                    {state.cards.map((card) => (
                        <MediaCard key={card.key} model={card} />
                    ))}
                </div>
            ) : null}
        </div>
    );
}
