---
title: 'The work window loads and sync starts'
type: 'bugfix'
ticket: '11'
created: '2026-11-13'
status: done
baseline_revision: '8f66480e0cc72741934cd0a6f3010cb960f34f24'
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

**Problem:** The hidden work window, which runs sync and background database work, fails three ways on every launch:
1. client-sync is rejected with "INVALID PACKAGE … must include an engines.nylas property", so sync never loads.
2. worker-ui fails to activate with `Rx.Observable.fromQuery is not a function`.
3. The background database agent fork dies with `Cannot find module …/static/database-agent.js`.

Without these, no account can sync and nothing that needs the work window can be verified.

**Approach:** Accept client-sync as a package. Hand out the Rx that carries the app's observable helpers. Fork the database agent from its real location in dev and packaged builds. Then confirm in the real app that the work window logs none of these errors and client-sync activates.

## Boundaries & Constraints

**Always:**
- Behaviour stays the same everywhere else. Anything already using `nylas-exports` `Rx` keeps working.
- The agent fork works in dev and in the packaged app, where sources live in `app.asar`.
- Tests ship with the change.
- Commit locally on `modernize/current` with no attribution lines, and never push. Refs heyjawrsh/nylas-mail#7.

**Never:**
- Adding a real account or credentials, or contacting any mail server.
- Changing what client-sync does once it runs.
- `findDOMNode`, string-ref or lifecycle work (stories 4–6).
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Package load | dev launch, fresh NYLAS_HOME | client-sync loads and activates in the work window; no INVALID PACKAGE | — |
| worker-ui | dev launch | worker-ui activates; `Rx.Observable.fromQuery` exists on the Rx `nylas-exports` gives out | — |
| Agent fork, dev | a background query in the work window | the agent starts from the app's source path and answers | a fork error is logged once, as today |
| Agent fork, packaged | the same, in the built macOS app | the agent starts from inside the app bundle and answers | — |
| Other Rx users | existing `nylas-exports` `Rx` consumers (specs) | unchanged results | — |

</frozen-after-approval>

## Code Map

- `packages/client-sync/package.json` -- symlinked to `client-app/internal_packages/client-sync`; has `main` but no `engines.nylas`, which `src/package.js` requires
- `packages/client-app/src/global/nylas-exports.js:805` -- `lazyLoadWithGetter("Rx", () => nodeRequire("rxjs"))`. `src/global/nylas-observables.js:165` adds `fromQuery` and the other helpers to **rx-lite**'s `Observable`. `src/register-bundled-modules.js` maps `rx-lite` to the bundle's patched copy for unbundled code
- `internal_packages/worker-ui/lib/developer-bar-store.js:148` -- `Rx.Observable.fromQuery(query)` with `Rx` from `nylas-exports`
- `packages/client-app/src/flux/stores/database-store.js:444-447` -- `childProcess.fork(path.join(path.dirname(__filename), "database-agent.js"))`. In the bundle `__filename` is `static/*.bundle.js`. `src/flux/stores/database-agent.js` is plain CJS using better-sqlite3. Resolve it from the app's resource path instead (`NylasEnv.getLoadSettings().resourcePath` or equivalent)
- `scripts/build-renderer.js` -- if a `__filename`-relative path is the pattern elsewhere in bundled code, grep for other `dirname(__filename)` uses in bundled `src/` and list them in Implementation Notes (fix only the ones on the work-window path)
- `electron-builder.yml` -- the packaged layout; `asarUnpack` covers `*.node` and esbuild

## Tasks & Acceptance

