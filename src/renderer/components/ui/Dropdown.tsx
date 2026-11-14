import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDownIcon } from '../icons';

export type DropdownItem = {
    id: string;
    label: string;
    icon?: ReactNode;
    danger?: boolean;
    disabled?: boolean;
    onSelect: () => void;
};

export interface DropdownProps {
    label: ReactNode;
    items: DropdownItem[];
    align?: 'start' | 'end';
    ariaLabel?: string;
}

export function Dropdown({ label, items, align = 'start', ariaLabel }: DropdownProps) {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    const close = useCallback((restoreFocus = true) => {
        setOpen(false);
        setActiveIndex(-1);
        if (restoreFocus) {
            triggerRef.current?.focus();
        }
    }, []);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onPointerDown = (event: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                close(false);
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open, close]);

    useEffect(() => {
        if (open) {
            const menu = menuRef.current;
            const first = menu?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
            first?.focus();
            setActiveIndex(items.findIndex((item) => !item.disabled));
        }
    }, [open, items]);

    const move = useCallback(
        (direction: 1 | -1) => {
            const enabled = items.map((item, index) => ({ item, index })).filter(({ item }) => !item.disabled);
            if (enabled.length === 0) {
                return;
            }
            const currentPos = enabled.findIndex(({ index }) => index === activeIndex);
            const nextPos = currentPos < 0 ? 0 : (currentPos + direction + enabled.length) % enabled.length;
            const next = enabled[nextPos].index;
            setActiveIndex(next);
            menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[next]?.focus();
        },
        [activeIndex, items]
    );

    return (
        <div className="ui-dropdown" ref={rootRef}>
            <button
                type="button"
                ref={triggerRef}
                className={`ui-dropdown__trigger${open ? ' ui-dropdown__trigger--open' : ''}`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-label={ariaLabel}
                onClick={() => setOpen((value) => !value)}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
            >
                <span className="ui-dropdown__label">{label}</span>
                <ChevronDownIcon size={14} className="ui-dropdown__chevron" />
            </button>
            {open ? (
                <div
                    className={`ui-dropdown__menu ui-dropdown__menu--${align}`}
                    role="menu"
                    id={menuId}
                    aria-label={ariaLabel}
                    ref={menuRef}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            close();
                        } else if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            move(1);
                        } else if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            move(-1);
                        }
                    }}
                >
                    {items.map((item, index) => (
                        <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            className={[
                                'ui-dropdown__item',
                                item.danger ? 'ui-dropdown__item--danger' : '',
                                index === activeIndex ? 'ui-dropdown__item--active' : '',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            disabled={item.disabled}
                            tabIndex={index === activeIndex ? 0 : -1}
                            onClick={() => {
                                close();
                                item.onSelect();
                            }}
                        >
                            {item.icon ? <span className="ui-dropdown__item-icon" aria-hidden="true">{item.icon}</span> : null}
                            <span className="ui-dropdown__item-label">{item.label}</span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
