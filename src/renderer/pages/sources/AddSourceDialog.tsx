import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { addSource, pickFolder } from '../../services/library/sourcesService';
import type { AddSourceInput } from '../../services/library/sourcesService';

function folderName(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] ?? path;
}

const CATEGORY_OPTIONS = [
    { value: '', label: '自动识别' },
    { value: 'movie', label: '电影' },
    { value: 'tv', label: '剧集' },
    { value: 'anime', label: '动漫' },
    { value: 'other', label: '其他视频' },
];

export function AddSourceDialog({
    open,
    privateMode,
    onClose,
    onAdded,
}: {
    open: boolean;
    privateMode: boolean;
    onClose: () => void;
    onAdded: (sourceIds: string[]) => void;
}) {
    const [type, setType] = useState<'local' | 'webdav'>('local');
    const [name, setName] = useState('');
    const [rootPath, setRootPath] = useState('');
    const [rootPaths, setRootPaths] = useState<string[]>([]);
    const [url, setUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [category, setCategory] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [picking, setPicking] = useState(false);

    useEffect(() => {
        if (open) {
            setType('local');
            setName('');
            setRootPath('');
            setRootPaths([]);
            setUrl('');
            setUsername('');
            setPassword('');
            setCategory('');
            setError('');
            setBusy(false);
            setPicking(false);
        }
    }, [open]);

    const pick = async () => {
        setPicking(true);
        setError('');
        try {
            const paths = await pickFolder(true);
            if (paths.length > 0) {
                setRootPaths((current) => Array.from(new Set([...current, ...paths])));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '选择文件夹失败');
        } finally {
            setPicking(false);
        }
    };

    const submit = async () => {
        if (busy) {
            return;
        }
        setError('');
        const input: AddSourceInput = {
            type,
            name: name.trim() || undefined,
            private: privateMode,
            category: privateMode ? undefined : category || undefined,
        };
        const localPaths =
            type === 'local'
                ? Array.from(new Set([...rootPaths, rootPath.trim()].filter((value) => value.length > 0)))
                : [];
        if (type === 'local') {
            if (localPaths.length === 0) {
                setError('请选择扫描目录');
                return;
            }
        } else {
            if (!url.trim()) {
                setError('请填写 WebDAV 地址');
                return;
            }
            input.url = url.trim();
            input.username = username.trim();
            input.password = password;
        }
        setBusy(true);
        try {
            if (type === 'local') {
                const ids: string[] = [];
                for (const [index, path] of localPaths.entries()) {
                    const source = await addSource({
                        ...input,
                        rootPath: path,
                        name: name.trim()
                            ? localPaths.length > 1
                                ? `${name.trim()} ${index + 1}`
                                : name.trim()
                            : folderName(path),
                    });
                    ids.push(source.id);
                }
                onAdded(ids);
            } else {
                const source = await addSource(input);
                onAdded([source.id]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '添加媒体源失败');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            title="添加媒体源"
            onClose={() => {
                if (!busy) {
                    onClose();
                }
            }}
            footer={
                <>
                    <Button variant="ghost" disabled={busy} onClick={onClose}>
                        取消
                    </Button>
                    <Button variant="primary" loading={busy} onClick={() => void submit()}>
                        添加并扫描
                    </Button>
                </>
            }
        >
            <div className="source-edit-form">
                {privateMode ? (
                    <p className="source-edit-note">隐私模式：新增源将作为隐私源，仅在隐私模式下可见。</p>
                ) : null}
                <div className="source-row__actions" role="group" aria-label="源类型">
                    <Button
                        variant={type === 'local' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setType('local')}
                    >
                        本地文件夹
                    </Button>
                    <Button
                        variant={type === 'webdav' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setType('webdav')}
                    >
                        WebDAV
                    </Button>
                </div>
                <Input label="名称（可选）" value={name} onChange={(event) => setName(event.target.value)} />
                {type === 'local' ? (
                    <>
                        <div className="source-row__actions">
                            <Button variant="secondary" loading={picking} onClick={() => void pick()}>
                                选择文件夹（可多选）…
                            </Button>
                        </div>
                        {rootPaths.length > 0 ? (
                            <ul className="source-path-list">
                                {rootPaths.map((path) => (
                                    <li key={path} className="source-path-list__item">
                                        <span>{path}</span>
                                        <button
                                            type="button"
                                            className="source-path-list__remove"
                                            aria-label={`移除 ${path}`}
                                            onClick={() =>
                                                setRootPaths((current) => current.filter((item) => item !== path))
                                            }
                                        >
                                            ×
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                        <Input
                            label="手动输入目录（可选）"
                            value={rootPath}
                            onChange={(event) => setRootPath(event.target.value)}
                        />
                    </>
                ) : (
                    <>
                        <Input
                            label="WebDAV 地址"
                            placeholder="https://nas.example:5006/dav"
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                        />
                        <Input label="用户名（可选）" value={username} onChange={(event) => setUsername(event.target.value)} />
                        <Input
                            label="密码（可选）"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                    </>
                )}
                {!privateMode ? (
                    <label className="source-edit-field">
                        <span className="ui-field__label">内容类型</span>
                        <select
                            className="source-edit-select"
                            value={category}
                            onChange={(event) => setCategory(event.target.value)}
                        >
                            {CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value || 'auto'} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : null}
                {error ? (
                    <p className="ui-field__error" role="alert">
                        {error}
                    </p>
                ) : null}
            </div>
        </Dialog>
    );
}
