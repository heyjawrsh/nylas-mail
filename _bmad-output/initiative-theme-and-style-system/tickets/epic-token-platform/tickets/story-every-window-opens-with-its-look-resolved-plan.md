---
title: 'Every window opens with its look resolved'
type: 'feature'
ticket: '8'
created: '2026-11-16'
status: 'built'
baseline_revision: '3ba0dbfcc'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The look is set by ThemeManager from `core.themes`, and only after packages activate. Hot windows open without `data-theme`/`data-variant`, every window paints white first, and there's no `core.appearance` setting, no pure look resolver, no theme library and no per-window commit path.

**Approach:**
- Add `core.appearance.*`, a pure `resolveLook`, a main-process ThemeLibrary skeleton and a shell-client.
- Main resolves each window's look at creation and passes it through load settings and `backgroundColor`.
- The renderer sets the attributes in `NylasEnv.initialize`, before React mounts.
- Every later change goes through one commit queue per window.

## Boundaries & Constraints

**Always:**
- **Keys:** `core.appearance.{style, theme, mode, increaseContrast, density, textSize, font}`.
  - Values: `mode` is `auto`/`light`/`dark`; `increaseContrast` is `system`/`on`/`off`; `density` is `compact`/`comfortable`/`spacious`; `textSize` runs 0.875–1.5 in 0.125 steps; `font` is `theme` or an id.
  - Defaults are `classic`, `classic`, `auto`, `system`, `comfortable`, `1` and `theme`. They live in one `DEFAULTS` constant that the config schema also reads. epic-loft flips the theme and style to `loft`.
  - An absent `core.appearance` renders Classic.
- **resolveLook is pure** (AD-23). It fills every attribute in the conventions table except `data-reflow`, and sets flags only when they are on. Invalid values fall back to their defaults.
  - **Theme:** an unknown or `unavailable` theme renders `DEFAULT_THEME`, which is `classic` until epic-loft.
  - **Style:** an unknown style renders `classic`.
  - **Contrast:** forced colours beat `-hc`. When a theme has no `-hc` group, the standard variant renders and `data-increased-contrast` stays set.
- **Shell boundary** (AD-2): only `shell-client.js` imports `electron` under `src/appearance/`, and only `src/browser/appearance-shell/` touches `nativeTheme` or reads theme files.
- **Signals in this story:** `DEFAULT_SIGNALS` (`colorScheme: light`, revision 0), served through `appearance-shell/signals.js`. Mode Auto renders light until story 9 adds live OS signals, because until stories 4–6 finish porting, following a dark OS would mix Classic dark tokens into a light LESS app. Decided by Josh, 2026-11-16.
- **Revisions** (AD-25): `get-theme-library` and `theme-changed` carry monotonically increasing revisions. A window subscribes first, then asks for the snapshot, and ignores anything older than what it holds.
- **Writes:** config is never written by resolve, fallback or a commit. `core.themes` is untouched.
- **Kernel sheet:** it stays the first stylesheet, and `index.html` stays in sync with `kernelSheet()`.

**Never:**
- No AppearanceSignals service and no OS live tracking (story 9).
- No file watcher, install or last-valid cache (epic-theme-authoring).
- No `--text-scale` mapping from `data-text-size` (story 10).
- No style packages, row-height probe or window-chrome handler in main (epic-style-contract).
- No View Transition UI or Appearance page (epic-appearance).
- No mapping from `core.themes` to `core.appearance` (AD-30).
- Don't change the hot-window flow (`packageLoadingDeferred`, `loadSettingsChangedSinceGetURL`), the `config-schema` non-enumerable default, or the `fileListCache`/`less-compile-cache` caches.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh config | no `core.appearance`, OS light | every window: `data-theme=classic data-variant=light data-style=classic data-density=comfortable data-text-size=100 data-font=theme`; `backgroundColor` is Classic light `surface-app` | none |
| Mode Auto on a dark OS | `mode: auto`, OS dark | `data-variant=light`, light `backgroundColor`, until story 9 | none |
| Mode Auto with a dark signal | `mode: auto`, signals `colorScheme: dark` (unit level) | `data-variant=dark` | none |
| One key changes | `Config.set('core.appearance.mode','dark')` in one window | every open window commits `data-variant=dark`; other `core.appearance` keys and `core.themes` unchanged | none |
| Contrast on, no hc group | `increaseContrast: on`, Classic without `-hc` | `data-variant=light`, `data-increased-contrast` set | none |
| Forced colours | snapshot `forcedColors: true`, contrast `on` | `data-forced-colors` set, no `-hc` | none |
| Unknown theme / unavailable | `theme: nope` or descriptor `status: unavailable` | `data-theme=classic`; config keeps `nope` | none |
| Bad values | `textSize: 3`, `mode: 7` | `data-text-size=100`, mode auto | none |
| Stale event | `theme-changed` revision ≤ held | ignored | none |
| Burst | 3 commits while one runs | serialised; the queued ones coalesce into one commit with the last values | a failing step rejects that commit only; the queue continues |
| Hot window | popout from the hot window | attributes present before populate; re-applied from the new load settings on populate | none |

