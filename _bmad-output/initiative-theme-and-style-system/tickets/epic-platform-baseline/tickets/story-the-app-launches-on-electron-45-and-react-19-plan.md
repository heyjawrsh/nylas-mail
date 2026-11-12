---
title: 'The app launches on Electron 45 and React 19'
type: 'chore'
ticket: '1'
created: '2026-11-12'
status: done
baseline_revision: '2a18e4976bccc7cee1dc9fdfba46b393b7b18f57'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/epic-platform-baseline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On a clean checkout the app can't start. Electron and React 19 aren't really installed: `node_modules` holds dangling test-stub symlinks. The committed renderer bundles are stale and contain test stubs. Internal-package `.jsx` can't load because the compile hook is an identity no-op. React 19 has no `ReactDOM.render`. There's no packaging, so no installable build.

**Approach:** Make the real install chain work on Electron 45.3.1 and React 19, build the renderer bundles from source on start, compile app sources at require time with esbuild, and mount the root with `createRoot`. Fix whatever the onboarding window hits, then add an unsigned macOS electron-builder build that opens the same window.

## Boundaries & Constraints

**Always:**
- Pin Electron to exactly 45.3.1 (architecture AD-4).
- Keep `nodeIntegration` and the existing window options. No window chrome changes.
- Behaviour stays the same: replace only removed or broken APIs.
- Tests ship with the change.
- Commit locally on `modernize/current` with no attribution lines, and never push.
- Refs heyjawrsh/nylas-mail#7.

**Never:**
- Windows or Linux targets, CI build jobs, Squirrel or crash-reporter changes (story 7).
- The removed-API CI check (story 2).
- `findDOMNode`, string-ref or legacy-context cleanup beyond what the onboarding window hits (stories 2–6).
- Code signing or notarisation.
- Any theme, LESS or look change.
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean dev launch | fresh clone, `pnpm install`, `pnpm start` in client-app, no accounts | onboarding window renders its first page, with no React errors in the console | — |
| Packaged launch | unsigned macOS build from electron-builder, opened from `dist/` | the same onboarding window renders | Gatekeeper blocks unsigned app → open via right-click › Open (documented) |
| Native module | better-sqlite3 loaded in main and renderer | loads against the Electron 45 ABI | install fails loudly if the rebuild fails |
| JSX in internal package | `require("./onboarding-root")` resolves to a `.jsx` file with ESM syntax | compiled to CJS by esbuild and loaded | a syntax error names the file and line |

</frozen-after-approval>

## Code Map

- `package.json` (root) -- the broken `build:renderer` path and the stray top-level `"smoke"` key; `onlyBuiltDependencies` lives in `pnpm-workspace.yaml`
- `packages/client-app/package.json` -- `electron ^44.0.0` becomes exactly `45.3.1`; `start` becomes `electron . --dev --enable-logging`; `vitest` and `@vitest/coverage-v8` are on `"latest"`; esbuild is a devDependency but the runtime needs it
- `packages/client-app/node_modules`, `spec/stubs/link-bridges.sh`, `spec/stubs/node-bridges/*` -- dangling bridge symlinks (electron stub `index.js:8` points at `~/Work/Repositories/...`). Vitest already aliases `electron` and `@electron/remote` (`vitest.config.js:13-14`)
- `packages/client-app/scripts/build-renderer.js:91-125` -- two `alias` keys (the second wins, so the native stubs are lost) and a wildcard alias esbuild can't use; `@electron/remote` isn't external, so the bundle carries the test stub
- `packages/client-app/static/{window,secondary-window}-bootstrap.bundle.js` -- ~12.9MB each, tracked, stale
- `packages/client-app/src/compile-support/babel.js` -- identity compiler that `src/compile-cache.js:10` maps to `.jsx`. `src/global/nylas-component-kit.js:9-32` has the esbuild `transformSync` loader to reuse
- `packages/client-app/src/nylas-env.js:1211` -- `ReactDOM.render(SheetContainer)`, React 19 removed it
- `@electron/remote` misuse: `import { remote } from "@electron/remote"` (no such export) in `nylas-env.js:32`, `key-manager.js:7`, `database-store.js:13`, `spellchecker.js:1` and components; `require("electron").remote` in `window-event-handler.js:12`, `package-manager.js:18`, `sheet-toolbar.jsx:18`, `default-client-helper.js:9`, internal packages
- `src/browser/main.js:293-297` -- `@electron/remote/main` initialise, then `application.default`; `application.js:244-257` opens onboarding when there are no accounts; `window-manager.js:240-250` sets the onboarding options; `nylas-window.js:118-120,224` creates the window
- Onboarding render path: `internal_packages/onboarding/lib/main.js` → `onboarding-root.jsx:100` (string ref), `decorators/create-page-for-form.jsx:50` (findDOMNode), `96,302` (string refs), `sheet-container.jsx:164-165` (string refs), `sheet.jsx:33-42` (legacy context)
- `build/resources/mac/nylas.icns` -- icon. `build/tasks/package-task.js:200-300` -- old asar-unpack and ignore rules to copy (natives unpacked)
- Not touching: `protocol.registerFileProtocol` (deprecated, still works in 45), the dead `new-window`/`crashed` handlers, the Grunt tasks

