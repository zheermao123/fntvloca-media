import { useEffect, useState } from 'react';
import { usePrivacyState } from '../../app/PrivacyStateProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { useToast } from '../../components/ui/ToastProvider';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SettingsIcon, SparklesIcon } from '../../components/icons';
import {
    checkForUpdates,
    fetchAppVersion,
    fetchDownloadProxy,
    fetchMpvPlaybackEnabled,
    fetchScraperSettings,
    saveDownloadProxy,
    saveMpvPlaybackEnabled,
    saveScraperSettings,
} from '../../services/settings/settingsService';
import type { DownloadProxySettings, ScraperSettings } from '../../services/settings/settingsService';

const EMPTY_SCRAPER: ScraperSettings = { apiKey: '', apiBaseUrl: '', imageBaseUrl: '', language: '' };

export function SettingsPage() {
    const theme = useTheme();
    const privacy = usePrivacyState();
    const { showToast } = useToast();
    const [scraper, setScraper] = useState<ScraperSettings>(EMPTY_SCRAPER);
    const [proxy, setProxy] = useState<DownloadProxySettings>({ enabled: true, proxyUrl: '' });
    const [mpvEnabled, setMpvEnabled] = useState(true);
    const [version, setVersion] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [privacyBusy, setPrivacyBusy] = useState(false);
    const [privacyError, setPrivacyError] = useState('');

    useEffect(() => {
        let active = true;
        Promise.all([fetchScraperSettings(), fetchDownloadProxy(), fetchMpvPlaybackEnabled(), fetchAppVersion()])
            .then(([scraperSettings, proxySettings, mpv, appVersion]) => {
                if (!active) {
                    return;
                }
                setScraper(scraperSettings);
                setProxy(proxySettings);
                setMpvEnabled(mpv);
                setVersion(appVersion);
            })
            .catch((error: unknown) => {
                if (active) {
                    showToast(error instanceof Error ? error.message : '加载设置失败', 'error');
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, [showToast]);

    const saveScraper = async () => {
        setSaving(true);
        try {
            await saveScraperSettings(scraper);
            showToast('TMDB 设置已保存', 'success');
        } catch (error) {
            showToast(error instanceof Error ? error.message : '保存失败', 'error');
        } finally {
            setSaving(false);
        }
    };

    const saveProxy = async () => {
        setSaving(true);
        try {
            await saveDownloadProxy(proxy);
            showToast('代理设置已保存', 'success');
        } catch (error) {
            showToast(error instanceof Error ? error.message : '保存失败', 'error');
        } finally {
            setSaving(false);
        }
    };

    const savePlayback = async () => {
        setSaving(true);
        try {
            await saveMpvPlaybackEnabled(mpvEnabled);
            showToast('播放设置已保存', 'success');
        } catch (error) {
            showToast(error instanceof Error ? error.message : '保存失败', 'error');
        } finally {
            setSaving(false);
        }
    };

    const savePrivacyPassword = async () => {
        const trimmed = password.trim();
        if (trimmed.length < 4) {
            setPrivacyError('密码至少 4 位');
            return;
        }
        if (trimmed !== confirmPassword.trim()) {
            setPrivacyError('两次输入的密码不一致');
            return;
        }
        setPrivacyBusy(true);
        setPrivacyError('');
        const result = await privacy.setPrivacyPassword(trimmed);
        setPrivacyBusy(false);
        if (!result.success) {
            setPrivacyError(result.error || '设置失败');
            return;
        }
        setPassword('');
        setConfirmPassword('');
        showToast(privacy.hasPassword ? '隐私密码已更新' : '隐私密码已设置', 'success');
    };

    const resetPrivacyPassword = async () => {
        if (!window.confirm('重置后隐私密码将被清除，隐私库将回到未设置密码状态。确认继续？')) {
            return;
        }
        setPrivacyBusy(true);
        setPrivacyError('');
        const result = await privacy.resetPassword();
        setPrivacyBusy(false);
        if (!result.success) {
            setPrivacyError(result.error || '重置失败');
            return;
        }
        showToast('隐私密码已重置', 'success');
    };

    return (
        <section className="app-page settings-page">
            <div className="settings-page__intro">
                <SettingsIcon size={24} />
                <div>
                    <h2 className="settings-page__title">设置</h2>
                    <p className="settings-page__subtitle">外观、刮削、隐私、播放与网络选项。</p>
                </div>
            </div>

            {loading ? <p className="settings-page__loading">加载设置…</p> : null}

            <section className="settings-card">
                <h3 className="settings-card__title">外观</h3>
                <p className="settings-card__hint">主题选择会立即生效，并在下次启动时保留。</p>
                <div className="settings-segmented" role="group" aria-label="主题模式">
                    {(['light', 'dark', 'system'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            className={`settings-segmented__item ${theme.mode === mode ? 'settings-segmented__item--active' : ''}`}
                            aria-pressed={theme.mode === mode}
                            onClick={() => theme.setMode(mode)}
                        >
                            {mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '跟随系统'}
                        </button>
                    ))}
                </div>
            </section>

            <section className="settings-card">
                <h3 className="settings-card__title">TMDB 刮削</h3>
                <p className="settings-card__hint">API Key 仅保存在本机，保存时使用系统安全存储加密。</p>
                <div className="settings-form">
                    <Input
                        label="TMDB API Key"
                        type="password"
                        autoComplete="off"
                        value={scraper.apiKey}
                        onChange={(event) => setScraper({ ...scraper, apiKey: event.target.value })}
                    />
                    <Input
                        label="API 地址"
                        value={scraper.apiBaseUrl}
                        onChange={(event) => setScraper({ ...scraper, apiBaseUrl: event.target.value })}
                    />
                    <Input
                        label="图片地址"
                        value={scraper.imageBaseUrl}
                        onChange={(event) => setScraper({ ...scraper, imageBaseUrl: event.target.value })}
                    />
                    <Input
                        label="元数据语言"
                        value={scraper.language}
                        onChange={(event) => setScraper({ ...scraper, language: event.target.value })}
                    />
                </div>
                <div className="settings-card__actions">
                    <Button variant="primary" loading={saving} onClick={() => void saveScraper()}>
                        保存 TMDB 设置
                    </Button>
                </div>
            </section>

            <section className="settings-card">
                <h3 className="settings-card__title">隐私库</h3>
                <p className="settings-card__hint">
                    {privacy.available
                        ? privacy.hasPassword
                            ? '修改隐私密码不会改变当前隐私库中的内容。'
                            : '设置密码后，进入隐私模式需要先解锁。'
                        : '当前桌面环境不支持隐私模式。'}
                </p>
                <div className="settings-form settings-form--two">
                    <Input
                        label={privacy.hasPassword ? '新密码' : '密码'}
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                    <Input
                        label="确认密码"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                </div>
                {privacyError ? (
                    <p className="ui-field__error" role="alert">
                        {privacyError}
                    </p>
                ) : null}
                <div className="settings-card__actions">
                    <Button
                        variant="primary"
                        loading={privacyBusy}
                        disabled={!privacy.available}
                        onClick={() => void savePrivacyPassword()}
                    >
                        {privacy.hasPassword ? '更新隐私密码' : '设置隐私密码'}
                    </Button>
                    {privacy.hasPassword ? (
                        <Button variant="danger" loading={privacyBusy} onClick={() => void resetPrivacyPassword()}>
                            重置隐私密码
                        </Button>
                    ) : null}
                </div>
            </section>

            <section className="settings-card">
                <h3 className="settings-card__title">播放与网络</h3>
                <label className="settings-check">
                    <input
                        type="checkbox"
                        checked={mpvEnabled}
                        onChange={(event) => setMpvEnabled(event.target.checked)}
                    />
                    <span>使用 MPV 播放本地媒体</span>
                </label>
                <div className="settings-card__actions">
                    <Button variant="secondary" loading={saving} onClick={() => void savePlayback()}>
                        保存播放设置
                    </Button>
                </div>
                <div className="settings-divider" />
                <label className="settings-check">
                    <input
                        type="checkbox"
                        checked={proxy.enabled}
                        onChange={(event) => setProxy({ ...proxy, enabled: event.target.checked })}
                    />
                    <span>启用 GitHub 下载代理</span>
                </label>
                <Input
                    label="代理地址"
                    value={proxy.proxyUrl}
                    onChange={(event) => setProxy({ ...proxy, proxyUrl: event.target.value })}
                />
                <div className="settings-card__actions">
                    <Button variant="secondary" loading={saving} onClick={() => void saveProxy()}>
                        保存代理设置
                    </Button>
                </div>
            </section>

            <section className="settings-card">
                <h3 className="settings-card__title">关于</h3>
                <p className="settings-card__hint">飞牛影视 {version ? `v${version}` : ''} · GPL-3.0</p>
                <div className="settings-card__actions">
                    <Button
                        variant="secondary"
                        iconLeft={<SparklesIcon size={14} />}
                        onClick={() => {
                            checkForUpdates();
                            showToast('已发起更新检查，请留意系统弹窗', 'info');
                        }}
                    >
                        检查更新
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            void window.electronAPI?.openExternal('https://github.com/QiaoKes/fntv-electron');
                        }}
                    >
                        GitHub 项目
                    </Button>
                </div>
            </section>
        </section>
    );
}
