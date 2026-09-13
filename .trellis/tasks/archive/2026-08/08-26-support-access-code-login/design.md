# Design: Access-Code Gateway Session

## Boundary

The access code belongs to the fnOS gateway. The existing FNMedia token remains
the application credential. A dedicated main-process helper establishes the
gateway session and returns a Cookie grant; downstream code consumes that grant
without learning or re-encoding the plaintext access code.

## Data Flow

1. The local login page sends an optional `accessCode` over the restricted
   `login` IPC channel with the existing credentials.
2. The main process verifies it with the `persist:fntv` Electron session using
   the live `/access_code_verify` header contract.
3. The helper records the response's resolved origin and reads that Electron
   session's Cookie set into an in-memory origin-scoped grant.
4. `ApiService` adds the grant Cookie to signed FNMedia API requests. It never
   adds the plaintext code.
5. Successful login stores the access code through `safeStorage` in current
   config and history. Startup re-verifies it before token restoration.
6. Playback-session registration passes the Cookie grant through the existing
   localhost endpoint protected by `X-FNTV-Proxy-Secret`.
7. The Go Proxy adds the Cookie to FNMedia API and local NAS range requests. It
   does not add it to cloud-provider direct requests.

## Contracts

- Empty access code means no gateway verification and no access grant.
- Access code encoding is `Buffer.from(code, 'utf8').toString('base64')`.
- Verification uses `GET /access_code_verify`, `x-access-code`, and
  `x-access-source: web`.
- Grant lookup is origin-scoped and kept in memory; the plaintext source remains
  encrypted at rest.
- Cookie composition is structured and includes `mode=relay` once without
  logging or URL serialization.
- A rejected code maps to a stable user-facing access-code error. Network and
  certificate failures retain their existing handling paths.

## FN ID Compatibility

The isolated FN ID window receives the optional access code only in its existing
injected auto-login script. If the current document is the fnOS access-code page,
the script fills and submits that page before continuing OAuth. Once the target
FNMedia origin is known, the main process establishes the same persistent grant
used by direct login and playback.

## Security

- `safeStorage` encrypts current and historical access-code values.
- The access code is omitted from logs, URLs, command-line arguments, environment
  variables, renderer config summaries, and Proxy responses.
- The derived Cookie crosses into the Proxy only inside the already-authenticated
  playback-session creation request and never appears in the short-lived session
  URL.
- Existing history records without `accessCode` decrypt as an empty value.

## Compatibility And Rollback

All new persisted fields are optional, so old configurations remain readable.
Rollback ignores the additional encrypted fields. Removing the helper calls and
optional fields restores prior behavior without a data migration.
