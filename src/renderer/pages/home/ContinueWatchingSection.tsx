import { Link } from 'react-router-dom';
import { MediaCard } from '../../components/media/MediaCard';
import { ROUTES } from '../../app/routes';
import type { MediaCardModel } from '../../services/library/library.types';

export function ContinueWatchingSection({ items, viewAll = false }: { items: MediaCardModel[]; viewAll?: boolean }) {
    if (items.length === 0) {
        return null;
    }
    return (
        <section className="home-section" aria-label="继续观看">
            <div className="home-section__header">
                <h3 className="home-section__title">继续观看</h3>
                {viewAll ? (
                    <Link to={ROUTES.continueWatching} className="home-section__more">
                        查看全部
                    </Link>
                ) : null}
            </div>
            <div className="media-grid">
                {items.map((model) => (
                    <MediaCard key={model.key} model={model} />
                ))}
            </div>
        </section>
    );
}
