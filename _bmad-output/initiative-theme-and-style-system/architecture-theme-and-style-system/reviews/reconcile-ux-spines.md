---
type: review
reviews: architecture-theme-and-style-system.md
against: [ux-theme-and-style-system/DESIGN.md, ux-theme-and-style-system/EXPERIENCE.md]
created: '2026-11-11'
---

# Reconcile: UX spines → architecture spine

**Verdict.** The spine covers the main structure well: attribute-keyed CSS, one compiler, one shell adapter, `fs.watch` plus a 300ms debounce, the shim, and email adaptation for replies and print. But it contradicts the UX spines in three places: the build-time contrast gate, forced colours on Linux and Windows, and toast persistence. It also leaves out several quiet requirements: how first paint gets the theme, the cache fallback semantics, the install, export and remove flow, the upgrade mapping, the preview data seam, and how theme values are serialised to CSS safely. 32 findings: 9 high, 13 medium, 10 low.

Visual values (hex values, pixel sizes) and microcopy are out of scope. "E" means EXPERIENCE.md and "D" means DESIGN.md. Each fix is a **new AD**, a **tightened Rule**, a **Deferred** line or an **Open question**.

## Summary

| # | Sev | Topic | Fix type |
|---|---|---|---|
| F1 | High | AD-5 build gate fails standard-contrast built-ins that fail by design | Tighten AD-5 |
| F2 | High | Forced colours: GNOME HC on Linux, and Windows Contrast vs `-hc` precedence | Tighten AD-14 + Open question |
| F3 | High | Theme values reach CSS through a blacklist only, so injection is possible | New AD |
| F4 | High | The preview renders real components on fixture data, and no data seam exists | New AD |
| F5 | High | First paint and new windows: no snapshot of third-party theme CSS, and async signals | New AD |
| F6 | High | Last-valid cache: fallback order, deleted file, the error payload, parse-failure identity | Tighten AD-16 + conventions |
| F7 | High | Whole-mode derivation algorithm undecided (D OQ5); the compiler assumes it | Open question + tighten AD-5 |
| F8 | High | The DTCG `$type` whitelist can't express line height, `em` tracking or `none` shadows | Open question |
| F9 | High | Install, export, remove: no IPC, the file dialog isn't behind the adapter, no clash round trip | New AD |
| F10 | Med | Themes folder lifecycle: lazy creation, unwritable state, when the watcher starts | Tighten AD-16 |
| F11 | Med | Upgrade mapping missing; AD-7's interim legacy path contradicts "LESS themes stop working" | New AD + tighten AD-7 |
| F12 | Med | Toast contract: info auto-dismisses, but the upgrade and community-LESS toasts persist; pause on hover | Tighten Toasts convention |
| F13 | Med | The derivation report never reaches the renderer (derived badge, theme default font name) | Tighten IPC convention |
| F14 | Med | Reflow ladder: JS steps, preview vs viewport queries, one source for `minWidth` | Open question + tighten AD-9 |
| F15 | Med | AD-10 row-height probe is per window, not per look root | Tighten AD-10 |
| F16 | Med | RTL: nothing sets `dir`; feature CSS isn't linted; OS controls are physical | Tighten AD-7, AD-9, AD-15 |
| F17 | Med | Styles have no contrast hook for the Increase contrast borders | Tighten conventions |
| F18 | Med | Reduced motion: preview cross-fade mechanism, feature CSS, Apply focus and announcement | Tighten AD-13 + conventions |
| F19 | Med | Hairlines at 1 device pixel need a runtime DPR property | Tighten Runtime properties |
| F20 | Med | Search highlight security contract dropped | New Rule (AD-9 or new AD) |
| F21 | Med | Email adaptation: no remote fetch for the backing plate; View original storage privacy | Tighten AD-18 + Deferred |
| F22 | Med | Signals snapshot shape: OS name, Linux "unknown" | Tighten IPC convention |
| F23 | Low | Sequence diagram shows an OS signal writing config | Fix diagram |
| F24 | Low | Harness has no signal-injection seam for HC, forced colours, reduced motion, RTL on Linux CI | Tighten AD-19 |
| F25 | Low | No cascade order for theme, style, font override, plugins, `styles.less` | New AD |
| F26 | Low | Theme identity: `$metadata.id` vs the file-name convention; duplicate ids | Tighten Ids convention |
| F27 | Low | Font fallback stack for third-party themes; detecting a missing local font | Tighten AD-17 + Deferred |
| F28 | Low | DTCG nested path → role name mapping and collisions | Tighten AD-6 |
| F29 | Low | "Error names file and line" needs a position-tracking JSON parser | Stack + tighten AD-5 |
| F30 | Low | Selected-card overhang and focus ring vs the virtualised scroller's clip | Deferred |
| F31 | Low | "Renders in Classic's arrangement" has no mechanism under `@scope` | Open question |
| F32 | Low | Swatches and style-card thumbnails aren't listed as look roots | Tighten conventions |

