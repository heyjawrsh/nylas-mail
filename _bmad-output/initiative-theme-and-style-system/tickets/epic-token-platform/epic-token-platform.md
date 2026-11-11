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

The app's look stops coming from stacked LESS themes and starts coming from role tokens. Role tokens compile from DTCG theme files to runtime custom properties, and the new appearance setting keys sit beside the untouched `core.themes`. The region, row-height and title-bar contracts every style builds on exist. Classic, ported from `ui-light` and `ui-dark`, is the first token theme in light and dark. Package LESS reads role tokens through a shim over every package stylesheet. The list takes row height from style, density and text size and supports natural-height rows. The main window is frameless on macOS, Windows and Linux. This is the platform baseline, so every later epic waits on it.

## Outcome

For everyone building the later epics, one token runtime and its contracts exist, and the app runs on them in Classic in a pre-release build with nothing visibly broken.

## Done when

- A role token changed in a DTCG theme file shows up as a runtime custom property and repaints the running app; Classic light and dark define every contract role, including the categorical palette, typography with line height and the three shadow roles (R4, R5, R30).
- Style, theme, density and the accessibility settings are stored under new independent keys, `core.themes` is untouched, and Mode Auto and Increase contrast follow the OS live (R1, R13, R14).
- Text size and density scale type, spacing and list row heights; the list handles natural-height rows; window zoom still stacks on top (R16, R18).
- The main window is frameless on all three OSes, with the region and title-bar contracts in place and OS controls placed per OS (R3, R20).
- Every package stylesheet that uses ui-variables still renders through the shim, a user's `styles.less` still loads, and forced colours are honoured (R15, R28).
- The sweep harness and the direct contrast-pair check run against the themes and styles that exist; it passes integrated verification in the real Electron app on macOS, Windows and Linux, and ships in an installable pre-release build.

## Boundaries

- It ports today's arrangement as the Classic style on the token runtime; epic-classic-style brings it to its spec. Out: any other style's layout (epic-loft, epics 7 to 9).
- Out: ported themes other than Classic, and Classic's high-contrast variants (epic-themes); the Loft theme (epic-loft).
- Out: Preferences › Appearance (epic-appearance); upgrade mapping and retiring the old LESS path (epic-onboarding-upgrade).
- Legacy LESS themes keep loading on the old path beside the token runtime until epic-onboarding-upgrade.
- Must not change: window zoom (`core.workspace.interfaceZoom`) stays separate from text size and stacks on top.
- Must not change: the legacy `core.themes` key, and the loading of a user's `styles.less`.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R1, R2, R3, R4, R5, R13, R14, R15, R16, R18, R19, R20, R28, R30, R32), Boundaries (touch points owned by epic-token-platform)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Colors › Role tokens, Categorical palette, Variants, Forced colours and Increase contrast borders, Built-in theme role table, LESS variable → role mapping; Typography; Layout & Spacing › Window chrome and minimum width, Density; Elevation & Depth
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Foundation; Style Contract; State Patterns › OS signals, Upgrade; Accessibility Floor; Responsive & Platform; Theme Authoring › Format; Verification Matrix

## Notes

- Decision: 2026-11-11 — this stays one epic; a split is offered when its stories are planned.
