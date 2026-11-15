import { NavLink } from 'react-router-dom';
import { CATEGORY_META, LIBRARY_CATEGORIES, ROUTES } from '../app/routes';
import type { LibraryCategory } from '../app/routes';
import {
    FilmIcon,
    FolderIcon,
    HomeIcon,
    MoreHorizontalIcon,
    ScanIcon,
    SparklesIcon,
    TvIcon,
} from '../components/icons';
import type { ReactNode } from 'react';

const CATEGORY_ICON: Record<LibraryCategory, ReactNode> = {
    movie: <FilmIcon size={15} />,
    tv: <TvIcon size={15} />,
    anime: <SparklesIcon size={15} />,
    other: <MoreHorizontalIcon size={15} />,
};

function itemClass({ isActive }: { isActive: boolean }): string {
    return `app-nav__item${isActive ? ' app-nav__item--active' : ''}`;
}

export function PrimaryNavigation({ variant = 'primary' }: { variant?: 'primary' | 'secondary' }) {
    if (variant === 'secondary') {
        return (
            <nav className="app-nav" aria-label="管理">
                <NavLink to={ROUTES.sources} className={itemClass}>
                    <span className="app-nav__icon" aria-hidden="true">
                        <FolderIcon size={15} />
                    </span>
                    <span>媒体源</span>
                </NavLink>
                <NavLink to={ROUTES.tasks} className={itemClass}>
                    <span className="app-nav__icon" aria-hidden="true">
                        <ScanIcon size={15} />
                    </span>
                    <span>任务状态</span>
                </NavLink>
            </nav>
        );
    }

    return (
        <nav className="app-nav" aria-label="媒体分类">
            <NavLink to={ROUTES.home} className={itemClass} end>
                <span className="app-nav__icon" aria-hidden="true">
                    <HomeIcon size={15} />
                </span>
                <span>首页</span>
            </NavLink>
            {LIBRARY_CATEGORIES.map((category) => (
                <NavLink key={category} to={ROUTES.library(category)} className={itemClass}>
                    <span className="app-nav__icon" aria-hidden="true">
                        {CATEGORY_ICON[category]}
                    </span>
                    <span>{CATEGORY_META[category].label}</span>
                </NavLink>
            ))}
        </nav>
    );
}
