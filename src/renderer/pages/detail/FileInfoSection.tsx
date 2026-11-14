import type { MediaDetailModel } from './detail.types';

export function FileInfoSection({ file }: { file: MediaDetailModel['file'] }) {
    return (
        <section className="detail-section">
            <h3 className="detail-section__title">文件信息</h3>
            {file ? (
                <div className="detail-file">
                    <span>文件名：{file.name}</span>
                    <span>大小：{file.sizeLabel}</span>
                    {file.resolution ? <span>清晰度：{file.resolution.toUpperCase()}</span> : null}
                </div>
            ) : (
                <p className="detail-overview">暂无文件信息</p>
            )}
        </section>
    );
}
