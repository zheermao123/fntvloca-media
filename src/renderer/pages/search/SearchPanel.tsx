import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePrivacyState } from '../../app/PrivacyStateProvider';
import { CATEGORY_META, LIBRARY_CATEGORIES, ROUTES } from '../../app/routes';
import type { LibraryCategory } from '../../app/routes';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { SearchIcon } from '../../components/icons';
import { MediaCard } from '../../components/media/MediaCard';
import { queryCatalogPage } from '../../services/library/libraryService';
import { mapCatalogEntries } from '../../services/library/library.mapper';
import type { MediaCardModel } from '../../services/library/library.types';

const SEARCH_LIMIT = 50;
const DEBOUNCE_MS = 300;
const RECENT_LIMIT = 5;

type CategoryFilter = 'all' | LibraryCategory;

type SearchState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; cards: MediaCardModel[]; total: number };

export function SearchPanel({ onNavigate }: { onNavigate: () => void }) {
    const privacy = usePrivacyState();
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<CategoryFilter>('all');
    const [recent, setRecent] = useState<string[]>([]);
    const [retryKey, setRetryKey] = useState(0);
    const [state, setState] = useState<SearchState>({ status: 'idle' });
    const keyword = query.trim();

    useEffect(() => {
        setCategory('all');
    }, [privacy.active]);

    useEffect(() => {
        const keyword = query.trim();
        if (!keyword) {
            setState({ status: 'idle' });
            return;
        }
        let cancelled = false;
        setState({ status: 'loading' });
        const timer = window.setTimeout(() => {
            queryCatalogPage({
                query: keyword,
                category: category === 'all' ? undefined : category,
                limit: SEARCH_LIMIT,
                private: privacy.active,
            })
                .then((page) => {
                    if (!cancelled) {
                        setState({ status: 'success', cards: mapCatalogEntries(page.entries), total: page.total });
                        setRecent((items) => [keyword, ...items.filter((item) => item !== keyword)].slice(0, RECENT_LIMIT));
                    }
                })
                .catch((error: unknown) => {
                    if (!cancelled) {
                        setState({ status: 'error', message: error instanceof Error ? error.message : '搜索失败' });
                    }
                });
        }, DEBOUNCE_MS);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [query, category, privacy.active, retryKey]);

    return (
        <div className="search-panel">
            <Input
                label="搜索"
                placeholder="搜索电影、剧集、动漫标题"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                data-autofocus
            />
            <div className="search-filters" role="group" aria-label="搜索分类">
                <button
                    type="button"
                    className={`search-filter ${category === 'all' ? 'search-filter--active' : ''}`}
                    aria-pressed={category === 'all'}
                    onClick={() => setCategory('all')}
                >
                    全部
                </button>
                {LIBRARY_CATEGORIES.map((value) => (
                    <button
                        key={value}
                        type="button"
                        className={`search-filter ${category === value ? 'search-filter--active' : ''}`}
                        aria-pressed={category === value}
                        onClick={() => setCategory(value)}
                    >
                        {CATEGORY_META[value].label}
                    </button>
                ))}
            </div>
            <p className="search-panel__hint">
                按标题搜索（含剧集名），不支持按文件名搜索；结果最多 {SEARCH_LIMIT} 条，分类过滤基于媒体源内容类型。
            </p>
            {state.status === 'idle' ? (
                <>
                    {recent.length > 0 ? (
                        <div className="search-recent" aria-label="最近搜索">
                            <span className="search-recent__label">最近搜索（仅本次弹层）</span>
                            {recent.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    className="search-recent__item"
                                    onClick={() => setQuery(item)}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    <EmptyState
                        icon={<SearchIcon size={22} />}
                        title="输入关键词开始搜索"
                        description="搜索会直接查询本地媒体库目录，输入即搜（300ms 防抖）。"
                    />
                </>
            ) : null}
            {state.status === 'loading' ? (
                <div className="search-panel__results" aria-hidden="true">
                    <Skeleton variant="text" />
                    <Skeleton variant="text" />
                    <Skeleton variant="text" />
                </div>
            ) : null}
            {state.status === 'error' ? (
                <ErrorState title="搜索失败" description={state.message} onRetry={() => setRetryKey((value) => value + 1)} />
            ) : null}
            {state.status === 'success' && state.cards.length === 0 ? (
                <EmptyState
                    icon={<SearchIcon size={22} />}
                    title="未找到匹配内容"
                    description="试试更短的关键词、切换分类，或确认媒体库已完成扫描与收录。"
                />
            ) : null}
            {state.status === 'success' && state.cards.length > 0 ? (
                <>
                    <p className="search-panel__count">
                        匹配 {state.total} 条，当前显示前 {state.cards.length} 条
                    </p>
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
                    <div className="search-panel__more">
                        <Link
                            to={ROUTES.librarySearch(keyword)}
                            className="search-panel__more-link"
                            onClick={onNavigate}
                        >
                            在全部媒体中查看“{keyword}”
                        </Link>
                    </div>
                </>
            ) : null}
        </div>
    );
}
