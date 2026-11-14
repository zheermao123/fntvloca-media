import { MediaCard } from '../../components/media/MediaCard';
import type { MediaCardModel } from '../../services/library/library.types';

export function MediaGrid({ cards }: { cards: MediaCardModel[] }) {
    return (
        <div className="media-grid">
            {cards.map((card) => (
                <MediaCard key={card.key} model={card} />
            ))}
        </div>
    );
}
