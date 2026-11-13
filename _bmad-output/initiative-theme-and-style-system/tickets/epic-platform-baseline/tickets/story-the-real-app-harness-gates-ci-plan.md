---
title: 'The real-app harness gates CI'
type: 'feature'
ticket: '8'
created: '2026-11-13'
status: 'draft'
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

**Problem:** Nothing checks the built app. `smoke.js` passes on a timer, and it isn't even in CI. Every story so far was checked by hand-written CDP scripts that later epics can't reuse. Architecture AD-19 requires a Playwright harness that drives the real built Electron app on a temporary config folder, runs axe, opens every window type and gates CI. Stories 1.4 to 1.6 also need pre-port reference screenshots of every window type to compare against.

**Approach:**
- Add a Playwright + `@axe-core/playwright` harness in `packages/client-app/e2e/`. It launches the built, unpacked app on a freshly seeded fixture account in a temporary NYLAS_HOME.
- Per test, it opens the main window and every other window type, fails on renderer errors, and runs axe against a committed baseline.
- It can capture reference screenshots.
- A CI job builds the Linux app and runs the harness under xvfb, replacing `smoke.js` as the gate.
- Fix the two things that would make the gate flaky or hang: the seed's checkpoint lock (#13) and the move-to-Applications dialog (the verify-install-location site of #14).

## Boundaries & Constraints

**Always:**
- The harness drives the built app (`electron-builder --dir` output), never `electron .` dev mode, on a temporary NYLAS_HOME seeded by `seedFixtureAccount`. It never touches a real config dir.
- A window fails its test on any page error or `console.error`. The exception is an entry in `e2e/known-errors.json`, where each entry names a matcher and the open issue that owns it.
- The axe gate fails on a rule id not in `e2e/axe-baseline.json` for that window, or on a node count above its baseline. A flag regenerates the baseline, and nothing regenerates it silently.
- The `EnableNodeCliInspectArguments` fuse is on in the built app, and the harness checks it before launching.
- Reference screenshots are captured on Linux (Docker locally, which matches CI) at a fixed window size, and committed under `e2e/reference/linux/`.
- Exact versions: `@playwright/test` 1.64.1 and `@axe-core/playwright` 4.14.0. Playwright 1.65.0, the version in the spine's table, is under the repo's two-week release-age rule.
- Tests ship with the change: the harness itself is the test. Unit specs cover the seed fix and the axe-baseline comparison.
- Commit locally on `modernize/current` with no attribution lines, and never push. Refs #7, #13 and #14.

**Never:**
- High-contrast variants, the 540-combination sweep, RTL, or signal overrides: those belong to epic-style-contract.
- Screenshot comparison thresholds (later stories); this story only captures references.
- Fixing existing axe violations or the other `showMessageBox` sites in #14.
- Pushing or running CI. The workflow is written and checked locally.
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy run | built app, seeded fixture | main window lists the fixture threads. Work, composer popout, thread popout, onboarding, print, calendar, scheduler-calendar and SalesforceObjectForm windows each open with no errors, and axe matches the baseline. Exit 0 | — |
| Renderer error | a window logs `console.error` or a page error not in known-errors | that test fails, naming the window and message | — |
| New axe violation | a window gains a rule id, or more nodes than baseline | the axe test fails, naming the rule and window | — |
| Probe failure | `E2E_PROBE_FAIL=1` | the run exits non-zero (proves the gate) | — |
| Fuse off | the built app has the inspect-arguments fuse disabled | the harness stops before launch with a clear message | — |
| Seed under load | 10 seeds in a row into fresh dirs | all 10 succeed (no `database table is locked`) | — |
| Mac build from dist/ | launched outside /Applications | no move-to-Applications dialog blocks the run | — |

</frozen-after-approval>

## Code Map

- Fixture:
  - `packages/client-app/scripts/seed-fixture-account.mjs` exports `seedFixtureAccount(home, options)`, `prepareHome`, `freePort`, `fixtureConfig` and `MARKER`, and refuses non-fixture dirs.
  - `:207` runs `DatabaseStore._db.pragma("wal_checkpoint(TRUNCATE)")` while the app's other connections are open, which is the #13 flake. Use a PASSIVE checkpoint, or retry TRUNCATE with backoff, then prove 10 runs in a row pass.
  - `fixtureConfig` is where the harness sets `asksAboutAppMove: 5`, so the dialog never shows.
