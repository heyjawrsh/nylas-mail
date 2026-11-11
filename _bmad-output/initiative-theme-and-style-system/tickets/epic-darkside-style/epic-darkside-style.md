---
type: epic
title: "Darkside arranges every surface"
parent: initiative-theme-and-style-system
covers: [R2, R3, R6, R7, R15, R18, R19, R20, R21, R32]
sources: []
companions: []
after: [epic-classic-style]
refined: false
risk: medium
---

# Darkside arranges every surface

## Description

The Darkside style arranges the frozen shared component kit into the fixed regions, following the Darkside style spec written at epic-classic-style's start. Its layout comes from `internal_packages/ui-darkside`'s layout LESS, and its colours come from the Darkside theme epic-themes ships. When it is done, every surface shipped so far lays out in Darkside with every built-in theme at every density, which moves the five-style coverage gate (R7) one style closer. epic-onboarding-upgrade offers it as one of the three looks and maps legacy Darkside users onto it.

## Outcome

For people who liked the legacy Darkside theme, Darkside becomes a style they can pair with any theme, and it passes its by-eye check at its native theme and density.

## Done when

- Darkside places or explicitly hides every region and lays out every surface shipped so far, using only the frozen kit and role tokens (R3, R7).
- Darkside's minimum width, row height per density, title bar and layout-mode rule match the Darkside style spec, and `core.workspace.mode` single and split pane keep working (R6, R18).
- Darkside meets the shared obligations, its border-strong edges and its reflow ladder hold at 150% text plus zoom (R15, R19, R21).
- Every built-in theme in all four variants at all three densities renders in Darkside with nothing tuned per pairing, through the sweep harness (R2, R32).
- Darkside passes the by-eye check in the real Electron app at its native theme and density (R32).
- It passes integrated verification in the real Electron app on macOS, Windows and Linux, and ships in an installable pre-release build.

## Boundaries

- Out: new shared components. The kit froze at the end of epic-classic-style; a component a style needs and the kit lacks goes back as a change to the kit, not into this style.
- Out: the Darkside theme's colours and variants (epic-themes).
- Out: mapping legacy Darkside users onto this style (epic-onboarding-upgrade).
- Out: the Taiga and Less-is-more styles (epics 7 and 9).
- Must not change: the `core.workspace.mode` single and split pane preference.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R2, R3, R6, R7, R15, R18, R19, R20, R21, R32)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Components › Style catalogue; Layout & Spacing › Window chrome and minimum width, Density; Open Questions 3 (the style spec, once written)
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Style Contract; Information Architecture › Surfaces every style must lay out; Accessibility Floor; Responsive & Platform › Reflow ladder; Verification Matrix

## Notes

- Waits on epic-classic-style because: the shared component kit freezes at the end of that epic, and the style spec is written at its start.
- Waits on epic-themes because: the Darkside theme comes from that epic.
