---
type: epic
title: "New users and upgraders land in the right look"
parent: initiative-theme-and-style-system
covers: [R7, R12, R28, R32]
sources: []
companions: []
after: [epic-taiga-style, epic-darkside-style, epic-less-is-more-style, epic-theme-authoring, epic-style-api]
refined: false
risk: high
---

# New users and upgraders land in the right look

## Description

First launch after account setup offers the Loft, Classic and Darkside looks plus text size and Increase contrast, once per install, inside the existing 900×600 onboarding window. Upgrading maps each legacy built-in theme to its style and theme, lands community LESS-theme users on Classic with a toast naming the theme, and shows the New: Appearance toast. No LESS theme loads in any build since epic-token-platform (AD-35), so this epic ships the mapping, not a retirement. The full 540-combination sweep and the five-style coverage check pass, so the stable public release can follow this epic.

## Outcome

For people installing or upgrading, Flows 1 (Ines) and 3 (Ruth) start right, upgraders land in their mapped look, and the release candidate passes the Verification Matrix.

## Done when

- On first launch the looks step offers Loft, Classic and Darkside plus text size and Increase contrast once per install; Continue applies the pick and Skip lands on Loft; the `key-onboarding.html` mock is re-checked at 900×600 (R12).
- Upgrading maps every legacy built-in theme to its style and theme, lands community LESS-theme users on Classic with a toast naming the theme, and shows the New: Appearance toast; `core.themes` is untouched (R28).
- All five built-in styles lay out every surface shipped, and all 540 combinations pass the screenshot and overflow checks with axe passing on the high-contrast variants (R7, R32).
- It passes integrated verification in the real Electron app on macOS, Windows and Linux, and ships in an installable pre-release build.

## Boundaries

- Out: the stable public release itself; it follows this epic once the initiative's Done when holds.
- Out: support for community LESS themes.
- Must not change: the legacy `core.themes` key, so a downgrade still works.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R7, R12, R28, R32), Constraints (onboarding window), Notes (strings)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Components › Onboarding looks step; Layout & Spacing › Loft style layout › Reference scale
- architecture — `_bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md`, AD-30, AD-32, AD-35
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Information Architecture › Onboarding looks step; State Patterns › Upgrade; Verification Matrix; Key Flows › Flow 1, Flow 3; Voice and Tone › Strings

## Notes

- Waits on epic-appearance because: it needs the look settings and Appearance as the New: Appearance toast's destination.
- Waits on epic-themes because: legacy themes map onto the nine built-in themes.
- Waits on epic-taiga-style because: legacy Taiga users map onto the finished Taiga style.
- Waits on epic-darkside-style because: the looks step offers Darkside, and legacy Darkside users map onto it.
- Waits on epic-less-is-more-style because: legacy Less-is-more users map onto the finished Less-is-more style.
- Waits on epic-theme-authoring because: its final coverage check covers that epic's surfaces.
- Waits on epic-style-api because: its final coverage check covers that epic's surfaces.
- Decision: 2026-11-11 — legacy LESS themes coexist on the old loading path until this epic. Superseded 2026-11-12: no LESS ships at all (AD-35); this epic keeps the upgrade mapping only.
- Decision: 2026-11-12 — re-sliced in place before start: LESS removal and the `styles.less` drop moved this epic's retirement work out; ids, covers and after unchanged (Josh's no-LESS decision).
- Decision: 2026-11-11 — this epic waits on epic-theme-authoring and epic-style-api as whole-epic gates (Josh).
