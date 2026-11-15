import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    block?: boolean;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
}

export function Button({
    variant = 'secondary',
    size = 'md',
    loading = false,
    block = false,
    iconLeft,
    iconRight,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
}: ButtonProps) {
    const classes = [
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        block ? 'ui-button--block' : '',
        loading ? 'ui-button--loading' : '',
        className ?? '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <button {...rest} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined}>
            {loading ? <span className="ui-button__spinner" aria-hidden="true" /> : null}
            {iconLeft ? <span className="ui-button__icon" aria-hidden="true">{iconLeft}</span> : null}
            <span className="ui-button__label">{children}</span>
            {iconRight ? <span className="ui-button__icon" aria-hidden="true">{iconRight}</span> : null}
        </button>
    );
}
