import { Link } from 'react-router-dom';
import { CATEGORY_META, ROUTES } from '../../app/routes';
import { Skeleton } from '../../components/ui/Skeleton';
import type { HomeCategorySummary } from '../../services/library/library.types';

export function LibraryOverview({ categories }: { categories: HomeCategorySummary[] }) {
    return (
        <div className="stats-grid">
            {categories.map(({ category, count, capped }) => (
                <Link key={category} to={ROUTES.library(category)} className="stat-card">
                    <div className="stat-card__label">{CATEGORY_META[category].label}</div>
                    <div className="stat-card__value">
                        {count}
                        {capped ? '+' : ''}
                    </div>
                    <div className="stat-card__hint">部 / 季</div>
                </Link>
            ))}
        </div>
    );
}

export function LibraryOverviewSkeleton() {
    return (
        <div className="stats-grid" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="stat-card">
                    <Skeleton variant="text" className="stat-card__skeleton-label" />
                    <Skeleton variant="text" className="stat-card__skeleton-value" />
                </div>
            ))}
        </div>
    );
}
