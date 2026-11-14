import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppBootstrap } from './app/AppBootstrap';
import './styles/tokens.css';
import './styles/reset.css';
import './styles/global.css';
import './styles/components.css';
import './styles/shell.css';
import './styles/pages.css';

const container = document.getElementById('root');
if (!container) {
    throw new Error('缺少 #root 挂载节点');
}

createRoot(container).render(
    <StrictMode>
        <AppBootstrap />
    </StrictMode>
);
