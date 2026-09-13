import { ipcRenderer } from 'electron';
import { isMpvPlaybackEnabled } from '../../modules/fn_config/playbackPreference';
import { extractItemGuidFromUrl, isItemGuid } from './playTarget';
import type { PlayMovieData } from './types';

export interface PlayButtonConfig {
    hideOriginalPlayButton: boolean;
}

const ITEM_ATTRIBUTES = ['data-item-guid', 'data-item_guid', 'data-guid', 'data-id'];
let configPromise: Promise<PlayButtonConfig> | null = null;

export function getPlayButtonConfig(): Promise<PlayButtonConfig> {
    if (configPromise) return configPromise;

    configPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
            ipcRenderer.off('play-button-config-info', handler);
            resolve({ hideOriginalPlayButton: true });
        }, 2000);

        const handler = (_event: Electron.IpcRendererEvent, data?: Partial<PlayButtonConfig>) => {
            clearTimeout(timeout);
            ipcRenderer.off('play-button-config-info', handler);
            resolve({
                hideOriginalPlayButton: isMpvPlaybackEnabled(data?.hideOriginalPlayButton),
            });
        };

        ipcRenderer.once('play-button-config-info', handler);
        ipcRenderer.send('get-play-button-config');
    });

    return configPromise;
}

function readGuidAttribute(element: Element): string | null {
    for (const attribute of ITEM_ATTRIBUTES) {
        const value = element.getAttribute(attribute);
        if (isItemGuid(value)) return value;
    }
    return null;
}

export function findItemGuid(element: Element | null): string | null {
    let current = element;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
        const attributeGuid = readGuidAttribute(current);
        if (attributeGuid) return attributeGuid;

        if (current instanceof HTMLAnchorElement) {
            const linkGuid = extractItemGuidFromUrl(current.href);
            if (linkGuid) return linkGuid;
        }

        const link = current.querySelector<HTMLAnchorElement>('a[href]');
        if (link) {
            const linkGuid = extractItemGuidFromUrl(link.href);
            if (linkGuid) return linkGuid;
        }
    }

    return extractItemGuidFromUrl(window.location.href);
}

export function getSelectedSourceIndex(): number {
    const selectors = [
        '[data-source-index][aria-selected="true"]',
        '[data-source-index].semi-button-primary',
        'button.semi-button.\\!h-9.\\!px-6',
    ];

    for (const selector of selectors) {
        const buttons = Array.from(document.querySelectorAll<HTMLElement>(selector));
        if (buttons.length === 0) continue;

        const selected = buttons.findIndex((button) =>
            button.getAttribute('aria-selected') === 'true'
            || button.classList.contains('semi-button-primary')
        );
        const element = selected >= 0 ? buttons[selected] : buttons[0];
        const explicitIndex = Number(element.dataset.sourceIndex);
        return Number.isInteger(explicitIndex) && explicitIndex >= 0
            ? explicitIndex
            : Math.max(selected, 0);
    }

    return 0;
}

export function sendPlayEvent(itemGuid: string, sourceIndex = 0): boolean {
    const playData: PlayMovieData = { id: itemGuid, sourceIndex };
    ipcRenderer.send('play-movie', playData);
    return true;
}

const PLAY_CONTROL_SELECTOR = [
    'button',
    '[role="button"]',
    '[class*="play-mask__btn--play" i]',
    '[class*="playmask" i]',
].join(', ');

export function findSemanticPlayButton(element: Element): HTMLElement | null {
    const button = element.closest<HTMLElement>(PLAY_CONTROL_SELECTOR);
    if (!button || button.dataset.customPlay === 'true') return null;

    const className = typeof button.className === 'string' ? button.className.toLowerCase() : '';
    if (className.includes('play-mask') || className.includes('playmask')) return button;

    const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, '')
        .toLowerCase();

    if (/^(立即|继续|重新)?播放$/.test(label) || label === 'play') return button;
    if (button.querySelector('[data-icon*="play" i], [class*="play-icon" i]')) return button;

    return null;
}

export function isSemanticPlayButton(element: Element): element is HTMLElement {
    return findSemanticPlayButton(element) !== null;
}
