---
title: 'Cloud-backed plugins are removed'
type: 'refactor'
ticket: '13'
created: '2026-11-15'
status: done
baseline_revision: '7bcbd7333ae7ea2edda465c8c27329bfaea0e50c'
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

**Problem:** Eight client packages only work against the retired Nylas cloud: activity-list, composer-mail-merge, composer-scheduler, link-tracking, open-tracking, send-later, send-reminders and nylas-private-salesforce. They load dead code, add two e2e windows that open empty (scheduler-calendar, SalesforceObjectForm), and would add eight packages to the LESS removal in epic-token-platform. Separately, `PackageManager.loadPackage` silently skips a package whose `supportedEnvs` excludes the current env (#20).

**Approach:** Delete the eight packages, along with their specs, their e2e windows, axe baseline entries and reference screenshots, and every reference to them in config and specs. Make `loadPackage` warn when it skips a package for its env. Josh approved the removal (#20); the code stays in git history.

## Boundaries & Constraints

**Always:**
- Remove the packages whole, never leaving a stub. Edit any spec that mixes removed and kept packages so it keeps the kept cases unchanged.
- The warning names the package and the env, and it's a `console.warn`, not a thrown error.
- Tests ship with the change: a spec covers the skip warning.
- Commit locally on `modernize/current` with no attribution lines, and never push. Refs #20.

**Never:**
- packages/cloud-api, cloud-workers or isomorphic-core (server-side tracking and send-later). The client stops shipping them; the server code is a separate decision.
- Changing send behaviour. `send-draft-task.js` looks the tracking plugin ids up by name, and once the packages are gone it sends with tracking off. Leave it as it is.
- CHANGELOG history, LESS work beyond deleting the one darkside `.activity-list-container` rule, or #18, #19 and #23.
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh profile | default `dot-nylas/config.json` | no removed package is listed in `core.disabledPackages`, and none loads | — |
| Old profile | config lists a removed package (e.g. disabled `send-later`) | starts normally; the stale name is ignored | no error dialog |
| Package for another env | `supportedEnvs: ["staging"]`, env `production` | `loadPackage` returns null and logs one warning naming the package and env | `console.warn` |
| Draft with tracking metadata | old draft carrying open-tracking metadata | sends as a normal message | — |
| Harness | the e2e window list | scheduler-calendar and SalesforceObjectForm are gone; every other window passes | — |

</frozen-after-approval>

## Code Map

All paths are under `packages/client-app`.

- Delete `internal_packages/{activity-list,composer-mail-merge,composer-scheduler,link-tracking,open-tracking,send-later,send-reminders,nylas-private-salesforce}/`, about 300 files. composer-mail-merge vendors papaparse in its own `node_modules`. None of them is a pnpm workspace member, so the lockfile doesn't change.
- Delete the dedicated specs: `spec/composer-mail-merge-token-data-source.spec.js`, `spec/composer-scheduler-helpers.spec.js`, `spec/internal-activity-data-source.spec.js` and `spec/internal-reminder-store-deep.spec.js`. Confirm each one tests only removed packages first.
- Mixed specs: drop only the cases that load removed packages.
  - `spec/internal-attachments-tracking-deep.spec.jsx` (the link- and open-tracking parts), `spec/internal-snooze-reminders.spec.js` (the send-reminders utils), `spec/lifecycle-packages-prop-change.spec.jsx`, `spec/mail-composer-refs.spec.jsx:518`, `spec/remaining-packages-refs.spec.jsx`.
  - `spec/check-removed-react-apis.spec.js:59-60`: drop the path entries.
  - `spec/package-migration-manager.spec.js`: replace the fixtures that use removed names with kept ones.
- `src/browser/package-migration-manager.js:20-41`: remove the migration entries for nylas-private-salesforce, send-reminders and send-later.
- `dot-nylas/config.json:12-25`: remove the names from the default lists.
- `internal_packages/ui-darkside/styles/darkside-window-controls.less:74`: delete the `.activity-list-container` rule.
- `build/resources/asar-ordering-hint.txt`: drop the lines for removed packages.
- e2e:
  - `e2e/windows.mjs:91-150`: remove the scheduler-calendar and SalesforceObjectForm windows, and update the "next three windows" comment for the one that's left (calendar).
  - `e2e/axe-baseline.json`: remove both entries for both OSes.
  - Delete `e2e/reference/linux/{scheduler-calendar,SalesforceObjectForm}.png`.
- #20, in `src/package-manager.js:799-804`: before `return null`, add `console.warn` naming `pack.name` (or the basename), the package's `supportedEnvs` and the current env. Add a spec in the existing package-manager spec style.
- Leave alone: `src/flux/tasks/send-draft-task.js`, the comments in `feature-usage-store.jsx` and `delta-processor.js`, and `spec/zero-coverage-stores-deep.spec.js:137`, whose "Later" is only a title.

## Tasks & Acceptance

**Execution:**
- [x] removal lane: package dirs, dedicated and mixed specs, config, migration manager, darkside rule, asar hint
- [x] e2e lane: windows.mjs, axe-baseline.json, reference PNGs
- [x] warning lane: `src/package-manager.js` plus its spec (#20)

**Acceptance Criteria:**
- Given the repo, when `git grep -E '<the eight names>|scheduler-calendar|SalesforceObjectForm' -- packages/client-app ':!**/CHANGELOG.md'` runs, then it finds only `send-draft-task.js`, its spec, and the two doc comments listed above.
- Given the repo, when Vitest runs, then it exits 0 with no unhandled errors. The test count drops only by the removed packages' tests.
- Given the built mac app, when the harness runs, then every remaining window passes, and the run logs no package load errors.
- Given a package with `supportedEnvs` excluding the env, when `loadPackage` runs, then it returns null and warns once with the package name and env.

## Implementation Notes

- The work ran as three parallel Ringer lanes on gpt-6-astra (removal, e2e, warning). Each passed first try. Commits: d64d3e5f8, plus 1e24c40aa for the review fixes.
- 308 files deleted with the packages and their four dedicated specs. All seven mixed specs were trimmed, none deleted. Vitest went from 3977 to 3875 tests, then back up to 3877 with the rebuilt HasTutorialTip tests.
- The skip check in `loadPackage` now runs before the Package is built, so a package that isn't loaded is never built.
- The spec reaches the real Package through `createRequire`: `package-manager.js` loads it with a native require, so `vi.mock` can't reach it.
- 23 images used only by the removed packages are gone. `mail-merge/icon-column-*` stays, because `src/components/editable-table.jsx` uses it.
- The first Mac e2e after each rebuild hit the #19 print-window timeout, and the rerun passed. One Linux run died on a qemu SIGBUS at launch, and the retry passed.

## Review Triage Log

| # | Lens | Finding | Verdict | Route | Evidence |
|---|------|---------|---------|-------|----------|
| 1 | quick | new #20 spec uses `composer-scheduler` as its fixture name | medium | patch | AC1 grep hits `spec/package-manager-deep-2.spec.js:220-228`. Rename to a neutral name. |
| 2 | quick | images used only by the removed packages still ship | medium | patch | `static/images/{activity-list,mail-merge}/…`, the linktracking and reminders composer icons, the thread-list reminder icons and `toolbar/ic-toolbar-native-reminder@*`. `git grep` finds no reference outside the deleted packages. |
| 3 | quick | composer-markdown still hides `.btn-mail-merge`, `.btn-scheduler` and `.btn-send-reminder` | low | patch | `markdown-editor.jsx:154-159`; only the removed packages rendered those classes. |
| 4 | quick | the HasTutorialTip block in `remaining-packages-refs.spec.jsx` was dropped | medium | patch | It tested the kept decorator via send-later and send-reminders fixtures. Nothing else covers HasTutorialTip around `ListensToObservable`. Rebuild it on thread-snooze's tipped buttons. |
| 5 | quick | migration-manager spec deleted fixtures instead of replacing them | low | patch | Both tests now hold one entry, so they no longer show that only matching names change. Add an unrelated name. |

## Verification

**Commands:**
- `pnpm check:react` and `pnpm check:public-build` -- expected: exit 0
- `npx biome check .` -- expected: no errors
- `cd packages/client-app && npx vitest run` -- expected: exit 0, no unhandled errors
- the AC1 `git grep` -- expected: only the allowed hits
- `pnpm --filter nylas-mail build:e2e && pnpm --filter nylas-mail e2e` -- expected: all pass, background mode
- `packages/client-app/e2e/linux-docker.sh` -- expected: pass

**Results** (on 1e24c40aa):
- AC1 grep: matches only CHANGELOG.md, `send-draft-task.js` and its spec, the two doc comments, and `zero-coverage-stores-deep.spec.js`
- Vitest: 3877 passed, no unhandled errors, no orphaned task children
- `check:react` and `check:public-build` pass; Biome has 37 warnings, the same as the baseline
- Mac `build:e2e` plus `e2e`: 14 passed, 7 skipped (the two removed windows took 6 tests), no package load errors, background mode
- `linux-docker.sh`: 14 passed, 7 skipped
