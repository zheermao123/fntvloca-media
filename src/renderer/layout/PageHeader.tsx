import { SearchIcon } from '../components/icons';

export interface PageHeaderProps {
    title: string;
    breadcrumb?: string;
    onSearchOpen: () => void;
}

export function PageHeader({ title, breadcrumb, onSearchOpen }: PageHeaderProps) {
    return (
        <header className="app-header">
            {breadcrumb ? <span className="app-header__breadcrumb">{breadcrumb} /</span> : null}
            <h1 className="app-header__title">{title}</h1>
            <div className="app-header__spacer" />
            <button type="button" className="app-search-trigger" onClick={onSearchOpen} aria-label="打开全局搜索">
                <SearchIcon size={14} />
                <span>搜索</span>
                <kbd>Ctrl K</kbd>
            </button>
        </header>
    );
}