## Tasks & Acceptance

**Execution:**
- [x] `packages/client-app/package.json`, `pnpm-lock.yaml` -- pin `electron` to 45.3.1, pin vitest and coverage to their installed versions, move `esbuild` to dependencies, add `electron-builder` 26.18.1. Add `postinstall: electron-builder install-app-deps` so natives rebuild for Electron. Add `prestart: node scripts/build-renderer.js` -- a real install with natives on the right ABI and bundles built from source
- [x] `package.json` (root) -- point `build:renderer` at the client-app script and move `smoke` under `scripts` -- broken scripts
- [x] `spec/stubs/link-bridges.sh`, `spec/stubs/node-bridges/` -- delete if nothing outside Vitest aliases needs them (check `spec/setup.js`), otherwise keep them out of install -- they poison real installs
- [x] `scripts/build-renderer.js` -- merge the two alias blocks, drop the wildcard, add `@electron/remote` to `external` -- the native stubs apply and the real remote loads
- [x] `static/*.bundle.js`, `.gitignore` -- `git rm --cached` the bundles and ignore them -- build output, not source
- [x] `src/compile-support/babel.js` -- compile `.jsx` and ESM-syntax `.js` under the app root (never `node_modules`) to CJS with esbuild `transformSync` (with sourcemap), keeping compile-cache's cache -- internal packages load at runtime
- [x] `src/nylas-env.js` -- mount `SheetContainer` with `createRoot` and keep the root for unmount -- React 19 removed `render`
- [x] every `@electron/remote` / `require("electron").remote` call site -- the default import or `require("@electron/remote")` -- the current imports are undefined against the real package
- [x] onboarding path files above -- replace the string refs, `findDOMNode` and legacy context that the onboarding window actually hits, found by launching -- reach a rendered first page
- [x] `packages/client-app/electron-builder.yml` (new) and the `dist:mac` script -- an unsigned mac dmg/zip target with appId `com.nylas.mail`, `asarUnpack` for `*.node` and esbuild, `internal_packages/client-sync` dereferenced, and `nylas-private-fonts` excluded -- an installable macOS build
- [x] `spec/compile-support-babel.spec.js`, `spec/nylas-env-react-root.spec.js` -- tests for the JSX/ESM compile (including a syntax error naming file and line) and for root mount/unmount with `createRoot`

**Acceptance Criteria:**
- Given a fresh clone, when `pnpm install` runs at the root, then it finishes with better-sqlite3 built for Electron 45 and no symlink pointing outside the repo
- Given the dev launch, when the onboarding window opens, then its console shows no React error or warning about removed APIs
- Given `pnpm --filter client-app dist:mac`, when the unsigned app in `dist/` is opened, then the onboarding window renders

## Implementation Notes

- Install: `nslog` dropped from dependencies. It no longer compiles against Electron 45's V8, `install-app-deps` failed on it, and `error-logger.js` already treats it as optional. pnpm 11 ignores `onlyBuiltDependencies`, so `pnpm-workspace.yaml` now uses `allowBuilds` (natives and electron allowed; scarf, electron-winstaller and es5-ext denied). `electron@45.3.1` is in `minimumReleaseAgeExclude`. Electron 45 downloads its binary on first `require("electron")`.
- Test bridges: specs still need `spec/stubs/node-bridges` for native `require`/`createRequire` calls that vite's aliases never see. The bridges stay, with relative paths, and `spec/setup.js` resolves the names to them through `module.registerHooks`. Nothing is symlinked into `node_modules` any more.
- Renderer runtime: `src/register-bundled-modules.js` is the first import of both bootstraps. It points `nylas-exports`, `nylas-component-kit`, `nylas-store`, `nylas-observables`, `react`, `react-dom`, `react/jsx-runtime` and `rx-lite` at the bundle's own instances, so internal packages share one flux layer and one React. The old node_modules bridge did this for `nylas-exports` only.
- `@electron/remote`: call sites use `import * as remote` or `require("@electron/remote")`. A default import doesn't work: the real package is `__esModule` with no default. `default-client-helper.js` only takes remote in the renderer.
- The rest of the fix log is under Design Notes.