---

## High

### F1: The AD-5 build gate contradicts the accepted standard-contrast risk

- **Input.** D › Brand & Style ("matches its reference exactly at standard contrast … even where that fails WCAG AA"); D › Contrast pairs ("Every high-contrast variant must pass … at standard contrast … failures there are expected and recorded"; safeguard 2: `text-strong` on `surface-panel` passes 4.5:1 in *every* theme variant); D › Do's and Don'ts ("Quietly fix a theme's standard-contrast ratios" is a Don't).
- **Spine.** AD-5: "A built-in that needs any derivation or fails a pair fails the build." Loft light standard fails many pairs (2.02–4.44:1), so as written the default theme can't build. The spine also never enforces the one always-pass pair for third-party standard variants.
- **Fix (tighten AD-5).** "The build fails if a built-in `-hc` variant fails any pair, or if any variant fails `text-strong`/`surface-panel` at 4.5:1. Standard-contrast pair failures are written to the compiler report and never fail the build or the load. For third-party themes the same always-pass pair is re-derived (and badged) when it fails, at any contrast level."

### F2: Forced colours on Linux and Windows contradict the inputs

- **Input.** E › Accessibility Floor: "Windows Contrast themes and GNOME high contrast are honoured" as forced colours. D › Forced colours: system colours replace roles, shadows are dropped, edges become 1px. E › Flow 3: "If she uses a Windows Contrast theme, forced colours are honoured *instead*."
- **Spine.** AD-14: "Chromium never enables forced colours on Linux." So the spine can't honour GNOME HC as forced colours, which is a direct contradiction. AD-14 also uses `nativeTheme.shouldUseHighContrastColors` for `contrast` on Windows. That flag is true under a Contrast theme, so `contrast` and `forcedColors` turn on together, and the spine has no precedence rule ("instead").
- **Fix.** Tighten AD-14: "When `forcedColors` is set, it wins: the look runtime sets `data-forced-colors`, and the `-hc` swap is suppressed or ignored for colour. On Windows, `contrast` comes from the user's Increase contrast choice only when no Contrast theme is active." **Open question** (owner epic-token-platform, and UX sign-off): on Linux, GNOME high contrast feeds `contrast` (the `-hc` variant), not forced colours. E and D should be amended to say so, or else the app emulates forced colours under `data-forced-colors` from portal values. The second option is not real system colours, because Chromium's system colours on Linux are fixed defaults.

### F3: Theme values reach CSS only through a blacklist

- **Input.** E › Theme Authoring › Validation: only colour, dimension, font-family string, shadow and font-weight are allowed. A value containing `url()`, `@import`, `var()`, `;` or `}` rejects the file.
- **Spine.** AD-5 says only that the compiler validates against the "EXPERIENCE Theme Authoring value rules". A substring blacklist is bypassable with CSS escapes (`u\72 l(`), comments or `{`. The spine also never says that `$metadata.id` is constrained before it is spliced into `[data-theme="<id>"]`, or how font-family strings are quoted.
- **Fix (new AD: "Theme CSS is serialised from typed values, never from author strings").** "The compiler parses each value to its typed form (a colour normalised by culori, a number and unit, a weight number, shadow parts, a font-family list) and emits CSS from those parts only. Font families are emitted as escaped CSS strings. `$metadata.id` must match `^[a-z0-9]+(-[a-z0-9]+)*$` before it is used in a selector, a file name or a toast key. The E blacklist stays as defence in depth. Compiled CSS is applied with `CSSStyleSheet.replaceSync` or `textContent`, never `innerHTML`."

### F4: The preview renders real components on fixture data

- **Input.** E › Appearance preview: "Renders real components (top bar, message list, reading card) on fixture (sample) data, never the user's mail … Inert … OS mode and contrast changes re-render it at once." The mini-preview holds a thumbnail of the whole pending screen.
- **Spine.** Only the nested look root (AD-1). Today `ThreadList`, `MessageList` and the account chip read Flux singletons (`ThreadListStore`, `MessageStore`, `AccountStore`). The spine has no seam for rendering them on fixtures, and no rule that the preview has no side effects (marking a thread read, loading remote images, network calls, registering keyboard commands).
- **Fix (new AD).** "Components shown in the preview or the onboarding cards split into a presentational part (props only) and a store-connected wrapper. The preview mounts the presentational parts with a fixture provider from `src/appearance/preview-fixtures/`. It renders under `inert`, with no store, action or network access. The mini-preview reuses the same render, scaled, not a second tree." Owner epic-appearance. It binds every epic whose components appear in the preview (epic-loft, the style epics).

### F5: First paint and new windows have no theme snapshot

- **Input.** E › OS signals: "OS Increase contrast on … first launch included: high-contrast values apply with no in-app action." E › Flow 3 step 3: the app *starts* in high contrast. E › Theme files: "Theme fails to load: App start."
- **Spine.** `get-appearance-signals` is an async invoke at window load, so the first paint can show the wrong variant (a light flash in dark mode, or standard before HC). `theme-changed` is push-only. There is no snapshot channel that gives a new window (a composer pop-out, onboarding, a reopened main window) the compiled CSS of installed third-party themes, cached or fresh. The spine also doesn't say what main does at startup when the applied theme is third-party.
- **Fix (new AD: "Windows open with the look resolved").** "Main passes the signals snapshot, the resolved look-root attributes and every third-party theme's compiled CSS (from the last-valid cache, so no compile blocks window creation) with window creation, through load settings. The renderer sets attributes before React mounts. `BrowserWindow.backgroundColor` is the resolved `surface-app`. ThemeLibrary re-validates in the background and pushes `theme-changed` if the result differs." Add `get-theme-sheets` (invoke) to the IPC conventions.

### F6: Last-valid cache semantics are unstated

- **Input.** E › Theme Authoring › Last valid cache: cached "on every successful load". On failure (at app start or from Appearance) the app uses the cached version, then Loft, with an error toast. "If the active file is deleted, the cached copy stays in use, with a toast." Live reload: "A parse failure counts as a partial save … error toast names the file and line, replacing any earlier one." E › Strings: two distinct outcomes, "Using Loft instead" and "Showing the last version that worked".
- **Spine.** AD-16 says only that ThemeLibrary "owns … the last-valid cache", and the layout is Deferred. The fallback order isn't a Rule. `ThemeLoadError` has `missing-file`, but E says a deleted active file keeps working, with a non-error toast. The error carries no "fallback taken" field, so the renderer can't choose between the two strings. The toast key `theme:<id>` needs the id, but a parse failure can't read `$metadata.id`. Nothing says whether falling back to Loft rewrites `core.appearance.theme`.
- **Fix (tighten AD-16 and the Theme load error convention).** "Fallback order: the last valid cached CSS, then Loft. The fallback never writes config, so fixing the file restores the theme. The cache is written only after a full compile succeeds. ThemeLibrary keeps a file → id/name map from the last valid load and uses it to key and name errors when parsing fails. If there is no prior load, it uses the file name. A deleted active file is not an error: it sends `theme-removed` with `usingCache: true` and an info toast." Add `fallback: 'cache' | 'loft'` to `ThemeLoadError`.

### F7: The whole-mode derivation algorithm is undecided

- **Input.** D › Open Questions 5: "The derivation rule for a whole mode is not decided yet." D › Derived values: the named rules (`border-strong`, focus ring, category label, accent split, HC error toast, the control roles take `border-strong` in HC, `shadow-accent` is `none` in HC). E › Partial themes: missing modes are "derived in OKLCH from its light values".
- **Spine.** AD-5 says "derives missing variants … in OKLCH" as if the algorithm exists. It doesn't cite D's rule set, and it doesn't say the output must be deterministic, which matters because the cache, the build and the harness all compare outputs.
- **Fix.** **Open question** (owner epic-themes, which must close it before epic-theme-authoring ships runtime derivation): the light → dark whole-mode derivation algorithm. Tighten AD-5: "Derivation implements DESIGN › Derived values rules and nothing else, and it is deterministic: the same file and compiler version give byte-identical CSS. The compiler version is stored with each cache entry, and a version change re-derives."

### F8: The DTCG `$type` whitelist can't express required content

- **Input.** E › Validation: only colour, dimension, font-family string, shadow and font-weight values are allowed. E › Contents: themes carry "typography including line height". D frontmatter: `lineHeight: '1.8'` (unitless), `letterSpacing: 0.01em`. D › Elevation: "A theme may set a shadow role to `none`."
- **Spine.** No mention. DTCG 2025.10 `dimension` allows only `px` and `rem` (confirm against the schema). Unitless line height is a DTCG `number`, which the whitelist doesn't allow. `em` tracking isn't a valid dimension. A DTCG `shadow` has no `none` form.
- **Fix (Open question, owner epic-token-platform, needs UX sign-off).** Allow `number` for line height, or allow the `typography` composite. Decide how em-relative tracking is carried (for example, as a `number` read as em by role convention). Decide how a theme says `none` for a shadow (for example, an empty array, or a transparent zero shadow). The answer goes into AD-6 and the theme author guide.

### F9: The install, export and remove flow has no architecture

- **Input.** E › Install, export, remove: Install validates first, and "a rejected file is never copied". On success the theme "becomes the pending theme" and is not applied ("Banned: applying an installed theme directly"). A third-party id clash asks **Replace** or **Keep both** *before* copying; Keep both asks for a name and assigns a new id. A built-in id or name clash gives an inline error and copies nothing. "Export a copy…" on a built-in creates "<Name> copy" with a new id. "Remove theme" is on third-party swatches.
- **Spine.** AD-16 says only that ThemeLibrary owns install, export and remove. The IPC conventions have no channels for them. The file picker (`dialog.showOpenDialog`) is an OS touch point that AD-2's list leaves out. The spine also doesn't cover: the two-step clash round trip, the watcher re-compiling a file ThemeLibrary just wrote (a double `theme-changed`), and what happens when the *applied* theme is removed.
- **Fix (new AD).** "Install is a two-phase invoke: `theme-install-check` (validate, return the report or a clash) → `theme-install-commit` (`replace` | `keep-both` + name). Plus `theme-export-copy` and `theme-remove`. The picker goes through the shell adapter. ThemeLibrary ignores watcher events for writes it made itself, within the debounce window. Install never writes config; the renderer sets the pending theme." **Open question** (owner epic-theme-authoring): when the applied theme is removed, does it fall back to Loft (and write config) or stay on cache?

---

## Medium

### F10: The themes folder lifecycle is missing

- **Input.** E › Location: the folder is created on the first install or export, "not on first launch". If it can't be written, "Install theme…" is disabled with an inline note naming the folder's path, and live reload is off.
- **Spine.** AD-16 watches `~/.nylas-mail/themes/` but doesn't say when the watcher starts (`fs.watch` on a missing directory throws), how a folder created later by the user is noticed, or how "unwritable" reaches the renderer.
- **Fix (tighten AD-16).** "ThemeLibrary starts the watcher when the folder first exists: at startup, after its own create, or on a parent-folder watch event. It probes writability at startup and on every install or export, and exposes `themesFolder: { path, exists, writable }` in a `get-theme-library-state` invoke and a `theme-library-state` broadcast."

### F11: The upgrade mapping is absent, and the interim legacy path contradicts the inputs

- **Input.** E › Upgrade: `ui-taiga` maps to Taiga + Taiga, and so on; `ui-light`/`ui-dark` → Classic + Classic; `ui-ubuntu` → Classic + Aubergine. "A `ui-dark` user keeps Mode pinned to Dark." With stacked themes, "the first non-base entry is the one that maps". A community LESS theme → Classic + Classic, "with a persistent toast naming the theme". E › Foundation, Theme Authoring › Legacy: "Old community LESS themes stop working." E › Density: the default is "the onboarded style's native density", and upgraders skip onboarding.
- **Spine.** No mapping table. The flags are Deferred. AD-7 keeps legacy LESS themes "loading on the old path until epic-onboarding-upgrade retires it". If any installable pre-release ships in between, community LESS themes still load, which contradicts E.
- **Fix.** New AD: "Main runs the upgrade mapping once, before the first window is created, when `core.themes` exists and there is no mapping marker. It writes only `core.appearance.*` and the marker, never `core.themes`, and it maps per E › Upgrade." Tighten AD-7: "The legacy path is gated off in every build distributed to users." **Open question** (owner epic-onboarding-upgrade): does a `ui-less-is-more` upgrader get Compact (the native density) or the `comfortable` default?

### F12: The toast contract contradicts itself

- **Input.** E › Toast: info toasts auto-dismiss after 5s, "paused on hover and focus"; clicking a toast dismisses it. E › Upgrade notice toast: "Persists until dismissed or acted on." E › Upgrade (community LESS): a "persistent toast". The deleted-theme toast's kind is undecided.
- **Spine.** Toasts convention: "Info toasts are `role="status"` and dismiss after 5s." It has no `persist` field and no pause on hover and focus. A theme error is broadcast to every window, so every window (including composer pop-outs) would raise its own toast.
- **Fix (tighten Toasts convention).** Add `persist` (boolean; default `false` for info, always `true` for error). Pause the auto-dismiss timer on hover and focus. "Theme and upgrade toasts show only in the main window."

### F13: The derivation report never reaches the renderer

- **Input.** E › Derived badge: shown when the *current mode and contrast's* variant is derived, when a role was filled from Classic, or when HC pairs were re-derived. E › Display rows › Font: "Theme default (naming the active theme's typeface)."
- **Spine.** AD-5's compiler returns "CSS plus a report", but `theme-changed` carries "theme id plus compiled CSS". The swatch can't know which variants are derived, and Font can't name the typeface.
- **Fix (tighten IPC convention).** `theme-changed` carries `{ id, name, css, report: { derived: { light, dark, 'light-hc', 'dark-hc' }, filledRoles[], rederivedPairs[], fontFamilyName } }`, and so does the F5 snapshot.

