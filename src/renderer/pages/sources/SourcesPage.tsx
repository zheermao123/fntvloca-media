import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrivacyState } from '../../app/PrivacyStateProvider';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { FolderIcon, LockIcon } from '../../components/icons';
import { fetchSources, runLibraryScan, testSource, updateSource } from '../../services/library/sourcesService';
import { formatScanResult, formatSourceTestResult, toSourceRows } from './sources.mapper';
import type { SourceDto, SourceRowModel } from './sources.mapper';

const CATEGORY_OPTIONS = [
    { value: 'movie', label: '电影' },
    { value: 'tv', label: '剧集' },
    { value: 'anime', label: '动漫' },
    { value: 'other', label: '其他视频' },
];

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; rows: SourceRowModel[]; locked: boolean };

type EditForm = {
    name: string;
    category: string;
    rootPath: string;
    url: string;
    username: string;
    password: string;
    clearPassword: boolean;
};

export function SourcesPage() {
    const privacy = usePrivacyState();
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const [scanningId, setScanningId] = useState<string | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, string>>({});
    const [banner, setBanner] = useState('');
    const [editSource, setEditSource] = useState<SourceDto | null>(null);
    const [form, setForm] = useState<EditForm>({
        name: '',
        category: 'movie',
        rootPath: '',
        url: '',
        username: '',
        password: '',
        clearPassword: false,
    });
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
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

    const test = async (sourceId: string) => {
        if (testingId) {
            return;
        }
        setTestingId(sourceId);
        try {
            const result = await testSource(sourceId);
            if (aliveRef.current) {
                setTestResults((prev) => ({ ...prev, [sourceId]: formatSourceTestResult(result) }));
            }
        } catch (error) {
            if (aliveRef.current) {
                setTestResults((prev) => ({
                    ...prev,
                    [sourceId]: `连接失败：${error instanceof Error ? error.message : '未知错误'}`,
                }));
            }
        } finally {
            if (aliveRef.current) {
                setTestingId(null);
            }
        }
    };

    const openEdit = (sourceId: string) => {
        if (state.status !== 'success') {
            return;
        }
        const source = (state.rows as SourceRowModel[]).find((row) => row.id === sourceId);
        if (!source) {
            return;
        }
        void (async () => {
            const result = await fetchSources(privacy.active);
            const raw = (result.sources as SourceDto[]).find((item) => item.id === sourceId);
            if (!raw) {
                setBanner('媒体源不存在');
                return;
            }
            setForm({
                name: raw.name,
                category: raw.category ?? 'movie',
                rootPath: raw.config.rootPath ?? '',
                url: raw.config.url ?? '',
                username: raw.config.username ?? '',
                password: '',
                clearPassword: false,
            });
            setFormError('');
            setEditSource(raw);
        })();
    };

    const saveEdit = async () => {
        if (!editSource || saving) {
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            const patch: {
                id: string;
                name?: string;
                rootPath?: string;
                url?: string;
                username?: string;
                password?: string | null;
                category?: string;
            } = {
                id: editSource.id,
                name: form.name.trim(),
                category: form.category,
            };
            if (editSource.type === 'local') {
                patch.rootPath = form.rootPath.trim();
            } else if (editSource.type === 'webdav') {
                patch.url = form.url.trim();
                patch.username = form.username.trim();
                if (form.clearPassword) {
                    patch.password = null;
                } else if (form.password.length > 0) {
                    patch.password = form.password;
                }
            }
            const result = await updateSource(patch);
            if (!result.success) {
                setFormError(result.error || '更新失败');
                return;
            }
            setEditSource(null);
            setBanner('媒体源已更新');
            await load();
        } catch (error) {
            setFormError(error instanceof Error ? error.message : '更新失败');
        } finally {
            setSaving(false);
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
                            : '请在经典界面「设置 → 媒体库」中添加媒体源；此处仅用于查看、测试与重新扫描。'
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
                                <div className="source-row__meta">上次扫描：{row.lastScanLabel}</div>
                                {testResults[row.id] ? (
                                    <div className="source-row__meta" role="status">
                                        {testResults[row.id]}
                                    </div>
                                ) : null}
                            </div>
                            <div className="source-row__count">{row.itemCount} 个条目</div>
                            <div className="source-row__actions">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={testingId !== null || scanningId !== null}
                                    onClick={() => void test(row.id)}
                                >
                                    {testingId === row.id ? '测试中…' : '测试连接'}
                                </Button>
                                <Button variant="ghost" size="sm" disabled={scanningId !== null} onClick={() => openEdit(row.id)}>
                                    编辑
                                </Button>
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
            <Dialog
                open={editSource !== null}
                title="编辑媒体源"
                onClose={() => {
                    if (!saving) {
                        setEditSource(null);
                    }
                }}
                footer={
                    <>
                        <Button variant="ghost" disabled={saving} onClick={() => setEditSource(null)}>
                            取消
                        </Button>
                        <Button variant="primary" loading={saving} onClick={() => void saveEdit()}>
                            保存
                        </Button>
                    </>
                }
            >
                <div className="source-edit-form">
                    <Input
                        label="名称"
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                    <label className="source-edit-field">
                        <span className="ui-field__label">内容分类</span>
                        <select
                            className="source-edit-select"
                            value={form.category}
                            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                        >
                            {CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {editSource?.type === 'local' ? (
                        <Input
                            label="扫描目录"
                            value={form.rootPath}
                            onChange={(event) => setForm((prev) => ({ ...prev, rootPath: event.target.value }))}
                        />
                    ) : null}
                    {editSource?.type === 'webdav' ? (
                        <>
                            <Input
                                label="WebDAV 地址"
                                value={form.url}
                                onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
                            />
                            <Input
                                label="用户名"
                                value={form.username}
                                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                            />
                            <Input
                                label="密码"
                                type="password"
                                placeholder="留空保持不变"
                                value={form.password}
                                onChange={(event) =>
                                    setForm((prev) => ({ ...prev, password: event.target.value, clearPassword: false }))
                                }
                            />
                            <label className="source-edit-check">
                                <input
                                    type="checkbox"
                                    checked={form.clearPassword}
                                    onChange={(event) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            clearPassword: event.target.checked,
                                            password: event.target.checked ? '' : prev.password,
                                        }))
                                    }
                                />
                                清除已保存密码
                            </label>
                        </>
                    ) : null}
                    {formError ? (
                        <p className="ui-field__error" role="alert">
                            {formError}
                        </p>
                    ) : null}
                </div>
            </Dialog>
        </section>
    );
}
