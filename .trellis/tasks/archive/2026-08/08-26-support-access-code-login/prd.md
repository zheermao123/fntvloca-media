# Support access-code login

## Goal

Allow users whose fnOS server is protected by a NAS access code to sign in,
restore their session after restarting the app, browse the embedded FNMedia UI,
and play media through the local Proxy without manually passing the access-code
page in another browser.

## Background

- The current login form sends only domain/FN ID, username, password, and HTTPS
  preference.
- The live fnOS page at `http://10.0.0.115:5666/v` uses a gateway before FNMedia.
  Its public access-code page sends `GET /access_code_verify` with
  `x-access-code` containing the UTF-8 access code encoded as Base64 and
  `x-access-source: web`, then relies on the resulting browser session Cookie.
- This access code is a NAS gateway credential, not a field in
  `/v/api/v1/login`. Adding it only to that login payload would leave the
  embedded page, background API requests, and playback Proxy unauthenticated.
- Login passwords and tokens are already protected with Electron `safeStorage`.

## Requirements

1. Add a password-style, optional `访问码（可选）` field to the existing login
   form, including a visibility toggle consistent with the password control.
2. Keep existing login behavior unchanged when the field is empty.
3. When present, validate the access code against `/access_code_verify` using
   the live fnOS header contract before submitting account credentials.
4. Follow same-origin redirects during verification and use the resolved origin
   for subsequent login requests, including the common port-80 to port-5666
   redirect.
5. Preserve the access-code session in Electron's `persist:fntv` partition so
   the embedded FNMedia page can load after login and after app restart.
6. Propagate only the resulting NAS Cookie, not the plaintext access code, to
   main-process FNMedia API calls and the authenticated local playback Proxy.
7. Ensure Proxy API calls and local NAS media-range requests include the access
   Cookie while cloud-direct requests keep their existing provider Cookies.
8. Save the current access code and login-history access code through
   `safeStorage`; never store it as plaintext, place it in URLs/process
   arguments, or write it to logs.
9. Restore the access-code field when selecting a login-history entry. Existing
   history records without the field must remain valid.
10. During FN ID login, handle the same fnOS access-code page if it appears in
    the isolated OAuth window and establish the persistent FNMedia session before
    loading the main window.
11. Return a specific `访问码错误` message for rejected access codes and keep
    certificate/network failures distinguishable from account-password errors.

## Acceptance Criteria

- [ ] A direct IP/domain login succeeds against an access-code-protected fnOS
      server when the correct access code, username, and password are supplied.
- [ ] A wrong access code fails before account login with an access-code-specific
      error and does not log the code.
- [ ] A server without access-code protection behaves exactly as before when the
      optional field is empty.
- [ ] Restarting Electron restores both the NAS gateway session and FNMedia token
      without showing the access-code page.
- [ ] Login history restores the access code, and `config.json` contains neither
      the plaintext access code nor plaintext password/token values.
- [ ] Main-process API calls, playback metadata calls, skip-info calls, and local
      NAS media streaming work behind the access-code gateway.
- [ ] Cloud-direct playback does not receive the NAS access Cookie.
- [ ] Access code, NAS access Cookie, token, account, and domain remain absent
      from playback URLs and logs.
- [ ] Existing FN ID, certificate-trust, HTTP/HTTPS, and login-history behavior
      remains covered by tests.
- [ ] TypeScript compilation, Node tests, Go tests, Go vet, and focused UI checks
      pass.

## Out Of Scope

- Managing or changing the access code configured on fnOS.
- Remembering credentials in the browser's password manager.
- Replacing the existing FNMedia account-password or FN Connect OAuth flows.
- Exposing the NAS access Cookie or plaintext access code to remote FNMedia page
  JavaScript after login.
