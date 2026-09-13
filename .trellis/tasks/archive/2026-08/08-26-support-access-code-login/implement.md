# Implementation Plan

1. Add the gateway-session helper.
   - Encode the access code and verify the live endpoint contract.
   - Normalize redirected origins, collect session Cookies, and keep an
     origin-scoped in-memory grant.
   - Add focused unit tests for Unicode Base64, redirects, success, rejection,
     and empty-code behavior.
2. Extend secure credential persistence.
   - Add optional access-code fields to current config and history.
   - Encrypt/decrypt them with the existing `safeStorage` path.
   - Test migration compatibility and prove plaintext credentials are absent.
3. Integrate login and restore flows.
   - Add the optional login field, visibility control, IPC payload, and history
     restoration.
   - Verify direct login before account authentication.
   - Re-establish the gateway session before startup token validation and page
     loading.
   - Extend FN ID page injection and final target-session setup.
4. Propagate the derived Cookie through backend requests.
   - Make `ApiService` apply an origin grant to every signed request.
   - Add the grant to playback-session registration.
   - Extend the Go session/API client and local NAS media forwarding while
     keeping cloud Cookies isolated.
5. Validate end to end.
   - Run TypeScript compilation and all Node tests.
   - Run Go formatting, tests, and vet.
   - Launch the local Electron login page and verify desktop/mobile-height layout,
     field behavior, and absence of overlap.
   - Smoke-test the access-code flow against the user-provided fnOS server with
     the user entering the secret when needed; do not request or echo it.
   - Inspect focused diffs for credential leakage.

## Risky Files And Rollback Points

- `src/modules/fn_config/config.ts`: all credential fields must use the same
  `safeStorage` write/read boundary.
- `src/main/handlers/plugins/auth.ts` and `fnid_login.ts`: certificate retries and
  OAuth behavior must remain intact.
- `src/modules/fn_api/api.ts`: grant headers must cover every request without
  altering request signing.
- `src/main/common/proxySession.ts` and Go session structs: Cookie data must stay
  inside the authenticated localhost control request.
- `src/modules/proxy/internal/logic/api/playvideo.go`: NAS and cloud Cookie paths
  must not be mixed.
- `resource/login/index.html`: the added field must fit the compact login panel
  and preserve keyboard/history behavior.
