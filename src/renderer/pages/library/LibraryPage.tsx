import { Navigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilmIcon } from '../../components/icons';
import { CATEGORY_META, resolveCategoryFromSegment } from '../../app/routes';

export function LibraryPage() {
    const { category: segment } = useParams();
    const category = resolveCategoryFromSegment(segment);
    if (!category) {
        return <Navigate to="/home" replace />;
    }
    return (
        <section className="app-page" aria-label={`${CATEGORY_META[category].label}媒体库`}>
            <EmptyState
                icon={<FilmIcon size={26} />}
                title={`${CATEGORY_META[category].label}媒体库即将接入`}
                description="媒体列表、排序与筛选将在 P2-04 阶段接入真实业务数据。"
            />
        </section>
    );
}
