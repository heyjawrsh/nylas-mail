---
type: review
lens: rubric
target: architecture-theme-and-style-system.md
reviewed: '2026-11-11'
inputs:
  - architecture-theme-and-style-system.md
  - .memlog.md
  - ../initiative-theme-and-style-system.md
  - ../tickets/tickets.toml
  - packages/client-app (brownfield spot-check)
---

# Rubric review: theme-and-style-system spine

## Verdict

**Not ready to bind the epics.** The token pipeline, attribute-keyed looks, the shell adapter, the compiler and the signals service hold up, and most of the brownfield claims check out. The style contract doesn't. AD-9 makes styles CSS-only, but the code that decides layout geometry is in feature JavaScript: column widths, the window minimum width, the list/split sheet stack and the narrow-list switch. As written, five style epics and the style API would each make up their own workaround. Several other cross-epic seams are also undecided or contradictory: the email-frame styling path, fixture rendering for the preview, the Classic fallback for community styles, CSS that is Chromium-only versus WebKit-safe, and the contrast-check scope. The operational envelope is mostly left out. Packaging is waved off as "not a theme concern", even though every epic's done condition needs an installable build, and telemetry, crash reporting, iframe security and performance aren't mentioned at all.

Tally: 1 critical, 10 high, 16 medium, 13 low.

## Brownfield spot-check

| Spine claim | Code | Result |
| --- | --- | --- |
| `frame: process.platform !== "darwin"` | `src/browser/window-launcher.js:36` | Confirmed |
| `nodeIntegration: true`, no sandbox | `src/browser/nylas-window.js:82-84` (`contextIsolation: false`, `sandbox: false`) | Confirmed |
| Electron 44.0.0 | `package.json:77` `"electron": "^44.0.0"` | Confirmed |
| Fonts over `nylas://` via deprecated `registerFileProtocol` | `src/browser/nylas-protocol-handler.js:33` | Confirmed |
| `pathwatcher` optional and missing | `src/theme-manager.js:19,69`, `src/renderer-stubs/optional-native.js` | Confirmed |
| `styles.less` not loaded anywhere | no reference in `src/` | Confirmed |
| ListTabular fixed `itemHeight`, rows at `idx * itemHeight` | `src/components/list-tabular.jsx:55,114` | Confirmed |
| thread-list 36 / 85 below 540px, draft-list 39 | `thread-list.jsx:188,191,400` (measures `offsetWidth < 540`), `draft-list.jsx:50` | Confirmed. The narrow switch is **width-driven JS**, not a look change (see H1) |
| Regions map onto WorkspaceStore locations | `workspace-store.js:118-146`: `Location` is rebuilt only from `defineSheet` columns and reset on init. No `Overlay`/`Toast`. `Center` (composer, scheduler, worker-ui) and `Preferences` exist but aren't mapped | Partly. See M2 |
| ComponentRegistry `location(s)`/`role(s)`/`mode(s)` | `src/registries/component-registry.js:87-140` | Confirmed. **No `order` option exists** (AD-12, M3) |
| Column geometry | `sheet.jsx:72-78` sums the `containerStyles.minWidth` of the feature components and calls `NylasEnv.setMinimumWidth`. ThreadList 300, MessageList 500, AccountSidebar 165–250 | **Not addressed by the spine** (C1) |
| 137 ui-variables, 21 computed | 137 `@` lines. 22 lines use colour functions, including `desaturate` and `fadeout` | Close. The function set is wider than AD-8 lists (M4) |
| ~15k lines of package LESS | 15,043 | Confirmed |
| Config via `setRawValue`, broadcast `on-config-reloaded` | `config.js:396,812`, `config-persistence-manager.js:166-180` | Confirmed |
| Email frame `doc.write`, styles from `<nylas-styles>` | `email-frame.jsx:69-74`. `email-frame-styles-store.js` scrapes `[source-path*="email-frame.less"]` and observes `<nylas-styles>` | Confirmed. **The spine doesn't replace this store** (H2) |
| ui-dark `invert()` + `hue-rotate` | `ui-dark/styles/email-frame.less:3,7` | Confirmed |
| Print snapshots DOM `innerHTML` | `print/lib/printer.js:20` | Confirmed |
| macOS custom stoplights | `sheet-toolbar.jsx:147` `ToolbarWindowControls`, registered into ComponentRegistry | Present. Not retired by AD-15 (L2) |
| 68 `findDOMNode` calls | about 150 non-test call sites across about 75 files | **Undercounted** (L1) |
| Packager absent, electron-builder planned | `MODERNIZATION.md`. Squirrel.Windows updater code is still live (`main.js:216-240`, `windows-updater.js`, `linux-updater-adapter.js`) | Partly. The old updater isn't mentioned (H9) |
| (not mentioned) Crash reporting | `application.js:511` and `error-logger.js:128` start `crashReporter` with `autoSubmit: true` to `nylas-breakpad-sentry.herokuapp.com` and `electron-crash-report-server.herokuapp.com` | **Missed** (H10) |
| (not mentioned) Config dir per environment | `main.js:17-30`: `.nylas-mail`, `.nylas-dev`, `.nylas-spec`, `.nylas-bench`, plus `--config-dir-path` and `NYLAS_HOME` | **Contradicted** by the hard-coded `~/.nylas-mail/themes/` (M6) |
| (not mentioned) Email CSP | `static/index.html:6`: `script-src 'self' 'unsafe-eval'`, `style-src * 'unsafe-inline'`, `img-src *` | It is the only guard on the frame (H3) |
| (not mentioned) Lint tool | Biome 2.5 only (`biome.json`, CI `pnpm lint`) | AD-9's lint rule has no tool behind it (M5) |