**Execution:**
- [ ] `packages/client-sync/package.json` -- add the `engines.nylas` value the loader accepts (match the other internal packages' manifests) -- the package loads
- [ ] `src/global/nylas-exports.js` -- `Rx` resolves to the rx-lite instance `nylas-observables` patches, in the bundle and in tests; check for any consumer that relied on rxjs-only APIs -- worker-ui gets `fromQuery`
- [ ] `src/flux/stores/database-store.js` -- fork `database-agent.js` from the app's real source path; packaged builds work from `app.asar` (or unpack it if a fork from asar fails) -- the agent starts
- [ ] specs -- `nylas-exports` `Rx.Observable.fromQuery` is a function; the agent path resolves to an existing file given a resource path; the client-sync manifest passes the loader's validation

**Acceptance Criteria:**
- Given a dev launch with a fresh NYLAS_HOME, when the work window loads, then the log has no INVALID PACKAGE, `fromQuery` or `Cannot find module` error, and client-sync reports as activated (read over CDP from the package manager)
- Given the packaged macOS build launched with a fresh NYLAS_HOME, when the work window loads, then the same holds and a background query through the agent returns a result

## Implementation Notes

Commit 24fcb2c4c (implementer, 2026-11-12).

- `client-sync/package.json`: brought back both `engines.nylas: "*"` and `windowTypes.work: true`. a700f4995 dropped both. Without `windowTypes`, `getAvailablePackagePaths("work")` filters the package out of the work window even once the engines check passes.
- `nylas-exports` `Rx` is now rx-lite. The getter loads `./nylas-observables.js` first, which patches rx-lite's `Observable`. Both requires are literal, so the bundle uses its bundled copies. Every `nylas-exports` `Rx` consumer in `internal_packages/` uses only rx-lite APIs (`fromQuery`, `fromStore`, `combineLatest`, `Disposable.create`, `fromPromise`, `empty`), and none relied on rxjs.
- `database-store.js` forks `databaseAgentPath(NylasEnv.getLoadSettings().resourcePath)`, which is `<resourcePath>/src/flux/stores/database-agent.js`. Packaged builds fork it from inside `app.asar` with no unpack.
- `database-agent.js` was outside the code map but had to change: it used the old async better-sqlite3 API (`.on("open")`/`.on("close")`), which v13 doesn't have, so the agent would throw on its first message. It now opens synchronously.
- Other `__dirname`/`__filename` uses: none left in bundled `src/`. `compile-support/babel.js` isn't bundled, `src/browser/*` runs in main, and the ones in `internal_packages/` (system-tray, screenshot-mode, print, composer-templates) are loaded unbundled with their own paths.
- Spec: `spec/work-window-loads.spec.js` (4 tests). Three of them fail on the baseline.

Verified: check:react exit 0. Build exit 0. Vitest 3622 pass, no failed file, 4 known unhandled errors. Lint shows the 1 known error. dist:mac exit 0. In dev and packaged arm64 (fresh NYLAS_HOME, CDP on the work window), there's no INVALID PACKAGE and no `fromQuery` error, worker-ui is active, and `DatabaseStore._executeInBackground("SELECT 1 …")` returns a result through the agent. Packaged, the agent's spawnargs point inside `app.asar`.

After the scope change (commits 1cae3c26c and e2e8ea1ed; see the Plan Change Log):
- `client-sync` deps: added `hapi-swagger@^17.3.2`, `@hapi/basic@^7.0.2` (registered as the `basic` scheme in place of `hapi-auth-basic`) and `prop-types@^15.8.1`. `hapi-boom-decorators` was dropped, not replaced: no route calls any of its `h.*` helpers (every handler uses `h.response` and `Boom` directly). `hapi-swagger` 17 declares `joi` 17 as a peer while `client-sync` uses 18. That's a peer warning only, because `startLocalAPI()` doesn't run unless `NYLAS_START_LOCAL_API=1`.
- `src/local-api/index.js` imported `../../package.js`, which never existed. It now imports `../../package.json`.
- `local-database-connector.js` imports `isomorphic-core/src/database-extensions.js`. `isomorphic-core`'s `exports` gained that one subpath. It stays a subpath import so the spec mocks of `isomorphic-core` still keep the side effect, and the client-sync specs pass (197 before and after).
- Packaging: `client-app` depends on `client-sync` (`workspace:*`). electron-builder hoists its deps into `app.asar/node_modules`, and the `internal_packages/client-sync` FileSet copy resolves them from there. It also places a second, unused copy at `node_modules/client-sync` (215 files).
- `isomorphic-core/src/load-models.js` built its dir from `new URL(".", import.meta.url).pathname`, which keeps `%20`. In `Nylas Mail.app`, `readdirSync` then hit "Invalid package …app.asar" and the shared database never loaded. It now uses `fileURLToPath`. This is a path-decoding fix and needs no sequelize or schema change.
- `postdist:mac` runs `electron-builder install-app-deps` (host arch). After `dist:mac`, `sqlite3` reads arm64 again.
- Spec: a fifth test checks that every bare import in `client-sync` resolves from the package.

Verified on e2e8ea1ed. check:react exits 0. The build exits 0. Vitest has 3623 passing and no failed files (4 known unhandled errors). Lint shows 1 known error. client-sync vitest shows 197 passing, and isomorphic-core shows 138 passing. `dist:mac` exits 0 and its postdist step leaves `sqlite3` arm64.

Over CDP on the work window (fresh NYLAS_HOME), in both the packaged arm64 app and a dev launch right after `dist:mac`:
- `client-sync` is active with its main module loaded, and `Developer:LocalSyncUI` is registered, which is the last statement of `activate()`, so `activate()` resolved.
- The launcher logs "SyncProcessManager: Can't start sync; no Nylas Identity present", as expected with no account.
- worker-ui is active and `fromQuery` is a function.
- An agent query returns a result.
- The log has no INVALID PACKAGE, `fromQuery`, `Cannot find module` or unhandled-rejection lines. The `vm module` and Bluebird long-stack-trace warnings were already in the baseline.

Not fixed, follow-ups:
- `new URL(".", document.baseURI).pathname` fallbacks in `src/nylas-env.js:27`, `src/global/nylas-exports.js:30` and `src/global/nylas-component-kit.js:56` would hit the same `%20` problem in the packaged app. None of them were on the activation path in this run.
- The duplicate `node_modules/client-sync` copy in the asar.

## Plan Change Log

- 2026-11-12 (orchestrator-approved, option a, time-boxed): scope extended so client-sync activates in dev and packaged. Only dependency, import, packaging and API-version fixes are in; stop if sequelize or schema rework or any change to sync behaviour would be needed (none was). Added: client-sync deps `hapi-swagger@^17.3.2`, `@hapi/basic@^7.0.2`, `prop-types@^15.8.1`. Removed: the `hapi-boom-decorators` registration (unused). Fixed: the `../../package.json` import, the `isomorphic-core/src/database-extensions.js` subpath (plus a new `exports` entry in `isomorphic-core`), and `fileURLToPath` in `isomorphic-core` `load-models.js`. Added `client-sync: workspace:*` to client-app dependencies and a `postdist:mac` step running `electron-builder install-app-deps`.
- 2026-11-12 (implementer): `database-agent.js` was changed to the sync better-sqlite3 open, which the agent AC needs. It was outside the original code map.

## Review Triage Log

### Pass 1 (quick lens), 2026-11-13

Counts: high 0, medium 1, low 3, false 0.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | Agent errors kill the child without a reply, so `.background()` callers hang forever | medium | patch | The path is newly live. The agent replies errors; the parent falls back to `_executeLocally` and settles open queries on close. |
| 2 | Manifest spec re-checks fields by hand, looser than the loader | low | patch | Assert through the real loader filter. |
| 3 | Import-resolution spec proves only the dev layout | low | defer | No version divergence today. A packaged-layout check belongs in the harness (13.8). |
| 4 | `postdist:mac` skipped when `dist:mac` fails, leaving x64 natives | low | patch | Restore in a wrapper that always runs. |

Orchestrator verification on e2e8ea1ed: `check:react` exits 0, build exits 0, vitest 3623 pass (no failed file), client-sync 197 pass, lint shows 1 known error. CDP work window, dev and packaged arm64: client-sync active, worker-ui active, `fromQuery` is a function, 0 INVALID PACKAGE / `fromQuery` / Cannot find module / unhandled lines in either log.

Verification on 734f5598e + 4a6e65953 (orchestrator, 2026-11-13): `check:react` exits 0, build exits 0, vitest 3627 pass (no failed file), client-sync 197 pass. Lint shows 1 known error, after the orchestrator formatted dist-mac.mjs (4a6e65953). A real `dist:mac` exits 0, and workspace sqlite3 is arm64 afterwards. CDP work window, dev and the fresh packaged arm64 build: client-sync and worker-ui active, `fromQuery` is a function, 0 error lines.

## Design Notes

No account means sync has nothing to fetch, so "sync starts" here means the package activates and its launcher runs without error. Read that over CDP from the work window (`NylasEnv.packages.isPackageActive("client-sync")` or equivalent) rather than waiting for network activity.

## Verification

**Commands:**
- `pnpm check:react` -- expected: exit 0
- `cd packages/client-app && node scripts/build-renderer.js` -- expected: exit 0
- `pnpm --filter nylas-mail exec vitest run` -- expected: no failed file and no fewer passing tests than baseline (3618; 4 known unhandled errors)
- `pnpm lint` -- expected: no new findings (1 known error)
- dev launch and `pnpm --filter nylas-mail dist:mac` packaged launch, each with a fresh NYLAS_HOME and CDP -- expected: per the acceptance criteria; quit afterwards
