import logger from '../core/logger';
import { registerHook, HookType } from '../core/hooks';
import {
    findItemGuid,
    getPlayButtonConfig,
    isSemanticPlayButton,
} from '../core/playback';

function findDetailPlayButton(): HTMLElement | null {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'));
    for (const candidate of candidates) {
        if (!isSemanticPlayButton(candidate)) continue;

        const className = typeof candidate.className === 'string' ? candidate.className.toLowerCase() : '';
        if (className.includes('play-mask') || className.includes('playmask')) continue;
        if (findItemGuid(candidate)) return candidate.closest<HTMLElement>('button, [role="button"]');
    }
    return null;
}

function interceptOriginalButton(button: HTMLElement): void {
    if (button.dataset.mpvDetailIntercepted === 'true') return;
    button.dataset.mpvDetailIntercepted = 'true';
}

async function setupDetailPlayButton(): Promise<void> {
    const button = findDetailPlayButton();
    if (!button) return;

    const config = await getPlayButtonConfig();
    if (!config.hideOriginalPlayButton) return;
    interceptOriginalButton(button);
}

function handleSetup(): void {
    setupDetailPlayButton().catch((error: unknown) => {
        logger.error('设置 MPV 播放按钮失败:', error);
    });
}

registerHook(HookType.OnReady, handleSetup);
registerHook(HookType.OnDomChange, handleSetup);

export {};