## Findings

### Critical

**C1. Style geometry lives in feature JS, so CSS-only styles can't meet R6, R8 or R21.**
- *Location:* AD-9, AD-15, the Style manifest convention, the Deferred row "single-pane-with-Back", and the R6/R21 rows of the Capability map.
- *Problem:* Column min and max widths are static `containerStyles` on feature components (ThreadList 300, MessageList 500, AccountSidebar 165–250). `sheet.jsx` sums them and clamps the window with `setMinimumWidth`, so the split view can never get narrower than about 965px and the reflow ladder (R21) can never fire. The list/split choice is a JS sheet stack: in list mode, reading is a pushed `Thread` sheet. The Classic narrow list is a JS width probe. AD-9 gives styles a manifest `minWidth` and CSS, and never says who reads `minWidth`, how a style sets region widths, how `layoutMode: split` is enforced (or `mode-switch` hidden), or how single-pane-with-Back is triggered from CSS. That last item is deferred to epic-loft even though epic-token-platform owns `sheet.jsx` and `WorkspaceStore`. Each style epic would invent its own fix: `!important` over inline widths, JS in the style (which is banned), or edits to shared components.
- *Fix:* Add one AD, owned by epic-token-platform, for a "style geometry runtime":
  1. The look runtime reads the active style's manifest. The window minimum width is the manifest `minWidth`, set through the shell adapter, and `sheet.jsx` stops summing `containerStyles`.
  2. Region widths come from scoped style properties `--region-<name>-min-width`, `--region-<name>-max-width` and `--region-<name>-width`. `ResizableRegion` reads them from a probe on each look change, as AD-10 does for rows. `containerStyles` becomes a fallback only.
  3. `layoutMode: split` forces split in WorkspaceStore's memory and never writes `core.workspace.mode`. The mode-switch toolbar item is hidden by the runtime.
  4. Below `minWidth`, the runtime sets `data-reflow="<step>"` on the look root from the window width. Style CSS reacts to it, and WorkspaceStore switches to single-pane-with-Back.

  Decide all of this in the spine and remove the Deferred row.

### High

**H1. AD-10 contradicts the ticket's "natural-height Loft rows" and can't express Classic's narrow-list rows.**
- *Location:* AD-10. Ticket touch point `list-tabular.jsx` / `multiselect-list.jsx` / `thread-list`, and the ListTabular decision. tickets.toml epic-loft R18 ("Loft's natural-height rows per density").
- *Problem:* The ticket and epic-loft promise natural-height rows. AD-10 fixes one uniform `itemHeight` per list, read "once per look change". Classic's narrow-list rows (85px under 540px) depend on width, and crossing 540px is not a look change. `multiselect-list.jsx` isn't mentioned. Loft's overhanging selected card has no stated geometry.
- *Fix:* Define "natural height" in AD-10 as the `calc()`-derived uniform height per list, density and text size. Draw the overhanging selected card outside the row box (transform or overflow), never through `itemHeight`. Re-read the probe on look change *and* on list-container resize (a ResizeObserver on the probe). Style CSS switches `--row-height-thread-list` with a container query at its narrow breakpoint. Name `multiselect-list.jsx` too. Ask the ticket owner to confirm this reading of "natural height".

