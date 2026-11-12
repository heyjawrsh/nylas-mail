---
type: epic
title: "All nine built-in themes ship complete"
parent: initiative-theme-and-style-system
covers: [R4, R5, R14, R32]
sources: []
companions: []
after: []
refined: false
risk: medium
---

# All nine built-in themes ship complete

## Description

Aubergine (from `ui-ubuntu`), Taiga, Darkside and Less-is-more are ported to token themes, and Volt, Ember and Dusk are added. Each ships light and dark at standard and high contrast with its type ramp. The build tasks in design Open Questions 5 are done and every derived value is hand-checked. The proprietary `nylas-private-fonts` package leaves the public build and becomes an optional private package. It uses the bundled-font pipeline from epic-loft, and epics 7 to 9 and 12 use its themes.

## Outcome

For people picking a theme, all nine built-ins load in every variant, none shows derived, and every high-contrast variant passes every contrast pair.

## Done when

- All nine built-in themes are bundled and define every role in all four variants; none fails to load or shows derived (R4, R5).
- Every high-contrast variant of the seven themes passes every pair in Contrast pairs through the direct check, and axe passes on them (R14, R32).
- Each theme except Loft has its type ramp in its own face.
- The public build contains no Nylas-Pro files, and Nylas-Pro renders only when the optional private package is present.
- It passes integrated verification in the real Electron app on macOS, Windows and Linux, and ships in an installable pre-release build.

## Boundaries

- Out: the Loft theme (epic-loft) and Classic in all four variants (epic-token-platform, since 2026-11-12).
- Out: the layout LESS in `ui-taiga`, `ui-darkside` and `ui-less-is-more` (epics 7 to 9).
- Out: the licensing question for the public repo; it is a separate GitHub issue.
- Out: theme distribution.
- Must not change: standard contrast stays reference-exact; never quietly fix standard ratios.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R4, R5, R14, R32), Notes (type ramps, build tasks)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Colors › Theme catalogue, Variants, Contrast pairs, High-contrast values, Built-in theme role table, LESS variable → role mapping, Derived values pending hand-check; Typography; Open Questions 4, 5
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Verification Matrix

## Notes

- Waits on epic-token-platform because: it needs the token runtime and the DTCG theme format.
- Waits on epic-loft because: it needs the bundled-font pipeline.