## Plan Change Log

- Verification commands need `--filter nylas-mail` (the package name); `--filter client-app` matches nothing.
- `register-bundled-modules.js`, `sheet-depth-context.js` and the bundler plugin weren't in the plan. Launching showed they were needed to render onboarding without duplicate stores or legacy context.

## Review Triage Log

### Pass 1 (quick lens), 2026-11-12

Counts: high 0 (1 pre-existing high deferred), medium 5, low 3, false 0, maybe-false 0.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | `electron-builder.yml` appId `com.nylas.mail` vs the hard-coded `com.nylas.nylas-mail` | medium | patch | `default-client-helper.js:17` and `native-notifications.js:40` use `com.nylas.nylas-mail`, so packaged default-client registration targets a nonexistent bundle. Set appId to `com.nylas.nylas-mail`. |
| 2 | Gatekeeper right-click › Open not documented (frozen matrix row says "documented") | medium | patch | Grep finds it only in the plan. Add it to the `electron-builder.yml` header and the client-app README. |
| 3 | mac targets are arm64 only | medium | patch | Intel Macs get no build, against epic R2. Add x64 dmg/zip. |
| 4 | Lock regeneration moved client-sync, cloud-api, cloud-core and cloud-workers from vitest 4.1.11 to 5.1.0 | medium | patch | Their `latest` pins re-resolved. Pin them to 4.1.11 like client-app. |
| 5 | `initializeReactRoot` commits asynchronously, where `ReactDOM.render` was sync | medium | patch | `startWindow` and `startSecondaryWindow` continue (packages.activate, `window:loaded`) before SheetContainer mounts. Wrap the render in `flushSync`. |
| 6 | `flushSync` in PopoverStore/ModalStore reached from `UNSAFE_componentWillReceiveProps` (thread-sharing) | low | reject | Only the thread-sharing plugin calls it from a lifecycle, and the legacy `ReactDOM.render` there was equally impure. The fix needs re-architecting the plugin. Unlikely in everyday use. |
| 7 | `nylas-component-kit` named imports are undefined inside the bundle (Modal, CodeSnippet) | high (pre-existing) | defer | The old committed bundles used the same alias, so the change didn't cause it. It blocks every modal. Already in epic deferred-work; must land before stories 2–6 verify. |
| 8 | `ESBUILD_WORKER_THREADS=0` spawns one esbuild process per uncached file on first launch | medium | defer | Cost is by design; the cache absorbs later launches. Precompiling internal packages at build time would remove it. |
| 9 | `css-transition-group-compat` `_nodeRefs` never pruned | low | reject | One ref object per key ever shown. Negligible memory, and pruning adds a branch. |
| 10 | Electron bridge stub comment says default export is the binary path | low | patch | The comment is now wrong. Direct correction. |
| 11 | (orchestrator) Vitest reports 4 unhandled errors (NetworkError, RetinaImg path, `getGlobal().isQuitting`, TaskQueue dequeue) and exits 1 | low (pre-existing) | defer | All four come from stubs and fixtures (`getGlobal` returns `{}` in both the old and new stubs). Tests pass 3504/3504. |

### Pass 1 verification after patches (f2a1c3b14), 2026-11-12

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 12 | (orchestrator) the x64 app ships only the darwin-arm64 esbuild binary | high | patch | Seen with `file` in `dist/mac/.../app.asar.unpacked/node_modules/@esbuild/`, and electron-builder warned the darwin-x64 package was not bundled. Intel Macs can't compile internal packages at runtime. Patch: pnpm `supportedArchitectures` for both darwin CPUs, rebuild, Rosetta launch check. |

Verification on f2a1c3b14: client-app 3504/3504 (4 pre-existing unhandled errors, row 11); client-sync 197, cloud-api 44, cloud-core 1, cloud-workers 33 and isomorphic-core 138 all pass on vitest 4.1.11. Lint shows 1 error (pre-existing `.nylas-smoke-home/config.json`) and 38 warnings. dist:mac built arm64 and x64 dmg/zip.

## Design Notes

Launch-driven loop: after the install and bundle fixes, launch the app with `--enable-logging`, fix the first error in main or the renderer, and relaunch until onboarding renders. Record each fix here. Anything found off the onboarding path goes to `deferred-work.md` (or to its React-19 story) rather than being fixed here.

