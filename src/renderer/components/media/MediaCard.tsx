import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PosterImage } from './PosterImage';
import { StarIcon } from '../icons';
import { setFavorite } from '../../services/media/mediaService';
import type { MediaCardModel } from '../../services/library/library.types';

export const MediaCard = memo(function MediaCard({ model }: { model: MediaCardModel }) {
    const [favorite, setFavoriteState] = useState(model.favorite === true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setFavoriteState(model.favorite === true);
    }, [model.favorite, model.key]);

    const toggle = async () => {
        const target = model.favoriteTarget;
        if (!target || busy) {
            return;
        }
        setBusy(true);
        const next = !favorite;
        try {
            await setFavorite(target.type, target.id, next, target.season);
            setFavoriteState(next);
        } catch {
            // 失败时保持原状态，刷新目录后可重试
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="media-card-wrap">
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
            {model.favoriteTarget ? (
                <button
                    type="button"
                    className={`media-card__favorite${favorite ? ' media-card__favorite--active' : ''}`}
                    aria-label={favorite ? '取消收藏' : '收藏'}
                    aria-pressed={favorite}
                    disabled={busy}
                    onClick={() => void toggle()}
                >
                    <StarIcon size={14} />
                </button>
            ) : null}
        </div>
    );
});