- CDP helpers: `scripts/lib/cdp.mjs` (`CdpPage`, `listTargets`, `waitForWindow`) are the ad-hoc helpers. Playwright replaces them in the harness; leave them for the seed script.
- `internal_packages/verify-install-location/lib/main.js:70-81` passes a callback to promise-based `showMessageBox`, so the answer is never saved (#14). Change this one site to `.then(({ response }) => …)`, keeping the handler's logic. It only runs on darwin outside dev mode.
- Window openers, evaluated in the main window through Playwright's `page.evaluate`:
  - composer: `Actions.composeNewBlankDraft()`
  - thread popout: `Actions.popoutThread(thread)` (`src/flux/stores/message-store.js:491`)
  - print: `Actions.printThread(thread, html)`, handled by `internal_packages/print/lib/printer.js`, which opens a `PrintWindow` BrowserWindow
  - onboarding, calendar, scheduler-calendar, SalesforceObjectForm: `NylasEnv.newWindow({ windowType, … })`
  - Onboarding can also be a separate launch on an empty NYLAS_HOME; pick whichever renders the real welcome page.
  - The work window opens on its own.
- Known errors at baseline, each needing an issue in known-errors.json:
  - the BufferedProcess `Cannot read properties of undefined (reading 'killed')` (#17).
  - DraftNotFoundError on closing a pristine popout (#11).
  - nylas:// font CORS errors, since nylas-private-fonts isn't in public builds. Report whether these are expected, or need an issue.
- Built app paths:
  - mac: `packages/client-app/dist/mac-arm64/Nylas Mail.app/Contents/MacOS/Nylas Mail` (or `mac/` on x64)
  - linux: `packages/client-app/dist/linux-unpacked/nylas-mail`
  - Add `scripts/dist.mjs --dir` support (or a `build:e2e` script) that builds the host's unpacked app and runs the existing native restore.
- Fuses: no `electronFuses` in `electron-builder.yml` today, so Electron defaults apply. Read them with `@electron/fuses` (exact version, devDependency) in harness setup.
- Docker for Linux runs: `electronuserland/builder` on a `git archive HEAD` copy, with `xvfb-run`. Under qemu emulation as root, launch needs `--no-sandbox --disable-gpu --in-process-gpu --no-zygote` (story 13.7 notes). Pass these only in the container, through an env-driven launch-args hook. CI on native x64 Ubuntu may still need `--no-sandbox`.
- smoke: `packages/client-app/scripts/smoke.js`, the `smoke` scripts in both package.json files, and the tracked `.nylas-smoke-home/` at the repo root (the source of the known Biome error). Delete all three, and gitignore the harness's temp and report dirs.
- CI: `.github/workflows/test.yml` (ubuntu, pnpm via packageManager after 13.7's fix). Add an `e2e` job that builds the Linux unpacked app, runs the harness under `xvfb-run` and uploads the Playwright report on failure.
- Layout, per spine: `packages/client-app/e2e/` holds `playwright.config.*`, a fixture/launch helper, the spec files, `axe-baseline.json`, `known-errors.json` and `reference/linux/`. The script is `pnpm --filter nylas-mail e2e`, with `-- --update-axe-baseline` and `-- --capture-reference` (or env equivalents).

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/seed-fixture-account.mjs` -- checkpoint without the lock race, plus `asksAboutAppMove` in the fixture config -- reliable seed (#13)
- [ ] `internal_packages/verify-install-location/lib/main.js` -- promise-based dialog result -- no stuck dialog (#14, this site)
- [ ] `scripts/dist.mjs` and package scripts -- host unpacked build for e2e -- the app under test
- [ ] `packages/client-app/e2e/` -- config, launch fixture (seed to temp home, fuse check, launch built app, collect errors per window), window-type specs, axe-baseline gate, known-errors, reference capture -- the harness
- [ ] `e2e/axe-baseline.json`, `e2e/reference/linux/*.png` -- generated on Linux in Docker and committed -- baselines
- [ ] `.github/workflows/test.yml` -- an e2e job that builds Linux and runs the harness under xvfb, with the report as an artifact -- the gate
- [ ] smoke removal and `.gitignore` -- smoke.js, its scripts and `.nylas-smoke-home/` gone -- one gate
- [ ] specs -- the axe-baseline comparison (new rule, higher count, equal) and the seed checkpoint path -- proof

**Acceptance Criteria:**
- Given the built mac app, when `pnpm --filter nylas-mail e2e` runs, then every window-type test and axe test passes, and with `E2E_PROBE_FAIL=1` the run exits non-zero
- Given a clean copy in Docker (Linux), when the Linux app is built and the harness runs under xvfb, then it passes, and `--capture-reference` writes one PNG per window type
- Given the repo, when `actionlint` runs, then the workflows are valid. Running the e2e job in GitHub is the human step

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

The axe baseline captures today's violations, so the gate catches regressions without first fixing a decade of old UI. Later epics shrink it. Key the baseline by window type, then by rule id, then by node count. On a failure, print the new nodes' targets.

Keep the launch helper the one place that knows the app path, the temp home, launch args and error collection, so style-contract stories can add sweeps without copying it.

## Verification

**Commands:**
- `pnpm check:react`, `pnpm check:public-build` -- expected: exit 0
- `cd packages/client-app && npx vitest run` -- expected: no failed file, no fewer passing than baseline
- `npx biome check .` -- expected: no errors (the known `.nylas-smoke-home` error goes with it)
- seed 10 times into fresh dirs -- expected: 10 of 10 pass
- `pnpm --filter nylas-mail e2e` on the mac build -- expected: pass; with `E2E_PROBE_FAIL=1`, it fails
- Docker Linux build, then the harness under xvfb, then `--capture-reference` -- expected: pass, with PNGs written
- `actionlint` -- expected: exit 0
