import { Link } from 'react-router-dom';
import { CATEGORY_META, LIBRARY_CATEGORIES, ROUTES } from '../../app/routes';

export function CategoryQuickLinks() {
    return (
        <div className="home-chips" aria-label="分类快捷入口">
            {LIBRARY_CATEGORIES.map((category) => (
                <Link key={category} to={ROUTES.library(category)} className="home-chip">
                    {CATEGORY_META[category].label}
                </Link>
            ))}
        </div>
    );
}
