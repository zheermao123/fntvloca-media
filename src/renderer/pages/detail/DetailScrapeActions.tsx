import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/ToastProvider';
import { SparklesIcon } from '../../components/icons';
import { applyMatch, scrapeItem, searchTmdb } from '../../services/media/mediaService';
import type { TmdbSearchResult } from '../../services/media/mediaService';

export function DetailScrapeActions({
    itemId,
    title,
    year,
    onChanged,
}: {
    itemId: string;
    title: string;
    year: number | null;
    onChanged: () => void;
}) {
    const { showToast } = useToast();
    const [busy, setBusy] = useState(false);
    const [matchOpen, setMatchOpen] = useState(false);
    const [query, setQuery] = useState(title);
    const [results, setResults] = useState<TmdbSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [applyingId, setApplyingId] = useState<number | null>(null);
    const [error, setError] = useState('');

    const rescrape = async () => {
        if (busy) {
            return;
        }
        setBusy(true);
        setError('');
        try {
            const summary = await scrapeItem(itemId);
            showToast(`重新刮削完成（${summary.scraped} 项更新）`, 'success');
            onChanged();
        } catch (err) {
            const message = err instanceof Error ? err.message : '重新刮削失败';
            setError(message);
            showToast(message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const search = async () => {
        const keyword = query.trim();
        if (!keyword || searching) {
            return;
        }
        setSearching(true);
        setError('');
        try {
            setResults(await searchTmdb(itemId, keyword, year));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'TMDB 搜索失败');
        } finally {
            setSearching(false);
        }
    };

    const apply = async (tmdbId: number) => {
        if (applyingId !== null) {
            return;
        }
        setApplyingId(tmdbId);
        setError('');
        try {
            await applyMatch(itemId, tmdbId);
            showToast('已应用 TMDB 匹配', 'success');
            setMatchOpen(false);
            onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : '应用匹配失败');
        } finally {
            setApplyingId(null);
        }
    };

    return (
        <div className="detail-scrape-actions">
            <Button variant="ghost" size="sm" loading={busy} iconLeft={<SparklesIcon size={14} />} onClick={() => void rescrape()}>
                重新刮削
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMatchOpen(true)}>
                手动匹配
            </Button>
            {error ? (
                <span className="ui-field__error" role="alert">
                    {error}
                </span>
            ) : null}
            <Dialog
                open={matchOpen}
                title="手动匹配 TMDB"
                onClose={() => {
                    if (applyingId === null) {
                        setMatchOpen(false);
                    }
                }}
            >
                <div className="detail-match">
                    <p className="detail-match__hint">
                        按标题搜索 TMDB；应用后会重新拉取元数据。剧集匹配会影响整部剧。
                    </p>
                    <div className="detail-match__search">
                        <Input
                            label="搜索关键词"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void search();
                                }
                            }}
                        />
                        <Button variant="primary" loading={searching} onClick={() => void search()}>
                            搜索
                        </Button>
                    </div>
                    {error ? (
                        <p className="ui-field__error" role="alert">
                            {error}
                        </p>
                    ) : null}
                    {results.length > 0 ? (
                        <ul className="detail-match__results">
                            {results.map((result) => (
                                <li key={result.id} className="detail-match__result">
                                    <div>
                                        <div className="detail-match__title">
                                            {result.title}
                                            {result.date ? ` (${result.date.slice(0, 4)})` : ''}
                                        </div>
                                        <div className="detail-match__meta">
                                            {result.voteAverage ? `评分 ${result.voteAverage.toFixed(1)} · ` : ''}
                                            {result.overview || '暂无简介'}
                                        </div>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        loading={applyingId === result.id}
                                        disabled={applyingId !== null}
                                        onClick={() => void apply(result.id)}
                                    >
                                        应用
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    {!searching && results.length === 0 ? (
                        <p className="detail-match__hint">输入关键词并搜索，选择正确的 TMDB 条目。</p>
                    ) : null}
                </div>
            </Dialog>
        </div>
    );
}
