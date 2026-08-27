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
