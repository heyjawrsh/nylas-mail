---
title: 'The real-app harness gates CI'
type: 'feature'
ticket: '8'
created: '2026-11-13'
status: done
baseline_revision: '22099e19391a4b967cbb29876aae092d84c520a0'
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

- **Commits:** the implementer wrote the harness in e5cd0427a, 1c5305787 and 6664da29e. Its session ended mid Linux run, so the top-level session finished the Linux work and the review fixes in 8a860ea67, 3f0838a69 and ac6a3807a.
- **Linux launch:** the builder image lacks Electron's runtime libraries. Playwright's `install-deps chromium` covers nss, gbm and xvfb, and GTK 3, libnotify, libxss, libxtst and libsecret are installed on top, in both the Docker script and the CI job.
- **Docker vs CI:** prebuilt `sqlite3` needs glibc 2.38 (#21). The Docker run builds natives from source, the image is pinned by digest, and the harness runs as a non-root user, as it does in CI.
- **Baseline:** `axe-baseline.json` is keyed by OS (`linux`, `mac`), because macOS draws its own window-control buttons (`button-name` ×3).
- **Focus:** Josh asked that Mac runs not take screen focus. The harness runs the app as an accessory app, opens windows inactive, and starts the seed with `--background`. `E2E_FOREGROUND=1` opts out.
- **Empty windows:** calendar, scheduler-calendar and SalesforceObjectForm open empty in this build: upstream switched off calendar's `activate()`, scheduler is filtered by `supportedEnvs` (#20), and Salesforce is disabled by default. `windows.mjs` says so.
- **Known errors:** the `nylas://` font and image CORS errors stay listed as known errors (#18), and so does the Linux keybase watch race (#22).
- **New issues:**
  - #19: window opens are flaky under load and just after a rebuild.
  - #20: cloud plugins never load.
  - #21: glibc floor.
  - #22: keybase watch race.

## Plan Change Log

## Review Triage Log

Quick lens, iteration 0. The implementer's session ended before review, so I applied the patches myself.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | `e2e/reference/linux/` not committed, and the source of axe-baseline.json is unclear | false | — | Neither was missing from the design: the Linux Docker runs had failed at launch (libnspr4, then libgtk-3), and both are written by the `--update-axe-baseline --capture-reference` Docker run, which commits them |
| 2 | scheduler-calendar and SalesforceObjectForm ready checks pass on a blank window (title-bar text) | low | patch | The windows are blank, but the app renders them that way. Probing the built app showed `composer-scheduler` is skipped silently by `supportedEnvs` because config `env` is never set (filed #20), `nylas-private-salesforce` is in the default `core.disabledPackages`, and `main-calendar`'s `activate()` returns at once. A content check has nothing to find yet. Patch: a comment in `windows.mjs` says these windows are empty and why |
| 3 | `launchApp().close()` hangs when the app died from a signal | low | patch | `exitCode` is null for a signalled process and `exit` has already fired; it's a one-condition fix, and a crash under test is exactly when it matters |
| 4 | seed PASSIVE checkpoint fallback likely throws the same SQLITE_LOCKED | maybe-false | defer | 10 of 10 fresh-dir seeds and 18 harness seeds passed, all via TRUNCATE. Settling it needs a lock held past the retry budget to see whether PASSIVE throws. If true, it's medium (#13 returns under heavy load) |
| 5 | 10-seed verification not run or recorded | false | — | Run during verification: 10 of 10, recorded under Verification |
| 6 | app's `--smoke` mode and MODERNIZATION.md still name smoke as the gate | medium | patch | Dead code with a timer-based pass, against the "one gate" intent. The mode is removed from `main.js`/`application.js`, and MODERNIZATION.md gets a note at the top, its history left as written |
| 7 | verify-install-location `.then` has no `.catch` | low | reject | showMessageBox rejects only if its window is destroyed mid-dialog, on a darwin, non-dev, outside-/Applications path, and the fix adds a guard |
| 8 | `dist.mjs` passes `--arm` on 32-bit ARM hosts | low | reject | No 32-bit ARM build host is in scope, and the fix adds a mapping |
| 9 | Docker image unpinned (`:latest`) | medium | patch | References and the axe baseline would drift with the image's fonts and libraries. Pinned by digest to the image the baseline was captured with |
| 10 | (Josh, mid-review) Mac runs take screen focus | medium | patch | The harness now runs the app as an accessory app and opens windows inactive in the main process; the seed launch adds `--background`. `E2E_FOREGROUND=1` opts out |

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

**Results (2026-11-13/14):**
- **Static checks:** `check:react`, `check:public-build`, Biome (no errors; the `.nylas-smoke-home` error is gone) and `actionlint` all exit 0.
- **Vitest:** 3915 passed, the same 4 known unhandled errors (story 13.9 owns them).
- **Seeds:** 10 of 10 into fresh dirs, with no `database table is locked`.
- **Mac e2e on the built app:**
  - 18 passed, on several runs with the machine idle.
  - Failures came only under load or on the first launches after a rebuild (#19).
  - `E2E_PROBE_FAIL=1` exits 1, with the deliberate error in all 9 windows.
  - App focus stayed on the terminal through the seed and every launch.
- **Linux in Docker:** across runs 3 to 5, every window type passed both its error test and its axe test at least once with no app errors, and the reference PNGs were written for all 9 window types. Every remaining failure was qemu's inspector socket dropping at launch, which isn't an app error. The axe baseline was stable between runs.
- **Linux check mode (no update flags):** 18 passed with the 9 screenshot tests skipped, exit 0, which is what CI runs.
- **CI:** not run, since nothing is pushed. Running the e2e job in GitHub is the human step.
