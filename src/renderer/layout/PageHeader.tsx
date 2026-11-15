import { MenuIcon, MoonIcon, SearchIcon, SunIcon } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';

function isMacPlatform(): boolean {
    if (typeof navigator === 'undefined') {
        return false;
    }
    return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
}

export interface PageHeaderProps {
    title: string;
    breadcrumb?: string;
    onSearchOpen: () => void;
    onMenuOpen?: () => void;
}

export function PageHeader({ title, breadcrumb, onSearchOpen, onMenuOpen }: PageHeaderProps) {
    const theme = useTheme();
    const shortcut = isMacPlatform() ? '⌘ K' : 'Ctrl K';
    const dark = theme.resolved === 'dark';
    return (
        <header className="app-header">
            {onMenuOpen ? (
                <button
                    type="button"
                    className="app-mobile-menu"
                    onClick={onMenuOpen}
                    aria-label="打开导航菜单"
                >
                    <MenuIcon size={16} />
                </button>
            ) : null}
            {breadcrumb ? <span className="app-header__breadcrumb">{breadcrumb} /</span> : null}
            <h1 className="app-header__title">{title}</h1>
            <div className="app-header__spacer" />
            <button
                type="button"
                className="app-theme-toggle"
                onClick={() => theme.setMode(dark ? 'light' : 'dark')}
                aria-label={dark ? '切换到亮色主题' : '切换到暗色主题'}
                title={dark ? '切换到亮色主题' : '切换到暗色主题'}
            >
                {dark ? <SunIcon size={15} /> : <MoonIcon size={15} />}
            </button>
            <button type="button" className="app-search-trigger" onClick={onSearchOpen} aria-label="打开全局搜索">
                <SearchIcon size={14} />
                <span>搜索</span>
                <kbd>{shortcut}</kbd>
            </button>
        </header>
    );
}
