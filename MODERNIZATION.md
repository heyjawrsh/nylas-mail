# Modernization Log — `modernize/current`

Goal: revive the archived Nylas Mail monorepo on a current toolchain (Node LTS, pnpm workspaces, Vitest, Biome), current dependency majors, zero CoffeeScript, coverage-gated passing tests, and current mail/auth protocols. This file is the decision log and the only allowlist for `pnpm outdated` exceptions.

## Baseline (recorded 2026-08-27, from `master` @ a6ec21617)

| Fact | Value |
|---|---|
| Toolchain | Node 6.9.1 / npm 3.10.8 (engines), Babel 6, Grunt, lerna 2.0.0-beta.38 fork, pm2 2.4 |
| Runtime targets | Electron 1.4.15, React 15.4.2, hapi 16, sequelize 3.x (nylas forks), jasmine 2 |
| Source | ~1,090 files: 516 `.es6`, 300 `.jsx`, 154 `.coffee` (all CoffeeScript lives in client-app: 87 src + 96 internal_packages), 119 `.js` |
| Module style | 430 files ESM `import`, 80 files CJS `require` — Babel 6 transpiled on the fly via `babel-node` |
| Specs | client-app 220, client-sync 11, isomorphic-core 7, cloud-api 6, cloud-core 5, cloud-workers 4 |
| Forked/pinned deps | better-sqlite3 (bengotow#…), sqlite3 (tarball fork), sequelize (nylas fork), imap (jstejada fork), simplemde (jstejada fork), debug (emorikawa fork), windows-shortcuts (emorikawa fork), bunyan-prettystream (emorikawa fork), lerna (emorikawa fork) |
| CI | Travis + AppVeyor + AWS EB (.ebextensions), Docker image for cloud |
| Toolchain available | Node 26.3.0 (mise latest), pnpm 11.18.0 |

## Strategy

- pnpm workspaces (`packages/*`) replace lerna bootstrap; keep the `internal_packages/client-sync` symlink via a small postinstall.
- Tests: Vitest per package (jasmine-2 specs migrate mechanically: `jasmine.createSpy` → `vi.fn()`, `spyOn` → `vi.spyOn`, clock → `vi.useFakeTimers()`).
- Server runtime: `tsx` replaces `babel-node` (handles mixed ESM/CJS + extensionless imports, zero config).
- CoffeeScript/CJSX: one-shot mechanical compile to JS, then Biome format + manual repair of hot files.
- Dependency order follows the import graph: isomorphic-core → cloud-core → cloud-api/cloud-workers → client-sync → client-app.
- Protocols: `imap` fork → current IMAP lib (TLS 1.2+/1.3), nodemailer 2 → current major (SMTP + UTF-8/MIME), xoauth2 current (XOAUTH2 refresh), fixture-tested.

## Allowlist (entries allowed in `pnpm outdated`)

`pnpm outdated -r` is CLEAN as of 2026-08-27 (commit 7308d9256). Entries below are
vendored/dead-library records, not registry pins:

| Dep | Disposition | Reason | Replacement evaluated |
|---|---|---|---|
| reflux 6.4.1 | vendored (client-app/src/vendor) | archived upstream, load-bearing store API (10 files) | zustand/mobx — deferred (would be a product-level state rewrite) |
| fs-plus 3.1.1 | vendored | archived atom-era fs helpers (18 files) | node:fs + mkdirp — deferred (API-surface parity needed first) |
| event-kit 2.5.3 | vendored | archived atom emitter API (10 files) | node:events — deferred (dispose semantics differ) |
| emissary 1.3.3 | vendored | archived atom mixin API (4 files) | none exists; manual rewrite required |
| imap-provider-settings | vendored dataset (isomorphic-core/vendor) | upstream repo+npm deleted 2023 | reconstructed from fork + 2026 provider docs |
| decaffeinate 8.1.4 | tooling (ringer tools dir, not a manifest dep) | one-shot CS→JS migration | hand migration — inferior at 300+ files |

## Loop log

### Loop 2 — Workspace scaffold (commit 88f96aefd)
- Root manifest: pnpm 11 workspaces (`packages/*`), engines `>=24`, MIT, scripts test/lint/format; devDeps vitest 4.1.11 / tsx 4.23.12 / biome 2.5.10; root `.babelrc` deleted; lerna-era postinstall replaced by `scripts/link-workspaces.mjs` (client-sync → internal_packages symlink).
- Biome wired at root (`biome.json`); `pnpm lint` exit-0 arrives with the migrations (legacy code still trips it).
- Toolchain audit: Node 26.3.0 + pnpm 11.18.0 via mise; branch `modernize/current` cut from master.

### Round 1 — Ringer swarm (run `nylas-mail-modernize`)
- Engine: codex GPT-5.6 Sol per scoreboard (proven code-fix, 42 tasks / 86% pass; user unavailable → standing "educated guesses" instruction). HUD at http://127.0.0.1:8700.
- Lanes: `isomorphic-core-convert` (pilot: vitest+joi17+sequelize6+nodemailer7, .es6→.js) and `coffee-migrate-message-list` (19 files, decaffeinate one-shot + esbuild parse gate). Gates: lint clean, baseline 2/2 correctly-fail, prove-fail 2/2 proved.
- Dep decisions: drop atob/btoa/promise-props/promise.prototype.finally (native); joi→17, sequelize→6, nodemailer→7, rx-lite→rxjs 7 if imported.
- **Protocol port design (my lane, next round)**: keep IMAPConnection/IMAPBox public API frozen, reimplement on `imapflow`; TLS floors `minVersion: TLSv1.2` + `rejectUnauthorized: true` by default (the old "insecure by default" backcompat branch dies; explicit opt-in only); XOAUTH2 keeps xoauth2 generator feeding imapflow `accessToken`; fixture/mocked tests only (no live servers).
- Allowlist (pre-declared): `imap-provider-settings` (provider dataset, no registry equivalent — vendor later); `imap` fork pending my imapflow port (temporary).

### Loop 3 — isomorphic-core conversion landed (commit 63edb0497)
- Ringer pilot failed on my scaffold's stale lockfile (filtered installs still validate the whole workspace). Fix: workspace membership ratchets to converted packages only (`pnpm-workspace.yaml`); salvaged the worker's completed conversion, verified + repaired inline (mixed require/import codemod via ast_edit, message-utils ESM exports, vendored provider dataset after discovering upstream repo deleted + npm-unpublished; fork snapshot + gmail/office365 canonical keys restored with 2026 values; SSLv3 cipher pins stripped).
- `imap` fork switched to https tarball (ssh-agent unavailable to ringer workers and my shell).

### Loop 4 — IMAP protocol port to imapflow 1.7 (commit 87ce26775)
- node-imap fork REMOVED. `IMAPConnection`/`IMAPBox` APIs frozen; internals on imapflow. Translators in `src/imap-translators.js` cover the exact node-imap shapes client-sync emits (criteria, struct, body specs, XOAUTH2 SASL).
- TLS: `minVersion: TLSv1.2` both modes; cert verification default-on; insecure is explicit opt-in only. XOAUTH2: refresh-token and backend-token flows → imapflow accessToken.
- 48/48 tests green (32 new). Coverage 27% — hardening round queued. Allowlist: `imap` fork entry CLOSED (dep deleted).
- Coffee lane: sandbox has no network → decaffeinate + esbuild staged at absolute paths (`~/.ringer/tools/decaffeinate`); lane relaunched.

### Loop 5 — message-list CoffeeScript migration (commit 2b13b1a04)
- Ringer round 2 passed after staging decaffeinate + esbuild at absolute paths (worker sandboxes have no network). 19 files migrated, esbuild-parse-verified, applied after review.

### Loop 6 — cloud-core modernized (commit 82e7e85be)
- pino (sync writes; pino-pretty dev; in-memory test stream), redis 5 (async clients; broadcastClient/notifyDelta now async), rxjs 7, mysql2, sqlite3 5.x, googleapis 152, umzug 3 with self-contained sequelize storage. Phantom deps (aws-sdk, signalfx, request, raven) deleted — never imported. 91.3% lines.

### Loop 7 — cloud-workers modernized (commit 3e2b4f6a)
- @hapi/hapi 21 (inject-testable monitoring server), @aws-sdk/client-s3 v3, hot-shots, @sentry/node, Sequelize.Op, findByPk/findOne, native promises. 33 tests, 86.9% lines.
- Round 3 in flight: 7 coffee lanes (src/components, src/flux, src root, keybase, thread-list, misc, category-picker explore lane on free nemotron) + isomorphic-core coverage hardening (check = package test gate itself).

### Loop 8 — dep floors to latest majors (commit 407261ec1)
- joi 18 / nodemailer 9 / redis 6 / sqlite3 6 / hot-shots 17 / googleapis / pino / @aws-sdk / @sentry bumped; all three server suites green post-bump; `pnpm outdated` clean for isomorphic-core, cloud-core, cloud-workers. @scarf/scarf telemetry postinstall denied.
- Round 3 salvage: 4 verified patches applied (flux/keybase/thread-list/misc-1, 0 parse failures); src-root lane worktree discarded (worker deleted 87 sources without converting — spec hardened to convert-then-delete); category-picker salvaged manually (JSX-in-.js renamed .jsx). codex OAuth capacity hit at max_parallel 4 → round 4 runs at 2.

### Client-app phase plan (next)
1. Finish CoffeeScript migration (lanes in flight: components, src-root; then remaining ~100 in internal_packages small dirs).
2. Manifest + toolchain: electron current, react 19, vite/esbuild build (grunt/babel6/coffee pipeline deleted), vitest + @testing-library, electron-builder packaging; apm/ (Atom plugin manager) dropped with the Atom ecosystem.
3. Import graph: `nylas-exports` bridge stays app-provided; specs stub it.
4. React 15 → 19 codemods: createClass→ES classes, PropTypes→prop-types, react-addons-* → react-transition-group/testing-library; legacy lifecycles.
5. Reflux: no maintained npm equivalent — vendor it (MIT, tiny) with an allowlist entry; new state code uses modern approaches. If React 19 migration degrades into product-level UI redesign, that tripwires stop-condition (d) and surfaces to the user instead.


## Status after loop 12 — coverage gates green on 5/6 packages

| Package | Tests | Lines | Gate |
|---|---|---|---|
| isomorphic-core | 138 | 81.7% | ✓ |
| cloud-core | 1 | 91.3% | ✓ |
| cloud-workers | 33 | 86.3% | ✓ |
| cloud-api | 44 | 94.3% | ✓ |
| client-sync | 197 | 60.7% | ✓ (commit 58e4247f9) |
| nylas-mail | 11 | 0.32% | ✗ coverage gate — React app, 3 spec files vs ~500 components |

`pnpm lint` GREEN. `pnpm -r test` blocked ONLY by nylas-mail coverage gate.
Ringer ledger: 11 rounds, 30+ tasks; every failed lane's work salvaged + verified inline.

## Status after loop 9 (2026-08-27, deep session)

### Green with enforced coverage gates (individually verified)
| Package | Tests | Line coverage | Gate |
|---|---|---|---|
| isomorphic-core | 138/138 | 81.7% | 80/60 ✓ |
| cloud-core | 1/1 | 91.3% | 80/60 ✓ |
| cloud-workers | 33/33 | 86.3% | 80/60 ✓ |
| cloud-api | 44/44 | 94.3% | 80/60 ✓ |

### In progress
- client-sync: **all 6 suites green** (17 passed, 1 documented skip; commit 1ced654e0). ESM cutover complete, hapi-21 local API, Op.in reference matching. Remaining: coverage 22.2% vs 60% gate — hardening round queued. Root `pnpm -r test` aborts only on this gate now.
- client-app: runtime 100% JS/JSX (CoffeeScript + .es6 all migrated, parse-verified); modern manifest (react 19/electron 44/vitest+jsdom), atom-era libs vendored (reflux/fs-plus/event-kit/emissary — allowlist), vitest aliases for nylas-* bridges. NOT yet on the workspace ratchet; first proof spec + React 19 component migration remain.

### Remaining to goal completion
1. client-sync suite green (fix 5 failing spec harnesses).
2. client-app: ratchet + first specs; React 15→19 component migration (createClass→classes codemod); enzyme/react-addons replacement; smoke script (electron boot).
3. Legacy spec/*.coffee port (73 files) or documented removal decision.
4. Root: pm2 ymls off babel-node; scripts cleanup; .github workflow; `pnpm outdated` sweep to allowlist (client-app vendored + any stragglers); full `pnpm -r test` green; `pnpm lint` clean.
5. Allowlist finalization in this file (vendored: reflux, fs-plus, event-kit, emissary, imap-provider-settings dataset).

### Ringer ledger
6 rounds, 21 tasks run; salvage pattern (verify worktree, import, fix inline) recovered 5 failed lanes' work. Post-mortems: worker sandboxes have NO network (specs must be edit-only); pnpm auto-inserts `allowBuilds` placeholders that poison worktrees — purge after every add; OAuth capacity limits max_parallel to 2.


## Loop 13 — Electron 44 boot convergence (commit 5f81de083)

Smoke (`pnpm --filter nylas-mail run smoke`) reaches renderer init: main process
boots, config loads, sqlite opens (better-sqlite3 13 sync API), window manager
starts, "App load time" logged. Sixteen boot crashes fixed in the loop (API
ports + module-system unification; see commit message for the full list).

### Remaining to `pnpm smoke` green
Renderer module graph under React 19: the renderer loads the flux stores +
component kit through the vendored reflux and 300 converted JSX components.
Boot crashes now surface one-per-launch from the renderer require chain. This is
the same converge-by-iteration pattern; each fix is one Electron launch away.

### Remaining to full goal
1. Renderer boot (above) -> smoke exit 0.
2. client-app coverage 0.32% -> 60% (18,334-line UI surface; needs component
   test authoring at scale — ringer swarm rounds over the component tree).
3. Final `pnpm -r test` (blocked only by #2's gate).


## Loop 14 — Renderer bundling + SMOKE_PASS (commit b531b707d)

`pnpm --filter nylas-mail run smoke` exits **0** with `SMOKE_PASS: app booted,
window ready, sync backend initialized`. The Electron 44 app boots end-to-end:
main process → config → sqlite (better-sqlite3 13) → window manager → bundled
renderer (flux layer + stores + component kit) → clean exit.

### Renderer pipeline (replaces 2017 babel/coffee JIT)
- `scripts/build-renderer.js`: esbuild bundles both window bootstraps to
  `static/*.bundle.js` (CJS, chrome130, electron/.node externals, optional
  natives stubbed). `smoke` = build + launch.
- Bundle banner seeds a URL-backed `NylasEnv` shim (load-time store singletons
  read config/inDevMode/getResourcePath before the real env exists);
  `bootstrap-assign-env.js` swaps in the real env as the first import.
- `requireFromSrc` in nylas-exports/component-kit: module-context-aware lazy
  resolution (nodeRequire first, resourcePath fallback for bundled contexts).
- 187+ decaffeinate constructors gained missing `super()` (V8 hard error).
  A sweep bug briefly corrupted third-party .pnpm files (joi, sequelize,
  nodemailer, imapflow, libmime, rxjs, hapi, vitest) — restored by deleting the
  affected .pnpm dirs and reinstalling from the intact store; all suites
  re-verified green afterward.
- Electron API ports: `electron.remote` → `@electron/remote` (per-window
  `enable()`), `document.registerElement` → `customElements` v1,
  nodeIntegration/contextIsolation restored (legacy renderer requires Node).
- `.es6` files renamed to `.js` (32 runtime + spec); chrono-node v2 namespace
  import; lru-cache 11 `LRUCache`; `request` → fetch-based `request-compat.js`;
  q/raven-js dropped (unused).

### Verification snapshot (2026-08-27)
| Check | Result |
|---|---|
| isomorphic-core | 138 tests GREEN (81.7% lines gate) |
| cloud-core | 1 test GREEN (91.3%) |
| cloud-workers | 33 tests GREEN (86.3%) |
| cloud-api | 44 tests GREEN (94.3%) |
| client-sync | 197 tests GREEN (60.35% stmts gate) |
| client-app tests | 11 GREEN (threshold gate RED: 0.32% vs 60%) |
| pnpm lint | GREEN |
| pnpm outdated -r | CLEAN |
| pnpm smoke | SMOKE_PASS, exit 0 |

### Remaining
client-app coverage: 11 tests / 0.32% vs enforced 60/45 gate — the only red
item. ~18.3k source lines; needs component + store spec authoring at scale
(@testing-library/react patterns proven in `spec/toast.spec.jsx`; store specs
per the client-sync rounds). This is the final goal criterion.


## Loop 15 — Coverage campaign round 1 (commit 819d4606e)

client-app: 0.32% → **9.01% lines** (322 tests, 13 files, all green). Ringer
swarm (6 codex workers, round12.json) authored the specs; integration hardened
the vitest harness into something the next rounds can build on directly:

- package-root pinning (root runs were swallowing sibling packages' specs)
- `spec/stubs/` node-bridge packages (electron, @electron/remote, nylas-*):
  named exports cjs-module-lexer can see; default electron export remains the
  binary path so smoke keeps working
- eager-but-cycle-guarded materialization of the lazy bridge getters
- `globalThis.$n` anchor makes nylas-exports loadable in CJS and ESM contexts
- `model.fromJSON` no longer assigns getter-only computed attributes

Per-round yield ≈ +9 pts/line-coverage at current module mix. Remaining gap to
the 60% gate ≈ 6 rounds of similar scope (stores, components via
testing-library, internal_packages). The harness is now the bottleneck-free
part — subsequent rounds are pure spec authoring.

Smoke re-verified SMOKE_PASS after all changes; lint green; 5 server packages
re-verified green.


## Loop 16 — Coverage campaign round 2 (commit 4783712a2)

client-app: 9.01% → **10.23% lines** (380 tests, 16 files, all green). Real
fixes landed outside the specs themselves: Publisher restored to reflux-coffee
(lost in a decaffeinate truncation — the original coffee exported both
Listener and Publisher), nylas-store/coffee-helpers proper ESM export shapes,
static-import extension gaps closed, 56 components given the missing
`import PropTypes`, nylas-api-helpers map converted off bare require.

Five worker specs deferred to `spec/deferred/*.disabled` (draft-factory,
message-store, focused-content-store, thread-counts-store, components-list-
tabular, internal-sidebar): mock-wiring mismatches and Rx-timeout issues in
the specs themselves — the modules under test are fine. First task of the
next round.

Yield curve is flattening (+1.2 pts this round vs +8.7 last): the remaining
mass is stores (need Rx/mock wiring) and internal_packages (need the plugin
bridge). Rounds 3+ should target internal_packages/lib directly (pure logic,
no bridge) and fix the deferred five first.

Verification after round 2: lint green, smoke SMOKE_PASS, isomorphic-core +
client-sync re-verified green.


## Loop 17 — Coverage round 3 + the JSX-extension wall (commit 8b1c2216b)

client-app: 10.23% → **12.10% lines** (445 tests, 18 files green). comp-services
(search backends, 37) + comp-tasks (change-mail request bodies, 28) landed.

### The wall, precisely
comp-root-1/2/3 + comp-contenteditable (≈120 tests authored, deferred) import
components whose chains reach JSX files through STATIC ESM imports in natively
loaded modules. Node's ESM loader has no extension hooks — `.jsx` cannot be
imported natively, period. Attempted the industry-standard fix (rename all 373
`.jsx` → `.js`, JSX-in-.js with plugin-react/esbuild loaders): REVERTED —
vitest 4's oxc parser rejects several class-property+JSX combinations that
esbuild and the old pipeline accept. Two viable unblocks (next loop):
1. oxc-compatible rewrite of the ~10 offending component files, then redo the
   rename (mechanical, bounded);
2. per-spec vi.mock of the bridge so the heavy chains never load (per-file
   mocking, what comp-tasks successfully does).

Harness durables this round: plugin-react wired, link-bridges.sh (pnpm installs
wipe manual node_modules symlinks — relink via `link:test-bridges`),
nylas-exports 90-name ESM surface, webFrame/menu/commands/config.observe stubs,
mailbox-perspective super() fix, query-subscription duck-type guards.

Yield: +1.9 pts/round at current mix; stores+components remain the mass.


## Final Report — 2026-08-27 (session 3 end)

### Success criteria status

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Toolchain current (pnpm, Biome, no Babel6/Grunt) | **MET** | pnpm workspaces all 6 pkgs; biome.json; CI workflow `.github/workflows/test.yml` |
| 2 | Dependencies current (`pnpm outdated` clean w/ allowlist) | **MET** | `pnpm outdated -r` empty; allowlist table above documents vendored libs |
| 3 | Tests fully passing (`pnpm test` exits 0) | **PARTIAL** | 5/6 packages green (413 tests); client-app 445 green but its coverage gate fails the recursive run |
| 4 | Coverage enforced per package | **5/6 MET** | isomorphic-core 81.7%, cloud-core 91.3%, cloud-workers 86.3%, cloud-api 94.3%, client-sync 60.35%; client-app **12.10% vs 60% gate** (enforced, failing) |
| 5 | Techniques current (no .coffee/.cjsx, Vitest, React 19) | **MET** | zero coffee outside vendored; vitest 4 everywhere; react 19.2 + electron 44 |
| 6 | Standards/protocols current (TLS1.2+, XOAUTH2, MIME) | **MET** | imapflow 1.7 + nodemailer 9 + libmime 5.4; XOAUTH2 both flows fixture-tested |
| 7 | Electron smoke exits 0 | **MET** | `pnpm smoke` → SMOKE_PASS, exit 0 (renderer boots via esbuild bundles) |

### Measured verification (2026-08-27, commit 8b1c2216b)
- `pnpm lint` → GREEN
- `pnpm outdated -r` → CLEAN
- `pnpm smoke` → exit 0
- Per-package: 138 + 1 + 33 + 44 + 197 + 445 = 858 tests passing
- client-app coverage: 12.10% lines / 9.83% branches / 10.29% functions (gate: 60/45/45)

### Remaining work to full green (single blocker)
client-app coverage 12.10% → 60%: ≈48 points at ~2 points/swarm-round = ~20
more rounds. Blocked families (components ≈6k lines) sit behind the
JSX-in-static-ESM wall (see loop 17 for the two unblock paths). Stores
(4.2k lines) need per-spec bridge mocking per the comp-tasks pattern.

### Cumulative session commits
52 → 63 ahead of master (this session: smoke convergence, renderer bundling,
3 coverage rounds, Publisher restoration, 858-test corpus).


## Loop 18 — The JSX wall, dismantled (commit 2abb1549a)

client-app: 12.53% → **15.76% lines** (647 tests, 27/27 files green). Every
deferred spec recovered. What the wall actually was — three stacked problems:

1. **Mixed module syntax**: 33 component files used CJS `require` inside
   ESM-syntax files; the vite transform chain failed with a misleading
   `Unexpected token '<'` pointing at unrelated JSX. All converted to ESM.
2. **Eager kit registration**: `NylasComponentKit.initClass()` eagerly
   required a .jsx at module scope; under vitest the CJS shim has no JSX
   loader, and Node ESM-detects .jsx files (import statements) so extension
   hooks don't apply either. Fixed by env-gating the pass under vitest and an
   inline esbuild compile-cache in `requireFromSrc` for runtime/native paths.
3. **Silent alias gap**: the vitest alias for `nylas-component-kit` pointed at
   the real module, not the shim — every kit import in specs bypassed the
   lazy-proxy machinery.

Also: unbound proxy returns (bound functions lose `.prototype` →
`class extends React.Component` broke), bind-before-super constructors in
menu.jsx, React 19 findDOMNode removal honored in two retired tests.

**Consequence**: all component families are now reachable by specs. Swarm
rounds 4+ can target any directory without per-file interop work.


## Loop 19 — Coverage round 4 + a real bug (commit c34652b20)

client-app: 15.76% → **18.18% lines** (818 tests, 37/37 files green). Ten new
spec files from swarm round-15.

**Worker spec caught a production bug**: `preferences-ui-store` sorted tabs
with a boolean comparator (`a.order > b.order` — never negative), so tabs
registered out of order displayed unsorted. Fixed to `a.order - b.order`.

Interop lessons banked: ESM-ify sources for vi.mock interception (category
store, multiselect handlers); keep dual-context modules CJS when the renderer
bundle loads them natively (deprecate-utils reverted — ESM `export` breaks
`require()` in the packaged app).

Cumulative session arcs: 12.10% (loop 17 start) → 18.18% through wall
demolition + two swarm rounds. Remaining mass: components (~2.5k lines),
stores remainder, browser/ (1.4k), services.


## Loop 20 — Round 5 + the dual-context module contract (commit f1c58d9b0)

client-app: 18.18% → **20.13% lines** (997 tests + 4 skipped, 49/49 files).
Smoke was broken by round-5's ESM conversions; recovering it produced the
missing architectural piece:

**The dual-context module contract.** Three loading worlds now coexist:
(a) the esbuild renderer bundle, (b) native renderer CJS requires
(runtime-loaded modules), (c) vite/vitest ESM transforms. Contract:
- Bridge registrations use literal-require thunks → esbuild inlines them;
  the same thunk falls back to requireFromSrc under vite.
- Modules the renderer loads natively are dual-CJS (no import syntax) with
  `.default` interop; their ESM consumers destructure defensively.
- ESM-graph modules (stores, models) stay ESM; native contexts reach them
  only through the bridge.

Also this round: search-bar React 19 port (createRef for string refs —
findDOMNode removed in 19), spellcheck/webFrame/crashReporter renderer-API
guards, config-schema/menu-manager/keymap-manager/command-registry/
action-bridge/database-change-record dual-CJS, api-helpers map through
bridge names, rimraf/mkdirp/uuid named-import fixes.

Verified: 997 tests green, lint green, bundle clean, smoke SMOKE_PASS rc=0,
5 server packages green, `pnpm outdated -r` clean.
