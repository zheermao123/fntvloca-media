import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { ScanIcon, SparklesIcon } from '../../components/icons';
import { runLibraryScan } from '../../services/library/sourcesService';
import { fetchScrapeStatus, onScrapeProgress, startScrape, waitScrapeDone } from '../../services/library/tasksService';
import { formatScanResult } from '../sources/sources.mapper';
import { describeScrapeSummary, scrapePercent } from './tasks.mapper';
import type { ScrapeProgressDto, ScrapeSummaryDto } from './tasks.mapper';

type StatusState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; running: boolean; lastSummary: ScrapeSummaryDto | null };

export function TasksPage() {
    const [state, setState] = useState<StatusState>({ status: 'loading' });
    const [scanPending, setScanPending] = useState(false);
    const [scrapePending, setScrapePending] = useState(false);
    const [progress, setProgress] = useState<ScrapeProgressDto | null>(null);
    const [banner, setBanner] = useState('');
    const aliveRef = useRef(true);
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const requestSeqRef = useRef(0);
    const scanInFlightRef = useRef(false);
    const scrapeInFlightRef = useRef(false);
    const scanAbortRef = useRef<AbortController | null>(null);
    const scrapeAbortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
            unsubscribeRef.current?.();
            unsubscribeRef.current = null;
            scanAbortRef.current?.abort();
            scrapeAbortRef.current?.abort();
            scanAbortRef.current = null;
            scrapeAbortRef.current = null;
        };
    }, []);

    const load = useCallback(async () => {
        const seq = ++requestSeqRef.current;
        setState({ status: 'loading' });
        try {
            const result = await fetchScrapeStatus();
            if (!aliveRef.current || requestSeqRef.current !== seq) {
                return;
            }
            setState({ status: 'success', running: result.running, lastSummary: result.lastSummary });
        } catch (error) {
            if (!aliveRef.current || requestSeqRef.current !== seq) {
                return;
            }
            setState({ status: 'error', message: error instanceof Error ? error.message : '加载失败' });
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const scan = async () => {
        if (scanInFlightRef.current) {
            return;
        }
        scanInFlightRef.current = true;
        const controller = new AbortController();
        scanAbortRef.current = controller;
        setScanPending(true);
        setBanner('正在扫描媒体库，完成后显示汇总…');
        try {
            const result = await runLibraryScan(undefined, controller.signal);
            if (aliveRef.current && !controller.signal.aborted) {
                setBanner(formatScanResult(result));
            }
        } catch (error) {
            if (aliveRef.current && !controller.signal.aborted) {
                setBanner(`扫描失败：${error instanceof Error ? error.message : '未知错误'}`);
            }
        } finally {
            scanInFlightRef.current = false;
            if (scanAbortRef.current === controller) {
                scanAbortRef.current = null;
            }
            if (aliveRef.current && !controller.signal.aborted) {
                setScanPending(false);
            }
        }
    };

    const scrape = async () => {
        if (scrapeInFlightRef.current) {
            return;
        }
        scrapeInFlightRef.current = true;
        const controller = new AbortController();
        scrapeAbortRef.current = controller;
        setScrapePending(true);
        setBanner('');
        setProgress(null);
        unsubscribeRef.current?.();
        unsubscribeRef.current = onScrapeProgress((value) => {
            if (aliveRef.current) {
                setProgress(value);
            }
        });
        try {
            const started = await startScrape(controller.signal);
            if (controller.signal.aborted) {
                return;
            }
            if (!started.started) {
                if (aliveRef.current) {
                    setBanner(started.error || '无法开始刮削');
                }
                return;
            }
            if (aliveRef.current) {
                setState({ status: 'success', running: true, lastSummary: null });
            }
            const done = await waitScrapeDone(controller.signal);
            if (aliveRef.current && !controller.signal.aborted) {
                if (done.error) {
                    setBanner(`刮削失败：${done.error}`);
                } else {
                    setBanner(`刮削已完成：成功 ${done.summary?.scraped ?? 0}，失败 ${done.summary?.failed ?? 0}，跳过 ${done.summary?.skipped ?? 0}`);
                }
            }
            if (!controller.signal.aborted) {
                await load();
            }
        } catch (error) {
            if (aliveRef.current && !controller.signal.aborted) {
                setBanner(`刮削失败：${error instanceof Error ? error.message : '未知错误'}`);
            }
        } finally {
            scrapeInFlightRef.current = false;
            if (scrapeAbortRef.current === controller) {
                scrapeAbortRef.current = null;
            }
            unsubscribeRef.current?.();
            unsubscribeRef.current = null;
            if (aliveRef.current && !controller.signal.aborted) {
                setScrapePending(false);
                setProgress(null);
            }
        }
    };

    const running = state.status === 'success' ? state.running : false;
    const summaryText = state.status === 'success' ? describeScrapeSummary(state.lastSummary) : null;

    return (
        <section className="app-page" aria-label="任务状态">
            <header className="library-page__header">
                <div>
                    <h2 className="library-page__title">任务状态</h2>
                    <p className="library-page__count">扫描与 TMDB 刮削（数据来自既有主进程任务）</p>
                </div>
            </header>
            {progress ? (
                <div className="task-banner" role="status">
                    正在刮削：{progress.title || '准备中'}（{progress.done}/{progress.total}）
                </div>
            ) : null}
            {banner ? (
                <div className="task-banner" role="status">
                    {banner}
                </div>
            ) : null}
            {state.status === 'loading' ? (
                <div className="tasks-grid" aria-hidden="true">
                    <Skeleton variant="text" />
                    <Skeleton variant="text" />
                </div>
            ) : null}
            {state.status === 'error' ? (
                <ErrorState title="任务状态加载失败" description={state.message} onRetry={() => void load()} />
            ) : null}
            {state.status === 'success' ? (
                <div className="tasks-grid">
                    <div className="task-card">
                        <h3 className="task-card__title">扫描媒体库</h3>
                        <p className="task-card__desc">
                            重新扫描所有本地媒体源，添加新文件并清理失效条目。扫描不提供实时进度，完成后显示汇总。
                        </p>
                        <div className="task-card__actions">
                            <Button
                                variant="primary"
                                iconLeft={<ScanIcon size={14} />}
                                disabled={scanPending || running}
                                onClick={() => void scan()}
                            >
                                {scanPending ? '扫描中…' : '开始扫描'}
                            </Button>
                        </div>
                    </div>
                    <div className="task-card">
                        <h3 className="task-card__title">TMDB 刮削</h3>
                        <p className="task-card__desc">
                            {running
                                ? '刮削任务正在进行中…'
                                : summaryText ?? '尚未执行过刮削。刮削需要先在设置中配置 TMDB API Key。'}
                        </p>
                        {progress ? (
                            <div className="task-progress">
                                <progress value={progress.done} max={Math.max(progress.total, 1)}>
                                    {scrapePercent(progress)}%
                                </progress>
                                <span>
                                    {progress.title || '准备中'} · {scrapePercent(progress)}%
                                </span>
                            </div>
                        ) : null}
                        <div className="task-card__actions">
                            <Button
                                variant="primary"
                                iconLeft={<SparklesIcon size={14} />}
                                disabled={scrapePending || running || scanPending}
                                onClick={() => void scrape()}
                            >
                                {running || scrapePending ? '刮削中…' : '开始刮削'}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