</frozen-after-approval>

## Code Map

All paths are under `packages/client-app`.

- **New `src/appearance/look-runtime/`:**
  - `defaults.js`: `DEFAULTS`, `DEFAULT_THEME`, `DEFAULT_STYLE`, `TEXT_SIZES`, `DEFAULT_SIGNALS`.
  - `resolve-look.js`: `resolveLook(applied, overrides, signals, library)`, returning an attribute map. `library` is `{themes: {id: descriptor}, styles: ['classic']}`.
  - `commit-queue.js`: `createLookRuntime({root, state, shell, flush})`. It exposes `commit(change, {transition})`, `onLookChanged` and `current`. Commit steps follow AD-26: set changed attributes; await `document.fonts.load` when `data-font` changed; run the registered `beforeFlush` hooks (the row-height probe goes here later); `flush()`, which defaults to `flushSync`; `shell.setWindowChrome(attrs)`; emit `look-changed`. `transition: true` wraps the commit in `document.startViewTransition` when it exists and reduced motion is off.
  - `index.js`: `installLookRuntime(NylasEnv)`, which wires the sources. A config `onDidChange('core.appearance')` triggers a commit (the source window updates through `load()`, not IPC). So do `theme-changed` (revision-filtered) and the hot-window `load-settings-changed`, the latter by reading `appearance` from the new settings.
- **New `src/appearance/shell-client.js`:** `getThemeLibrary()` (`ipcRenderer.invoke`), `onThemeChanged(cb)`, `setWindowChrome(attrs)` (`ipcRenderer.send`).
- **New `src/browser/appearance-shell/`:**
  - `signals.js`: `readSignalsSnapshot()`.
  - `builtin-themes.js`: reads `static/themes/<id>.css` and `<id>.descriptor.json`, plus themes-folder state (`<configDirPath>/themes`: exists, writable).
- **New `src/browser/appearance-services/theme-library.js`:** `ThemeLibrary`.
  - Loads built-in descriptors synchronously at start.
  - `descriptors()`, plus `publish(descriptor)`, which bumps the revision and calls `windowManager.sendToAllWindows('theme-changed', …)`.
  - `ipcMain.handle('get-theme-library')` returns `{descriptors, themesFolder, revision}`. It is the first `handle` in the codebase.
  - `windowLook(config)` returns `{signals, attributes, backgroundColor, revision}`. The colour is `swatch[variant].surface`, falling back to the standard variant.
  - `repaintWindows(config)`: when a `core.appearance` write reaches main, it calls `setBackgroundColor` on every NylasWindow, including hidden work and hot windows, so a resize or a reused hot window never shows the old colour. Hook it into `src/browser/config-persistence-manager.js:175-183` (`emitChangeEvent`), which already updates `application.config`. This is a background update only, not a window-chrome handler.
- **`scripts/build-themes.mjs`:** also writes `static/themes/<id>.descriptor.json` per ThemeDescriptor (no `css`, `source: builtin`, `status: ok`, `swatch` per variant with `surface` = `surface-app`, `text-default` and `accent`), plus `variants` (the compiled groups). Commit the generated file beside `classic.css`.
- **`src/browser/application.js:~95-119`:** create the ThemeLibrary after config and before `new WindowManager`, because the hot window is built in the WindowLauncher constructor. Pass it to WindowLauncher.
- **`src/browser/window-launcher.js`:**
  - At `newWindow` and at the hot-window swap (`:68-95`), set `opts.appearance = themeLibrary.windowLook(config)`. This uses main's `application.config`, which has no schema defaults, so resolveLook's defaults apply.
  - `:33`/`:50`: WindowLauncher already gets `config`.
