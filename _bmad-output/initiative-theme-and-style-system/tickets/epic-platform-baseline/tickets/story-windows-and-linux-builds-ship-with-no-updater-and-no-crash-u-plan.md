---
title: 'Windows and Linux builds ship with no updater and no crash upload'
type: 'feature'
ticket: '7'
created: '2026-11-13'
status: done
baseline_revision: '76f079e963ec744b810d510c700cf583066846e3'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/epic-platform-baseline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Only an unsigned macOS build exists. There are no Windows or Linux packages, and no CI builds any package. Each launch on Windows still runs Squirrel's startup handler, and the dead updater adapters are still in the tree. Both crash-reporter starts (`src/browser/application.js`, `src/error-logger.js`) auto-submit to dead Nylas Heroku endpoints (heyjawrsh/nylas-mail#8). Nothing checks that the licensed `nylas-private-fonts` stays out of a package.

**Approach:**
- Add unsigned Windows (NSIS) and Linux (AppImage, deb) electron-builder targets and a cross-platform dist script.
- Add a CI workflow that builds all three OSes on native runners.
- Remove Squirrel startup handling and the updater adapters.
- Start the crash reporter with uploads off and no submit URL.
- Add a public-build check that fails when a package holds `nylas-private-fonts` or the source re-enables crash upload. It runs locally and in CI.

## Boundaries & Constraints

**Always:**
- Builds stay unsigned: no certificates, notarisation or signing secrets.
- Crash dumps are still written locally (`uploadToServer: false`), and nothing is sent.
- The macOS build keeps working: `dist:mac` and its host-native restore are unchanged in behaviour.
- Local Linux and Windows builds run on a clean copy of the tree (`git archive HEAD`), never on the working tree, so the host's mac `node_modules` and natives are untouched.
- Tests ship with the change: specs for the crash-reporter options and the public-build check.
- Commit locally on `modernize/current` with no attribution lines, and never push. Refs heyjawrsh/nylas-mail#8 and #7.

**Never:**
- A working crash-report backend or an opt-in upload UI.
- Code signing, auto-update or a new updater.
- Pushing or triggering CI. The workflow file is written and checked locally; a person runs it.
- Default-mail-client registration on Windows (`default-client-helper.js` and the registry half of `windows-updater.js`), beyond removing Squirrel startup handling.
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Forced crash | `process.crash()` in a renderer of the built mac app | a dump is written under `crashDumps`, `getUploadedReports()` stays empty, and the crash handler opens no network connection | — |
| Windows launch | a `--squirrel-install`-style argument | the app starts normally (no Squirrel branch) | — |
| Fonts in a package | a built package whose app contents include `nylas-private-fonts` or a `Nylas-Pro*` font | the public-build check exits non-zero, naming the package and path | — |
| Upload re-enabled | `submitURL`, `autoSubmit` or `uploadToServer: true` added to source | the public-build check exits non-zero, naming `file:line` | — |
| Clean package | the mac, Linux or Windows output | the check exits 0 | — |

</frozen-after-approval>

## Code Map

- `packages/client-app/electron-builder.yml` -- mac-only, unsigned. Its header comment says Windows/Linux come later. Add:
  - `win` with an `nsis` x64 target and `build/resources/win/nylas.ico`.
  - `linux` with `AppImage` and `deb` x64 targets, icons from `build/resources/linux/icons`, category `Network;Email`, the `mailto` mime type, and a deb `maintainer`.
  - Keep the files list; the `!internal_packages/nylas-private-fonts` exclusion already lives there.
- `packages/client-app/scripts/dist-mac.mjs` -- spawns `electron-builder --mac`, then `install-app-deps` to restore host natives. Generalise it to `scripts/dist.mjs <mac|win|linux>`. Keep `dist:mac` as an alias with the same behaviour, add `dist:win` and `dist:linux` (with `predist:*` running the renderer build), and run the public-build check after a successful build.
- Squirrel:
  - `src/browser/main.js:210-248` has `handleStartupEventWithSquirrel`, called at `start()`, and `app.setAppUserModelId("com.squirrel.nylas.nylas")`. Delete the handler and its call, and set the AppUserModelId to `com.nylas.nylas-mail` (the appId, so Windows notifications attribute).
  - `src/browser/main.js:171` has the `squirrel` argv filter. Keep it so stray args are ignored.
