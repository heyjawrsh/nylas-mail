---
type: review
lens: adversarial (compatible-in-letter, incompatible-in-build pairs)
target: architecture-theme-and-style-system.md (status: draft, 2026-11-11)
reviewed: '2026-11-11'
verdict: 'Not ready to finalize. 4 critical, 8 high, 5 medium holes.'
---

# Adversarial review: theme-and-style-system spine

## Verdict

**Not ready to finalize.** The ADs are right about the paradigm: attribute-keyed looks, a pure compiler, one adapter, regions not styles. They are silent at exactly the seams where two epics meet. Four holes are critical. Each lets two epics follow every AD to the letter and still ship code that can't run together. The worst is that "a feature a community style doesn't cover renders in Classic's arrangement" has no CSS mechanism at all. Classic's CSS is `@scope`d to `data-style="classic"` and can never match under `data-style="foo"`. The `covers` vocabulary that would drive it is deferred to epic 11, after the kit freezes in epic 6.

I checked the brownfield code where a claim depends on it:
- `config-persistence-manager.js:166-182`: `setRawValue` broadcasts `on-config-reloaded` to every window **except the source**, once per key.
- `component-registry.js`: there is no `order` field anywhere.
- `list-tabular.jsx:114`: it throws without `itemHeight`.
- `thread-list.jsx:185-191`: it picks 36 or 85px from window width, not from look.
- `email-frame-styles-store.js`: it scrapes `<nylas-styles>` `innerText` into each iframe.
- `package-manager.js:520`: `windowTypes` gates which packages load in which window.
- `window-launcher.js:128-136`: `frame` can't change on a hot window, so a mismatch skips the hot window.
- `print-window.js:66`: the print package makes its own `BrowserWindow` through `@electron/remote`.

Severity scale: **Critical** means the epics can't integrate without rework of a shipped epic. **High** means a visible defect or a fork of a shared shape that's likely in practice. **Medium** means a defect at an edge, or drift that costs a consolidation pass.

## Summary

| # | Pair | Severity | Proposed AD |
| --- | --- | --- | --- |
| P1 | epic-classic-style's scoped Classic CSS vs epic-style-api's "uncovered renders in Classic" | Critical | AD-20 Classic is the unscoped baseline arrangement |
| P2 | Look runtime in window A vs window B on one OS signal (sequence diagram writes config) | Critical | AD-21 Resolved look is computed, never stored |
| P3 | Style `@scope` CSS vs ported feature CSS vs shim plugin CSS vs `styles.less` | Critical | AD-22 One cascade-layer order |
| P4 | ThemeLibrary fallback (main) vs look runtime fallback (renderer) vs Appearance pending | Critical | AD-23 Fallback is render-time resolution with one owner |
| P5 | A late-opened window vs `theme-changed` broadcasts | High | AD-24 Snapshot plus revisioned events for themes and signals |
| P6 | epic-theme-authoring / epic-style-api / epic-email-dark-mode vs epic-appearance's page | High | AD-12 tightened: a draft-store API, card extension points, order bands |
| P7 | epic-token-platform's port codemod vs the plugin shim's `ui-variables` | High | AD-25 One generated legacy-variable map |
| P8 | Theme compiler's type roles vs style row-height `calc()` vs the shim (text scale) | High | Tighten the Typography / Runtime conventions: scale is applied once, in the theme CSS |
| P9 | Row-height probe vs width breakpoints, nested preview, Loft natural-height rows | High | AD-10 rewritten |
| P10 | Apply's View Transition vs immediate settings, signals, `theme-changed`, multi-key writes | High | AD-26 One look-transaction queue per window; atomic Apply |
| P11 | Email frame and print as look roots vs AD-1/AD-11 "attributes only" | High | AD-27 Look roots in other documents |
| P12 | Nested look roots vs `:root`-declared computed roles, signal flags and runtime props | High | AD-1 tightened: everything a look needs is declared on `[data-look]` |
| P13 | Style and theme packages vs window types (onboarding, composer popout, hot window, print) | Medium | AD-28 Look sheets load in every window type |
| P14 | Per-OS title bar: Loft CSS vs adapter (macOS traffic lights, overlay colour format, hot windows) | Medium | AD-15 tightened |
| P15 | A style declaring a role property vs the theme's ownership of that role | Medium | AD-9 tightened: style-declarable properties are allow-listed |
| P16 | Legacy `core.themes` LESS path vs token look during coexistence | Medium | AD-29 Coexistence precedence |
| P17 | Theme list cards (epic-appearance) vs ThemeLibrary output (epic-theme-authoring) | Medium | Add a `ThemeDescriptor` convention; fix id vs filename |

