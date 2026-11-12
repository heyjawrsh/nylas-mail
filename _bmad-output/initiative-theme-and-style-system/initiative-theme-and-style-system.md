---
type: initiative
title: Theme and style system
parent: none
sources:
  - _bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md
  - _bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md
companions:
  - _bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md
  - _bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md
  - _bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md
after: []
risk: high
---

# Theme and style system

## Description

The revived Nylas Mail client (`packages/client-app`) gets its look from a shared token layer instead of stacked LESS themes. When this is done, users mix four independent settings: style (5 built-ins), theme (9 built-ins), density (3 levels) and the accessibility settings (Mode, Increase contrast, Text size, Font override, Adapt email colours). Any theme works with any style. Loft is the first new style and the default look. Theme authors ship single DTCG token files, and style authors ship plugin packages. The UX is final and lives in the two adopted spines, `DESIGN.md` (tokens and visuals) and `EXPERIENCE.md` (behaviour). This ticket lifts their requirements at initiative altitude, and the detail stays in the spines. It matters because this is a public open-source release that people will install, so first-run defaults, the authoring APIs and accessibility all ship to strangers.

## Outcome

For people installing the first public release, the app opens in Loft and lets them pair any theme with any style at any density, with accessibility settings on top. The success signals are the four key flows (experience Key Flows) running in the released app and the Verification Matrix passing (experience Verification Matrix).

## Requirements

