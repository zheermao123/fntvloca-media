import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/ui/EmptyState';
import { ChevronLeftIcon, FilmIcon } from '../../components/icons';

export function MediaDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    return (
        <section className="app-page">
            <button type="button" className="app-back" onClick={() => navigate(-1)}>
                <ChevronLeftIcon size={14} />
                返回
            </button>
            <EmptyState
                icon={<FilmIcon size={26} />}
                title="媒体详情即将接入"
                description={`详情页将在 P2-05 阶段接入真实元数据与播放入口${id ? `（当前条目：${id}）` : ''}。`}
            />
        </section>
    );
}
