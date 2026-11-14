---
title: 'Refactor sweep: the gate runs clean'
type: 'refactor'
ticket: '9'
created: '2026-11-14'
status: done
baseline_revision: '1573f9acbef3a377bedd68d14b2caf68399e035b'
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

**Problem:** The epic left its gates noisy. Vitest passes every test but exits 1 on 4 unhandled errors, and the e2e harness tolerates three app errors through `e2e/known-errors.json`:
- BufferedProcess `killed` (#17)
- DraftNotFoundError from Bluebird-only promise calls on native promises (#11)
- the keybase key-dir watch race on Linux (#22)

A few small deferred defects also remain: the tooltip's missing DateUtils import (#12), the `%20` baseURI fallbacks, and the seed's checkpoint fallback.

**Approach:** Fix the root cause of each one, so that Vitest exits 0 and `known-errors.json` keeps only the `nylas://` entries (#18). Those stay because the font question belongs to epic-token-platform. This is cleanup only: no feature changes.

## Boundaries & Constraints

**Always:**
- Fix causes, not symptoms. A spec stub may change only where the spec, not the app, is wrong.
- Every fix ships with the spec or harness check that would have caught it.
- Remove each known-errors entry in the same commit as its fix.
- Commit locally on `modernize/current` with no attribution lines, and never push. Refs #7, #11, #12, #17 and #22.

**Never:**
- #18 or the `nylas://` fonts (epic-token-platform).
- The packages story 13.13 removes, which are activity-list, composer-mail-merge, composer-scheduler, link-tracking, open-tracking, send-later, send-reminders and nylas-private-salesforce.
- #10 (keytar), #14 (showMessageBox), #19 (the load flake), #20 and #21.
- Restoring `apm` or the plugin store's featured list. When apm is absent, the plugins store just shows nothing.
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unit suite | `npx vitest run` | every test passes, 0 unhandled errors, exit 0 | — |
| Main window starts, no apm | built app, no `apm/` dir | no `killed` TypeError and no spawn error reaches the renderer | the missing apm is handled quietly, at most a `console.warn` |
| Pristine composer or popout closes | blank draft destroyed | no DraftNotFoundError and no "not a function" | a missing draft is treated as already gone |
| Fresh profile with `keys/` but no subdirs | Linux, first launch | both subdirs exist before `watch()`; no ENOENT | — |
| baseURI with a space | `file:///…/Nylas%20Mail.app/…` | decoded path with a real space | — |
| Seed checkpoint while a statement is open | the same connection holds a transaction | the seed still checkpoints, or reports clearly; no SQLITE_LOCKED crash | — |

</frozen-after-approval>

## Code Map

- **Vitest unhandled errors** (all in `packages/client-app`):
  - `spec/window-event-handler.spec.js:136-140`: the `runUnloadFinished` spy runs the real function (`src/window-event-handler.js:182` requires `@electron/remote`, which gets the bridge stub). Add `.mockImplementation(() => {})`.
  - `spec/task-queue-processing-deep.spec.js:109-112`: `_processTask` isn't awaited. The real `Task` (`task-queue.js:20`) fails `instanceof` at `:507`, and the `catch` at `:403-407` re-runs `dequeue`. Await it and stub `dequeue`.
  - `spec/setup.js:76`: the `getLoadSettings` stub has no `resourcePath`, so `src/…/utils.js:298/323` calls `path.join(undefined)` (from `spec/comp-root-3.spec.jsx:181`). Add `resourcePath`.
  - NetworkError: probably `spec/core-infrastructure-deep.spec.js`, where `src/chaos-monkey.js:8-9` installs real persistent nock interceptors and the test at `:152` asserts on an empty array. Confirm by running that spec alone. Then call `ChaosMonkey.goHome()` in `afterEach` and assert with `nock.pendingMocks()`.
- **#17:** `src/buffered-process.js:265`, where `triggerExitCallback` is a plain `function` and so has no `this`. Make it an arrow function. The caller chain is `internal_packages/plugins/lib/packages-store.jsx:15/26` → `apm-wrapper.js:44`. With the arrow fix, the missing `apm/` may throw "Failed to spawn command" from `handleError` (`:316`). Handle ENOENT in `apm-wrapper` or `packages-store` and resolve to an empty list.
- **#11:** `.catch(ErrorClass, fn)` and `.thenReturn` on native promises:
  - the 5 typed-catch sites are `src/flux/tasks/destroy-draft-task.js:23,61`, `event-rsvp-task.js:54`, `syncback-category-task.js:99` and `destroy-category-task.js:89`;
  - `.thenReturn` is at `destroy-draft-task.js:60` and `event-rsvp-task.js:53` (`NylasAPIRequest.run()` is async);
  - also audit `draft-store.js:148` (`.reflect`) and `:297`, `draft-editing-session.js:311`, `draft-factory.js:334` and `syncback-model-task.js:38,107`.

  The pattern is `.catch(e => { if (!(e instanceof X)) throw e; … })` and `.then(() => value)`. Leave chains that start from a Bluebird `new Promise`, but convert them anyway when it's free.
- **#22:** `internal_packages/keybase/lib/pgp-key-store.jsx:63-105`. Replace the nested async `mkdir` calls with `fs.mkdirSync(dir, { recursive: true })` for both subdirs, then `_populate()` and `watch()`. The first-run branch currently skips `_populate()`, which is harmless with an empty dir, but run it the same way.
- **#12:** `internal_packages/thread-list/lib/thread-list-scroll-tooltip.jsx:51`. Import `DateUtils` from `nylas-exports`, and delete the `globalThis.DateUtils` patch at `spec/internal-list-components-deep.spec.jsx:189`, which is already mocked at `:24/29`.
- **baseURI:** `src/nylas-env.js:27`, `src/global/nylas-exports.js:30` and `src/global/nylas-component-kit.js:56`. Use `fileURLToPath(new URL(".", document.baseURI))`, as `packages/isomorphic-core/src/load-models.js:10` does.
- **Seed checkpoint:** `scripts/seed-fixture-account.mjs:~100-125, 234`. A checkpoint on `DatabaseStore._db` hits SQLITE_LOCKED in any mode while that connection has an open statement or transaction, and contention from other connections only shows up as `busy`. Run the checkpoint from Node on a fresh better-sqlite3 connection after the app exits, and drop the in-app TRUNCATE-then-PASSIVE path.
- **Harness:** `e2e/known-errors.json` loses the #17, #11 and #22 entries. `spec/e2e-harness.spec.js` holds the checkpoint spec.

## Tasks & Acceptance

**Execution:**
- [ ] the 4 spec files above -- fix each unhandled error at its cause, confirming the NetworkError source first -- Vitest exits 0
- [ ] `src/buffered-process.js`, `internal_packages/plugins/lib/apm-wrapper.js` (or packages-store) -- arrow-function fix, plus quiet handling when apm is missing -- #17
- [ ] `src/flux/tasks/*.js`, `src/flux/stores/draft-*.js` -- replace the Bluebird-only calls on native promises -- #11
- [ ] `internal_packages/keybase/lib/pgp-key-store.jsx` -- create the dirs synchronously, then populate and watch -- #22
- [ ] `thread-list-scroll-tooltip.jsx` and its spec -- the real import -- #12
- [ ] the three baseURI fallbacks -- `fileURLToPath` -- spaces and drive letters
- [ ] `scripts/seed-fixture-account.mjs` -- checkpoint on a fresh connection after exit -- seed reliability
- [ ] `e2e/known-errors.json` -- remove the #17, #11 and #22 entries -- the gate tightens
- [ ] specs -- one per fix:
  - BufferedProcess exit callback
  - destroy-draft on a missing draft, and event-rsvp
  - key-store fresh dir
  - baseURI with `%20`
  - checkpoint with an open statement
- [ ] git -- delete untracked `.nylas-smoke-home` leftovers if any, and confirm Biome is clean -- the old known lint error

**Acceptance Criteria:**
- Given the repo, when `npx vitest run` runs, then it exits 0 with no unhandled errors, and passes no fewer tests than the 3915 baseline
- Given the built mac app, when `pnpm --filter nylas-mail e2e` runs with the trimmed `known-errors.json`, then all tests pass
- Given the built Linux app in Docker, when the harness runs, then it passes with the same trimmed list

## Implementation Notes

- The NetworkError came from chaos-monkey's native `require()` of nylas-api.js, not from nock (vi.mock can't reach it). The spec seeds the require cache and drives the real nock.
- `spec/tasks-remaining.spec.js:181` asserted the #11 bug; it now expects a missing draft to resolve. Also fixed `PermanentErrorCodes.inclue` in destroy-draft-task.
- draft-store's `.reflect()` became `Promise.allSettled` (Bluebird 3.7.2 has it too).
- After the checkpoint the `-wal` file stays at 0 bytes; the main file stands alone (the spec reads a copy).
- Found, not fixed: a dotfile in keys/ hangs keybase's `_populate` (#23).

## Plan Change Log

## Review Triage Log

| # | Lens | Finding | Verdict | Route | Evidence |
|---|------|---------|---------|-------|----------|
| 1 | quick | missing apm on Windows still rejects `getInstalled()` | medium | patch | BufferedProcess spawns `cmd.exe /s /c` on win32, so a missing `apm.cmd` exits 1, not ENOENT; `packages-store.jsx:215` has no catch, so preparing the Plugins tab leaves an unhandled rejection. |
| 2 | quick | AC2 and AC3 (real-app runs) unverified | false | reject | Mac e2e ran on this tree: 18 passed, exit 0. The Linux Docker run is recorded under Verification. |

## Verification

**Commands:**
- `pnpm check:react` and `pnpm check:public-build` -- expected: exit 0
- `npx biome check .` -- expected: no errors
- `cd packages/client-app && npx vitest run` -- expected: exit 0, no unhandled errors, ≥3915 passing
- `pnpm --filter nylas-mail build:e2e && pnpm --filter nylas-mail e2e` -- expected: 18 passed. If the post-rebuild flake from #19 appears, rerun and record it
- `packages/client-app/e2e/linux-docker.sh` -- expected: pass
- seed 10 times into fresh dirs -- expected: 10 of 10

**Results** (after the review patch 1e21da01e):
- `check:react`, `check:public-build`, Biome: pass, no errors
- Vitest: exit 0, no unhandled errors, 3932 passed
- Mac e2e: 18 passed, 9 skipped, background mode; no #19 flake
- Linux Docker: 18 passed (9.4m), exit 0
- Seeds: 10 of 10 with the built app, each `checkpoint=truncate`, WAL 0 bytes
- `known-errors.json` keeps only the two #18 entries