### F14: The reflow ladder mechanism is unstated

- **Input.** E › Responsive & Platform › Reflow ladder: below the style's minimum width, in order: collapse the rail, collapse the folders, reduce the sidebar to an icon strip, merge to a single pane with Back. The top bar collapses too (search becomes an icon, the account chip its avatar). Below that the window scrolls. "The ladder holds at 150% text plus zoom." D › Window chrome: the minimum widths per style.
- **Spine.** R21 → "style CSS at the manifest `minWidth`". The single-pane step is Deferred. Open items: the Back control and "which pane is showing" are feature state, not CSS. The spine doesn't say whether the ladder keys on the viewport (`@media`) or the look root (`@container`). That choice decides whether the Appearance preview, a narrow nested look root, collapses to one pane. `minWidth` in the manifest and the breakpoints in CSS can drift apart. It's undecided whether `BrowserWindow.minWidth` changes per style. There's no rule for how the ladder interacts with `layoutMode: user` single-pane.
- **Fix.** Tighten AD-9: "Ladder breakpoints are container queries on the look root (`container-type: inline-size`). The preview renders at a virtual window width (the style's `minWidth` or the 1504px key-screen width) and is scaled with `transform`, so it never enters the ladder. The manifest `minWidth` is the only source, and the build generates the CSS breakpoints from it." **Open question** (owner epic-loft): the window's hard minimum size, and the ladder under `layoutMode: user` single-pane.