(A further medium on manifest `layoutMode` / `hide` / `minWidth` is folded into P1 and P9.)

---

## P1: Classic's scoped CSS vs "uncovered features render in Classic's arrangement". Critical

**Unit A, epic-classic-style (epic 6).** It obeys AD-1 and AD-9 to the letter. All Classic arrangement CSS goes in `@scope ([data-style="classic"]) to ([data-look])`. The kit freezes at the end of the epic.

**Unit B, epic-style-api (epic 11).** A community style `style-foo` obeys AD-9. It's CSS-only and lists `covers`. The window root has `data-style="foo"`.

**Incompatibility.** No Classic rule can match any element under `data-style="foo"`, because Classic's scope root is a different attribute value. So "renders in Classic's arrangement" has no CSS path. The uncovered feature falls through to whatever unscoped feature CSS exists, or to nothing. epic 11 can't fix this without reopening Classic's frozen CSS, which breaks the freeze decision. The `covers` vocabulary is deferred to epic 11, but the CSS it has to drive is written and frozen in epic 6.

Missing row heights show the same gap. A community style that skips `--row-height-draft-list` resolves to an empty value. `ListTabular` then throws at `list-tabular.jsx:114`.

There's a sibling gap. Manifest `hide` and `layoutMode` have no stated mechanism. Is `hide` CSS `display:none`, with the component still mounted and still fetching? Or does WorkspaceStore skip rendering? Loft could hide `mode-switch` one way and Darkside hide the rail the other way.

**Proposed AD-20: Classic is the unscoped baseline arrangement.**
- Classic's arrangement CSS and every region's default row heights are authored once, as the baseline layer (AD-22). They key on `[data-region]` and feature hooks, not on `data-style="classic"`.
- The Classic style package adds only what Classic does differently from the baseline. It's ideally empty, apart from the manifest.
- Every other style overrides the baseline inside its `@scope`, per feature it lists in `covers`.
- Uncovered features keep the baseline automatically.
- epic 6 freezes the `covers` vocabulary as the list of feature hook names (one per registered region component), not epic 11.
- Manifest `hide` is enforced in JS. WorkspaceStore doesn't mount a hidden region's components. Style CSS never hides a region.
- The look runtime supplies a default for every `--row-height-<list>` from the baseline, so a missing value can't reach `ListTabular`.

---

## P2: Window A vs window B on one OS appearance signal. Critical

**Unit A, the main window's look runtime. Unit B, a composer popout's look runtime.** Both follow the AD-14 sequence diagram literally. They receive `appearance-signals`, "resolve data-variant and motion attributes", then `Config.set core.appearance key (remote)`.