**H2. The email-frame styling path is undefined, so frames would lose styles and go stale on a look change.**
- *Location:* AD-1, AD-7, AD-18, the look-root convention ("the email-frame document").
- *Problem:* `EmailFrameStylesStore` finds frame CSS by scraping `<nylas-styles>` for `email-frame.less` and re-renders on mutations there. AD-1 takes themes off that element and makes switching attribute-only, and AD-7 ports `email-frame.less` to CSS. Both inputs disappear. The iframe is a separate document: window attributes and `@scope` don't reach into it, and the spine doesn't say who injects theme CSS or mirrors the attributes. epic-token-platform (porting) and epic-email-dark-mode (adaptation) would each build their own version.
- *Fix:* Add a rule to AD-18. `src/appearance/email-adaptation/` owns frame styling: it injects the active theme's compiled CSS plus the ported `email-frame.css`, and mirrors the look-root attributes onto the frame's `<html>` on every look-runtime change. epic-token-platform replaces `EmailFrameStylesStore` with this API, and epic-email-dark-mode builds on it.

**H3. Security of the email iframe isn't decided.**
- *Location:* AD-18, Deferred, Open Questions.
- *Problem:* Raw message HTML is `doc.write`n into a same-origin, unsandboxed `about:blank` frame inside a `nodeIntegration: true`, `contextIsolation: false` renderer. The only guard is the inherited CSP. AD-18 adds code that parses and rewrites untrusted HTML and CSS. Nothing stops that code from:
  - re-serialising through `innerHTML` and skipping the existing transforms;
  - fetching remote `<link>` stylesheets to find dark rules, which would leak opens before images are allowed;
  - loosening the CSP or iframe flags to inject styles;
  - printing the adapted DOM, since today's printer serialises the frame DOM.
- *Fix:* Add a rule to AD-18. Adaptation changes only inline styles and the CSSOM of the already-written frame document. It never fetches anything, never moves content into the parent document, and never changes the CSP or iframe attributes. A cross-origin stylesheet it can't read counts as "declares nothing". Print serialises the model body. Add a script-injection and remote-CSS fixture to the AD-19 harness. Add a Deferred row "frame sandbox / per-frame CSP hardening" with an owner (the modernisation track).

**H4. AD-2 and AD-15 contradict each other on shell-specific CSS.**
- *Location:* AD-2 ("only features that both Chromium and WebKit ship") and AD-15 (styles place the window controls with `env(titlebar-area-*)` and use `app-region: drag`).
- *Problem:* `env(titlebar-area-*)` and `app-region` are Chromium/Electron only. All five style epics are told to do both. AD-15 also misses two things: the macOS traffic-light position has to move at runtime when the style's `titlebarHeight` changes (`setWindowButtonPosition`), and CSS px have to be converted to DIP under `interfaceZoom`.
- *Fix:* The renderer half of the shell adapter publishes `--titlebar-area-x`, `-y`, `-width` and `-height`, and owns a runtime stylesheet that applies `app-region` to `[data-region=titlebar]` and its interactive descendants. Style CSS reads only those custom properties. Extend `set-title-bar-overlay` into a chrome message that carries the height, overlay colours and the macOS button position, multiplied by the zoom factor.

**H5. The sequence diagram writes config on every OS signal, in every window.**
- *Location:* the third diagram (`SC->>LR resolve…`, `LR->>CPM: Config.set core.appearance key`).
- *Problem:* Every window that receives `appearance-signals` writes config. That means N concurrent writes per OS change, derived state persisted, a broadcast storm, and a contradiction with AD-11 and AD-14.
- *Fix:* Split the diagram. OS signals only set look-root attributes, with no config write. Config writes come only from user actions in the window where they happen, then `on-config-reloaded` goes to the other windows.

