---
type: epic
title: "Classic arranges every surface and the shared kit is frozen"
parent: initiative-theme-and-style-system
covers: [R2, R3, R6, R7, R15, R18, R19, R20, R21, R32]
sources: []
companions: []
after: [epic-email-dark-mode]
refined: false
risk: medium
---

# Classic arranges every surface and the shared kit is frozen

## Description

At its start, one Update of the spines writes all four short style specs (Classic, Taiga, Darkside, Less-is-more), including Classic's narrow-list row heights (design Open Questions 3). The Classic style that epic-token-platform ported is then brought to its spec and arranges the shared components into the regions and lays out every surface shipped so far, including Loft's. At its end the shared component kit freezes, and epics 7 to 9 and epic-style-api build on it. Classic's arrangement is also the fallback for features a community style doesn't cover.

## Outcome

For people who want the familiar Nylas layout, Classic is a style they can pair with any theme, and the frozen kit lets the remaining styles fan out without redefining components.

## Done when

- The four style specs are in the spines, written by one Update at this epic's start; the View original toggle from epic-email-dark-mode is in the kit before it freezes.
- Classic places or hides every region and lays out every surface shipped so far, using only shared components and role tokens (R3, R7).
- Classic's minimum width, rows per density (including the narrow-list case), title bar and layout-mode rule match its spec, and `core.workspace.mode` keeps working (R6, R18).
- Classic meets the shared obligations, its border-strong edges and its reflow ladder, and every theme built so far renders in it untuned through the sweep harness (R2, R15, R19, R21, R32).
- Classic passes the by-eye check at its native theme and density, and the shared component kit is frozen (R32).
- It passes integrated verification in the real Electron app on macOS, Windows and Linux, and ships in an installable pre-release build.

## Boundaries

- Out: the Taiga, Darkside and Less-is-more styles (epics 7 to 9); this epic writes only their specs.
- Out: Classic's colours (epic-token-platform, epic-themes).
- Must not change: the `core.workspace.mode` single and split pane preference.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R2, R3, R6, R7, R15, R18, R19, R20, R21, R32), Notes (style specs)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Components › Style catalogue, Shared components; Layout & Spacing › Window chrome and minimum width, Density; Open Questions 3
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Style Contract; Information Architecture › Surfaces every style must lay out; Accessibility Floor; Responsive & Platform › Reflow ladder; Verification Matrix

## Notes

- Waits on epic-loft because: Classic arranges the Loft surfaces and the shared components that epic builds.
- Waits on epic-email-dark-mode because: the View original toggle joins the shared kit before it freezes.
- Decision: 2026-11-11 — this epic waits on epic-email-dark-mode as a whole-epic gate (Josh).
- Decision: 2026-11-11 — all four short style specs are written at this epic's start as one Update of the spines, and the shared component kit freezes at its end.
