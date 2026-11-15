import { MediaCard } from '../../components/media/MediaCard';
import type { MediaCardModel } from '../../services/library/library.types';

export function RecentlyPlayedSection({ items }: { items: MediaCardModel[] }) {
    if (items.length === 0) {
        return null;
    }
    return (
        <section className="home-section" aria-label="最近播放">
            <h3 className="home-section__title">最近播放</h3>
            <div className="media-grid">
                {items.map((model) => (
                    <MediaCard key={model.key} model={model} />
                ))}
            </div>
        </section>
    );
}
