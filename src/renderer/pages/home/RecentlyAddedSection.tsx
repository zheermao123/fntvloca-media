import { MediaCard } from '../../components/media/MediaCard';
import { Skeleton } from '../../components/ui/Skeleton';
import type { MediaCardModel } from '../../services/library/library.types';

export function RecentlyAddedSection({ items }: { items: MediaCardModel[] }) {
    if (items.length === 0) {
        return null;
    }
    return (
        <section className="home-section" aria-label="最近入库">
            <h3 className="home-section__title">最近入库</h3>
            <div className="media-grid">
                {items.map((model) => (
                    <MediaCard key={model.key} model={model} />
                ))}
            </div>
        </section>
    );
}

export function RecentlyAddedSkeleton() {
    return (
        <section className="home-section" aria-hidden="true">
            <h3 className="home-section__title">最近入库</h3>
            <div className="media-grid">
                {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="media-card media-card--skeleton">
                        <Skeleton variant="rect" className="media-card__skeleton-poster" />
                        <Skeleton variant="text" />
                    </div>
                ))}
            </div>
        </section>
    );
}
