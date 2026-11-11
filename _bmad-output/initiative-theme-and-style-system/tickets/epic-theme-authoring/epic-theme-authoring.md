---
type: epic
title: "Theme authors ship one token file"
parent: initiative-theme-and-style-system
covers: [R23, R24, R25, R26, R29]
sources: []
companions: []
after: []
refined: false
risk: medium
---

# Theme authors ship one token file

## Description

A third-party theme is one DTCG `.tokens.json` file identified by `$metadata.id`. Bad files and clashes with built-in ids or names are rejected with an error naming file and line. Saving a file in the themes folder live-reloads it, and a theme that fails falls back to its last valid version, then Loft. Users install, export and remove themes from Appearance. Missing variants and roles are derived and marked derived. A user-facing author guide is published and linked from Appearance.

## Outcome

For theme authors, Flow 2 (Dev) runs end to end: export a built-in, live-edit it, install it, following the published guide.

## Done when

- A valid file installs and becomes the pending theme; a file that breaks validation, or reuses a built-in id or name, is rejected with an error naming file and line and is never copied; clashes ask Replace or Keep both (R23, R25).
- Saving a file in the themes folder reloads that theme in the app and the preview after 300ms; a failing theme falls back to its last valid version, then Loft, with an error toast (R24).
- Export copies a built-in, and remove deletes a third-party theme (R25).
- A partial theme gets OKLCH-derived variants, Classic-filled roles and re-derived failing high-contrast pairs, and its swatch shows derived (R26).
- The author guide is published and Appearance links to it; its surfaces sit in the shared Preferences layout and the toast region every style lays out (R29).
- It passes integrated verification in the real Electron app on macOS, Windows and Linux, and ships in an installable pre-release build.

## Boundaries

- Out: theme distribution.
- Out: community LESS themes; they stop loading (epic-onboarding-upgrade).
- Out: community styles (epic-style-api).

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R23, R24, R25, R26, R29), Notes (theme-folder watcher, strings)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Colors › Variants
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Theme Authoring; Component Patterns › Install theme…; State Patterns › Theme files; Voice and Tone › Strings; Key Flows › Flow 2

## Notes

- Waits on epic-token-platform because: it needs the DTCG compiler and token runtime.
- Waits on epic-loft because: it needs Loft as the fallback theme and the error toast.
- Waits on epic-appearance because: it needs the Appearance theme list and pending-theme preview.
