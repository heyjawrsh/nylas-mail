---
type: epic
title: "Plugin packages add community styles"
parent: initiative-theme-and-style-system
covers: [R27]
sources: []
companions: []
after: [epic-classic-style]
refined: false
risk: high
---

# Plugin packages add community styles

## Description

A public style API lets plugin packages add styles from day one. A style package is CSS only: it arranges the frozen shared components into the regions, and any JavaScript in it is not run. Under a community style, a feature the style doesn't cover renders in Classic's arrangement, and the style's card in Appearance names what it doesn't cover.

## Outcome

For style authors, a plugin package can add a style that shows up in Appearance and works with any theme, and nothing it ships can run code.

## Done when

- A sample CSS-only plugin package adds a style that appears in Appearance and renders with every theme the build ships at every density (R27).
- A feature the community style doesn't cover renders in Classic's arrangement, and its card names what it doesn't cover (R27).
- JavaScript shipped in a style package is not run.
- It passes integrated verification in the real Electron app on macOS, Windows and Linux, and ships in an installable pre-release build.

## Boundaries

- Out: community themes (epic-theme-authoring).
- Out: changes to the shared component kit; a community style arranges the frozen kit and cannot replace a component.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R27), Constraints (CSS-only style packages)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Brand & Style › The style contract
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Style Contract › Community styles; Theme Authoring › Styles

## Notes

- Waits on epic-classic-style because: the API exposes the shared kit, which freezes at the end of that epic, and Classic's arrangement is the fallback.
- Waits on epic-appearance because: community styles show as cards in Appearance.
- Waits on epic-theme-authoring because: both epics edit the Appearance tab.
- Decision: 2026-11-11 — this epic waits on epic-theme-authoring, because both edit the Appearance tab (Josh).
