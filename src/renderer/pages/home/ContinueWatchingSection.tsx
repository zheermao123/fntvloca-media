import { MediaCard } from '../../components/media/MediaCard';
import type { MediaCardModel } from '../../services/library/library.types';

export function ContinueWatchingSection({ items }: { items: MediaCardModel[] }) {
    if (items.length === 0) {
        return null;
    }
    return (
        <section className="home-section" aria-label="继续观看">
            <h3 className="home-section__title">继续观看</h3>
            <div className="media-grid">
                {items.map((model) => (
                    <MediaCard key={model.key} model={model} />
                ))}
            </div>
        </section>
    );
}
