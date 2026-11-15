---
title: 'Cloud-backed plugins are removed'
type: 'refactor'
ticket: '13'
created: '2026-11-15'
status: 'ready-for-dev'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
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
- [ ] removal lane: package dirs, dedicated and mixed specs, config, migration manager, darkside rule, asar hint
- [ ] e2e lane: windows.mjs, axe-baseline.json, reference PNGs
- [ ] warning lane: `src/package-manager.js` plus its spec (#20)

**Acceptance Criteria:**
- Given the repo, when `git grep -E '<the eight names>|scheduler-calendar|SalesforceObjectForm' -- packages/client-app ':!**/CHANGELOG.md'` runs, then it finds only `send-draft-task.js`, its spec, and the two doc comments listed above.
- Given the repo, when Vitest runs, then it exits 0 with no unhandled errors. The test count drops only by the removed packages' tests.
- Given the built mac app, when the harness runs, then every remaining window passes, and the run logs no package load errors.
- Given a package with `supportedEnvs` excluding the env, when `loadPackage` runs, then it returns null and warns once with the package name and env.

## Verification

**Commands:**
- `pnpm check:react` and `pnpm check:public-build` -- expected: exit 0
- `npx biome check .` -- expected: no errors
- `cd packages/client-app && npx vitest run` -- expected: exit 0, no unhandled errors
- the AC1 `git grep` -- expected: only the allowed hits
- `pnpm --filter nylas-mail build:e2e && pnpm --filter nylas-mail e2e` -- expected: all pass, background mode
- `packages/client-app/e2e/linux-docker.sh` -- expected: pass