### F15: AD-10's row-height probe is per window, not per look root

- **Input.** E › Appearance preview: the preview renders the pending style and density, which differ from the applied ones. Text size applies immediately, the preview included.
- **Spine.** AD-10: "`ListTabular` reads the computed value from a probe element once per look change." One probe per window gives the preview the applied row height.
- **Fix (tighten AD-10).** "One probe per look root. A 'look change' includes `data-style`, `data-density`, `data-text-size`, `data-font` and `data-variant` (HC may change line height) on that root."

### F16: RTL is underspecified

- **Input.** E › Style Contract: logical properties for RTL. E › RTL: the sidebar, list and reading pane swap sides; the overhang and compose follow inline-end. E › Window chrome: macOS controls at inline-start, Windows and Linux at inline-end. E › Accessibility Floor: `dir="auto"` with bidi isolation for names, subjects and snippets. E › Verification: LTR/RTL multiplies the matrix.
- **Spine.** AD-9 lints physical `left`/`right` in *style* CSS only. The ported feature CSS (AD-7) isn't linted, so RTL breaks there. Nothing says what sets `dir` on look roots (app locale? a setting?). OS window controls are physically placed: `trafficLightPosition` is a physical x/y, and `titleBarOverlay` sits where the OS puts it. That conflicts with the "inline-start/end" wording under RTL.
- **Fix.** Tighten AD-7: "Ported feature CSS uses logical properties, under the same lint." Tighten AD-15: "Window-control placement follows the OS, read from `env(titlebar-area-*)`, not the app's `dir`." **Open question** (owner epic-token-platform): what sets `dir` on the look roots, and whether the harness sweeps RTL.

