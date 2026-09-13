export function isMpvPlaybackEnabled(value: unknown): boolean {
    // Preserve the historical MPV default while still treating malformed values
    // as disabled rather than accepting truthy strings or numbers.
    return value === undefined || value === true;
}
