---
type: epic
title: "Every look comes from role tokens at runtime"
parent: initiative-theme-and-style-system
covers: [R1, R4, R5, R13, R14, R15, R16, R19, R28, R30]
sources: [_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md, _bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md]
companions: [_bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md]
after: []
refined: true
risk: high
---

# Every look comes from role tokens at runtime

## Description

The app stops taking its look from stacked LESS themes and takes it from role tokens instead.

**Themes.** One in-house compiler turns DTCG theme files into CSS on look roots. Classic, ported from `ui-light` and `ui-dark`, is the first token theme in all four variants: light, dark and their high-contrast versions. Email bodies get the active look through a minimal frame binding instead of scraped LESS.

**Settings and the OS.** The new settings sit under `core.appearance`, independent of each other and of the untouched `core.themes`. The look is computed in every window from those settings and from the OS signals, and Mode Auto, Increase contrast, forced colours and reduced motion follow the OS live through one shell adapter.

**Text size and colours.** Text size scales all type. Folder, calendar and avatar colours come from the categorical palette.

**LESS.** The internal LESS (56 files in `static/` and the package LESS, except the layout LESS in `ui-taiga`, `ui-darkside` and `ui-less-is-more`) is ported to CSS on role tokens. `less` and `less-cache` are then removed, so no LESS compiler ships.

The region, row-height and title-bar contracts are in epic-style-contract. The builds, React 19 and the harness are in epic-platform-baseline.

## Outcome

Anyone building the later epics gets one token runtime to build on, and the app runs on it in Classic, with no LESS left, in an installable pre-release build.

## Requirements

- R1 (parent R1): style, theme, density and the accessibility settings are stored under independent `core.appearance` keys. Changing one leaves the others as set, and `core.themes` is untouched.
- R2 (parent R4): Classic light and dark each define every contract role, including the 8-colour categorical palette, typography with line height, and the three shadow roles.
- R3 (parent R5): Classic light, dark, light-hc and dark-hc, ported from `ui-light` and `ui-dark`, compile at build time and never fail to load or show as derived. A build with no `core.appearance` renders Classic (architecture AD-30).
- R4 (parent R13): Mode Auto follows the OS light/dark setting live on macOS, Windows and Linux. Light and Dark pin it.
- R5 (parent R14): Increase contrast (Follow system, On, Off) tracks the OS contrast signal live and selects the theme's high-contrast variant. Linux reads the XDG portal `contrast` key (architecture AD-14). Classic's high-contrast variants pass every pair in Contrast pairs.
- R6 (parent R15): forced colours are honoured and take precedence over high-contrast variants. Increase contrast adds `border-strong` edges wherever separation comes from shadow or tint alone.
- R7 (parent R16): text size (87.5–150% in 12.5% steps) scales all type and reflows layout. It starts at 100% on every OS and stacks under window zoom.
- R8 (parent R19): under reduced motion, every motion is instant. Ported CSS uses logical properties only.
- R9 (parent R28): no LESS ships. A third-party package's `.less` stylesheet is not loaded and is logged as deprecated once per package per launch. The legacy-variable → role map exists as `src/appearance/legacy-map.json` for the author guide (architecture AD-29). `core.themes` is never written.
- R10 (parent R30): folder, calendar and avatar colours come from the categorical palette by a hash of id or email. A user override is stored as a palette index, so it resolves in every theme and variant.
- R11 (architecture AD-27): email bodies render with the active look's `color-scheme` and role values through an explicit frame binding, never by scraping app stylesheets, so plain and unstyled bodies stay legible in light and dark.

## Constraints

- Looks are attribute-keyed CSS on `[data-look]` roots, and switching a look changes attributes only (architecture AD-1).
- Only the shell adapter imports `electron`. Theme CSS uses only what Chromium 156 and WebKit both ship (architecture AD-2).
- Theme files have one shape (architecture AD-6): one `.tokens.json` per theme with four variant groups and metadata in `$extensions["org.nylas.theme"]`.
- One pure compiler handles both built-in and third-party themes (architecture AD-5, AD-31). It validates against the DTCG 2025.10 schema, serialises from typed values, and its build gate fails any built-in that needs derivation.
- One layer order, declared first in the kernel sheet: `reset, kernel, theme, font, baseline, style, plugin`. There is no `user` layer (architecture AD-20, AD-22).
- The look is computed, never stored. Windows open with it already resolved, then follow revisioned events through one commit queue per window (architecture AD-23, AD-25, AD-26, AD-28).
- Standard-contrast values stay reference-exact even where AA fails (initiative Constraints).
- Must not change: `core.workspace.interfaceZoom` stays separate from text size and stacks on top. `core.workspace.mode` keeps working.