### F17: Styles have no contrast hook

- **Input.** D › Forced colours and Increase contrast borders: "Increase contrast also adds a 1px `border-strong` border wherever separation is by shadow or tint only". E › Style Contract lists this as an obligation of every style.
- **Spine.** Styles key on `data-forced-colors`, `data-reduced-motion` and `data-reduced-transparency`. Contrast exists only inside `data-variant` values. Styles would have to match `[data-variant$="-hc"]` or read a theme-supplied value, and neither is a convention.
- **Fix (tighten Look-root attributes).** Add the flag `data-increased-contrast`, set by the look runtime with the `-hc` variant. Styles key the extra borders on it.

### F18: Reduced motion is only half covered

- **Input.** E › Reduced motion: "every transition in every style is instant, Loft micro-motion included". E › Appearance preview: "Updates on every change with a 120ms cross-fade (instant with reduced motion)". E › Applied: focus stays where it was, and screen readers hear the whole new look.
- **Spine.** AD-13 covers only Apply. The convention says *styles* key motion on `data-reduced-motion`; ported feature CSS is left out. AD-13 doesn't cover keeping focus, the live region for the announcement, or what non-applying windows do.
- **Fix.** Tighten the convention: "All app CSS (style and feature) keys motion on `data-reduced-motion`." Tighten AD-13: "The preview cross-fade uses an element-scoped View Transition on the preview root, or a CSS opacity cross-fade if element-scoped transitions aren't in Electron 45's Chromium; verify which. Apply never moves focus. The look runtime owns one polite live region for the Apply announcement. Other windows apply attributes with no transition."

