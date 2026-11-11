---
type: epic
title: "Loft is the default look"
parent: initiative-theme-and-style-system
covers: [R2, R3, R4, R5, R6, R7, R8, R14, R15, R18, R19, R20, R21, R31, R32]
sources: []
companions: []
after: []
refined: false
risk: high
---

# Loft is the default look

## Description

Loft, the first new style and the default look, runs on the token platform. The Loft style and the Loft theme deliver the Loft mail view: the top bar with the app mark, search pill and overlay, bell placement, gear and account chip; the sidebar; the message list with the overhanging selected card; the reading card with its right rail; and the compose card. Along the way it builds the shared pieces other epics use: the shared toast, modal and popover, and the bundled-font pipeline epic-themes uses. It also settles the visual specs for the derived badge and the View original toggle, which epic-email-dark-mode builds.

## Outcome

For new users, Loft is a complete mail view in a pre-release build, and it matches the reference by eye and by the scale-normalised diff against `imports/loft-01.webp`.

## Done when

- With Loft set, the pre-release build shows the Loft mail view with the behaviour EXPERIENCE gives each part; the single/split pane control is hidden and Loft is always split pane (R6, R8).
- The Loft theme defines every role in all four variants, and its high-contrast variants pass every contrast pair (R4, R5, R14).
- Loft places or hides every region, keeps natural-height rows per density with a 24px pointer target, meets the shared obligations and holds its reflow ladder (R3, R15, R18, R19, R21).
- Toasts stack at most three, de-duplicated by key, with info and error behaviour as specified (R31).
- Loft passes the by-eye check at its native theme and density and the diff against `imports/loft-01.webp` (R32).
- It passes integrated verification in the real Electron app on macOS, Windows and Linux, and ships in an installable pre-release build.

## Boundaries

- Out: the notifications feature. Loft places the bell, and the bell renders only once that feature's contract exists.
- Out: Calendar and Contacts features; Loft ships only their regions and visual spec.
- Out: the other eight themes (epic-themes) and the other four styles (epic-classic-style and epics 7 to 9).
- Out: email body adaptation and the View original behaviour (epic-email-dark-mode); this epic only specifies its look.
- Out: feature content dropped to feature epics in `reconcile-loft-DESIGN.md`, and empty, loading and error states of the mail surfaces.
- Must not change: the `core.workspace.mode` preference keeps working in the other styles.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R2, R3, R4, R5, R6, R7, R8, R14, R15, R18, R19, R20, R21, R31, R32), Boundaries (touch points owned by epic-loft)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Components › Loft mail surfaces, Shared components; Layout & Spacing › Loft style layout (incl. Reference scale), Density; Colors › Theme catalogue, Derived values pending hand-check › Loft light and Night Slate; Open Questions 1, 2
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Component Patterns › Loft mail surfaces, Shared components; Style Contract; Verification Matrix
- reconcile — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/reconcile-loft-DESIGN.md`

## Notes

- Waits on epic-token-platform because: it needs the token runtime, regions, row-height and title-bar contracts.
- Decision: 2026-11-11 — the Loft theme lives in this epic, not epic-themes.
