import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrivacyState } from '../../app/PrivacyStateProvider';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { ScanIcon, SparklesIcon } from '../../components/icons';
import { runLibraryScan } from '../../services/library/sourcesService';
import { fetchScrapeStatus, onScrapeProgress, startScrape, waitScrapeDone } from '../../services/library/tasksService';
import { formatScanResult } from '../sources/sources.mapper';
import { describeScrapeSummary, scrapePercent } from './tasks.mapper';
import { formatTaskTime } from './tasks.mapper';
import type { ScrapeProgressDto, ScrapeSummaryDto } from './tasks.mapper';
import {
    findRunningOperation,
    finishOperation,
    getOperations,
    startOperation,
    useOperationLog,
} from '../../app/operationLog';

const OPERATION_STATUS_LABEL = {
    running: '进行中',
    success: '成功',
    error: '失败',
} as const;

type StatusState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; running: boolean; lastSummary: ScrapeSummaryDto | null };

export function TasksPage() {
    const privacy = usePrivacyState();
    const [state, setState] = useState<StatusState>({ status: 'loading' });
    const [scanPending, setScanPending] = useState(false);
    const [scrapePending, setScrapePending] = useState(false);
    const [progress, setProgress] = useState<ScrapeProgressDto | null>(null);
    const [banner, setBanner] = useState('');
    const operations = useOperationLog();
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
            // 不再中止 renderer 等待：主进程任务继续运行，完成后仍写入全局操作记录。
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
            if (result.running && !findRunningOperation('scrape')) {
                startOperation({
                    kind: 'scrape',
                    title: 'TMDB 刮削',
                    summary: '检测到主进程刮削正在运行',
                    recovered: true,
                });
            } else if (!result.running) {
                for (const operation of getOperations()) {
                    if (operation.recovered && operation.kind === 'scrape' && operation.status === 'running') {
                        finishOperation(
                            operation.id,
                            'success',
                            describeScrapeSummary(result.lastSummary) ?? '主进程刮削已结束'
                        );
                    }
                }
            }
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

    const recoveredScrape = operations.find(
        (operation) => operation.recovered && operation.kind === 'scrape' && operation.status === 'running'
    );
    useEffect(() => {
        if (!recoveredScrape) {
            return;
        }
        let cancelled = false;
        const check = async () => {
            try {
                const status = await fetchScrapeStatus();
                if (!cancelled && !status.running) {
                    finishOperation(
                        recoveredScrape.id,
                        'success',
                        describeScrapeSummary(status.lastSummary) ?? '主进程刮削已结束'
                    );
                    setState({ status: 'success', running: false, lastSummary: status.lastSummary });
                }
            } catch {
                // 状态查询失败时保留 running，下一次轮询继续。
            }
        };
        const timer = window.setInterval(() => void check(), 5000);
        void check();
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [recoveredScrape]);

    const scan = async () => {
        if (scanInFlightRef.current) {
            return;
        }
        scanInFlightRef.current = true;
        const controller = new AbortController();
        scanAbortRef.current = controller;
        setScanPending(true);
        setBanner('正在扫描媒体库，完成后显示汇总…');
        const operationId = startOperation({ kind: 'scan', title: '扫描媒体库' });
        try {
            const result = await runLibraryScan(undefined, controller.signal);
            if (!controller.signal.aborted) {
                const summary = formatScanResult(result);
                finishOperation(operationId, result.error ? 'error' : 'success', summary);
                if (aliveRef.current) {
                    setBanner(summary);
                }
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                const message = `扫描失败：${error instanceof Error ? error.message : '未知错误'}`;
                finishOperation(operationId, 'error', message);
                if (aliveRef.current) {
                    setBanner(message);
                }
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
        const operationId = startOperation({ kind: 'scrape', title: 'TMDB 刮削' });
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
                const message = started.error || '无法开始刮削';
                finishOperation(operationId, 'error', message);
                if (aliveRef.current) {
                    setBanner(message);
                }
                return;
            }
            if (aliveRef.current) {
                setState({ status: 'success', running: true, lastSummary: null });
            }
            const done = await waitScrapeDone(controller.signal);
            if (!controller.signal.aborted) {
                const summary = done.error
                    ? `刮削失败：${done.error}`
                    : `刮削已完成：成功 ${done.summary?.scraped ?? 0}，失败 ${done.summary?.failed ?? 0}，跳过 ${done.summary?.skipped ?? 0}`;
                finishOperation(operationId, done.error ? 'error' : 'success', summary);
                if (aliveRef.current) {
                    setBanner(summary);
                }
            }
            if (!controller.signal.aborted) {
                await load();
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                const message = `刮削失败：${error instanceof Error ? error.message : '未知错误'}`;
                finishOperation(operationId, 'error', message);
                if (aliveRef.current) {
                    setBanner(message);
                }
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
        <section className="app-page" aria-label="库维护">
            <header className="library-page__header">
                <div>
                    <h2 className="library-page__title">库维护</h2>
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
                <ErrorState title="库维护加载失败" description={state.message} onRetry={() => void load()} />
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
                    {!privacy.active ? (
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
                    ) : null}
                </div>
            ) : null}
            {privacy.active ? (
                <p className="task-note">隐私模式：刮削不可用，仅保留媒体库扫描。</p>
            ) : null}
            {running ? (
                <p className="task-note">
                    主进程刮削正在运行；操作记录会保留，但进度百分比离开页面后无法恢复。
                </p>
            ) : null}
            <section className="task-history" aria-label="操作记录">
                <div className="task-history__header">
                    <h3 className="task-history__title">操作记录</h3>
                    <span className="task-history__hint">本次软件运行期间（关闭软件后清空）</span>
                </div>
                {operations.length === 0 ? (
                    <p className="task-history__empty">本次软件启动后暂无操作记录。</p>
                ) : (
                    <ul className="task-history__list">
                        {operations.map((operation) => {
                            const masked = operation.private && !privacy.active;
                            const summary = masked
                                ? '私有源操作（隐私模式下查看详情）'
                                : operation.target
                                  ? `${operation.target} · ${operation.summary}`
                                  : operation.summary;
                            return (
                                <li key={operation.id} className="task-history__item">
                                    <span className="task-history__kind">{operation.title}</span>
                                    <span className="task-history__time">
                                        {formatTaskTime(operation.startedAt)}
                                    </span>
                                    <span
                                        className={`task-history__status task-history__status--${operation.status}`}
                                    >
                                        {OPERATION_STATUS_LABEL[operation.status]}
                                    </span>
                                    <span className="task-history__summary">{summary}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </section>
    );
}
