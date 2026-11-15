import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ToastTone = 'info' | 'success' | 'error';

type ToastItem = {
    id: number;
    message: string;
    tone: ToastTone;
};

type ToastContextValue = {
    showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const TOAST_DURATION_MS = 3200;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const nextIdRef = useRef(1);
    const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

    const dismiss = useCallback((id: number) => {
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
        setItems((current) => current.filter((item) => item.id !== id));
    }, []);

    const showToast = useCallback(
        (message: string, tone: ToastTone = 'info') => {
            const trimmed = message.trim();
            if (!trimmed) {
                return;
            }
            const id = nextIdRef.current++;
            setItems((current) => [...current.slice(-2), { id, message: trimmed, tone }]);
            const timer = setTimeout(() => dismiss(id), TOAST_DURATION_MS);
            timersRef.current.set(id, timer);
        },
        [dismiss]
    );

    useEffect(() => {
        const timers = timersRef.current;
        return () => {
            for (const timer of timers.values()) {
                clearTimeout(timer);
            }
            timers.clear();
        };
    }, []);

    const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            {createPortal(
                <div className="toast-viewport" aria-live="polite" aria-atomic="false">
                    {items.map((item) => (
                        <div key={item.id} className={`toast toast--${item.tone}`} role="status">
                            <span className="toast__message">{item.message}</span>
                            <button
                                type="button"
                                className="toast__close"
                                onClick={() => dismiss(item.id)}
                                aria-label="关闭提示"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextValue {
    const value = useContext(ToastContext);
    if (!value) {
        throw new Error('useToast 必须在 ToastProvider 内使用');
    }
    return value;
}
