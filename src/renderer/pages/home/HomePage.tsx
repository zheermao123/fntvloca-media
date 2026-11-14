import { EmptyState } from '../../components/ui/EmptyState';
import { FilmIcon } from '../../components/icons';

export function HomePage() {
    return (
        <section className="app-page">
            <EmptyState
                icon={<FilmIcon size={26} />}
                title="首页即将接入"
                description="媒体概览、最近入库与分类快捷入口将在 P2-03 阶段接入真实数据。"
            />
        </section>
    );
}
