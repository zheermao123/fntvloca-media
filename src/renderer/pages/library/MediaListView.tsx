import { Link } from 'react-router-dom';
import { PosterImage } from '../../components/media/PosterImage';
import type { MediaRowModel } from './library.mapper';

export function MediaListView({ rows }: { rows: MediaRowModel[] }) {
    return (
        <div className="library-list">
            {rows.map((row) => (
                <Link key={row.key} to={row.route} className="media-row">
                    <div className="media-row__poster">
                        <PosterImage src={row.poster} alt={row.title} />
                    </div>
                    <div className="media-row__body">
                        <div className="media-row__title">{row.title}</div>
                        <div className="media-row__meta">
                            {row.meta.map((part) => (
                                <span key={part}>{part}</span>
                            ))}
                        </div>
                    </div>
                    <div className="media-row__status">{row.statusText}</div>
                </Link>
            ))}
        </div>
    );
}
