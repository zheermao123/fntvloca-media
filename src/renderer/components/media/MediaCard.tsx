import { memo } from 'react';
import { Link } from 'react-router-dom';
import { PosterImage } from './PosterImage';
import type { MediaCardModel } from '../../services/library/library.types';

export const MediaCard = memo(function MediaCard({ model }: { model: MediaCardModel }) {
    return (
        <Link to={model.route} className="media-card" aria-label={`${model.title} 详情`}>
            <div className="media-card__poster">
                <PosterImage src={model.poster} alt={model.title} />
                {model.badges.map((badge) => (
                    <span key={badge} className="media-card__badge">
                        {badge}
                    </span>
                ))}
            </div>
            <div className="media-card__name">{model.title}</div>
            <div className="media-card__meta">
                {model.subtitle ? <span>{model.subtitle}</span> : null}
                {model.year ? <span>{model.year}</span> : null}
                <span>{model.statusText}</span>
            </div>
        </Link>
    );
});
