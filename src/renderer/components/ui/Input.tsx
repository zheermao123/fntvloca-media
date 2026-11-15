import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    { label, error, id, className, ...rest },
    ref
) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = error ? `${inputId}-error` : undefined;
    return (
        <div className={`ui-field${error ? ' ui-field--invalid' : ''}`}>
            {label ? (
                <label className="ui-field__label" htmlFor={inputId}>
                    {label}
                </label>
            ) : null}
            <input
                {...rest}
                ref={ref}
                id={inputId}
                className={['ui-input', className ?? ''].filter(Boolean).join(' ')}
                aria-invalid={error ? true : undefined}
                aria-describedby={errorId}
            />
            {error ? (
                <span className="ui-field__error" id={errorId} role="alert">
                    {error}
                </span>
            ) : null}
        </div>
    );
});