- Updater adapters: `src/browser/linux-updater-adapter.js` (it still imports the uninstalled `request`) and `src/browser/windows-updater-squirrel-adapter.js` have no importers. Delete both, and any spec that only covers them.
  - `src/browser/windows-updater.js` stays, since `default-client-helper.js:66` uses its registry functions. Note in Implementation Notes whether `createRegistryEntries` depends on Squirrel's `Update.exe`. If it does, that's backlog work for the orchestrator to file, not this story.
- Crash reporter: `src/browser/application.js:510-516` and `src/error-logger.js:127-133` both call `crashReporter.start({..., submitURL: "https://…herokuapp…", autoSubmit: true})`. Change both to `{ productName: "Nylas Mail", uploadToServer: false }`. `companyName` is deprecated and `autoSubmit` was replaced by `uploadToServer`.
- New `scripts/check-public-build.mjs` (repo root, alongside `check-removed-react-apis.mjs`), with a `pnpm check:public-build [distDir…]` script.
  - It scans `packages/client-app/src` for `submitURL`, `autoSubmit` or `uploadToServer: true`.
  - For each package in the given dist dirs, it lists the app contents (the asar via `@electron/asar`, added as an exact-version devDependency, plus `app.asar.unpacked` and loose `resources/app` dirs) and fails on any `nylas-private-fonts` path or `Nylas-Pro` font.
  - It handles `.app` bundles, `*-unpacked` dirs, and the AppImage/deb/exe outputs through their unpacked dirs, which electron-builder leaves in `dist/`.
- CI: `.github/workflows/test.yml` is the existing test job (ubuntu, pnpm 11, node 24). Add `.github/workflows/dist.yml` with a matrix of macos-latest, windows-latest and ubuntu-latest.
  - Each job runs pnpm install, then `dist:<os>` (which runs the public-build check), then uploads the installers as artifacts.
  - Trigger on `workflow_dispatch` and push to `modernize/current`.
  - Native modules build on each runner, so no cross-compiling.
