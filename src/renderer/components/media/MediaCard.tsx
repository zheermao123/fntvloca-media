import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PosterImage } from './PosterImage';
import { PlayIcon, StarIcon } from '../icons';
import { useToast } from '../ui/ToastProvider';
import { setFavorite } from '../../services/media/mediaService';
import type { MediaCardModel } from '../../services/library/library.types';

export const MediaCard = memo(function MediaCard({ model }: { model: MediaCardModel }) {
    const { showToast } = useToast();
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
            showToast(next ? '已加入收藏' : '已取消收藏', 'success');
        } catch {
            showToast('收藏操作失败，请重试', 'error');
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
                    <span className="media-card__play" aria-hidden="true">
                        <PlayIcon size={18} />
                    </span>
                    {typeof model.progressPct === 'number' && model.progressPct > 0 ? (
                        <progress
                            className="media-card__progress"
                            max={100}
                            value={Math.min(100, Math.max(0, model.progressPct))}
                            aria-label={`观看进度 ${model.progressPct}%`}
                        />
                    ) : null}
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