### F19: Hairlines at 1 device pixel need a runtime property

- **Input.** E › Scale factors, D › Forced colours: "Hairlines are 1 device pixel at every scale factor." D › Do's: don't let hairlines blur between scale factors.
- **Spine.** The runtime properties are only `--text-scale` and `--density-scale`. `devicePixelRatio` changes when the window moves between monitors and with `interfaceZoom`.
- **Fix (tighten Runtime properties).** Add `--hairline: calc(1px / <dpr>)`. The look runtime sets it on every look root and updates it on a `resolution` media change.

### F20: The search highlight security contract was dropped

- **Input.** E › Search overlay: "**Security contract:** hit highlights render as HTML, which is safe only because the search layer escapes the text first."
- **Spine.** Absent.
- **Fix (new Rule; it fits a new AD next to F3, or AD-9).** "Search hit markup is built only by the search layer, from text it has escaped. Components render highlight HTML only from that layer's output, and never call `dangerouslySetInnerHTML` on message fields." Owner epic-loft (`thread-search`).

### F21: Email adaptation has a privacy edge

- **Input.** E › Email Body Rendering: "Transparent images get a light backing plate; the image itself is unaltered." E › Reading card: remote images stay blocked until "Show remote images" is clicked. E › View original: remembered "per sender address, per account".
- **Spine.** AD-18 says images are never altered; the backing plate isn't mentioned. Detecting transparency would need image pixels, which means fetching remote images (a tracking-pixel leak) and reading cross-origin canvas data. The Deferred storage line has no privacy constraint, even though the data is a list of sender addresses.
- **Fix.** Tighten AD-18: "Adaptation never loads a resource. The backing plate is chosen by format (formats that can carry alpha) or after the user unblocks the image, never by fetching it." Tighten the Deferred line: "Stored locally, in the account's local data rather than synced or exported config; removed with the account."

