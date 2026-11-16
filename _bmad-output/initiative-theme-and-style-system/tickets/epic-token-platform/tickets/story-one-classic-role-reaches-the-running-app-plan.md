---
title: 'One Classic role reaches the running app'
type: 'feature'
ticket: '1'
created: '2026-11-15'
status: 'ready-for-dev'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-theme-and-style-system/tickets/epic-token-platform/epic-token-platform.md'
  - '{project-root}/_bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The app takes every colour from LESS variables compiled per window. There is no path for a role token to travel from a theme file to a painted surface, no cascade-layer order, and no look root. Every later token story needs all three.

**Approach:** This is the tracer bullet. It adds:
- a kernel sheet, first in the document, that declares the layer order (AD-22);
- a loader step that wraps every package and base sheet in its layer by source;
- a minimal pure compiler (AD-5, AD-6) that turns `static/themes/classic.tokens.json` into `@layer theme` CSS on `[data-look][data-theme="classic"][data-variant="light"]` at build time;
- that look root on every window's `<html>`;
- one surface, `#message-list`, reading `var(--surface-app)` instead of `@background-secondary`.

Story 2 completes the compiler (Ajv, typed values, the gate) and all of Classic.

## Boundaries & Constraints

**Always:**
- The layer order is `reset, kernel, theme, font, baseline, style, plugin`, declared in a kernel sheet that is `document.styleSheets[0]` in every window. One JS module holds the list, and a spec keeps `static/index.html` in step with it.
- Sheets go in these layers:
  - base and bundled package sheets in `baseline`;
  - legacy theme-package sheets in `style`;
  - third-party package sheets in `plugin`;
  - compiled theme CSS declares its own `@layer theme` and isn't wrapped again.
- Wrapping hoists a sheet's leading `@charset`/`@import` statements out of the block. Each `@import` gets `layer(<name>)`.
- The compiler is pure: text in, `{css, report}` out, with no fs, DOM or Electron. Its output is deterministic, and it lives in `src/appearance/theme-compiler/`.
- `surface-app` for Classic light is `#f6f6f6`, the legacy `@background-secondary`, so the window looks the same as before.
- Tests ship with the change. Commit locally on `modernize/current` with no attribution lines.

**Never:**
- New dependencies (Ajv and culori arrive in story 2).
- Ajv validation, derivation, the gate, the other variants or roles, `resolveLook`, or `core.appearance`.
- Removing LESS, porting other rules, or touching `core.themes`.
- Wrapping `email-frame` sheets (by `context` or source path). The email iframe joins their text without the order statement. Story 13 replaces this.
- Editing ticket files or pushing.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Any window loads | `static/index.html` | the first stylesheet is the kernel sheet, and its first rule is the layer statement | — |
| Base sheet with a CSS import | `static/index` compiled LESS that starts `@import url(font-awesome…)` | the import is hoisted as `@import … layer(baseline);`, then `@layer baseline { … }` | — |
| Sheet already layered | compiled `classic.css` | added as is, not nested | — |
| Email-frame sheet | context `email-frame` or path `email-frame` | left unwrapped | — |
| Compile Classic | `classic.tokens.json` (light, `surface-app`) | `@layer theme { [data-look][data-theme="classic"][data-variant="light"] { color-scheme: light; --surface-app: #f6f6f6; } }` | — |
| Malformed theme | bad JSON or a non-colour value | the report holds an error, and the build step exits non-zero naming the file | the build fails |
| Role change | edit `surface-app` in the file, then rebuild | `#message-list` paints the new value | — |

</frozen-after-approval>

## Code Map

All paths are under `packages/client-app`.

- `src/appearance/layers.js` (new): `export const LAYERS = ["reset","kernel","theme","font","baseline","style","plugin"]` and `layerStatement()`.
- `static/index.html:8`: before the loading-cover `<style>`, a first `<style id="nylas-kernel">` holding the statement. The CSP already allows inline styles.
- `src/appearance/wrap-in-layer.js` (new, pure): `wrapInLayer(source, layer)`. It hoists leading `@charset`/`@import`, adds `layer(x)` to each import, and returns the source unchanged when `layer` is falsy.
- `src/style-manager.js:108-146` `addStyleSheet`: a new `layer` option applied with `wrapInLayer` before `textContent` (`:137`), stored as a `layer` attribute. `StylesElement` clones the text unchanged.
- `src/package.js:317-342` `activateStylesheets`: it passes `layer`. A `context` or path containing `email-frame` gets none. A theme-type package gets `style`, a bundled package `baseline`, any other `plugin`.
- `src/theme-manager.js:264-276, 351-354`: base sheets get `layer: "baseline"` (email-frame excepted). `reloadBaseStylesheets` also requires `static/themes/classic.css` with no wrapping.
- `src/appearance/theme-compiler/index.js` (new): `compileTheme(text) → {css, report}`.
  - It handles DTCG groups `light`, `dark`, `light-hc` and `dark-hc` if present. Tokens become `--<path-joined-with->`.
  - A colour `$value` is `{colorSpace:"srgb", components, hex?}`. It emits `hex`, or the hex built from the components.
  - `color-scheme` comes from the group name.
  - Report entries are `{level, path, message}`.
