import type { ReactNode } from 'react';

export interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="ui-empty-state">
            {icon ? <div className="ui-empty-state__icon" aria-hidden="true">{icon}</div> : null}
            <h3 className="ui-empty-state__title">{title}</h3>
            {description ? <p className="ui-empty-state__description">{description}</p> : null}
            {action ? <div className="ui-empty-state__action">{action}</div> : null}
        </div>
    );
}