### F22: The signals snapshot shape is undefined

- **Input.** E › Tone: the OS name and its setting name in the Increase contrast strings and the OS chip "come from the platform at runtime". E › OS chip: "Following macOS: off". AD-14 itself allows "no signal" on Linux.
- **Spine.** The `appearance-signals` payload is "the full signals object", with no fields defined and no unknown state.
- **Fix (tighten IPC convention).** `{ platform: 'mac'|'windows'|'linux', colorScheme: 'light'|'dark', contrast: 'more'|'no-preference'|'unknown', forcedColors, reducedMotion, reducedTransparency }`. E needs a chip string for `unknown` (hand back to UX).

---

## Low

### F23: The sequence diagram has an OS signal writing config

- **Input.** E › Live OS tracking: Mode Auto and Follow system track the OS live. Text size is "User-owned afterwards".
- **Spine.** Diagram 3: `SC->>LR: resolve data-variant` and then `LR->>CPM: Config.set core.appearance key`, all inside the OS-signal flow. Read literally, an OS change writes config, and every other window then re-applies from `on-config-reloaded`.
- **Fix.** Split the diagram into an OS-signal flow (attributes only, no config write) and a user-change flow (`Config.set` → broadcast).

### F24: The harness can't inject signals

- **Input.** E › Verification Matrix: HC variants get axe. Forced colours, RTL and the three OSes multiply the matrix. Flow 3 covers OS HC on first launch.
- **Spine.** AD-19 runs the sweep on Linux CI, where real forced colours and Windows Contrast don't exist.
- **Fix (tighten AD-19).** "AppearanceSignals accepts a test-only override (env or IPC, compiled out of release builds), so the harness can sweep `contrast`, `forcedColors`, `reducedMotion` and `dir` on Linux. Real-OS behaviour stays a by-eye check per OS."

### F25: No cascade order

- **Input.** D › Typography: the font override "replaces the theme's typeface everywhere". E › Legacy: `styles.less` loads after the tokens. D: the Increase contrast borders and the forced-colours treatment sit on top of style CSS.
- **Spine.** AD-8 places `styles.less` last. Nothing else is ordered. A `[data-font]` rule has to beat `[data-theme][data-variant]` family declarations whatever the specificity or source order, and third-party theme sheets are added at runtime.
- **Fix (new AD).** "One `@layer` order: `theme, style, font-override, a11y, features, plugins, user`. Theme sheets, including third-party sheets added at runtime, go into `theme`. `styles.less` goes into `user`."

### F26: Theme identity vs file names

- **Input.** E › Identity: "A theme is identified by `$metadata.id`." Keep both "gives the copy a new id".
- **Spine.** Ids convention: ids "match the file or package name … `themes/<id>.tokens.json`". A hand-dropped `ocean.tokens.json` with `id: "sea"`, or two files with the same id, is undefined.
- **Fix (tighten Ids).** "For third-party themes, `$metadata.id` is the identity. ThemeLibrary writes files as `<id>.tokens.json` and treats the file name as advisory. When two files share an id, the newer one gets a `ThemeLoadError` with a new code, `duplicate-id`."

### F27: Font fallback stack and missing-font detection