- R1 (experience Foundation › Settings axes; design Brand & Style): style, theme, density and the accessibility settings are independent; changing one leaves the others as set, and density persists across style switches.
- R2 (experience Style Contract › Free mix; design Brand & Style): any built-in or third-party theme renders in any built-in style at any density with nothing tuned per pairing.
- R3 (experience Style Contract; design Brand & Style › The style contract): a style places or explicitly hides each fixed region (titlebar, nav, list, reading, rail, overlay, toast) with the shared feature components, and sets only radius, spacing, row heights per density and component variants, reading role tokens only.
- R4 (design Colors › Role tokens, Categorical palette; Typography; Elevation & Depth): every theme defines every contract role (colour incl. the 8-colour categorical palette, typography with line height, the three shadow roles) in each variant it ships.
- R5 (design Colors › Theme catalogue, Variants): nine bundled built-in themes (Classic, Aubergine, Taiga, Darkside, Less-is-more, Loft, Volt, Ember, Dusk) each ship light and dark at standard and high contrast, never fail to load and never show derived.
- R6 (design Components › Style catalogue; Layout & Spacing › Window chrome and minimum width, Density): five built-in styles (Classic, Loft, Taiga, Darkside, Less-is-more) each ship with their own minimum width, row height per density, title bar and layout-mode rule (Loft always split pane).
- R7 (experience Style Contract › Built-in coverage; Information Architecture › Surfaces every style must lay out): every surface this initiative ships is laid out by all five built-in styles before it is released.
- R8 (design Components › Loft mail surfaces; Layout & Spacing › Loft style layout; experience Component Patterns › Loft mail surfaces): the Loft style and Loft theme deliver the Loft mail view (top bar with app mark, search pill and overlay, bell placement, gear, account chip; sidebar; message list with the overhanging selected card; reading card with right rail; compose card) with the behaviour EXPERIENCE gives each.
- R9 (experience Information Architecture › Where each setting lives; Component Patterns › Appearance page, Shared components): Preferences › Appearance sets style, theme, mode, Increase contrast, density, text size, font and Adapt email colours with a preview of real components on fixture data in the pending look; the Preferences sheet keeps one shared layout in every style; the theme-picker modal is gone.
- R10 (experience Interaction Primitives › Two apply models; State Patterns › Appearance): style, theme, density and font change only the preview until Apply; Revert or Esc discards (Undo for 5s) and leaving discards silently; Mode, Increase contrast, text size and Adapt email colours apply at once.
- R11 (experience State Patterns › Appearance; Accessibility Floor › Focus, Screen readers): Apply cross-fades after the new look paints, keeps focus where it was, and announces the whole new look.
- R12 (experience Information Architecture › Onboarding looks step; Key Flows › Flow 1, Flow 3): first launch after account setup offers the Loft, Classic and Darkside looks plus text size and Increase contrast, once per install; Continue applies the pick, Skip lands on Loft.
- R13 (experience Information Architecture › Where each setting lives; Responsive & Platform › OS appearance): Mode Auto follows the OS light/dark setting live on macOS, Windows and Linux; Light and Dark pin it.
- R14 (experience Accessibility Floor › Increase contrast; design Colors › Contrast pairs): Increase contrast (Follow system, On, Off; tracking prefers-contrast live) swaps every theme to its high-contrast variant, and every high-contrast variant passes every pair in Contrast pairs.
- R15 (design Colors › Forced colours and Increase contrast borders; experience Accessibility Floor › Forced colours): forced colours are honoured, and Increase contrast adds border-strong edges wherever separation is by shadow or tint only.
- R16 (experience Accessibility Floor › Text size; design Typography): text size (87.5-150% in 12.5% steps) scales all type and reflows layout, stacks under window zoom, and starts at 100% on every OS.
- R17 (design Typography; experience State Patterns › OS signals): font override replaces the theme typeface app-wide; a missing font falls back to the theme default with a toast.
- R18 (design Layout & Spacing › Density; experience Accessibility Floor › Pointer targets): density (Compact, Comfortable, Spacious) scales each style's spacing roles and applies that style's row height for the level; every message row keeps a 24px pointer target.
- R19 (experience Style Contract › Obligations every style meets; Accessibility Floor): every style meets the shared obligations: two-tone focus ring at 3:1 never clipped, RTL via logical properties, instant motion under reduced motion, never colour alone, dir=auto on mixed scripts, and the listed screen-reader semantics.
- R20 (experience Responsive & Platform › Window chrome; design Layout & Spacing › Window chrome and minimum width): the window is frameless on macOS, Windows and Linux; each style draws its title bar with OS controls placed per OS, and the top bar is the drag region.
- R21 (experience Responsive & Platform › Reflow ladder): below a style's minimum width its regions collapse along the reflow ladder, holding at 150% text plus zoom.
- R22 (experience Email Body Rendering; Component Patterns › View original toggle): in dark mode email bodies are adapted so text meets the active contrast floor with images untouched; View original is per message, remembered per sender per account; replies, forwards and print use original colours; an app-wide switch turns adaptation off.
- R23 (experience Theme Authoring › Format, Validation, Identity): a third-party theme is one DTCG .tokens.json file identified by $metadata.id; a file breaking the validation rules or reusing a built-in id or name is rejected with an error naming file and line, and is never copied.
- R24 (experience Theme Authoring › Location, Live reload, Last valid cache): saving a file in the themes folder reloads that theme in the app and the preview after 300ms; a theme that fails to load falls back to its last valid version, then Loft, with an error toast.
- R25 (experience Theme Authoring › Install, export, remove; Component Patterns › Install theme…): users install a theme from a file (it becomes the pending theme; clashes ask Replace or Keep both), export a copy of a built-in, and remove a third-party theme.
- R26 (experience Theme Authoring › Partial themes; State Patterns › Theme files): a third-party theme's missing variants are derived in OKLCH, missing roles filled from Classic and failing high-contrast pairs re-derived, and its swatch shows derived.
- R27 (experience Style Contract › Community styles; Theme Authoring › Styles): a public style API lets plugin packages add styles; a feature a community style doesn't cover renders in Classic's arrangement and its card names what it doesn't cover.
- R28 (experience State Patterns › Upgrade): upgrading maps each legacy built-in theme to its style and theme, lands community LESS-theme users on Classic with a toast naming the theme, shows the New: Appearance toast, and leaves core.themes untouched; a third-party package's `.less` stylesheet is not loaded and is logged as deprecated, and the legacy-variable → role map is published for authors.
- R29 (experience Theme Authoring › Docs): a user-facing theme author guide exists and Appearance links to it.
- R30 (design Colors › Categorical palette): folder, calendar and avatar colours come from the categorical palette by a hash of id or email, and a user override is stored as a palette index so it resolves in every theme and variant.
- R31 (experience Component Patterns › Toast): toasts stack at most three, de-duplicated by key; info toasts auto-dismiss after 5s as status; error toasts persist as alerts and carry the word Error.
- R32 (experience Verification Matrix; design Layout & Spacing › Loft style layout › Reference scale): all 540 combinations get screenshots and overflow checks, contrast pairs are checked directly, axe runs on high-contrast variants, each style passes a by-eye check in the real Electron app at its native theme and density, and Loft passes the scale-normalised diff against imports/loft-01.webp.

