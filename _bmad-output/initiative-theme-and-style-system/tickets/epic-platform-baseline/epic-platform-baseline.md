---
type: epic
title: "The app installs, renders and is tested on current Electron and React"
parent: initiative-theme-and-style-system
covers: [R32]
sources: [_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md, _bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md]
companions: [_bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md]
after: []
refined: true
risk: high
---

# The app installs, renders and is tested on current Electron and React

## Description

Today the app cannot start. React 19 is declared but not installed, the Electron package is a stub that points at another checkout, the root `build:renderer` script calls a missing file, and esbuild's duplicate `alias` key drops three stubs. The code also still uses about 157 `findDOMNode` calls, about 90 string refs, 9 `ReactDOM.render` calls and 1 `unmountComponentAtNode`, legacy context and 113 `componentWill*` lifecycles, so it won't render under React 19 (https://github.com/heyjawrsh/nylas-mail/issues/7). This epic gets the app running on Electron 45 and React 19. It produces unsigned electron-builder pre-release builds for macOS, Windows and Linux in CI, disables the Squirrel updater, stops crash dumps leaving the machine (https://github.com/heyjawrsh/nylas-mail/issues/8), and puts a Playwright harness on the built app as the CI gate. Every other epic is verified in the real app through this harness, so this epic comes first.

## Outcome

Anyone building the later epics has an app that installs and renders on all three OSes, plus a real-app harness in CI, so the theme work can be verified where it ships.

## Requirements

- R1 (parent R32): the built app runs under a Playwright harness with `@axe-core/playwright` on a temporary config folder in CI, and that run is the gate in place of `smoke.js` (architecture AD-19).
- R2 (architecture AD-34): unsigned electron-builder pre-release builds for macOS, Windows and Linux are produced in CI, then install and open the app on each OS.
- R3 (architecture AD-34, issue #7): every window type renders on React 19. No `findDOMNode`, string refs, legacy context, `ReactDOM.render`, `unmountComponentAtNode` or legacy `componentWill*` lifecycle remains in `src/` or `internal_packages/`.
- R4 (architecture AD-4): the app runs on Electron 45.3.1 (Chromium 156, Node 24).
- R5 (architecture AD-34): the Squirrel updater code is disabled, and no build checks for, downloads or applies an update.
- R6 (issue #8, user decision 2026-11-12): crash dumps are never uploaded from any build.

## Constraints

- Code signing, notarisation and auto-update are deferred (architecture AD-34).
- No Tauri or native-shell work; the platform move is its own initiative (architecture AD-3, https://github.com/heyjawrsh/nylas-mail/issues/6).
- Test builds keep the `EnableNodeCliInspectArguments` fuse on so Playwright can drive them; `smoke.js` is not a gate (architecture AD-19).
- Public builds exclude `nylas-private-fonts`, and a CI check enforces it (architecture AD-17).

## Done when

- CI builds unsigned pre-release packages for macOS, Windows and Linux. Each one installs and opens the app on its OS (R2, R4).
- Every window type renders on React 19, and a CI check confirms none of the removed React APIs are left (R3).
- No build checks for updates, and a forced crash uploads nothing (R5, R6).
- The Playwright harness runs against the built Linux app in CI, and a failing check fails the build (R1).

## Boundaries

- Out: anything to do with themes, LESS or the look (epic-token-platform), and regions, rows, frameless windows and the combination sweep (epic-style-contract).
- Out: code signing, notarisation, auto-update and a working crash reporter.
- Out: porting or deleting the 87 old-format `*-spec.*` files that Vitest never runs (user decision 2026-11-12, tracked as a backlog issue).
- Must not change: what any mail feature does. The React 19 work only replaces removed APIs and keeps behaviour the same.
- Must not change: the legacy `core.themes` key.
- Touch point: `package.json` (root and `packages/client-app`), `scripts/build-renderer.js`, `build/` Grunt tasks; owner: epic-platform-baseline.
- Touch point: `src/browser/main.js`, `windows-updater.js`, `windows-updater-squirrel-adapter.js`, `linux-updater-adapter.js`; owner: epic-platform-baseline.
- Touch point: `src/browser/application.js` and `src/error-logger.js` crash reporter start; owner: epic-platform-baseline.
- AD-34's packaging duties for later code (the build-time theme compile, `static/themes` and the CSS in the asar, `culori` and `ajv` as production dependencies, the D-Bus client) are added to the build by the epic-token-platform stories that introduce that code.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R32), Notes (platform baseline decision 2026-11-12)
- architecture — `_bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md`, AD-3, AD-4, AD-17, AD-19, AD-34; Open Questions (React 19 render breakage)
- issue — https://github.com/heyjawrsh/nylas-mail/issues/7 (React 19 render and fake smoke)
- issue — https://github.com/heyjawrsh/nylas-mail/issues/8 (crash reports auto-submit to dead Heroku endpoints)

## Notes

- Decision: 2026-11-12. epic-token-platform is split into three epics: epic-platform-baseline (this one, first), epic-token-platform, and epic-style-contract. As a single epic it would have run to about 33 stories.
- Decision: 2026-11-12. Turning off crash-dump upload (#8) is folded into this epic. A real crash reporter stays out of scope.
- Decision: 2026-11-12. The 87 old-format spec files are out of this initiative and go to a backlog issue. New tests ship with each story.
- Decision: 2026-11-12. The tracer bullet is story 1: the app launches on Electron 45 and React 19, and an unsigned macOS build opens the onboarding window.
- Decision: 2026-11-12. LESS removal moves to epic-token-platform after the port. Nothing can stop compiling LESS until every stylesheet is ported, which architecture AD-7 and AD-35 already order.
- Decision: 2026-11-12 — the architecture spine was updated for the split, with AD ids kept: owners re-pointed in AD-4, AD-9, AD-10, AD-15, AD-19, AD-21, AD-22, AD-32 and AD-34, and AD-27 (minimal email binding), AD-29 (font sizes map to pre-scaled type roles) and AD-6 (Classic ships all four variants) amended. This resolves the earlier source conflict over owners.
- Decision: 2026-11-12 — story 2 comes second because story 3 and the context consumers in 4 and 5 depend on it. The least certain story, the harness (8), can't run until the app renders, so it follows the React work.
- Risk: 75 files change with no intended change in behaviour. Beyond each story's check, the harness (8) opens every window type before this epic closes.
- Decision: 2026-11-12 (user) — two stories added after story 13.1 surfaced defects no planned story owned: 10 (named imports from nylas-component-kit are undefined in the bundle, so every modal crashes), after 2 and before 3–5; and 11 (the work window fails, so sync never starts), before 4 and the harness.
- Decision: 2026-11-12 — the check that a modal and a popover render with no React errors moves from story 10 to story 3. Story 10 makes the kit imports resolve, after which Modal and FixedPopover mount and crash on their own `findDOMNode`, and story 3 removes that. Story 10 checks that kit components resolve and mount.
- Decision: 2026-11-13 — story 5 also owns the main-window package load failures found while building story 4: account-sidebar, github-contact-card, keybase and phishing-detection. Story 4 fixes the 10 kit registrations still resolved by string path, because they block thread-list and composer.
