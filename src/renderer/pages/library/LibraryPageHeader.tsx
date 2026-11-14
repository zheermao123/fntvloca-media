export function LibraryPageHeader({ title, count, capped }: { title: string; count: number; capped: boolean }) {
    return (
        <div className="library-page__header">
            <h2 className="library-page__title">{title}</h2>
            <span className="library-page__count">
                {count}
                {capped ? '+' : ''} 部 / 季
            </span>
        </div>
    );
}
