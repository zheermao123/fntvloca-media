import { PosterImage } from '../../components/media/PosterImage';
import { toFileUrl } from '../../utils/fileUrl';
import { MetadataLine } from './MetadataLine';
import { PrimaryActions } from './PrimaryActions';
import { DetailActions } from './DetailActions';
import { DetailScrapeActions } from './DetailScrapeActions';
import type { MediaDetailModel } from './detail.types';

export interface ScrapeTarget {
    itemId: string;
    title: string;
    year: number | null;
}

export function DetailHero({
    model,
    onChanged,
    scrapeTarget,
}: {
    model: MediaDetailModel;
    onChanged: () => void;
    scrapeTarget?: ScrapeTarget | null;
}) {
    return (
        <div className="detail-hero">
            {model.backdrop ? (
                <div className="detail-hero__backdrop" aria-hidden="true">
                    <img src={toFileUrl(model.backdrop)} alt="" draggable={false} />
                </div>
            ) : null}
            <div className="detail-hero__poster">
                <PosterImage src={model.poster} alt={model.title} />
            </div>
            <div className="detail-hero__body">
                <h2 className="detail-hero__title">{model.title}</h2>
                <MetadataLine items={model.meta} />
                <PrimaryActions targetId={model.playTargetId} label={model.playLabel} />
                <DetailActions model={model} onChanged={onChanged} />
                {scrapeTarget ? (
                    <DetailScrapeActions
                        itemId={scrapeTarget.itemId}
                        title={scrapeTarget.title}
                        year={scrapeTarget.year}
                        onChanged={onChanged}
                    />
                ) : null}
            </div>
        </div>
    );
}
