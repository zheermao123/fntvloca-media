import type { MetaItem } from './detail.types';

export function MetadataLine({ items }: { items: MetaItem[] }) {
    return (
        <div className="detail-meta">
            {items.map((item) => (
                <span key={`${item.label}-${item.value}`}>
                    {item.label}：{item.value}
                </span>
            ))}
        </div>
    );
}
