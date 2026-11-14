import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '../components/ui/Button';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        window.log?.error?.('UI 2.0 渲染错误:', error.message, info.componentStack ?? '');
    }

    render() {
        if (this.state.error) {
            return (
                <div className="app-error-boundary" role="alert">
                    <h1>界面出现错误</h1>
                    <p>{this.state.error.message}</p>
                    <Button variant="primary" onClick={() => window.location.reload()}>
                        重新加载
                    </Button>
                </div>
            );
        }
        return this.props.children;
    }
}
