import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { StarIcon } from '../../components/icons';
import { setFavorite, setWatched } from '../../services/media/mediaService';
import type { MediaDetailModel } from './detail.types';

export function DetailActions({ model, onChanged }: { model: MediaDetailModel; onChanged: () => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const run = async (task: () => Promise<void>) => {
        if (busy) {
            return;
        }
        setBusy(true);
        setError('');
        try {
            await task();
            onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : '操作失败');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="detail-actions">
            {model.watchedItemId ? (
                <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                        void run(() => setWatched(model.watchedItemId as string, !model.watched))
                    }
                >
                    {model.watched ? '标记未看' : model.kind === 'season' ? '标记本集已看' : '标记已看'}
                </Button>
            ) : null}
            {model.favoriteTarget ? (
                <Button
                    variant="secondary"
                    iconLeft={<StarIcon size={14} />}
                    disabled={busy}
                    onClick={() =>
                        void run(() =>
                            setFavorite(
                                model.favoriteTarget!.type,
                                model.favoriteTarget!.id,
                                !model.favorite,
                                model.favoriteTarget!.season
                            )
                        )
                    }
                >
                    {model.favorite ? '取消收藏' : '收藏'}
                </Button>
            ) : null}
            {error ? (
                <span className="ui-field__error" role="alert">
                    {error}
                </span>
            ) : null}
        </div>
    );
}
