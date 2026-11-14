import { useState } from 'react';
import { FilmIcon } from '../icons';
import { toFileUrl } from '../../utils/fileUrl';

export interface PosterImageProps {
    /** 本地文件路径或 URL；为空时显示占位 */
    src?: string | null;
    alt: string;
    className?: string;
}

export function PosterImage({ src, alt, className }: PosterImageProps) {
    const [failed, setFailed] = useState(false);
    const url = toFileUrl(src);
    const showPlaceholder = !url || failed;

    return (
        <div className={['ui-poster', className ?? ''].filter(Boolean).join(' ')}>
            {showPlaceholder ? (
                <div className="ui-poster__placeholder" role="img" aria-label={alt}>
                    <FilmIcon size={22} />
                </div>
            ) : (
                <img
                    className="ui-poster__image"
                    src={url}
                    alt={alt}
                    loading="lazy"
                    draggable={false}
                    onError={() => setFailed(true)}
                />
            )}
        </div>
    );
}