**Incompatibility.**
- Every window (hot windows included, since `getAllWindows()` returns hidden ones) writes config for the same signal. That's N writes and N×(N−1) `on-config-reloaded` deliveries.
- Each write excludes only its own source, so the last writer wins.
- A derived value (the OS's current scheme) is persisted as if it were the user's choice. If the resolver writes `mode`, Mode Auto silently becomes Light or Dark. Nothing in AD-11 or AD-14 says which key is written, or why.
- Two epics will read this diagram differently. epic-token-platform persists a resolved variant. epic-appearance treats `mode` as user intent.

**Proposed AD-21: The resolved look is computed, never stored.**
- `data-variant` and the signal flags are a pure function: `resolveLook(appliedConfig, overrides, signals)`. It lives in `look-runtime/` and is called by every look root.
- OS signals never cause a config write.
- Only an explicit user action writes `core.appearance`, and only the window where it happened writes it.
- Delete the `LR->>CPM` arrow on the signal path from the sequence diagram.

---

## P3: Style `@scope` CSS vs ported feature CSS vs shim plugin CSS vs `styles.less`. Critical

**Unit A, style-loft (epic 2).** `@scope ([data-style=loft]) to ([data-look]) { .list-item.selected { … } }`. Specificity is (0,2,0) within scope.

**Unit B, epic-token-platform's port of thread-list LESS to CSS (AD-7).** `.thread-list .list-item.selected { background: var(--accent-subtle) }`. It's unscoped, has specificity (0,3,0) and reads role tokens. That obeys AD-7.

**Unit C, a third-party package sheet through the shim (AD-8)**, at any specificity.

**Incompatibility.**
- Cascade order is origin → layers → specificity → scope proximity → order of appearance. Scope proximity only breaks specificity ties.
- So the unscoped ported rule beats Loft's scoped rule. Loft's overhanging selected card never shows.
- Order of appearance is undefined across the two insertion paths. Style package sheets load through `package.js` → `ThemeManager.loadStylesheet` into `<nylas-styles>`. Theme CSS goes through the look runtime.
- AD-8's "`styles.less` loads after all theme and style CSS" is not enforceable without a defined insertion point.
- Every style epic will fight this with specificity hacks, a different hack per style.

**Proposed AD-22: One cascade-layer order.**
- A kernel sheet declares `@layer reset, kernel, theme, baseline, feature, style, plugin, user;` first.
- Each producer wraps its output in its layer:
  - the theme compiler emits `@layer theme`;
  - ported feature CSS and Classic's baseline go in `baseline` / `feature`;
  - style packages go in `style`;
  - shim output goes in `plugin`;
  - `styles.less` goes in `user`.
- The package loader wraps style package sheets. Authors don't.
- Lint fails unlayered CSS in `internal_packages/` and `static/`.
- Insertion order then stops mattering.

Also verify in Chromium 156 that `to ([data-look])` does not treat the scope root itself, which also carries `data-look`, as a limit. Add a harness test for it.

---

## P4: Who falls back when a theme can't load or is removed? Critical

**Unit A, ThemeLibrary (main, epic 10).** It owns the last-valid cache and removal (AD-16). On removing the applied theme, or on a failure with no last-valid version, it "falls back to Loft". A reasonable reading is `Config.set core.appearance.theme = loft`.

**Unit B, the look runtime (renderer, epic 1).** On a `ThemeLoadError` over `theme-changed` it "raises ThemeLoadError". It then sets `data-theme="loft"` locally in each window.

**Unit C, epic-appearance's pending state.** The preview shows a third-party theme being live-edited (R24). The file breaks, and the preview falls back to Loft.

**Incompatibility.**
- A writes config, so the user's choice is lost for good. When the file is fixed, the theme doesn't come back. B doesn't write, so the choice comes back.
- If Apply is pressed during C's fallback, does Apply commit `loft` or the original id?
- Windows disagree during the gap.
- `theme-changed` carries "compiled CSS or a ThemeLoadError", so it's unspecified whether an error message also carries the last-valid CSS. A window that never saw the last-valid CSS can't fall back to it.

**Proposed AD-23: Fallback is render-time resolution with one owner.**
- Config and pending state always hold the user's chosen theme id.
- ThemeLibrary alone decides what CSS each id resolves to: current, last-valid, or none.
- Every `theme-changed` carries `{ id, revision, status: ok | last-valid | unavailable, css | null, error | null }`.
- `resolveLook` (AD-21) maps `unavailable` to `loft` at render time, in every look root alike.
- Nothing writes `core.appearance.theme` except an explicit Apply.
- Removal does the same: config keeps the id, the render falls back, and a toast explains.
- The same rule covers a disabled or uninstalled community style package, which falls back to the Classic baseline.

---

## P5: A late-opened window vs `theme-changed` broadcasts. High

**Unit A, ThemeLibrary.** It broadcasts `theme-changed` per AD-16.

**Unit B, a composer popout or onboarding window opened after startup.** It calls `get-appearance-signals` at load, the only snapshot channel there is.

**Incompatibility.**
- Built-in theme CSS ships compiled, but third-party theme CSS is only ever delivered by broadcast. A window opened later never receives the compiled CSS for an installed third-party theme, so it renders Loft or nothing.
- The hot window also misses events while it is still bootstrapping.
- Signals have a race too. A broadcast can arrive between the `get-appearance-signals` request and its reply, and then the older snapshot overwrites the newer state.
- Each epic will add its own channel to patch this: epic 10 a `get-themes`, epic 12 onboarding something else.

**Proposed AD-24: Snapshot plus revisioned events.**
- Add `get-theme-library` (invoke). It returns every third-party `ThemeDescriptor` (see P17) with CSS and status.
- Every `appearance-signals` and `theme-changed` payload carries a monotonically increasing `revision`.
- A window subscribes before it asks for the snapshot, and ignores any event or snapshot older than what it already holds.
- Add these to the IPC channel convention.

---

## P6: The Appearance slot can't reach the pending state or the cards. High

**Unit A, epic-appearance (epic 3).** It owns layout, the apply bar and pending state (AD-12). Its own built-in sections are laid out directly.

**Unit B, epic-theme-authoring (epic 10).** "Install theme…" must make the installed theme *pending* (R25). It has to put a derived badge and a Remove action on theme cards (R26).

**Unit C, epic-style-api (epic 11).** Its style card "names what it doesn't cover" (R27).

**Unit D, epic-email-dark-mode (epic 4).** It registers the Adapt email colours section.

**Incompatibility.**
- AD-12 only offers "register a component into `Preferences.Appearance.Section` with an `order`". A section can't set pending state, because no API is defined. B will either write config directly, which breaks R10, or reach into epic-appearance's internals.
- B and C need to change *cards inside* epic-appearance's pickers, which a section slot can't do. Their only AD-legal route is a section that duplicates the picker.
- `ComponentRegistry` has no `order` at all (verified). D, B and C each pick numbers with no band or tie rule. Their position relative to epic-appearance's own sections, which aren't in the registry, is undefined.

**Proposed AD-12, tightened.**
- epic-appearance exports an `AppearanceDraft` store. It has `pending`, `applied`, `set(key, value)` (pending keys only), `applyNow(key, value)` (immediate keys only), and `onChange`. It's the only way a section or card extension reads or writes looks.
- epic-appearance's own sections register into the same slot, at orders 100, 200 and up.
- Contributed sections get documented bands: 1xx–9xx between built-ins, ties broken by package name.
- epic-appearance adds the `order` field to ComponentRegistry and to `InjectedComponentSet` sorting.
- epic-appearance also defines two card extension points, `Preferences.Appearance.ThemeCard.Accessory` and `Preferences.Appearance.StyleCard.Accessory`. Each gets `{ descriptor }` as props, so epics 10 and 11 never edit the pickers.

---

## P7: The port codemod vs the shim's `ui-variables`. High

**Unit A, epic-token-platform's internal LESS → CSS port (AD-7).** "The 21 computed ui-variables become roles or `color-mix()`." For several of them, the port inlines `color-mix(in oklch, var(--accent) 12%, var(--surface-app))` at each use site and creates no role.

**Unit B, the shim (AD-8).** It "maps each legacy variable to `var(--<role>)` per DESIGN's mapping." A computed variable such as `@background-off-primary` maps to a role name that A never created. It resolves to the guaranteed-invalid value, so it's transparent in every plugin.

**Incompatibility.**
- The two halves of one migration produce different spellings for the same legacy variable.
- Neither AD says which legacy variables are dimensions, such as `@font-size-base` or `@padding-base-horizontal`. Those must stay LESS literals, because plugins do LESS arithmetic on them and use them in `@media (max-width: @…)`, where `var()` is illegal.
- If they're mapped to `var()`, the arithmetic fails, and the whole sheet silently falls back to literal Classic. It's correct by AD-8, but every plugin is stuck in Classic colours.
- Only `darken`, `lighten`, `fade` and `mix` are rewritten. `spin`, `saturate`, `tint`, `shade` and `contrast` push the sheet into the same Classic fallback.

**Proposed AD-25: One generated legacy-variable map.**
- `plugin-less-shim/legacy-map.json` is generated from DESIGN's LESS variable → role table.
- Each legacy variable gets `kind` (`colour` or `dimension` or `font`) and `css` (a `var(--role)` or a `color-mix(…)` expression).
- Dimension and font-size entries keep a literal LESS value.
- Both the port codemod and the shim's generated `ui-variables.less` are built from this one file. A test asserts that every `css` value references only roles the compiler emits.
- Extend the function plugin to every LESS colour function the 15k lines and known plugins use, or list the deliberately unsupported ones.

---

## P8: Where text scale is applied. High

**Unit A, the theme compiler (epic 1).** Following "every size is multiplied by `--text-scale`", it emits `--type-body-reading-size: calc(15px * var(--text-scale))`.

**Unit B, style-loft (epic 2).** Following AD-10, "`calc()` over its spacing roles and the theme's line-height roles, so it follows text size", it writes `calc(var(--type-body-size) * var(--text-scale) * var(--type-body-line-height) + …)`.

**Unit C, the shim.** `@font-size-base` stays a literal (P7), so plugin text doesn't scale at all.

**Incompatibility.**
- Both A and B "multiply by `--text-scale`". The row becomes text-scale² tall while the text is text-scale. At 150% the rows are 2.25× and the text is 1.5×.
- Or both assume the other did it, and neither does.
- Density has the same split. AD-10 says per-density values in style CSS, while the runtime `--density-scale` invites multiplication. A style author can do either and match neither DESIGN's row table nor the other styles.

**Proposed tightening.**
- Typography convention: the theme compiler emits pre-scaled sizes, `--type-*-size: calc(<px> * var(--text-scale))`, declared on `[data-look]` (P12).
- Consumers never multiply by `--text-scale` again, and lint flags `var(--text-scale)` outside the compiler output.
- Line heights are unitless.
- Density: styles set explicit per-density values on `:scope[data-density=…]`. `--density-scale` is only for the baseline and shim layers.
- State whether plugin text is expected to scale. If it should, the shim maps font sizes to `var()` where a plugin does no arithmetic on them.

---

## P9: The row-height probe vs width, nested roots and Loft rows. High

**Unit A, `ListTabular` (epic 1).** Per AD-10 it reads a probe "once per look change" and keeps fixed `itemHeight`.

**Unit B, the Classic style (epic 6).** It adds narrow-list row heights through a width container or media query in style CSS, replacing the JS 540px branch in `thread-list.jsx:185-191`.

**Unit C, the Appearance preview (epic 3).** It renders a thread list in a nested look root at the pending density and style.

**Unit D, epic-loft.** The initiative decided on "natural-height Loft rows". AD-10 says fixed-height virtualisation.

**Incompatibility.**
- B changes `--row-height-thread-list` on resize. That's no look change, so A's cached `itemHeight` goes stale and rows overlap or gap.
- The same happens when a font face finishes loading if any line height isn't unitless, and at R21 reflow steps.
- A probes per *window*. C's list needs the nested root's value, so the preview shows the window's row height at the wrong density.
- D contradicts AD-10 outright. epic 1 builds one thing and epic 2 needs the other.

**Proposed AD-10, rewritten.**
- The probe lives inside each list's own look root and region container.
- It's re-read on look change for that root, on `ResizeObserver` of the list container, and on `document.fonts` `loadingdone`.
- It's read with `getComputedStyle` on a hidden sized element, never parsed from the custom-property string.
- Resolve the Loft conflict explicitly. Either Loft's "natural height" means a style-defined fixed height per density that fits Loft's two-line card, which keeps AD-10, or `ListTabular` gains a measured variable-height mode that epic 1 builds. Pick one in the spine.
- `minWidth` is single-sourced. The look runtime exposes the manifest value as `--style-min-width` on the root, and style CSS uses container queries against it, never a re-typed px number.

---

## P10: Apply's View Transition vs everything else that changes the look. High

**Unit A, Apply (epic 3, AD-13).** `startViewTransition(() => set attributes)`.

**Unit B, immediate settings (Mode, contrast, text size) and OS signals (AD-14).** They set attributes directly at any time.

**Unit C, `theme-changed` (AD-16).** It replaces a sheet at any time.

**Unit D, Apply's config write (AD-11).** It sets `style`, `theme`, `density` and `font` one key at a time.

**Incompatibility.**
- A signal or a text-size change mid-transition either runs a second `startViewTransition`, which skips the first and loses the fade, or mutates the DOM under the pseudo-element snapshot.
- A's callback returns after the attribute change but before React re-renders with the new `itemHeight` (P9), and before the `data-font` face loads. The "new look painted" snapshot then has wrong rows and the fallback font, which breaks AD-13's own promise.
- D: each `Config.set` → `setRawValue` broadcasts separately (verified). Other windows paint four intermediate looks, such as the new style with the old theme, without transitions.

**Proposed AD-26: One look-transaction queue per window.**
- All look changes in a window go through `lookRuntime.commit(change, { transition })`. Changes are serialised, and changes queued mid-transition coalesce into the next commit.
- The update callback sets attributes, awaits `document.fonts.load` for a changed `data-font`, re-probes row heights, flushes React (`flushSync`), then resolves.
- Apply writes `core.appearance` as one object, `Config.set('core.appearance', next)`, so every window gets one `on-config-reloaded` and one commit.
- Other windows commit without a transition, and say so.

---

## P11: The email frame and print window as look roots. High

**Unit A, the look runtime (epic 1).** Per AD-1 and AD-11, a change is applied "by setting look-root attributes only". The conventions list "the email-frame document" as a look root.

**Unit B, email adaptation (epic 4, AD-18).** A luminance-threshold rewrite of text and background in JS, per variant.

**Unit C, print (epic 4).** "The light standard variant." The print package creates its own `BrowserWindow` through `@electron/remote` (`print-window.js:66`).

**Incompatibility.**
- An iframe is a separate document. None of the window's resident theme sheets apply inside it. Today `EmailFrameStylesStore` copies `<nylas-styles>` `innerText` into each frame, and AD-1 retires `<nylas-styles>` as the theme path.
- If epic 1 keeps sheets as `adoptedStyleSheets`, constructed sheets can't be adopted into another document, so there's no way to copy them across.
- A Mode Auto flip at dusk changes `data-variant` only. B's JS rewrite was computed against the old background and isn't re-run.
- Live reload (`theme-changed`) never reaches the frames.
- A text-size change doesn't trigger the frame-height re-measure, so the body is clipped.
- C's window isn't a look-runtime window. It receives no sheets, no signals and no adapter, and it's created outside AD-2.

**Proposed AD-27: Look roots in other documents.**
- The look runtime owns a `LookDocument` binding for each same-origin child document (email frames) and for the print window.
- The binding injects the active theme's CSS text from one in-memory registry. Sheets are kept as text plus `CSSStyleSheet` per document, never shared objects.
- It mirrors the attribute set and re-injects on `theme-changed`.
- It emits a `look-changed` event that email adaptation subscribes to, re-running the rewrite, and that `EmailFrame` subscribes to, re-measuring height.
- AD-11's "attributes only" is narrowed to "no recompile, no config write". Subscribers may recompute derived DOM.
- The print window opens through the shell adapter with a pinned `{ variant: light, contrast: off }` override.

---

## P12: Nested look roots vs `:root` declarations. High

**Unit A, epic-token-platform's kernel sheet.** Computed roles (`--surface-hover: color-mix(… var(--surface-app) …)`), `--text-scale` and `--density-scale` are declared on `:root`, or set as inline style on `<html>` by the look runtime. That's a literal reading of "set only by the look runtime".

**Unit B, the Appearance preview and the onboarding cards (epics 3 and 12).** These are nested look roots with "their own full attribute set".

**Unit C, two styles keying motion on the flags.** Taiga writes `[data-reduced-motion] .row`, which matches the ancestor `<html>`. Darkside writes `:scope[data-reduced-motion] .row`.

**Incompatibility.**
- A custom property holding `var()` resolves where it's declared. The preview inherits the *window's* `--surface-hover`, `--text-scale` and `--density-scale`, so the preview's hover colour, text size and density show the applied look, not the pending one. That breaks R9.
- C: if nested roots don't carry the signal flags, Darkside loses reduced motion in the preview. If they carry them, Taiga's selector also matches through the window root, so the two still differ when an override is wanted (onboarding offers Increase contrast as a pick).

**Proposed AD-1, tightened.**
- Everything a look depends on is declared on `[data-look]` by attribute selector, in theme or kernel CSS: derived roles and `--text-scale` / `--density-scale` (through `[data-text-size="112.5"] { --text-scale: 1.125 }`). Nothing goes on `:root` or in inline style.
- Every look root carries all attributes *including* the signal flags. `resolveLook` (AD-21) fills them.
- Styles key flags only as `:scope[data-…]`, and lint enforces it.

---

## P13: Look sheets vs window types. Medium

**Unit A, style-darkside (epic 8).** Its `package.json` copies a sibling's `windowTypes: { default: true }`.

**Unit B, the onboarding looks step (epic 12).** It shows a Darkside card in the onboarding window.

**Unit C, composer popouts and hot windows.**

**Incompatibility.**
- `package-manager.js:520` loads a package only in the window types it lists. The onboarding card renders unstyled, which still meets AD-1's "resident in every window" in spirit but not in fact.
- Hot windows (`packageLoadingDeferred`) don't have style sheets until they activate. The first popout paints unstyled, then snaps.

**Proposed AD-28: Look sheets load in every window type.**
- Style packages are loaded by the look runtime, not by the `windowTypes` gate. The `"style"` block implies `windowTypes.all`, and the hot-window bootstrap loads look sheets eagerly.
- The harness opens every window type (main, composer popout, thread popout, onboarding, print) in the sweep.

---

## P14: The per-OS title bar, between style CSS and the adapter. Medium

**Unit A, style-loft.** It places controls with `env(titlebar-area-*)` (AD-15).

**Unit B, the adapter (epic 1).** It sets `trafficLightPosition` at creation and forwards `set-title-bar-overlay`.

**Incompatibility.**
- `env(titlebar-area-*)` is undefined on macOS. Loft must branch per OS, but no look-root attribute exposes the platform, so each style invents its own (a class, a UA sniff).
- `trafficLightPosition` is a creation option. A style switch with a new `titlebarHeight` needs `setWindowButtonPosition` at runtime, and no channel exists for that.
- The hot window is created with the old style's position and overlay height.
- Overlay colours come from computed role values. Chromium serialises `color-mix(in oklch …)` as `oklch(...)` or `color(srgb …)`, which `setTitleBarOverlay` may not parse.
- The diagram sends `set-title-bar-overlay` only after `theme-changed`, not after a style or variant change.

**Proposed AD-15, tightened.**
- The window look root carries `data-platform` (`mac`, `win`, `linux`) and `data-window-type`.
- The look runtime sets `--titlebar-inset-start` and `--titlebar-inset-end` from the adapter, for every OS.
- One channel replaces the current one: `set-window-chrome` with `{ height, buttonPosition, color, symbolColor }`, colours as `#rrggbb` resolved in the renderer.
- It's sent after every commit (AD-26) and by the hot window on activation.

---

## P15: A style declaring a role property. Medium

**Unit A, style-darkside's port of ui-darkside layout LESS (epic 8).** To get its dark sidebar, it writes `[data-region=nav] { --surface-app: var(--surface-sidebar) }` inside its scope. That reads role tokens only, with no hex and no theme id, so AD-9's lint passes.

**Unit B, the Darkside theme and any third-party theme.**

**Incompatibility.**
- The style now owns colour in that region. This breaks the ownership constraint (a style never changes colour), and pairings tested against the theme's contrast pairs fail in that region.
- Shim plugin CSS inside the nav reads the redefined role.

**Proposed AD-9, tightened.**
- Style CSS may declare only `--radius-*`, `--space-*`, `--row-height-*` and `--style-*` custom properties.
- Lint fails a declaration of any role property name, from the compiler's emitted role list.
- If a style needs a region surface, the theme contract gets a role for it, such as `--surface-sidebar`. The style doesn't remap one role onto another.

---

## P16: The legacy LESS path vs the token look during coexistence. Medium

**Unit A, the old path (kept until epic 12).** It still loads `core.themes`. Its `getImportPaths` prepends the active legacy theme's `ui-variables`.

**Unit B, the token runtime (epic 1).** It applies `core.appearance.*`.

**Incompatibility.**
- An upgrader with a community LESS theme in `core.themes` gets both looks stacked in epics 1 to 11, in undefined order.
- Plugin sheets compile against the legacy theme's literal `ui-variables`, not the shim, so they drift from the token look.
- `ui-light` and `ui-dark` become the Classic theme (touch points). If those package names vanish, a `core.themes: ["ui-dark"]` user hits the old path's missing-theme branch.

**Proposed AD-29: Coexistence precedence.**
- From epic 1 on, the token look always renders. The old path loads only community LESS themes, inside `@layer plugin` (AD-22).
- The shim's `ui-variables` always wins the import path.
- Built-in legacy ids in `core.themes` are read only by epic 12's mapping, never loaded.
- `core.themes` stays unwritten.

---

## P17: Theme list cards vs ThemeLibrary output. Medium

**Unit A, epic-appearance's theme picker (epic 3).** It shows names and swatches for the 9 built-ins from build output.

**Unit B, ThemeLibrary (epic 10).** Its `theme-changed` carries "theme id plus compiled CSS".

**Incompatibility.**
- There's no shared shape for name, author, swatch colours, the `derived` flag or the source (built-in or file). A will parse its own built-in manifest. B's cards would have to scrape CSS, or B invents its own descriptor.
- Identity forks. Conventions say ids "match the file name", but R23 identifies a theme by `$metadata.id`. What wins when `foo.tokens.json` holds `id: "bar"`?
- "Keep both" on install has no renaming rule.

**Proposed convention, `ThemeDescriptor`.**
- `{ id, name, author, version, license, source: builtin | file, file, derived: { variants: [], roles: [] }, swatch: { surface, text, accent } per variant, status, revision }`.
- The compiler emits it for built-ins at build. ThemeLibrary emits it at load.
- `$metadata.id` is the identity.
- ThemeLibrary writes installed files as `<id>.tokens.json`. A file whose name and id disagree is loaded under its id with a warning.
- "Keep both" rewrites `$metadata.id` and `name` with a `-2` suffix before writing.

---

## What holds up

- AD-5 (pure compiler, one path) and AD-6 (four groups) are tight, and I couldn't build a clash against them alone.
- AD-2 and AD-3 (adapter and shell-neutral) hold, except for the print window in P11 and the chrome channel in P14.
- AD-14's single signal owner is right. Only the downstream config write in the diagram (P2) breaks it.
- AD-16's main-process `fs.watch` holds. Its gaps are delivery and versioning (P5), not watching.