## Done when

- Changing a role in Classic's theme file and rebuilding repaints the running app through runtime custom properties, and Classic light and dark pass the compiler's build gate (R2, R3).
- No `.less` file loads, `less` and `less-cache` are gone from the manifests and lockfile, and a third-party `.less` file is skipped and logged (R8, R9). The only `.less` files left are the unloaded layout LESS in the three legacy theme packages, which the style epics port and delete.
- Each setting is stored under its own key. Mode Auto, Increase contrast, forced colours and reduced motion follow the OS live on macOS, Windows and Linux (R1, R4, R5, R6).
- Classic's high-contrast variants pass every contrast pair, and email bodies stay legible in Classic light and dark (R5, R11).
- Every text-size step scales type and stacks under window zoom, and categorical colours resolve in light and dark (R7, R10).
- The epic-platform-baseline harness checks all of this in the real app, and it ships in an installable pre-release build.

## Boundaries

- Out: regions, the style manifest, row heights, density, style geometry, the frameless window, the preview data provider, style lint and the combination sweep (epic-style-contract).
- Out: builds, the React 19 fix, the updater, crash upload and the harness itself (epic-platform-baseline).
- Out: themes other than Classic (epic-themes); the Loft theme and the bundled-font pipeline (epic-loft).
- Out: adapting sender colours, View original and the email frame sandbox (epic-email-dark-mode). This epic ships only the minimal binding.
- Out: Preferences › Appearance (epic-appearance); the upgrade mapping (epic-onboarding-upgrade).
- Out: the layout LESS in `ui-taiga`, `ui-darkside` and `ui-less-is-more`. It stops loading here, and each style epic ports it.
- No legacy LESS theme loads, built-in or community.
- Must not change: the legacy `core.themes` key.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R1, R4, R5, R13, R14, R15, R16, R19, R28, R30), Boundaries (touch points owned by epic-token-platform)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Colors › Role tokens, Categorical palette, Variants, Forced colours and Increase contrast borders, Built-in theme role table, LESS variable → role mapping; Typography; Elevation & Depth
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Foundation; State Patterns › OS signals; Accessibility Floor; Responsive & Platform › OS appearance; Theme Authoring › Format
- architecture — `_bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md`, AD-1, AD-2, AD-5, AD-6, AD-7, AD-11, AD-14, AD-20, AD-22 to AD-26, AD-28 to AD-31, AD-35

## Notes

- Decision: 2026-11-12. Split into epic-platform-baseline (13), this epic (1) and epic-style-contract (14). This epic keeps its id, slug and title. R2, R3, R18, R20 and R32 move to epic-style-contract, and R19 is shared with it.
- Decision: 2026-11-12. The tracer bullet is story 1: one Classic role travels from its theme file through the build-time compiler to a surface in the running app.
- Decision: 2026-11-12. The legacy map and port codemod (story 3) follow the compiler story (2), because the map's test needs the roles the compiler emits. The codemod is the least certain part, and every port story depends on it.
- Decision: 2026-11-12. The package loader keeps its folder and option paths but loads only `.css`. ThemeManager, theme-package and the theme-picker stop writing `core.themes` in story 7, and the theme-picker modal is hidden until epic-appearance retires it.
- Decision: 2026-11-12. The layout LESS in `ui-taiga`, `ui-darkside` and `ui-less-is-more` stays in the repo, unloaded, until each style epic ports and deletes it.
- Risk: every window's look changes source at once. Beyond each story's check, a person compares the ported app against the pre-port build before story 7 removes LESS.
- Decision: 2026-11-12 (user). Classic's high-contrast variants move here from epic-themes (story 12), so the build gate stays strict and Increase contrast works in the first pre-release.
- Decision: 2026-11-12 (user). A minimal email-frame binding ships here (story 13), so email bodies stay legible after LESS goes. epic-email-dark-mode extends it with adaptation and the sandbox.
- Open question: which Linux D-Bus client to use, `@particle/dbus-next` 0.11.4 or shelling out to `gdbus` (architecture Deferred). Owner: story 9.
- Open question: which position-tracking JSON parser reports compiler error lines, for example `jsonc-parser` (architecture Deferred). Owner: story 2.
- Open question: the storage key for category colour overrides (architecture Deferred). Owner: story 10.