Fix log, in launch order:

1. main: `@electron/remote` required in the browser process by `default-client-helper.js`, so it is renderer-only now.
2. renderer: esbuild's sync API can't start worker threads in Electron's renderer, so `babel.js` sets `ESBUILD_WORKER_THREADS=0` there. It also skips `*.bundle.js`.
3. renderer: the real `@electron/remote` has no default export, so call sites use a namespace import.
4. dev: Bluebird refused `longStackTraces` after promises existed, so it is wrapped to warn.
5. hot window: `config-schema.js`'s enumerable `default` self-reference sent `Config.setDefaults` into infinite recursion, so `default` is non-enumerable.
6. main: `webContents.getId()` was removed, so `config-persistence-manager.js` uses `.id`.
7. renderer: better-sqlite3 was bundled and couldn't find its binary, so it is external in `build-renderer.js`.
8. renderer: the bundle used the classic JSX transform and files had no React import, so the bundle uses `jsx: "automatic"`.
9. stores: `ModalStore` and `PopoverStore` used `ReactDOM.render` with callbacks. They now use `createRoot` plus `flushSync`, which keeps the synchronous commit.
10. bridge: the `nylas-exports` lazy proxy `.bind()`-ed functions and lost `Actions.x.listen`. Function members are wrapped in a Proxy now, keyed per owner.
11. flux: 12 `nylas-exports` entries loaded by string path got a second, native copy of their store (`FocusedPerspectiveStore` and others). They are thunks with literal requires now. `PackageManager` and `DatabaseChangeRecord` use the bundled-first pattern.
12. `IdentityStore` had `DatabaseStore`, `KeyManager` and `APIError` as undefined globals. It uses plain imports now.
13. better-sqlite3 13: `pragma(x, true)` became `{ simple: true }`, and `user_version` comes back as a number, so the version check casts it to a string. `DatabaseStore.findJSONBlob` was async and returned a Promise where callers expected a query, so it is synchronous again (a query is thenable).
14. `SheetContainer` and 13 other derived constructors were missing `super()`, and 3 touched `this` before `super()`. `super(...)` is first now.
15. bundler: relative `nodeRequire("./x")` calls loaded unbundled duplicates and failed relative to `static/`. A `build-renderer.js` plugin rewrites them to `require`, except under `/spec/`. `nylas-env`'s `loadFromSrc` sites take a bundled thunk, gated on the `NYLAS_RENDERER_BUNDLE` define.
16. bundler: esbuild renamed colliding classes (`Event` became `Event2`), so model table names broke. Fixed with `keepNames: true`.
17. bundler: the banner `NylasEnv` shim said every hot window was the main window, so `WorkspaceStore` defined Threads as root. The shim now gives the same answers as the real env (`isMainWindow`, `isEmptyWindow`).
18. bundler: `windows-shortcuts` was external but not installed, and the merge had dropped its stub alias. The optional-native stub is aliased again.
19. React 19 on the onboarding path: `Sheet` and `Toolbar` legacy `childContextTypes` moved to `SheetDepthContext`, with `CategoryPicker` as its consumer. Toolbar's `findDOMNode` became a ref. `SheetContainer`'s string refs became callback refs. Onboarding-root's unused `ref="activePage"` is gone. `create-page-for-form`'s `findDOMNode` and `ref="form"` became refs. The CSSTransition compat now passes `key` directly and a `nodeRef` for DOM children.
20. `action-bridge.js` referenced an undefined `DatabaseStore` after a DB trigger, so it uses `DB`.
21. packaging: `dot-nylas/` was missing from `files`. esbuild can't spawn from inside the asar, so `babel.js` points `ESBUILD_BINARY_PATH` at `app.asar.unpacked`. String patterns listed after a FileSet don't apply to the app files, so the FileSet goes last.

## Verification

**Commands:**
- `rm -rf node_modules packages/*/node_modules && pnpm install` -- expected: exit 0; `node -e "require('electron')"` in client-app prints the binary path
- `pnpm --filter client-app test` -- expected: the new specs pass and the suite is no worse than baseline
- `pnpm lint` -- expected: no new findings
- `pnpm --filter client-app start` -- expected: the onboarding window renders, with no React errors in the logged console
- `pnpm --filter client-app dist:mac` -- expected: `dist/` holds an unsigned `.dmg` and `.zip`

**Manual checks (if no CLI):**
- Josh: on a clean clone, run the install and start, then open the `.dmg` build (right-click › Open). Onboarding renders in both.
