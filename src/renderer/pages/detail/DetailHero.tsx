import { PosterImage } from '../../components/media/PosterImage';
import { MetadataLine } from './MetadataLine';
import { PrimaryActions } from './PrimaryActions';
import type { MediaDetailModel } from './detail.types';

export function DetailHero({ model }: { model: MediaDetailModel }) {
    return (
        <div className="detail-hero">
            <div className="detail-hero__poster">
                <PosterImage src={model.poster} alt={model.title} />
            </div>
            <div className="detail-hero__body">
                <h2 className="detail-hero__title">{model.title}</h2>
                <MetadataLine items={model.meta} />
                <PrimaryActions targetId={model.playTargetId} label={model.playLabel} />
            </div>
        </div>
    );
}
