import { Skeleton } from '../../components/ui/Skeleton';

export function LibraryLoadingState() {
    return (
        <div className="media-grid" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => (
                <div key={index} className="media-card media-card--skeleton">
                    <Skeleton variant="rect" className="media-card__skeleton-poster" />
                    <Skeleton variant="text" />
                </div>
            ))}
        </div>
    );
}
