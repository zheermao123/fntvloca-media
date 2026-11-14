import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { WindowFrame } from '../layout/WindowFrame';
import { Sidebar } from '../layout/Sidebar';
import { MainRegion } from '../layout/MainRegion';
import { PageHeader } from '../layout/PageHeader';
import { Dialog } from '../components/ui/Dialog';
import { SearchPanel } from '../pages/search/SearchPanel';
import { usePrivacyState } from './PrivacyStateProvider';
import { CATEGORY_META, ROUTES, resolveCategoryFromSegment } from './routes';

function titleForPath(pathname: string): string {
    if (pathname === '/home' || pathname === '/') {
        return '首页';
    }
    if (pathname.startsWith('/library/')) {
        const segment = pathname.split('/')[2];
        const category = resolveCategoryFromSegment(segment);
        return category ? CATEGORY_META[category].label : '媒体库';
    }
    if (pathname.startsWith('/media/')) {
        return '媒体详情';
    }
    if (pathname === '/sources') {
        return '媒体源';
    }
    if (pathname === '/tasks') {
        return '任务状态';
    }
    return '媒体库';
}

export function AppShell() {
    const location = useLocation();
    const navigate = useNavigate();
    const privacy = usePrivacyState();
    const [searchOpen, setSearchOpen] = useState(false);
    const title = useMemo(() => titleForPath(location.pathname), [location.pathname]);
    const prevPrivacyActive = useRef(privacy.active);

    useEffect(() => {
        if (prevPrivacyActive.current && !privacy.active) {
            setSearchOpen(false);
            navigate(ROUTES.home, { replace: true });
        }
        prevPrivacyActive.current = privacy.active;
    }, [privacy.active, navigate]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <div className="app-shell-root">
            <WindowFrame>
                <Sidebar />
                <MainRegion>
                    <PageHeader title={title} onSearchOpen={() => setSearchOpen(true)} />
                    <div className="app-main__scroll">
                        <Outlet />
                    </div>
                </MainRegion>
            </WindowFrame>
            <Dialog open={searchOpen} title="全局搜索" onClose={() => setSearchOpen(false)}>
                <SearchPanel onNavigate={() => setSearchOpen(false)} />
            </Dialog>
        </div>
    );
}