## Constraints

- Public open-source release people install: first-run defaults matter, the theme and style APIs face users, accessibility is not optional (experience Foundation › Stakes).
- Ownership: the theme owns colour, typography incl. line height and shadow; the style owns layout, regions, radius, spacing, row heights, title bar and minimum width; a style never names a theme or a hex, a theme never changes layout, corners or spacing (design Brand & Style; Do's and Don'ts).
- Styles cannot replace components: each feature is written once and registers into regions, not styles (experience Style Contract › Shared components, Regions).
- Five-style coverage is a release blocker (experience Style Contract › Built-in coverage).
- Standard contrast stays reference-exact (Loft mockup-exact) even where AA fails, an accepted risk kept safe by onboarding offering Increase contrast and the Increase contrast label passing AA in every theme; never quietly fix standard ratios (design Colors › Contrast pairs; experience Foundation › Accepted risks).
- Theme files are W3C DTCG JSON, one file per theme with four variant groups light, dark, light-hc, dark-hc, holding only colour, dimension, font-family, shadow and font-weight values (experience Theme Authoring › Format, Validation).
- Third-party themes come only through token files; community LESS themes stop loading (experience Foundation › Third party).
- New settings use new keys; the legacy core.themes key is left untouched so a downgrade still works (experience State Patterns › Upgrade).
- The open-source build bundles only redistributable faces (Jost, Ubuntu, Inter, Source Serif); Nylas-Pro renders only when the private nylas-private-fonts package is present (design Typography; Colors › Theme catalogue).
- All style layout uses logical properties and every style supports RTL (design Layout & Spacing › Loft style layout; Do's and Don'ts).
- Each style owns a frameless title bar on all three OSes, an accepted risk reaffirmed (experience Foundation › Accepted risks).
- Loft is the only name for that style and theme; Loft's top bar shows the app's own mark (design Brand & Style).
- The spines win over mockups and imports; DESIGN owns tokens and visuals, EXPERIENCE owns behaviour (design structure note; experience preamble).
- Loft's CSS token values are canonical; imports/loft-01.webp is checked for composition, proportion and colour at its own scale, not as a pixel target (design Layout & Spacing › Loft style layout › Reference scale).
- Images in email bodies are never altered in dark mode (design Do's and Don'ts; experience Email Body Rendering).
- Microcopy follows the tone rules and strings table (experience Voice and Tone).
- The bell renders only once the notifications feature's contract exists, so Loft never shows a dead button (user decision 2026-11-11).
- Community style packages are CSS only: a style arranges shared components through CSS, and any JavaScript in a style package is not run (user decision 2026-11-11).
- The onboarding looks step fits the existing 900×600 onboarding window, not the mock's 1504×956 (user decision 2026-11-11).
- No LESS ships in the app (user decision 2026-11-12).

## Done when

- A stable public release installs on macOS, Windows and Linux with the 5 built-in styles and 9 built-in themes. New users land in Loft, and upgraders land in their mapped look.
- The automated sweep of all 540 combinations passes its screenshot and overflow checks. Every high-contrast variant passes every contrast pair, and axe passes on the high-contrast variants.
- Each built-in style passes the by-eye check in the real Electron app at its native theme and density, and Loft passes its diff against `imports/loft-01.webp`.
- All five built-in styles lay out every surface the release ships.
- In the released app, a theme author can export, live-edit and install a single `.tokens.json` theme by following the published guide, and a plugin package can add a community style.
- The four key flows (Ines, Dev, Ruth and Marco) run end to end in the released app.

