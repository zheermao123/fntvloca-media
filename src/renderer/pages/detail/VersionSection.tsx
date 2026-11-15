import { Button } from '../../components/ui/Button';
import { PlayIcon } from '../../components/icons';
import { playLibraryItem } from '../../services/media/mediaService';
import type { MovieVersionModel } from './detail.types';

export function VersionSection({ versions }: { versions: MovieVersionModel[] }) {
    if (versions.length <= 1) {
        return null;
    }
    return (
        <section className="detail-section">
            <h3 className="detail-section__title">版本（{versions.length}）</h3>
            <div className="detail-versions">
                {versions.map((version) => (
                    <div key={version.id} className="detail-version">
                        <div className="detail-version__main">
                            <div className="detail-version__name">{version.fileName}</div>
                            <div className="detail-version__meta">
                                {version.resolution ? `${version.resolution.toUpperCase()} · ` : ''}
                                {version.sizeLabel}
                            </div>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={<PlayIcon size={13} />}
                            onClick={() => playLibraryItem(version.id)}
                        >
                            播放此版本
                        </Button>
                    </div>
                ))}
            </div>
        </section>
    );
}