**H6. The contrast-check scope contradicts the "standard contrast stays reference-exact" Constraint.**
- *Location:* AD-5 ("checks every contrast pair… A built-in that… fails a pair fails the build"). Ticket Constraints 5 and 6. The ticket decision on ported-theme new-component pairs.
- *Problem:* As written, Loft's standard variant fails the build, which pushes authors to quietly fix standard ratios. That is exactly what the Constraint forbids. The Constraint's own requirement, that the Increase contrast label passes AA in every theme and variant, isn't encoded anywhere.
- *Fix:* The build fails if any high-contrast variant fails any pair, or if the Increase contrast label pair fails in any variant. Built-in standard variants are reported, never failed and never re-derived. Third-party standard variants are never re-derived either.

**H7. Deferring the `covers` vocabulary lets the frozen kit and the style API diverge.**
- *Location:* AD-9 (the Classic fallback for uncovered features) and the Deferred row "Style `covers` vocabulary → epic-style-api".
- *Problem:* Classic's CSS must also work as a per-feature fallback inside a community style. That shapes how epic-classic-style writes Classic, and the kit freezes in epic 6. The vocabulary is only decided in epic 11, after the freeze. The spine also gives no mechanism for applying Classic's `@scope` inside a `[data-style=<community>]` root.
- *Fix:* Decide now. The unit is the region (`covers` lists region names, plus any named sub-surfaces). An uncovered region's container gets `data-style-fallback="classic"`, and Classic's scope root selector is `[data-style=classic], [data-style-fallback=classic]`. epic-classic-style writes to that, and epic-style-api only adds the card copy.

**H8. Preview and onboarding need "real components on fixture data", but there is no fixture contract.**
- *Location:* R9 and R12 (ticket). The spine mentions nested look roots only.
- *Problem:* Region components read Flux stores directly. The Appearance preview (epic 3) and the onboarding cards (epic 12) need those same components fed with fixtures, and nothing tells epic-loft or the frozen kit to make them injectable. The result is either a refactor in epic 3 or fake components, which breaks "real components".
- *Fix:* Add an AD. Every component registered into a region reads its data through a provider (React context) that defaults to the live stores. The preview and onboarding roots wrap a fixture provider. epic-token-platform ships the provider, and epic-loft and the kit follow it.

**H9. The packaging deferral blocks every epic's done condition, and theme-specific packaging duties go unowned.**
- *Location:* Deferred row "Packaging and distribution… Not a theme concern → modernisation track". The ticket's tracer path, Done when, and every tickets.toml description ("in an installable pre-release build").
- *Problem:* No epic can close without a signed or installable build on all three OSes, and the owner isn't named or dated. The theme work also adds its own packaging duties: the build-time theme compile step, `static/themes` and the generated CSS in the asar, Fontsource files served over `nylas://` from inside the asar, `less` and `culori` as production dependencies, and the D-Bus client. The live Squirrel.Windows updater path (`main.js:216-240`) will clash with electron-builder. The React 19 render blocker (Open Questions) has the same gap.
- *Fix:* Move both items to Open Questions as **blocking gates** with a named owner and a date: epic-token-platform can't close until a packaged pre-release build renders the main window under React 19 on all three OSes. Add a convention row, "Theme packaging obligations", that lists the build-step and asar items above, and point the modernisation track at the Squirrel code.

**H10. Telemetry and crash reporting are absent, and the brownfield auto-submits crash dumps to dead third-party hosts.**
- *Location:* the whole spine (no AD, Deferred row or Open Question).
- *Problem:* `crashReporter` is started with `autoSubmit: true` to `nylas-breakpad-sentry.herokuapp.com` (`application.js:511`) and to `electron-crash-report-server.herokuapp.com` (`error-logger.js:128`). Anyone can re-register a defunct Heroku app name, and minidumps carry mailbox memory. The theme work adds a new crash surface (main-process parsing of untrusted theme files) and new error payloads (`ThemeLoadError` with user file paths, shim deprecation warnings), with no rule for where they go.
- *Fix:* Add a rule. Theme, style and shim errors stay local (console plus toast) and never go through `NylasEnv.reportError` or a crash sink with file paths or contents. Add a Deferred row "crash reporting and telemetry → modernisation track". Ask the parent session to open a security issue for the two endpoints: they are outside this spine and should be fixed before any public build.

### Medium

**M1. The `"style"` key in package.json collides with npm's common `"style"` field.** (AD-9, Style manifest convention.) Many packages set `"style": "dist/x.css"` as a string. The loader would treat them as style packages and skip their JS. *Fix:* treat a package as a style only when `style` is an object with an `id`, or use a namespaced key (`"nylas": { "style": {…} }`).

