import { useEffect, useState } from 'react';
import { onceReply, sendChannel } from '../app/bridge';
import { usePrivacyState } from '../app/PrivacyStateProvider';
import { PrimaryNavigation } from './PrimaryNavigation';
import { LockIcon } from '../components/icons';

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

export function Sidebar() {
    const privacy = usePrivacyState();
    const version = useAppVersion();

    const privacyLabel = !privacy.available
        ? '隐私模式（桌面环境不可用）'
        : privacy.active
          ? '退出隐私模式'
          : '进入隐私模式';

    return (
        <aside className="app-sidebar" aria-label="主导航">
            <div className="app-brand">
                <span className="app-brand__logo" aria-hidden="true">
                    FN
                </span>
                <span className="app-brand__name">飞牛影视</span>
            </div>

            <PrimaryNavigation />

            <div className="app-sidebar__section-title">管理</div>
            <PrimaryNavigation variant="secondary" />

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

            <div className="app-sidebar__footer">{version ? `版本 ${version}` : ' '}</div>
        </aside>
    );
}
