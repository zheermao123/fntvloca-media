import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { addSource, pickFolder } from '../../services/library/sourcesService';
import type { AddSourceInput } from '../../services/library/sourcesService';

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
    onAdded: (sourceId: string) => void;
}) {
    const [type, setType] = useState<'local' | 'webdav'>('local');
    const [name, setName] = useState('');
    const [rootPath, setRootPath] = useState('');
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
            const paths = await pickFolder(false);
            if (paths.length > 0) {
                setRootPath(paths[0]);
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
        if (type === 'local') {
            if (!rootPath.trim()) {
                setError('请选择扫描目录');
                return;
            }
            input.rootPath = rootPath.trim();
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
            const source = await addSource(input);
            onAdded(source.id);
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
                                选择文件夹…
                            </Button>
                        </div>
                        <Input
                            label="扫描目录"
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