## Boundaries

- Out:
  - The Calendar and Contacts features themselves. This initiative ships the regions they register into and Loft's visual spec for them, and each style lays them out when they ship.
  - The notifications feature that the bell opens. Loft places the bell, and it renders only once that feature's contract exists.
  - Feature content dropped to the feature epics in `reconcile-loft-DESIGN.md`:
    - contact fields and new-event modal fields;
    - provider presets and forms, and the OAuth note;
    - account kind and status words;
    - the folder set and icons;
    - relative timestamp formats;
    - the attachment thumbnail source.
  - Empty, loading and error states of the mail surfaces.
  - Theme distribution.
  - Loft's in-window Settings view.
  - The app's own name.
  - Support for community LESS themes.
- Touch point: `src/theme-manager.js`, `src/theme-package.js`, `src/package.js` stylesheet loading, `src/less-compile-cache.js` — the theme and style runtime; no legacy LESS theme loads, `src/less-compile-cache.js` goes, and a package's `.less` stylesheet is skipped with a deprecation log; owner: epic-token-platform
- Touch point: `static/variables/ui-variables.less` and about 15k lines of package LESS — ported to CSS on role tokens, and `ui-variables` is no longer injected; owner: epic-token-platform
- Touch point: `package.json` dependencies `less` and `less-cache` — removed, so no LESS compiler ships; owner: epic-token-platform
- Touch point: `src/flux/stores/workspace-store.js`, `src/sheet.jsx`, `src/sheet-toolbar.jsx`, ComponentRegistry locations — the regions are expressed through them; owner: epic-style-contract
- Touch point: `src/browser/window-launcher.js`, `src/browser/window-manager.js` — the main window becomes frameless on Windows and Linux too; owner: epic-style-contract
- Touch point: `src/components/list-tabular.jsx`, `src/components/multiselect-list.jsx`, `internal_packages/thread-list` — row height from style, density and text size, and natural-height Loft rows; owner: epic-style-contract (Classic's narrow-list heights come from the Classic style spec in epic-classic-style)
- Touch point: `internal_packages/ui-light`, `internal_packages/ui-dark` — become the Classic theme; owner: epic-token-platform
- Touch point: `internal_packages/ui-ubuntu`, `ui-taiga`, `ui-darkside`, `ui-less-is-more` — their colours become themes (owner: epic-themes), and their layout LESS goes into the matching style (owners: epic-taiga-style, epic-darkside-style, epic-less-is-more-style)
- Touch point: `internal_packages/nylas-private-fonts` — removed from the public build and made an optional private package; owner: epic-themes
- Touch point: `src/package.js` package loading and `src/package-manager.js` — style packages register a style through CSS only, and their JavaScript is not run; owner: epic-style-api
- Touch point: `internal_packages/notifications` — the legacy bars read the `status-warning` and `status-info` roles; owner: epic-token-platform
- Touch point: `internal_packages/thread-search`, `account-sidebar`, `participant-profile`, `composer` — the search overlay, account chip, right rail and compose card; owner: epic-loft
- Touch point: `src/components/toast.jsx`, `src/components/undo-toast.jsx`, the `undo-redo` toasts — use the shared toast; owner: epic-loft
- Touch point: `internal_packages/preferences` (the Appearance tab), `internal_packages/theme-picker` (retired) — owner: epic-appearance
- Touch point: `static/email-frame.less`, the message-list email frame, `internal_packages/print` — email adaptation and original-colour printing; owner: epic-email-dark-mode
- Touch point: `internal_packages/onboarding` (`page-initial-preferences`) — the looks step; owner: epic-onboarding-upgrade
- Touch point: `src/config-schema.js` — new appearance setting keys beside the untouched `core.themes`; owner: epic-token-platform
- Touch point: `src/components/modal.jsx`, `src/components/fixed-popover.jsx` — the shared modal and popover on theme surfaces and style radius; owner: epic-loft
- Touch point: `internal_packages/mode-switch` — the single/split pane control, hidden under Loft; owner: epic-loft
- Touch point: `package.json` (root and client-app), `scripts/build-renderer.js`, the `build/` Grunt tasks — Electron 45, React 19 and electron-builder unsigned builds; owner: epic-platform-baseline
- Touch point: `src/browser/main.js` and the Squirrel updater adapters — disabled; `src/browser/application.js` and `src/error-logger.js` crash reporter — no upload; owner: epic-platform-baseline
- Must not change: window zoom (⌘+/⌘−, `core.workspace.interfaceZoom`) stays separate from text size and stacks on top of it.
- Must not change: the `core.workspace.mode` single and split pane preference keeps working in Classic, Taiga, Darkside and Less-is-more.
- Must not change: the legacy `core.themes` key.
- Tracer path: a Loft role token compiles from its DTCG file to a runtime custom property (epic-token-platform), and the Loft style's message row reads it (epic-loft). Picking Loft in Preferences › Appearance then previews it, and Apply repaints the real Electron window of an installed pre-release build on macOS, Windows and Linux (epic-appearance).

## References

- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md` (adopted companion: tokens, theme catalogue, contrast pairs, Loft layout, components)
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md` (adopted companion: IA, style contract, states, theme authoring, verification matrix, key flows)
- architecture — `_bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md` (adopted companion: AD-1–AD-35)
- design — DESIGN.md, Colors › Contrast pairs (the AA thresholds and pair table every high-contrast variant passes)
- design — DESIGN.md, Colors › Built-in theme role table and LESS variable → role mapping (the ported themes' values)
- design — DESIGN.md, Layout & Spacing › Density (row heights per style)
- experience — EXPERIENCE.md, Style Contract (regions, coverage, community styles)
- experience — EXPERIENCE.md, Theme Authoring (format, validation, lifecycle)
- experience — EXPERIENCE.md, Open Questions (architecture-owned items)
- reconcile — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/reconcile-loft-DESIGN.md` (Loft spec items dropped to feature epics)
- tracking — https://github.com/heyjawrsh/nylas-mail/issues/2

## Notes

- Decision: 2026-11-12 — the architecture open questions are answered by the adopted spine: style contract AD-9, AD-20, AD-21; LESS migration AD-7, AD-35; email adaptation AD-18, AD-27 (thresholds in epic-email-dark-mode's spike); theme-folder watcher AD-16; cross-fade AD-13, AD-26; frameless title bar AD-15; mode × contrast AD-6; Linux high contrast AD-14.
- Open question: how does a bulk selection of threads look in Loft? (design Open Questions 1). Owner: epic-loft.
- Open question: what are the visual specs for the derived badge and the View original toggle? (design Open Questions 2). Owner: epic-loft.
- Open question: what do the short style specs for Classic, Taiga, Darkside and Less-is-more say about spacing, row and selection treatment, rail placement, and Classic's narrow-list row heights? (design Open Questions 3). Owner: epic-classic-style, all four at its start as one bmad-ux Update of the spines.
- Open question: what are the type ramps for every theme except Loft? (design Open Questions 4). Owner: epic-themes.
- Open question: build task — design, rather than derive, the light modes of Volt, Ember and Dusk and the dark modes of Darkside and Less-is-more (design Open Questions 5). Owner: epic-themes.
- Open question: build task — derive and hand-check the Aubergine and Taiga dark modes. The rule for deriving a whole mode isn't decided yet (design Open Questions 5). Owner: epic-themes.
- Open question: build task — derive every high-contrast variant of Classic, Aubergine, Taiga, Darkside and Less-is-more, and hand-check each against Contrast pairs (design Open Questions 5). Owner: epic-themes.
- Open question: build task — hand-check the derived Loft light high contrast (owner: epic-loft) and all four variants of Volt, Ember and Dusk (owner: epic-themes) (design Open Questions 5).
- Open question: build task — hand-check every other derived value: categorical colours 5–8, every derived variant, and every value in Derived values pending hand-check (design Open Questions 5). Owner: epic-themes, with Loft's share in epic-loft.
- Open question: three strings are still to draft: the inline error for a clash with a built-in id or name, and the community-LESS-theme and deleted-theme toasts (experience Voice and Tone). Owner: epic-theme-authoring and epic-onboarding-upgrade.
- Decision: 2026-11-11 — scope: Calendar, Contacts and the notifications feature behind Loft's bell are out of this initiative. It ships the regions they register into and Loft's visual spec for them, and the bell renders only once the notifications feature's contract exists, so there's never a dead button.
- Decision: 2026-11-11 — community style packages are CSS only. A style arranges shared components through CSS, and any JavaScript in a style package is not run.
- Decision: 2026-11-11 — all four short style specs (Classic, Taiga, Darkside, Less-is-more) are written at the start of epic-classic-style, and the shared component kit freezes at the end of that epic. Taiga, Darkside and Less-is-more build on the frozen kit. The specs are one bmad-ux Update run at epic-classic-style's start; design Open Questions 3 now says so.
- Decision: 2026-11-11 — release: each epic delivers to installable pre-release builds. The stable public release follows epic-onboarding-upgrade, gated by five-style coverage (R7) and the full matrix (R32).
- Decision: 2026-11-11 — the 12-epic split is approved in this build order: epic-token-platform, epic-loft, epic-appearance, epic-email-dark-mode, epic-themes, epic-classic-style, epic-taiga-style, epic-darkside-style, epic-less-is-more-style, epic-theme-authoring, epic-style-api, epic-onboarding-upgrade. The rule that cut it: one source capability, or a tightly coupled pair, per epic, delivered together, with at most a contract between two epics. The breakdown is `tickets/tickets.toml`.
- Decision: 2026-11-11 — epic-token-platform stays one epic; a split is offered when its stories are planned.
- Decision: 2026-11-11 — legacy LESS themes coexist on the old loading path until epic-onboarding-upgrade. Superseded 2026-11-12: LESS is fully removed, and no legacy LESS theme loads.
- Decision: 2026-11-11 — the Loft theme lives in epic-loft, not epic-themes.
- Decision: 2026-11-11 — email dark mode is the 4th epic, and its adaptation spike may start once epic-token-platform is done.
- Decision: 2026-11-11 — ported-theme new-component pairs (badge, error-toast bar, bell dot) keep the legacy colours at standard contrast, and Increase contrast lifts them to AA (UX decision; DESIGN Open Questions renumbered, so build tasks are 5).
- Decision: 2026-11-11 — Nylas-Pro: epic-themes removes the proprietary `nylas-private-fonts` package from the public build and makes it an optional private package. The licensing question for the public repo is https://github.com/heyjawrsh/nylas-mail/issues/5.
- Decision: 2026-11-11 — Classic narrow-list rows: the Classic style spec, written at epic-classic-style's start, adds row heights for the narrow-list case (today `thread-list.jsx` switches to 85px multi-line rows under 540px).
- Decision: 2026-11-11 — ListTabular fixed `itemHeight`: the spec stands. epic-token-platform changes the list so it supports row height from style, density and text size, and natural-height Loft rows.
- Decision: 2026-11-11 — plugin shim scope: the spec is corrected, and the shim covers every package stylesheet, because package stylesheets get `ui-variables` injected and don't import it (R28 re-worded). EXPERIENCE State Patterns › Upgrade now says the same. Superseded 2026-11-12: the shim is retired with LESS.
- Decision: 2026-11-11 — onboarding window: the looks step fits the existing 900×600 onboarding window, and epic-onboarding-upgrade re-checks the `key-onboarding.html` mock at that size.
- Decision: 2026-11-11 — frameless window: the spec stands. epic-token-platform makes the main window frameless on Windows and Linux (today `window-launcher.js` gives them a native frame).
- Decision: 2026-11-11 — epic-onboarding-upgrade waits on epic-theme-authoring and epic-style-api as whole-epic gates: it retires the theme and package loading both touch, and its final check covers their surfaces.
- Decision: 2026-11-11 — epic-style-api waits on epic-theme-authoring, because both edit the Appearance tab.
- Decision: 2026-11-11 — epic-classic-style waits on epic-email-dark-mode as a whole-epic gate, so the View original toggle joins the shared kit before the freeze.
- Decision: 2026-11-11 — epic-appearance's density check switches between Classic and Loft: epic-token-platform ports the Classic style and epic-loft ships Loft, so two styles exist when epic-appearance runs.
- Decision: 2026-11-12 — `styles.less` is dropped. The app hasn't loaded a user stylesheet since Nylas removed it, so there's nothing to keep, and there's no `user` cascade layer.
- Decision: 2026-11-12 — LESS is fully removed, and no LESS compiler ships. Internal LESS is ported to CSS, the plugin LESS shim is retired, and `less` and `less-cache` are removed. A third-party package's `.less` stylesheet isn't loaded; the loader logs a deprecation naming the package once per launch. The legacy-variable → role map is published in the theme and plugin author guide. Built-in legacy LESS themes no longer coexist: an upgrader on a built-in theme that isn't ported yet lands on Classic until epic-themes ships its port. This supersedes the 2026-11-11 coexistence and plugin shim scope decisions.
- Decision: 2026-11-12 — text size starts at 100% on every OS, because Electron has no OS text-scale API.
- Decision: 2026-11-12 — the architecture spine (`architecture-theme-and-style-system.md`, AD-1–AD-35) is adopted as a companion.
- Decision: 2026-11-12 — epic-token-platform opens with the platform baseline: unsigned electron-builder pre-release builds for macOS, Windows and Linux, the React 19 render fix (https://github.com/heyjawrsh/nylas-mail/issues/7), the legacy Squirrel updater disabled or replaced, and LESS removed.
- Decision: 2026-11-12 — epic-token-platform is split three ways, because as one epic it would have run to about 33 stories. epic-platform-baseline (13) comes first: Electron 45, React 19, unsigned builds, no updater, no crash upload, and the real-app harness. epic-token-platform (1) keeps the token runtime, Classic theme, OS signals, text size, categorical colours and the LESS port and removal. epic-style-contract (14) takes regions, the style manifest and the Classic style package, row heights and density, style geometry, the frameless window, the preview data provider, style lint and the sweep. This supersedes the 2026-11-11 one-epic decision. epic-loft and epic-appearance now also wait on epic-style-contract.
- Decision: 2026-11-12 — crash dumps auto-submitting to dead endpoints (https://github.com/heyjawrsh/nylas-mail/issues/8) is folded into epic-platform-baseline, because pre-release builds install on other people's machines. A real crash reporter stays out.
- Decision: 2026-11-12 — look roots take `dir` from the window's document. The sweep forces `rtl` once per style at its native theme across every window type, not across all 540 combinations. Owner: epic-style-contract.
- Decision: 2026-11-12 — the 87 old-format `*-spec.*` files that Vitest never runs are out of this initiative and are tracked as a backlog issue.
- Decision: 2026-11-12 — the WebKitGTK check of `@scope` and `contrast-color()` (architecture AD-2) belongs to the platform-move research (https://github.com/heyjawrsh/nylas-mail/issues/6).
- Decision: 2026-11-12 — the architecture spine was updated for the split, with AD ids kept: owners re-pointed in AD-4, AD-9, AD-10, AD-15, AD-19, AD-21, AD-22, AD-32 and AD-34, and AD-27 (minimal email binding), AD-29 (font sizes map to pre-scaled type roles) and AD-6 (Classic ships all four variants) amended. This resolves the earlier source conflict over owners.
- Decision: 2026-11-12 — Classic's high-contrast variants move from epic-themes to epic-token-platform, so the build gate stays strict and Increase contrast works in the first pre-release. The Classic share of design Open Questions 5's high-contrast build task is now epic-token-platform's.
- Decision: 2026-11-12 — epic-token-platform ships a minimal email-frame binding (`color-scheme` plus role values) so bodies stay legible once LESS is gone, and epic-email-dark-mode extends it.
