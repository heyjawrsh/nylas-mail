---
type: epic
title: "People change their look in Preferences › Appearance"
parent: initiative-theme-and-style-system
covers: [R1, R9, R10, R11, R17]
sources: []
companions: []
after: []
refined: false
risk: medium
---

# People change their look in Preferences › Appearance

## Description

Preferences › Appearance becomes the one place to set style, theme, mode, Increase contrast, density, text size, font and Adapt email colours. Its preview shows real components on fixture data in the pending look. Style, theme, density and font wait for Apply, and the rest apply at once; Apply cross-fades after the new look paints, keeps focus and announces the new look. The theme-picker modal is retired. The page gives epic-email-dark-mode its Adapt email colours slot, epic-theme-authoring its theme list, epic-style-api its style cards, and epic-onboarding-upgrade the New: Appearance toast's destination.

## Outcome

For anyone using the pre-release, the look changes from one page with a preview before it commits, and Flow 3 (Ruth) runs as far as its Appearance steps.

## Done when

- Each control changes only its own setting, the others stay as set, and density persists when switching between Classic (ported by epic-token-platform) and Loft (R1, R9).
- Style, theme, density and font change only the preview until Apply; Revert or Esc discards with Undo for 5s; leaving discards silently; the immediate controls apply at once (R10).
- Apply cross-fades after the new look paints, keeps focus where it was and announces the whole new look to screen readers (R11).
- A font override replaces the theme typeface app-wide, and a missing font falls back with a toast (R17).
- The Preferences sheet keeps one shared layout in every style, and `internal_packages/theme-picker` is gone (R9).
- It passes integrated verification in the real Electron app on macOS, Windows and Linux, and ships in an installable pre-release build.

## Boundaries

- Out: the adaptation behind Adapt email colours (epic-email-dark-mode); this epic ships its slot.
- Out: installing, exporting and removing themes, and the author-guide link (epic-theme-authoring); community style cards (epic-style-api).
- Out: the onboarding looks step (epic-onboarding-upgrade).
- Out: Loft's in-window Settings view.
- Must not change: window zoom stays separate from text size.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R1, R9, R10, R11, R17)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Components › Appearance page (Preferences › Appearance); Typography
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Information Architecture › Where each setting lives; Component Patterns › Appearance page; State Patterns › Appearance; Interaction Primitives; Accessibility Floor › Focus, Screen readers; Key Flows › Flow 3

## Notes

- Waits on epic-token-platform because: it needs the setting keys, the token runtime and live variant switching.
- Waits on epic-loft because: it needs the shared toast and the Loft look the preview shows.
- Decision: 2026-11-11 — the density-persistence check switches between Classic and Loft: epic-token-platform ports the Classic style and epic-loft ships Loft, so two styles exist when this epic runs (Josh).