- **`src/browser/nylas-window.js:70-87,125-164`:** `backgroundColor` from `appearance.backgroundColor`, and `appearance` into `loadSettings`.
- **`src/nylas-env.js:258-260`:** replace `data-look=""` with the attributes from `loadSettings.appearance` (fallback: `resolveLook({}, {}, DEFAULT_SIGNALS, builtin)`). Call `installLookRuntime` after Config exists (`:288`). It must work in hot windows before `populateHotWindow`.
- **`src/theme-manager.js:412-427`:** stop setting `data-theme`/`data-variant` (the look runtime owns them) but keep the LESS theme loading (story 7). Update its spec.
- **`src/config-schema.js`:** add `core.appearance` as an object with typed properties and defaults taken from `DEFAULTS`. Keep `:173-178` as is.
- **`static/index.html:2,18`:** drop `background: #fff`; the cover uses `var(--surface-app, transparent)`, so `backgroundColor` shows until the sheets load.
- **Print** (`internal_packages/print/lib/print-window.js:33-48`): it already copies the caller's attributes. No change.
- **e2e `e2e/look-runtime.spec.mjs`:** replace the `core.themes ui-dark` case. With the main window, a composer popout and a thread popout open, setting `core.appearance.mode` to `dark` in one window gives every window `data-variant=dark`, and `core.themes` plus the other keys read the same.
  - Also assert the full attribute set on each window type, including hot windows before populate.
  - Assert `getThemeLibrary()` returns the Classic descriptor with a revision.
  - The app needs `build:e2e`.

## Tasks & Acceptance

**Execution:**
- [ ] foundation: `look-runtime/defaults.js`, `resolve-look.js` and its spec (every I/O row), the `config-schema.js` `core.appearance` block, and the build-themes descriptor output plus the generated descriptor -- shared vocabulary for both lanes
- [ ] main lane: `appearance-shell/*`, `appearance-services/theme-library.js`, `application.js`, `window-launcher.js`, `nylas-window.js`, with specs (descriptor load, revision bump and broadcast, `windowLook` colour fallback, invoke payload)
- [ ] renderer lane: `shell-client.js`, `look-runtime/commit-queue.js` and `index.js`, `nylas-env.js`, `theme-manager.js`, `static/index.html`, the specs (queue serialise/coalesce/failure, revision filter, hot-window re-apply, look-changed) and the e2e update

**Acceptance Criteria:**
- Given any window type, when it opens, then `<html>` carries the full resolved attribute set before React mounts, and the window's background is the resolved `surface-app` from the first frame.
- Given three open windows, when one `core.appearance` key changes, then every window commits it without a reload, and no other key or `core.themes` changes.
- Given `get-theme-library`, when invoked, then it returns Classic's descriptor, the themes-folder state and a revision.

## Implementation Notes

- Review fixes (the four patch rows) ran as one Ringer fix lane on gpt-6-astra, PASS first attempt, gated by two acceptance probes. One probe failed on 7adadc3a9 with exactly the stale load-settings bug (`expected 'dark' to be 'light'`). Committed as the fix commit after 7adadc3a9.

- Ringer run `nylas-token-8-look-resolved`: foundation, main and renderer lanes on gpt-6-astra, all PASS (main took 2 attempts). Ringer's integration check could not package the app from a symlinked scratch worktree (electron-builder refuses the layout), so the patches were applied to `modernize/current` and built and e2e-tested there. 7adadc3a9.
- The built-app e2e showed the print window copying only three look attributes; `print-window.js` now copies the caller's full `data-*` look set (outside the Code Map, needed by AD-1).
- On a dark-mode Mac, Auto following the OS mixed Classic dark tokens into the light LESS app and failed the axe baseline. Josh chose to keep Auto light until story 9 (frozen block updated).

- Planning: the plan is about 2,100 tokens, over the 1,600 gate. Kept whole on the standing go-ahead: resolveLook, the main-side window look and the renderer queue only ship together, and the Code Map is what keeps the lanes from re-investigating.

## Plan Change Log

## Review Triage Log

Pass 1 (quick lens, 6 findings): high 2, medium 1, low 1, false 1, rejected 1.

| # | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|
| 1 | `appearance-shell/signals.js` reads `nativeTheme.shouldUseDarkColors`, so Auto renders dark on a dark OS | high | patch | Confirmed. The code predates Josh's 2026-11-16 decision, now in the frozen block. Fix: return `DEFAULT_SIGNALS`, and make the theme-library spec and `e2e/look-runtime.spec.mjs` expect light under Auto. |
| 2 | `look-runtime/index.js` rebuilds `applied` from main's resolved attributes (`appliedFromAttributes`) at install and on `load-settings-changed`, pinning auto/system and turning unknown theme ids into `classic`; the composer's second `updateLoadSettings` re-sends the creation-time look | high | patch | Confirmed. `NylasWindow.updateLoadSettings` merges the stale `loadSettings.appearance`. Fix: `applied` only ever comes from config (`env.config.get`/`onDidChange`, which fires on load); `load-settings-changed` commits signals only, never `applied`; drop `appliedFromAttributes`. |
| 3 | `config-persistence-manager.js:177` calls `repaintWindows` on every write, unguarded, before broadcast and save; `windowLook` throws on a descriptor with no `swatch` | medium | patch | Confirmed: `publish()` accepts any descriptor and `const { swatch } = …` then throws. Fix: guard the call so a failure is logged and never blocks the write; repaint only when the resolved background changed; fall back to the default theme's swatch. |
| 4 | Plan's targeted vitest command names `spec/theme-library`, but the specs live in `spec/appearance-main/` | low | reject | The fix is an edit to this plan. The full `npx vitest run` covers them, and the fix-lane check runs `spec/appearance-main` explicitly. |
| 5 | `print-window.js` copies every `data-*` on `<html>`, outside the plan's "No change" | false | reject | Every `data-*` on a look root is a look attribute (Consistency Conventions; AD-1 has the print root carry the full set). The e2e asserts it for the print window. Logged in Implementation Notes. |
| 6 | `window-launcher.js` takes the library from `global.application` instead of being passed it | low | patch | Confirmed: `window-manager.js` doesn't pass it. Direct fix: pass `themeLibrary` from Application through WindowManager to WindowLauncher. |

## Design Notes

- Mode Auto stays light until story 9 (Josh, 2026-11-16). On a dark Mac, following the OS turned the token-ported surfaces Classic dark inside a light LESS app and failed the axe baseline. Story 9 lands after stories 4–6, when the whole app is on tokens.
- Interim: a `core.themes: ui-dark` user now gets Classic tokens by Mode, under the LESS dark theme, until story 7 stops LESS loading. AD-30 forbids an interim mapping.
- No third-party CSS travels through load settings yet: none exists until epic-theme-authoring, and URL size argues for invoke then anyway.

## Verification

**Commands:**
- `cd packages/client-app && npx vitest run spec/look-runtime spec/theme-library spec/theme-manager.spec.js spec/build-themes.spec.js` -- expected: pass
- `cd packages/client-app && npx vitest run` -- expected: all pass
- `./node_modules/.bin/biome check packages/client-app` -- expected: 0 errors
- `cd packages/client-app && node scripts/build-renderer.js && node scripts/dist.mjs host --dir && node e2e/run.mjs` -- expected: every e2e spec passes (look-runtime included), in the background on macOS
- `pnpm check:public-build` -- expected: pass

**Manual checks:**
- In the built app: open a composer popout and a thread popout with Preferences open in the main window. Set the mode through DevTools `NylasEnv.config.set('core.appearance.mode','dark')`. All three windows repaint with no white flash, and a newly opened popout starts dark.

## Verification Results

- Vitest: 224 files, 4369 tests pass, 2 skipped, no unhandled errors. The acceptance probes `zz-probe-resolve` (every resolveLook matrix row, the defaults, the schema and the descriptor) and `zz-probe-runtime` pass.
- Biome: 0 errors (35 warnings, all pre-existing). check:react and check:public-build pass.
- Built app (macOS, background): 24 of 25 e2e pass, including `look-runtime` for every window type (print included) and the story probe `zz-probe-look`. The probe checks:
  - the full attribute set on main, composer, thread popout, onboarding and the unused hot window;
  - every window's `backgroundColor` equals Classic's `surface-app` from creation;
  - `get-theme-library` returns Classic's descriptor and CSS, the themes-folder state and a revision;
  - `core.appearance.mode` set in the composer reaches all three windows with no reload, leaving `core.themes` and the other keys unchanged;
  - a window opened afterwards starts in the new look, and every window background, hidden ones included, follows.
- The one e2e failure, the default window's mac axe baseline (8 colour-contrast nodes against 7), is pre-existing: 3ba0dbfcc fails identically. Filed as https://github.com/heyjawrsh/nylas-mail/issues/27. CI gates on Linux.
- Extra check: the three windows' backgrounds and attributes follow a mode change, per the probe. No one has watched for a white flash by eye; Mac test runs stay in the background.