- `static/themes/classic.tokens.json` (new): `$schema` 2025.10; `$extensions["org.nylas.theme"]` with `{id:"classic", name:"Classic", author:"Nylas", version:"1.0.0", license:"GPL-3.0"}`; `light.surface.app` = `#f6f6f6`.
- `scripts/build-themes.mjs` (new): compiles each `static/themes/*.tokens.json` to `static/themes/<id>.css`, prints the report and exits 1 on any error. `scripts/build-renderer.js:334-342` calls it in its run block. `.gitignore` gets `static/themes/*.css`.
- `src/nylas-env.js:258`: `document.documentElement` gets `data-look`, `data-theme="classic"` and `data-variant="light"`.
- `internal_packages/message-list/stylesheets/message-list.less:124`: `background: var(--surface-app);`.
- Specs:
  - the compiler (output, determinism, bad input);
  - `wrapInLayer` (hoist, the falsy layer, an already-layered sheet passed with `layer` false);
  - `addStyleSheet` with `layer`;
  - the `activateStylesheets` layer by package kind, and the email-frame skip;
  - base sheets in `baseline`;
  - `index.html` holding `LAYERS`;
  - `build-themes` writing CSS and failing on a bad file.
- e2e:
  - New `e2e/look-runtime.spec.mjs`, using `evaluate()` from `e2e/app.mjs` (closure-free) and `mainWindow` plus thread-popout from `e2e/windows.mjs`.
  - It asserts that `document.styleSheets[0]` is `#nylas-kernel`, that its first rule is a `CSSLayerStatementRule` naming `LAYERS`, and that `<html>` carries the Classic light attributes.
  - It asserts that `--surface-app` on `<html>` and `#message-list`'s background both equal the value read from `classic.tokens.json` at test time.
  - It asserts that every `<nylas-styles>` sheet except email-frame starts with `@layer` or `@import`.

## Tasks & Acceptance

**Execution:**
- [ ] compiler lane: `theme-compiler`, `classic.tokens.json`, `build-themes.mjs` plus its `build-renderer` hook, `.gitignore`, and specs
- [ ] runtime lane: `layers.js`, the kernel in `index.html`, `wrapInLayer`, the StyleManager, Package and ThemeManager layer plumbing, the look root, the `#message-list` var, specs, and the e2e spec

**Acceptance Criteria:**
- Given the built app, when any window loads, then `document.styleSheets[0]` is the kernel sheet declaring `LAYERS` in order.
- Given Classic light, when the main window renders, then `--surface-app` comes from the compiled `classic.css`, and `#message-list` paints it.
- Given `surface-app` changed in `classic.tokens.json`, when the app is rebuilt and opened, then `#message-list` paints the new value.
- Given the repo, when Vitest and the full harness run, then both pass with no new known errors, and the default window looks as before.

## Design Notes

Layering changes cascade precedence. Within `baseline`, order of insertion still decides, as before. Across layers, `style` beats `baseline` and `plugin` beats both, whatever the insertion order. Unlayered CSS beats every layer: today that's the loading cover and component `<style>` tags. `!important` declarations invert the layer order, so a legacy theme's `!important` in `style` loses to a base `!important` in `baseline`. The non-default legacy themes use `!important` 93 times. Classic light (`ui-light`) is variables only, so the default look isn't affected. The epic's person-compare covers the rest before story 7.

## Verification

**Commands:**
- `pnpm check:react` and `pnpm check:public-build` -- expected: exit 0
- `npx biome check .` -- expected: no errors (37 warnings baseline)
- `cd packages/client-app && npx vitest run` -- expected: exit 0, no unhandled errors
- `node scripts/build-themes.mjs` -- expected: writes `static/themes/classic.css`; a malformed copy exits 1
- `pnpm --filter nylas-mail build:e2e && pnpm --filter nylas-mail e2e` -- expected: all pass, look-runtime included, background mode
- once, by hand: set `surface-app` to `#ff00ff`, rebuild, rerun look-runtime (passes against the new value), then revert
- `packages/client-app/e2e/linux-docker.sh` -- expected: pass
