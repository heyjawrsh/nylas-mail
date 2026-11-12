---
type: epic
title: "Every look comes from role tokens at runtime"
parent: initiative-theme-and-style-system
covers: [R1, R2, R3, R4, R5, R13, R14, R15, R16, R18, R19, R20, R28, R30, R32]
sources: []
companions: []
after: []
refined: false
risk: high
---

# Every look comes from role tokens at runtime

## Description

The app's look stops coming from stacked LESS themes and starts coming from role tokens. The epic opens with the platform baseline: unsigned electron-builder pre-release builds for macOS, Windows and Linux, the React 19 render fix (https://github.com/heyjawrsh/nylas-mail/issues/7), the legacy Squirrel updater disabled or replaced, and LESS removed. Role tokens compile from DTCG theme files to runtime custom properties, and the new appearance setting keys sit beside the untouched `core.themes`. The region, row-height and title-bar contracts every style builds on exist. Classic, ported from `ui-light` and `ui-dark`, is the first token theme in light and dark. Internal LESS is ported to CSS on role tokens and `less` and `less-cache` are removed, so no LESS compiler ships; a third-party package's `.less` stylesheet is not loaded and is logged as deprecated. The list takes row height from style, density and text size and supports natural-height rows. The main window is frameless on macOS, Windows and Linux. This is the platform baseline, so every later epic waits on it.

## Outcome

For everyone building the later epics, one token runtime and its contracts exist, and the app runs on them in Classic in a pre-release build with nothing visibly broken.

## Done when

- The platform baseline lands first: unsigned electron-builder pre-release builds install on macOS, Windows and Linux, the React 19 render breakage is fixed (https://github.com/heyjawrsh/nylas-mail/issues/7), the legacy Squirrel updater is disabled or replaced, and LESS is removed (R32).
- A role token changed in a DTCG theme file shows up as a runtime custom property and repaints the running app; Classic light and dark define every contract role, including the categorical palette, typography with line height and the three shadow roles (R4, R5, R30).
- Style, theme, density and the accessibility settings are stored under new independent keys, `core.themes` is untouched, and Mode Auto and Increase contrast follow the OS live (R1, R13, R14).
- Text size starts at 100% on every OS; text size and density scale type, spacing and list row heights; the list handles natural-height rows; window zoom still stacks on top (R16, R18).
- The main window is frameless on all three OSes, with the region and title-bar contracts in place and OS controls placed per OS (R3, R20).
- No LESS ships: internal LESS is ported to CSS on role tokens, `less` and `less-cache` are gone, a third-party package's `.less` stylesheet is not loaded and is logged as deprecated once per launch, and forced colours are honoured (R15, R28).
- The sweep harness and the direct contrast-pair check run against the themes and styles that exist; it passes integrated verification in the real Electron app on macOS, Windows and Linux, and ships in an installable pre-release build.

## Boundaries

- It ports today's arrangement as the Classic style on the token runtime; epic-classic-style brings it to its spec. Out: any other style's layout (epic-loft, epics 7 to 9).
- Out: ported themes other than Classic, and Classic's high-contrast variants (epic-themes); the Loft theme (epic-loft).
- Out: Preferences › Appearance (epic-appearance); the upgrade mapping (epic-onboarding-upgrade).
- No legacy LESS theme loads beside the token runtime, built-in or community.
- Must not change: window zoom (`core.workspace.interfaceZoom`) stays separate from text size and stacks on top.
- Must not change: the legacy `core.themes` key.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R1, R2, R3, R4, R5, R13, R14, R15, R16, R18, R19, R20, R28, R30, R32), Boundaries (touch points owned by epic-token-platform)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Colors › Role tokens, Categorical palette, Variants, Forced colours and Increase contrast borders, Built-in theme role table, LESS variable → role mapping; Typography; Layout & Spacing › Window chrome and minimum width, Density; Elevation & Depth
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Foundation; Style Contract; State Patterns › OS signals, Upgrade; Accessibility Floor; Responsive & Platform; Theme Authoring › Format; Verification Matrix
- architecture — `_bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md`, AD-34 (platform baseline), AD-35 (no LESS), and every AD that binds epic-token-platform

## Notes

- Decision: 2026-11-11 — this stays one epic; a split is offered when its stories are planned.