- Local Linux evidence: Docker 29 is installed. Build `git archive HEAD` in `electronuserland/builder` with corepack pnpm, then `dist:linux`. Then run the unpacked Linux app in the same image under `xvfb-run` with `--enable-logging` on a temporary NYLAS_HOME, and confirm the main process starts and a window loads. Do a Windows build the same way in `electronuserland/builder:wine` if natives allow; otherwise record that Windows is CI-only.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/client-app/electron-builder.yml` -- win and linux unsigned targets -- packages exist
- [ ] `packages/client-app/scripts/dist.mjs`, `package.json` scripts -- one dist script for all three, `dist:mac` unchanged in behaviour -- builds
- [ ] `src/browser/main.js`, the two adapter files -- Squirrel handling and the adapters removed, AppUserModelId set to the appId -- no updater
- [ ] `src/browser/application.js`, `src/error-logger.js` -- `uploadToServer: false` with no submitURL -- no crash upload (#8)
- [ ] `scripts/check-public-build.mjs`, root `package.json` -- the public-build check -- the guard
- [ ] `.github/workflows/dist.yml` -- three-OS build plus the check plus artifacts -- CI
- [ ] specs -- crash-reporter options in both starts, the check flagging fonts and upload settings and passing a clean tree, and main.js starting normally with a squirrel arg -- proof

**Acceptance Criteria:**
- Given `pnpm --filter nylas-mail dist:mac`, when it finishes, then the dmg and zip build, the public-build check passes on `dist/`, and the built app opens on the fixture account
- Given the built mac app, when a renderer is force-crashed, then a dump is on disk, `getUploadedReports()` is empty, and no network connection is made by the crash handler
- Given a clean copy built in Docker, when `dist:linux` runs, then an AppImage and a deb are produced, the check passes, and the unpacked app starts under xvfb and loads its main window
- Given the repo, when the workflow file is linted (`actionlint` if available, otherwise a YAML parse), then it is valid. Running it in CI and installing the Windows and Linux packages are the human steps

## Implementation Notes

- Commit 7be26a315 on `modernize/current` (not pushed).
- `scripts/dist.mjs <mac|win|linux>` replaces `dist-mac.mjs`. It runs `electron-builder --<os> --publish never`, then `install-app-deps` (pass or fail, as before), then the public-build check on `dist/` with node directly (no shell, so Windows paths need no quoting). `dist:mac` keeps its behaviour; `--publish never` only stops a CI run from trying to publish.
- `check-public-build.mjs` scans `packages/client-app/src` and `internal_packages` (a superset of the plan's `src`; both are clean). With no args it checks the source plus `packages/client-app/dist` if present. A dist dir that is given but has no `*.app` or `*-unpacked` package fails, so CI can't pass on an empty dir. The font match is `nylas-private-fonts` as a path segment, or a `Nylas-Pro*` file with a font extension. A first draft without the extension flagged `nylas-protocol-handler.js`; a spec now covers that.
- `@electron/asar` is pinned at 3.4.1, the version electron-builder 26.18.1 already uses. 4.x is out.
- `createRegistryEntries` (windows-updater.js) does depend on Squirrel: the `.reg` template points `mailto` at `{{PATH_TO_ROOT_FOLDER}}\Update.exe --processStart nylas.exe`, and the template and `elevate.cmd` are read from `<appFolder>/resources`, which the NSIS build doesn't ship (electron-builder copies no `build/resources/win` files). Default-mail-client registration on Windows is broken until that is reworked. Backlog for the orchestrator.
- Linux: the `.desktop` entry already gets `x-scheme-handler/mailto` and `nylas` from `protocols`; electron-builder repeats them, and `linux.mimeTypes` adds one more `mailto`. Harmless duplicates. electron-builder also warns that `desktopName` isn't set (window-to-launcher association).
- Specs: `browser-main-startup.spec.js` runs `main.js` as a CommonJS module function with a fake `require`, `process` and `global` (its `require()` calls are native, so `vi.mock` can't reach them), with five `--squirrel-*` args. `error-logger.js` is also CommonJS, so its spec spies on the node-bridge electron's `crashReporter.start`. `browser-application-crash-reporter.spec.js` mocks application.js's ESM imports and fires the `ready` handler. Both new main/application specs fail on the baseline source.
- Removed: `browser-windows-updater-squirrel-adapter.spec.js` (only covered the deleted adapter) and the adapter's skip line in `browser-commonjs-modules.spec.js`.

Found, not in scope (backlog for the orchestrator):
- `verify-install-location` shows "Please move Nylas Mail to your Applications folder … to get updates correctly" on the second and later launches from outside /Applications. It passes a callback to the promise-based `dialog.showMessageBox`, so the answer is never saved and it asks every launch. While it is open the main process stops answering DevTools `/json`, which will bite the Playwright harness (story 8) on any mac build run from `dist/`.
- Linux window icon: `nylas-window.js` looks for `nylas.png` at the app root or `build/resources/nylas.png`; neither is in the package, so the log shows "Failed to load image from path …/app.asar/build/resources/nylas.png".

AC deviation (needs a human call): Electron 45's `crashReporter.getUploadedReports()` lists every report in the local Crashpad database, uploaded or not. After the forced crash it returns one entry with `id: ""` and `date: 1970-01-01T00:00:00Z`: no server id and no upload time, so the dump was never sent. The AC's "is empty" holds only before a crash. The no-upload evidence is the missing `--url` on `chrome_crashpad_handler`, no sockets on it, and the dump staying in `Crashpad/pending/` (see Verification).

## Plan Change Log

## Review Triage Log

### Pass 1 (quick lens), 2026-11-13

Counts: high 0, medium 2, low 2, false 0, accepted 1, known gap 1.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | AC 2 "getUploadedReports() is empty" fails after the crash | low | accepted deviation, flagged to Josh | Electron 45 lists local reports too. The one entry has `id: ""` and a 1970 date, so it was never sent. The handler has no `--url` and no sockets, and the dump stays in `pending/`. The intent (nothing sent) is met; the AC's proxy was wrong. |
| 2 | `pnpm/action-setup@v4` `version: 11` clashes with `packageManager: pnpm@11.18.0` and fails setup | medium | patch | The v4 action rejects differing version strings, and no run has ever exercised this config. Drop `version:` in dist.yml and test.yml. |
| 3 | check-public-build exits 0 silently through a symlinked path | medium | patch | `runAsScript` compares the unresolved argv[1] to the realpath'd module URL. A guard that silently doesn't run is the worst failure. Compare realpaths, and make the spec assert the "passed" line. |
| 4 | the upload scan skips client-sync, which ships in the package | low | patch | The symlink isn't followed and `packages/client-sync` isn't a root. Add it. |
| 5 | pnpm-workspace.yaml comment says "mac-only build" | low | patch | Direct correction. |
| 6 | Windows package never built or checked | — | known gap | Recorded as CI-only. better-sqlite3 has no win32 prebuild and node-gyp can't cross-compile. The human step runs dist.yml. |

## Verification

**Commands:**
- `pnpm check:react` and `pnpm check:public-build` -- expected: exit 0
- `cd packages/client-app && npx vitest run` -- expected: no failed file and no fewer passing tests than baseline (3885; 4 known unhandled errors)
- `npx biome check .` -- expected: no new findings (1 known error)
- `pnpm --filter nylas-mail dist:mac` -- expected: exit 0, and the check passes on `dist/`
- Docker Linux build and xvfb launch as in the Code Map -- expected: AppImage and deb built, and the app starts

**Results (implementer, 2026-11-13, on 7be26a315):**
- `pnpm check:react` exits 0. `pnpm check:public-build` exits 0 on the source and `packages/client-app/dist`. On a dir with no package it exits 1.
- vitest: 3897 passed, 2 skipped, 201 files passed, none failed, 4 known unhandled errors. The removed adapter spec held 6 tests; 18 are new.
- `biome check .`: 1 error (the known one), no findings in the changed files. `actionlint` on both workflows exits 0.
- `pnpm --filter nylas-mail dist:mac` exits 0: arm64 and x64 dmg and zip, host natives restored to arm64, check passes on `dist/`.
- Built mac app (`dist/mac-arm64`) on a fresh copy of the seeded fixture, over CDP: the main window lists 3 inbox threads (Welcome, Lunch on Thursday?, Meeting notes). `chrome_crashpad_handler` runs with `--database=…/Nylas Mail/Crashpad` and no `--url`. `crashReporter.getUploadToServer()` is false and `getUploadedReports()` is `[]` before the crash.
- Forced crash (`process.crash()` in the main window renderer): `Crashpad/pending/128777f7-….dmp` written. `lsof -a -i` on the crashpad handler shows no sockets, before and during 10 s after the crash, polled every 250 ms. `getUploadedReports()` then returns `[{ id: "", date: 1970-01-01T00:00:00Z }]` (see the AC deviation above).
- Docker (`electronuserland/builder:latest`, linux/amd64 under emulation, node 24.22.1), on `git archive HEAD` (which includes the 14 tracked `nylas-private-fonts` files): `pnpm install`, then `dist:linux` exits 0. Output: `Nylas Mail-2.1.0.AppImage` (189 MB) and `nylas-mail_2.1.0_amd64.deb` (154 MB), check passes. The deb control has the maintainer; the `.desktop` has `Categories=Network;Email;` and `x-scheme-handler/mailto`.
- `linux-unpacked/nylas-mail` under `xvfb-run` on a temp NYLAS_HOME, with `--no-sandbox --disable-gpu --in-process-gpu --no-zygote` (root in the container and qemu emulation; without the GPU flags the GPU process won't launch under qemu): "App load time: 4469ms", three windows load, and the onboarding window renders "Welcome to Nylas Mail / Get Started". `getUploadToServer()` is false there too.
- Windows is CI-only. In `electronuserland/builder:wine` on the same archive, `pnpm install` passes but `dist:win` exits 1. better-sqlite3 has no win32 prebuild for Electron 45, so @electron/rebuild falls back to source, and "node-gyp does not support cross-compiling native modules from source". The `windows-latest` job in `dist.yml` builds natively, so it should pass there; this is untested until the workflow runs.

**Manual checks (human):**
- Run the dist workflow in GitHub Actions: all three jobs green, with artifacts.
- Install and open the Windows and Linux packages on real machines.

Verification on 62631dfdd (orchestrator, 2026-11-13): `check:react` and `check:public-build` exit 0. vitest has 3899 passing across 201 files with none failed (4 known unhandled errors), lint shows 1 known error, and actionlint passes on both workflows. All 4 patch findings are fixed. The status stays `built`, not done, until the human steps pass: the dist workflow runs green on all three OSes, and the Windows and Linux packages are installed and opened on real machines. Backlog filed: #14 (showMessageBox API), #15 (Windows mailto registration), #16 (Linux icon and desktop entry).

- 2026-11-16, Josh signed off: the Windows and Linux packages install and open (CI dist run 43789734069, f8236e4f0). The AC2 deviation is accepted: the crash report is never sent, though getUploadedReports() lists it locally.
