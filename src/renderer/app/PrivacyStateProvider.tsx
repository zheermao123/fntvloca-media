import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { onceReply, sendChannel } from './bridge';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

type PrivacyState = {
    available: boolean;
    hasPassword: boolean;
    unlocked: boolean;
};

type PrivacyContextValue = PrivacyState & {
    /** 是否处于隐私模式（UI 层状态，与 main 解锁态联动） */
    active: boolean;
    gateOpen: boolean;
    busy: boolean;
    error: string | null;
    requestActivate: () => void;
    closeGate: () => void;
    submitPassword: (password: string) => Promise<void>;
    deactivate: () => Promise<void>;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyStateProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<PrivacyState>({ available: false, hasPassword: false, unlocked: false });
    const [active, setActive] = useState(false);
    const [gateOpen, setGateOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');

    const refresh = useCallback(async () => {
        if (!sendChannel('library:privacy-begin')) {
            return;
        }
        try {
            const data = await onceReply<{ hasPassword?: boolean; unlocked?: boolean }>('library:privacy-state');
            setState({
                available: true,
                hasPassword: data?.hasPassword === true,
                unlocked: data?.unlocked === true,
            });
            if (data?.unlocked !== true) {
                setActive(false);
            }
        } catch {
            setState({ available: false, hasPassword: false, unlocked: false });
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const requestActivate = useCallback(() => {
        if (!state.available) {
            return;
        }
        setError(null);
        setPassword('');
        if (state.unlocked) {
            setActive(true);
            return;
        }
        setGateOpen(true);
    }, [state.available, state.unlocked]);

    const closeGate = useCallback(() => {
        setGateOpen(false);
        setError(null);
        setPassword('');
    }, []);

    const submitPassword = useCallback(
        async (value: string) => {
            if (!state.available || busy) {
                return;
            }
            setBusy(true);
            setError(null);
            try {
                if (!sendChannel('library:privacy-unlock', { password: value })) {
                    setError('桌面桥接不可用');
                    return;
                }
                const result = await onceReply<{ success?: boolean; unlocked?: boolean; error?: string }>('library:privacy-result');
                if (result?.success && result.unlocked) {
                    setState((prev) => ({ ...prev, unlocked: true }));
                    setGateOpen(false);
                    setPassword('');
                    setActive(true);
                } else {
                    setError(result?.error || '解锁失败');
                }
            } catch {
                setError('解锁请求超时');
            } finally {
                setBusy(false);
            }
        },
        [state.available, busy]
    );

    const deactivate = useCallback(async () => {
        if (busy) {
            return;
        }
        setBusy(true);
        try {
            if (sendChannel('library:privacy-lock')) {
                try {
                    await onceReply('library:privacy-result');
                } catch {
                    // 忽略超时；本地状态仍然退出隐私模式
                }
            }
        } finally {
            setActive(false);
            setState((prev) => ({ ...prev, unlocked: false }));
            setBusy(false);
        }
    }, [busy]);

    const value = useMemo<PrivacyContextValue>(
        () => ({
            ...state,
            active,
            gateOpen,
            busy,
            error,
            requestActivate,
            closeGate,
            submitPassword,
            deactivate,
        }),
        [state, active, gateOpen, busy, error, requestActivate, closeGate, submitPassword, deactivate]
    );

    return (
        <PrivacyContext.Provider value={value}>
            {children}
            <Dialog
                open={gateOpen}
                title={state.hasPassword ? '进入隐私模式' : '隐私模式未设置密码'}
                onClose={closeGate}
                footer={
                    <>
                        <Button variant="ghost" onClick={closeGate}>
                            取消
                        </Button>
                        <Button
                            variant="primary"
                            loading={busy}
                            disabled={!state.hasPassword || password.length === 0}
                            onClick={() => void submitPassword(password)}
                        >
                            解锁
                        </Button>
                    </>
                }
            >
                {state.hasPassword ? (
                    <Input
                        label="密码"
                        type="password"
                        autoComplete="current-password"
                        data-autofocus
                        value={password}
                        error={error ?? undefined}
                        onChange={(event) => setPassword(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                void submitPassword(password);
                            }
                        }}
                    />
                ) : (
                    <p>尚未设置隐私密码，请先在设置中创建隐私密码后再进入。</p>
                )}
            </Dialog>
        </PrivacyContext.Provider>
    );
}

export function usePrivacyState(): PrivacyContextValue {
    const value = useContext(PrivacyContext);
    if (!value) {
        throw new Error('usePrivacyState 必须在 PrivacyStateProvider 内使用');
    }
    return value;
}
