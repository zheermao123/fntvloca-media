# Phase 7: Cleanup & Packaging — Outcome

1. [x] package.json `build.files` includes `resource/library` (installable
       packaging carries the new page).
2. [x] Version bumped 2.6.2 → 2.7.0; CHANGELOG.md rewritten for the local
       media manager release.
3. [x] Proxy service demoted to optional component: startup failure no longer
       quits the app (local playback unaffected).
4. [x] Preload titlebar plugin skips injection on the library page (page owns
       its own titlebar).
5. [x] All test temp fixtures relocated from system tmpdir to project-local
       `tmp/tests` (policy: no file access outside the project path); helper
       added at tests/helpers/tmpRoot.cjs; `tmp` gitignored.
6. [x] Encoding incident fixed: PowerShell rewrite corrupted Chinese literals
       in two test files; libraryParser/libraryScraper rewritten via write
       tool, accessCodeLoginPage line 11 restored (stronger assertion passes).
7. [x] Full verify: compile clean, 111/111 tests pass.

## Deferred (needs environment)

- electron-builder packaging (`npm run build:win`) requires the Go toolchain
  to compile the proxy; not available in this workspace. CI (release.yml)
  handles three-platform builds; locally install Go or reuse CI.
- GUI smoke test: launching the app writes its data to `~/.fntv` (outside the
  project path), which the current access policy forbids for this session;
  left for the user to run via `npm start`.
