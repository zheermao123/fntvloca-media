import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    icon: ReactNode;
    /** 必须提供，作为按钮的无障碍名称 */
    label: string;
    size?: 'sm' | 'md';
    variant?: 'ghost' | 'secondary';
}

export function IconButton({ icon, label, size = 'md', variant = 'ghost', className, type = 'button', ...rest }: IconButtonProps) {
    const classes = ['ui-icon-button', `ui-icon-button--${size}`, `ui-icon-button--${variant}`, className ?? '']
        .filter(Boolean)
        .join(' ');
    return (
        <button {...rest} type={type} className={classes} aria-label={label} title={label}>
            <span className="ui-icon-button__icon" aria-hidden="true">{icon}</span>
        </button>
    );
}
