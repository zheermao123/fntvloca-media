import { Button } from './Button';

export interface ErrorStateProps {
    title?: string;
    description?: string;
    retryLabel?: string;
    onRetry?: () => void;
}

export function ErrorState({ title = '加载失败', description, retryLabel = '重试', onRetry }: ErrorStateProps) {
    return (
        <div className="ui-error-state" role="alert">
            <h3 className="ui-error-state__title">{title}</h3>
            {description ? <p className="ui-error-state__description">{description}</p> : null}
            {onRetry ? (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                    {retryLabel}
                </Button>
            ) : null}
        </div>
    );
}
