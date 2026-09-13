# External Runtime Ownership

> **Scenario**: Managed MPV Bundle And Local Proxy

## 1. Scope And Trigger

Read this guideline when changing the packaged MPV runtime, MPV plugins, portable
configuration synchronization, playback defaults, or the local Go proxy lifecycle.

The Electron repository consumes a complete MPV bundle. The authoritative package
manifest and plugin versions live in `QiaoKes/fntv-mpv-config`.

## 2. Signatures

```ts
synchronizeMpvConfig(
  portableConfigDir: string,
  mpvConfigDir: string,
): 'initialized' | 'updated'

isMpvPlaybackEnabled(value: unknown): boolean

loadOrCreateProxySecret(userDataDir: string): string
```

## 3. Contracts

- Pin MPV and plugin versions only in `fntv-mpv-config/package_cfg.json`.
- Electron release packaging downloads one complete, versioned MPV bundle. It must
  not overlay files from an upstream plugin branch.
- On first initialization, seed missing portable configuration files without
  replacing files that already exist.
- On later updates, replace only the application-managed
  `scripts/uosc_danmaku` directory.
- Treat `danmaku-history.json`, `script-opts`, and unrelated scripts as user-owned.
  Preserve them byte for byte during updates.
- MPV playback is opt-in. Only the literal boolean `true` enables it; missing,
  malformed, or timed-out values select native playback.
- Store a random 32-byte proxy secret as 64 lowercase hexadecimal characters in
  `userData/proxy-secret`. Reuse it across proxy and Electron restarts.
- Create the secret atomically and restrict it to owner read/write permissions on
  POSIX systems (`0600`). Pass it through stdin or request headers only.
- Never put the proxy secret in process arguments, environment variables, URLs, or
  logs. Playback URLs contain short-lived session tokens instead.

## 4. Validation And Error Matrix

| Input or state | Required behavior |
| --- | --- |
| Portable config does not exist | Seed missing files, preserving any concurrently created file |
| Portable config already exists | Replace only managed plugin code |
| User state file is empty or malformed | Preserve it byte for byte; do not repair it during package sync |
| Playback preference is `true` | Enable MPV playback |
| Playback preference is absent, `false`, or non-boolean | Use native playback |
| Proxy secret file is absent | Generate and atomically persist a new valid secret |
| Proxy secret file is valid | Reuse the exact secret |
| Proxy secret file is malformed | Atomically replace it with a new valid secret |
| Proxy secret file is unreadable | Fail startup with a clear error instead of ignoring the filesystem error |
| Proxy health check returns unauthorized | Treat the process as foreign or stale and do not accept it as healthy |

## 5. Good, Base, And Bad Cases

**Good case**: A release downloads the tested MPV bundle, refreshes only
`scripts/uosc_danmaku`, and leaves the user's history and options unchanged.

**Base case**: A new installation seeds the portable config and defaults to native
playback until the user explicitly enables MPV.

**Bad case**: Electron downloads one MPV bundle and then copies plugin files from a
moving upstream branch, or recursively replaces the whole portable config directory.

## 6. Tests Required

- Test first initialization with both missing and pre-existing user files.
- Test later updates replace managed plugin code and preserve user-owned files byte
  for byte.
- Test playback preference handling for `true`, `false`, missing, and malformed
  values.
- Test proxy secret creation, persistence across application lifecycles, file mode,
  and rejection of an orphan proxy with a different secret.
- Validate the release workflow contains no direct upstream plugin overlay.

## 7. Wrong Versus Correct

```ts
// Wrong: missing values silently enable MPV.
const enabled = value !== false

// Correct: MPV is enabled only by explicit user choice.
const enabled = value === true
```

```ts
// Wrong: a new secret makes a surviving proxy unreachable after Electron restarts.
const secret = randomBytes(32).toString('hex')

// Correct: one persisted secret identifies the local proxy across restarts.
const secret = loadOrCreateProxySecret(app.getPath('userData'))
```
