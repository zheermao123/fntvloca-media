import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrivacyState } from '../../app/PrivacyStateProvider';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { FolderIcon, LockIcon } from '../../components/icons';
import { fetchSources, runLibraryScan } from '../../services/library/sourcesService';
import { formatScanResult, toSourceRows } from './sources.mapper';
import type { SourceDto, SourceRowModel } from './sources.mapper';

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; rows: SourceRowModel[]; locked: boolean };

export function SourcesPage() {
    const privacy = usePrivacyState();
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const [scanningId, setScanningId] = useState<string | null>(null);
    const [banner, setBanner] = useState('');
    const aliveRef = useRef(true);
    const requestSeqRef = useRef(0);
    const scanAbortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
            scanAbortRef.current?.abort();
            scanAbortRef.current = null;
        };
    }, []);

    const load = useCallback(async () => {
        const seq = ++requestSeqRef.current;
        setState({ status: 'loading' });
        try {
            const result = await fetchSources(privacy.active);
            if (!aliveRef.current || requestSeqRef.current !== seq) {
                return;
            }
            setState({
                status: 'success',
                rows: toSourceRows(result.sources as SourceDto[], privacy.active),
                locked: result.locked,
            });
        } catch (error) {
            if (!aliveRef.current || requestSeqRef.current !== seq) {
                return;
            }
            setState({ status: 'error', message: error instanceof Error ? error.message : '加载失败' });
        }
    }, [privacy.active]);

    useEffect(() => {
        void load();
    }, [load]);

    const rescan = async (sourceId: string) => {
        if (scanningId) {
            return;
        }
        const controller = new AbortController();
        scanAbortRef.current = controller;
        setScanningId(sourceId);
        setBanner('正在扫描，完成后显示结果…');
        try {
            const result = await runLibraryScan(sourceId, controller.signal);
            if (aliveRef.current && !controller.signal.aborted) {
                setBanner(formatScanResult(result));
                await load();
            }
        } catch (error) {
            if (aliveRef.current && !controller.signal.aborted) {
                setBanner(`扫描失败：${error instanceof Error ? error.message : '未知错误'}`);
            }
        } finally {
            if (scanAbortRef.current === controller) {
                scanAbortRef.current = null;
            }
            if (aliveRef.current && !controller.signal.aborted) {
                setScanningId(null);
            }
        }
    };

    return (
        <section className="app-page" aria-label="媒体源">
            <header className="library-page__header">
                <div>
                    <h2 className="library-page__title">媒体源</h2>
                    <p className="library-page__count">
                        {state.status === 'success' ? `共 ${state.rows.length} 个源` : '正在加载…'}
                    </p>
                </div>
            </header>
            {privacy.active ? (
                <div className="task-banner">
                    <LockIcon size={13} /> 隐私模式：地址已隐藏，仅显示隐私源。
                </div>
            ) : null}
            {banner ? (
                <div className="task-banner" role="status">
                    {banner}
                </div>
            ) : null}
            {state.status === 'loading' ? (
                <div className="sources-list" aria-hidden="true">
                    <Skeleton variant="text" />
                    <Skeleton variant="text" />
                    <Skeleton variant="text" />
                </div>
            ) : null}
            {state.status === 'error' ? (
                <ErrorState title="媒体源加载失败" description={state.message} onRetry={() => void load()} />
            ) : null}
            {state.status === 'success' && state.rows.length === 0 ? (
                <EmptyState
                    icon={<FolderIcon size={22} />}
                    title={state.locked ? '隐私库未解锁' : '暂无媒体源'}
                    description={
                        state.locked
                            ? '请先在侧边栏解锁隐私库后再查看隐私源。'
                            : '请在经典界面「设置 → 媒体库」中添加媒体源；此处仅用于查看与重新扫描。'
                    }
                />
            ) : null}
            {state.status === 'success' && state.rows.length > 0 ? (
                <div className="sources-list">
                    {state.rows.map((row) => (
                        <div className="source-row" key={row.id}>
                            <div className="source-row__main">
                                <div className="source-row__name">{row.name}</div>
                                <div className="source-row__meta">
                                    {row.typeLabel} · {row.location}
                                </div>
                                <div className="source-row__meta">
                                    上次扫描：{row.lastScanLabel}
                                </div>
                            </div>
                            <div className="source-row__count">{row.itemCount} 个条目</div>
                            <div className="source-row__actions">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={scanningId !== null}
                                    onClick={() => void rescan(row.id)}
                                >
                                    {scanningId === row.id ? '扫描中…' : '重新扫描'}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </section>
    );
}
