export function OverviewSection({ overview }: { overview: string | null }) {
    return (
        <section className="detail-section">
            <h3 className="detail-section__title">简介</h3>
            <p className="detail-overview">{overview && overview.trim().length > 0 ? overview : '暂无简介'}</p>
        </section>
    );
}
