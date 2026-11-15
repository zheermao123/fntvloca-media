import { ErrorState } from '../../components/ui/ErrorState';

export function LibraryErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return <ErrorState title="媒体库加载失败" description={message} onRetry={onRetry} />;
}