- **Input.** D › Typography: "Every stack ends in system fallbacks that cover CJK, Arabic and Hebrew." E › Strings: "'Fira Sans' isn't installed. Using the theme's default font."
- **Spine.** AD-17 covers bundled faces. The spine doesn't guarantee fallbacks for third-party font stacks. It doesn't say how a missing *local* font is detected: `document.fonts.check` is unreliable for local faces, and `queryLocalFonts` needs a permission.
- **Fix.** Tighten AD-5: "The compiler appends the system fallback stack to every emitted font-family." Extend the existing Deferred line ("Choose installed font…") to cover the detection mechanism, which should go through the shell adapter.

### F28: DTCG nested path → role name

- **Input.** D › Structure note: theme files "may nest the same roles (`surface.app`)"; the architecture ratifies the mapping.
- **Spine.** The role property names follow D's kebab keys. The path → name rule isn't stated, and a collision (`surface.app` and `surface-app` in the same file) is undefined.
- **Fix (tighten AD-6).** "Role name = the DTCG path joined with `-`. When two paths resolve to the same role, the file gets a `schema` error."

### F29: "Names the file and line" needs a source-mapped parse

- **Input.** E › Validation and Live reload: the error names "the file and line", for example "line 12: expected a colour value".
- **Spine.** `ThemeLoadError.line` exists. `JSON.parse` reports positions only for syntax errors, not for semantic errors (forbidden value, wrong `$type`, alias cycle).
- **Fix.** Add a position-tracking JSON parser to Stack (for example `jsonc-parser`; the choice is epic-token-platform's), and tighten AD-5: "Every report entry carries the line of the token that caused it."

### F30: The selected-card overhang vs the virtualised scroller

- **Input.** D › Selected message card: it overhangs 10px past the list's inline-end edge and sits above the reading pane. E › Focus: the focus ring is never clipped by the overhang.
- **Spine.** AD-10 keeps fixed-height virtualisation inside a scroll container, and a scroll container clips its children on both axes. CSS-only styles have to solve this, for example with a scroller that extends under the reading pane with inline-end padding.
- **Fix (Deferred).** "How Loft's overhang escapes the list scroller under CSS-only styles. Freeze the solution into the kit at epic-classic-style." Owner epic-loft.

### F31: The community-style fallback mechanism

- **Input.** E › Style Contract: under a community style, an uncovered feature "renders in Classic's region arrangement".
- **Spine.** AD-9 states the outcome. Style CSS is `@scope ([data-style=<id>]) to ([data-look])`. An uncovered feature's region would need `data-style="classic"` plus a scope boundary, and as written the community scope still reaches it.
- **Fix (Open question, owner epic-style-api).** Is the uncovered region a nested look root (with `data-look` and `data-style="classic"`, all other attributes inherited from its parent), or does Classic's region CSS get a second, region-keyed scope?

### F32: Swatches and thumbnails as look roots

- **Input.** D › Theme swatch: the "Aa" chip is drawn "in the theme's typeface and colours". D › Style card: the wireframe thumbnail is drawn "in the card's theme tokens". The onboarding cards are drawn in each look's own theme.
- **Spine.** The look-root list covers `<html>`, the preview, the onboarding cards and the email frame. It leaves out swatches and style-card thumbnails, which need their own `data-theme`/`data-variant`.
- **Fix (tighten Look-root attributes).** Add the theme swatch chip and the style-card thumbnail as look roots. They take `data-theme`, `data-variant` and `data-font`, and inherit the rest.

---

## Checked and consistent (no finding)

The 300ms live-reload debounce (AD-16). Replies and forwards quote the model body, and print uses the original body in the light standard variant (AD-18). Pending picks are never written before Apply (AD-11). `core.themes` is untouched (AD-8, AD-11). Window zoom stacks on text size (AD-11). The 24px pointer-target floor (AD-10). The 540-combination sweep, with axe on HC only and pairs checked directly (AD-19). Onboarding is 900×600 and frameless (AD-15). The category override is stored as an index (conventions). Built-in ids and names are reserved (conventions). The 256KB limit and alias cycles are reflected in the `ThemeLoadError` codes. The OS text scale is already an Open question in the spine.