**M2. The region mapping is incomplete.** (AD-9, Regions convention.)
- `Overlay` and `Toast` don't exist, `Location` is rebuilt only from sheet columns, and neither has a host container.
- `titlebar` is N per-column `Toolbar` locations, not one bar, which matters for Loft's single top bar.
- `Center` and `Preferences` aren't mapped.
- The precedence between the manifest `hide` and the user's `core.workspace.hiddenLocations` isn't stated.

*Fix:* define the two fixed locations in `_resetInstanceVars` and render their hosts in the sheet container. State which element carries `data-region="titlebar"`. Map `Center` to `reading`. Declare Preferences outside region arrangement (R9's shared layout). Say that the manifest `hide` wins over the user's hidden locations, without writing them.

**M3. AD-12 relies on an `order` option the registry doesn't have.** (AD-12, Regions convention.) It also uses `location` for a string slot, where the registry expects `WorkspaceStore` location objects. *Fix:* register with `role: "Preferences:Appearance:Section"` and name an owner for adding `order` sorting to ComponentRegistry (epic-token-platform).

**M4. The plugin shim covers too few functions and ignores LESS arithmetic.** (AD-8.) Package LESS also uses `fadeout` (49), `desaturate` (11), `tint` (14), `saturate` (6) and `contrast` (1), and has about 336 arithmetic expressions on variables. LESS maths on `var()` fails, so many sheets would drop to literal Classic colours under every theme. *Fix:* map only the colour variables to `var()`, and keep dimension and typography variables as literal Classic numbers. Cover the full colour-function set: `fadein`/`fadeout`/`fade` become `color-mix` with transparent; `tint`/`shade` become a mix with white or black; `saturate`/`desaturate`/`spin` become OKLCH relative colour; `contrast()` falls back to a literal.

**M5. Several lint rules aren't enforceable as written.** (AD-9, AD-2, AD-7.)
- Biome has no rules for "no hex", "no theme id" or "no physical property", and no tool is named.
- Community styles never pass through repo lint.
- AD-2's "for these" can't be linted.
- Ported shared-component CSS (AD-7) isn't covered by the logical-property rule, yet RTL (R19 and the Constraint) depends on it.

*Fix:* name a check (a Biome GritQL plugin or a script in `pnpm lint`) over `internal_packages/style-*/` and all ported package CSS. Run the same check at load for community styles, with a warning or a refusal. Restate AD-2 as "no file under `src/appearance/` except `shell-client.js` imports `electron` or `@electron/remote`".

**M6. The themes folder path ignores the app's environments.** (AD-16.) `~/.nylas-mail/themes/` is hard-coded, but dev, spec and bench runs use `.nylas-dev`, `.nylas-spec` and `.nylas-bench`, and `--config-dir-path` / `NYLAS_HOME` override the folder. *Fix:* use `<configDirPath>/themes/`, create it if it's missing, and have the AD-19 harness run on a temporary config dir.

**M7. The last-valid cache isn't versioned.** (AD-16, Deferred cache layout.) After an auto-update, cached CSS from an older compiler or role contract would be missing new roles. A downgrade would read a newer cache. *Fix:* key each entry by file hash, compiler version and contract version, and treat a mismatch as a miss. Settings rollback is otherwise covered by `core.themes` staying untouched.

**M8. There are no performance budgets.** (Not in the spine.)
- All sheets stay resident in every window.
- An attribute switch triggers a style recalc over about 15k lines of ported CSS.
- A synchronous culori compile in main blocks IPC for every window.
- A pre-launched hot window can paint before its look-root attributes are set.

*Fix:* add budgets: a switch paints in at most one frame plus the transition, a third-party compile stays under N ms, and startup grows by less than N ms. Run the third-party compile in a `utilityProcess` or worker. Set the look-root attributes before first paint from the bootstrap config.

**M9. Theme CSS output from untrusted files isn't constrained.** (AD-5, Theme load error convention.) The compiler writes file values into CSS and uses the theme id in selectors, and there is no `invalid-id` code. *Fix:* emit only re-serialised typed values: colours normalised through culori, dimensions as a number plus an allowlisted unit, font families as escaped, quoted strings. Anything else is a `forbidden-value`. Enforce an id regex `^[a-z0-9]+(-[a-z0-9]+)*$` with an `invalid-id` code, and render `$metadata.name` as text only.

**M10. `$metadata` may fail the official DTCG 2025.10 schema.** (AD-5, AD-6, R23.) DTCG reserves `$`-prefixed names, and vendor data belongs in `$extensions`. Validating against the official schema could reject every theme. *Fix:* in epic-token-platform's first story, validate a sample against the official schema. If it's rejected, move metadata to `$extensions["<reverse-domain>.theme"]` and ask the ticket owner to update R23 and EXPERIENCE.

**M11. Two derivation algorithms could appear.** (AD-5. Ticket Notes, "rule for deriving a whole mode isn't decided". tickets.toml epics 5 and 10.) epic-themes (epic 5) derives whole modes for built-ins, and the compiler's load-time derivation (R26) lands in epic-theme-authoring (epic 10). *Fix:* the derivation code lands in the epic-token-platform compiler. epic-themes runs it to seed values, then hand-checks and commits complete groups. epic-theme-authoring only wires it to load time.

**M12. Legacy LESS themes during epics 1–11 aren't defined.** (AD-7, AD-8. Decision "legacy LESS themes coexist".) Once the ported packages read `var(--role)`, a legacy theme's ui-variables no longer reach them, and the precedence between legacy theme sheets and token CSS isn't stated. Pre-release users would get mixed looks. *Fix:* while `core.themes` names a legacy theme, the runtime shows its mapped token look (or Classic) and the legacy theme sheets load after the token CSS. State which wins.

**M13. There is no fallback for a missing style.** (AD-9, AD-11.) If `core.appearance.style` names a removed or disabled community style, or an id unknown after a downgrade, nothing is defined. Themes have R24's fallback chain; styles don't. *Fix:* fall back to Loft with an error toast, and never rewrite the config.

**M14. The free-form font deferral isn't really single-consumer.** (Deferred row "Choose installed font…".) An installed-font pick has to reach the nested preview roots, the onboarding window and the email frame, and enumerating fonts is OS access, which belongs to the adapter. *Fix:* decide now. The runtime keys `--font-override-family` on `[data-font=custom]` in a runtime sheet and mirrors it into the nested roots and frames (H2). Enumeration goes through the adapter.

**M15. Three binding ADs aren't adopted yet.** AD-8, AD-11 and AD-12 carry no `[ADOPTED]` tag (the memlog says "proposed by architect"), yet they bind epics 1, 3, 4, 10, 11 and 12. *Fix:* adopt or revise them before epic-token-platform's stories are planned.

**M16. The bell-gating Constraint has no architecture.** (Ticket Constraint "bell renders only once the notifications feature's contract exists"; not covered by any AD.) *Fix:* the notifications feature registers the bell into `titlebar` under a role. Loft's CSS only positions that slot, and epic-loft ships no placeholder component.

### Low

- **L1.** Open Questions undercounts `findDOMNode`: there are about 150 non-test call sites across about 75 files, not 68. Correct the number. It changes how big the React 19 work is.
- **L2.** AD-15 doesn't retire `ToolbarWindowControls` (`sheet-toolbar.jsx:147`, the custom macOS stoplights) or the `process.platform` checks in feature code. Name both in AD-15.
- **L3.** `core.appearance.textSize` (0.875–1.5) and `data-text-size` (87.5–150) are two encodings. State the mapping (`× 100`) in the conventions.
- **L4.** The window `<html>` and the nested roots carry both `data-style` and `data-look`. Add a cross-engine fixture proving that `@scope (…) to ([data-look])` never treats the scoping root itself as its own limit.
- **L5.** Font lists drift. The Stack adds Atkinson Hyperlegible Next, but the Constraint names Jost, Ubuntu, Inter and Source Serif. Reconcile with the ticket owner.
- **L6.** Capability map: R11's focus and announcement aren't governed by AD-13, and the module location of `categoryIndex` (R30) is missing from the Structural Seed.
- **L7.** It isn't said where the upgrade mapping runs. Say "main process, once" so multiple windows don't race.
- **L8.** OS text scale: the ticket says "where Electron exposes it", and the memlog says Electron exposes it nowhere. Close the question as "100% everywhere" unless adapter work is wanted.
- **L9.** AD-14 names the Linux source for contrast only. Name the Linux `colorScheme` source too (nativeTheme or the portal `color-scheme`).
- **L10.** It isn't said whether the other windows cross-fade when they apply `on-config-reloaded`.
- **L11.** AD-8 loads `styles.less` but doesn't say whether it compiles through the shim.
- **L12.** Popovers and modals portal to `body`, so they leave the nested preview look root. State that the preview is inert, or portal into the nearest look root.
- **L13.** `fs.watch` caveats: atomic saves arrive as `rename` with temporary names, a deleted or re-created folder drops the watch, and the folder may not exist on first run. Note the handling in AD-16.

## Ticket reconciliation

| Item | Status |
| --- | --- |
| R1–R5, R13, R14, R20, R23–R26, R29, R31 | Covered |
| R6, R8, R21 | Mapped, but not achievable under AD-9 as written (C1) |
| R7, R32 | Covered by AD-19. The harness is blocked by H9 and the React 19 question |
| R9, R12 | The fixture-data preview is missing (H8) |
| R10, R11 | Apply models are covered. Focus and announcement aren't governed (L6) |
| R15, R19 | Lint is not enforceable, and RTL in shared CSS isn't covered (M5) |
| R16 | Open question, answerable from the ticket's wording (L8) |
| R17 | The free-form font pick is deferred incorrectly (M14) |
| R18 | AD-10 conflicts with "natural-height" rows (H1) |
| R22 | Algorithm covered. Frame styling (H2) and security (H3) are missing |
| R27 | `covers` deferred past the freeze (H7). The `"style"` key collides (M1) |
| R28 | Shim gaps (M4), coexistence gap (M12). `styles.less` is correctly an open question |
| R30 | Covered. The override storage deferral is fine |
| Constraint: standard contrast reference-exact | Contradicted by AD-5 (H6) |
| Constraint: theme never changes layout | Enforced only if the compiler emits contract roles only. State that unknown tokens are ignored or rejected (part of M9) |
| Constraint: logical properties and RTL | Partly covered (M5) |
| Constraint: bell gating | Dropped (M16) |
| Constraint: OSS fonts only | Covered by AD-17. List drift (L5) |
| Constraint: CSS-only community styles | Covered by AD-9. Detection hazard (M1) |
| Constraint: 900×600 onboarding | Covered by AD-15 |
| Boundary touch point `multiselect-list.jsx` | Dropped (H1) |
| Boundary touch point `mode-switch` hidden under Loft | Dropped (C1) |
| Boundary touch point `notifications` legacy bars on status roles | Implicit in the role contract. Fine |
| Boundary touch point `modal.jsx`, `fixed-popover.jsx` | Conventions cover radius. Portal escape (L12) |
| Boundary "must not change": `core.workspace.mode` in four styles | Holds only if those four manifests use `layoutMode: user`. Pin that in the convention |
| Tracer path: installable build on three OSes | Unowned (H9) |

## Operational envelope

| Dimension | Spine | Needed |
| --- | --- | --- |
| Packaging | Deferred as "not a theme concern" | A blocking gate plus the theme packaging obligations (H9) |
| Deployment and release channels | Deferred | Same gate. Pre-release vs stable is in the ticket decision only |
| Environments (dev, spec, bench, CI) | Contradicted by the hard-coded path | `<configDirPath>/themes/` and a harness temp dir (M6) |
| Signing and notarisation | Deferred, no owner or date | Owner and date (H9) |
| Auto-update | Deferred. The live Squirrel code isn't mentioned | Owner, plus cache versioning across updates (M7) |
| Telemetry and crash reporting | Absent | A local-only rule for theme errors, a Deferred owner, and the security issue (H10) |
| Performance budgets | Absent | Budgets and an off-main compile (M8) |
| Settings migration and rollback | Partly covered (`core.themes` untouched, marker deferred) | Missing-style fallback (M13), cache versioning (M7), a single migration site (L7) |
| Email iframe security | Absent | Rules in AD-18 and a Deferred hardening row (H3) |
| Third-party theme input safety | Partly covered (error codes) | Typed re-serialisation and an id regex (M9) |

## For the parent session

This review is read-only and doesn't touch the tracker. Suggested new issues, with no status label:
1. **Security:** crash reports auto-submit to defunct `*.herokuapp.com` endpoints (`application.js:511`, `error-logger.js:128`). Outside this spine, and it should be fixed before any public build.
2. **Packaging and React 19 gate** for the theme initiative (H9). It needs a named owner on the modernisation track.
