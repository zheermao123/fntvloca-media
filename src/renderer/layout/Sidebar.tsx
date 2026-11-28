import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { onceReply, sendChannel } from '../app/bridge';
import { usePrivacyState } from '../app/PrivacyStateProvider';
import { ROUTES } from '../app/routes';
import { PrimaryNavigation } from './PrimaryNavigation';
import { LockIcon, SettingsIcon } from '../components/icons';

function useAppVersion(): string | null {
    const [version, setVersion] = useState<string | null>(null);
    useEffect(() => {
        if (!sendChannel('get-version')) {
            return;
        }
        let active = true;
        void onceReply<{ version?: string }>('version-info')
            .then((data) => {
                if (active && data?.version) {
                    setVersion(data.version);
                }
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, []);
    return version;
}

export function Sidebar({ open = false }: { open?: boolean }) {
    const privacy = usePrivacyState();
    const version = useAppVersion();

    const privacyLabel = !privacy.available
        ? '隐私模式（桌面环境不可用）'
        : privacy.active
          ? '退出隐私模式'
          : '进入隐私模式';

    return (
        <aside className={`app-sidebar${open ? ' app-sidebar--open' : ''}`} aria-label="主导航">
            <div className="app-brand">
                <span className="app-brand__logo" aria-hidden="true">
                    FN
                </span>
                <span className="app-brand__name">飞牛影视</span>
            </div>

            <div className="app-sidebar__section-title">媒体库</div>
            <PrimaryNavigation privacyActive={privacy.active} />

            <div className="app-sidebar__section-title">管理</div>
            <PrimaryNavigation variant="secondary" privacyActive={privacy.active} />

            {!privacy.active ? (
                <>
                    <div className="app-sidebar__section-title">系统</div>
                    <nav className="app-nav" aria-label="系统">
                        <NavLink
                            to={ROUTES.settings}
                            className={({ isActive }) =>
                                `app-nav__item${isActive ? ' app-nav__item--active' : ''}`
                            }
                        >
                            <span className="app-nav__icon" aria-hidden="true">
                                <SettingsIcon size={15} />
                            </span>
                            <span>设置</span>
                        </NavLink>
                    </nav>
                </>
            ) : null}

            <div className="app-sidebar__spacer" />

            <div className="app-privacy">
                <button
                    type="button"
                    className="app-nav__item"
                    disabled={!privacy.available}
                    onClick={() => {
                        if (privacy.active) {
                            void privacy.deactivate();
                        } else {
                            privacy.requestActivate();
                        }
                    }}
                >
                    <span className="app-nav__icon" aria-hidden="true">
                        <LockIcon size={15} />
                    </span>
                    <span>{privacyLabel}</span>
                </button>
                {privacy.active ? <div className="app-privacy__status">隐私库内容仅在本模式可见</div> : null}
            </div>

            <div className="app-profile">
                <span className="app-profile__avatar" aria-hidden="true">
                    FN
                </span>
                <span className="app-profile__body">
                    <span className="app-profile__name">本地媒体库</span>
                    <span className="app-profile__meta">{version ? `版本 ${version}` : ' '}</span>
                </span>
            </div>
        </aside>
    );
}
