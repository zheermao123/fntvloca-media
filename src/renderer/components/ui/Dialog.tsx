import { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { IconButton } from './IconButton';
import { CloseIcon } from '../icons';

export interface DialogProps {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
}

const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, title, onClose, children, footer }: DialogProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);
    const titleId = useId();

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (!open) {
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== 'Tab' || !panelRef.current) {
                return;
            }
            const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
            if (focusable.length === 0) {
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        },
        [open, onClose]
    );

    useEffect(() => {
        if (!open) {
            return;
        }
        previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        document.addEventListener('keydown', handleKeyDown);
        const panel = panelRef.current;
        const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel;
        target?.focus();
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocused.current?.focus();
        };
    }, [open, handleKeyDown]);

    if (!open) {
        return null;
    }

    return createPortal(
        <div
            className="ui-dialog__overlay"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                className="ui-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                ref={panelRef}
            >
                <header className="ui-dialog__header">
                    <h2 className="ui-dialog__title" id={titleId}>
                        {title}
                    </h2>
                    <IconButton icon={<CloseIcon size={14} />} label="关闭" size="sm" onClick={onClose} />
                </header>
                <div className="ui-dialog__content">{children}</div>
                {footer ? <footer className="ui-dialog__footer">{footer}</footer> : null}
            </div>
        </div>,
        document.body
    );
}
