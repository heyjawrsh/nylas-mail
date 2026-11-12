---
type: epic
title: "Styles arrange the app through one contract"
parent: initiative-theme-and-style-system
covers: [R2, R3, R18, R19, R20, R32]
sources: [_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md, _bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md]
companions: [_bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md]
after: []
refined: true
risk: high
---

# Styles arrange the app through one contract

## Description

This epic builds the contract every style builds on.

**Classic as a style.** Classic becomes a style package: a `nylasStyle` manifest plus scoped CSS that arranges the seven regions mapped onto WorkspaceStore locations. Today's arrangement stays in the baseline layer.

**Rows and geometry.** The list takes row height from the style's CSS through a probe, per density and text size, and the 36, 85 and 39px values hard-coded in `thread-list.jsx` and `draft-list.jsx` go. Style geometry (region widths, the window minimum and the reflow breakpoints) comes from the manifest and replaces `setMinimumWidth` in `sheet.jsx`.

**Window chrome.** Every window, popouts included, is frameless on macOS, Windows and Linux.

**Shared tooling.** The preview data provider lets Appearance and onboarding render real components on fixtures. Style lint enforces the shared obligations, and the sweep harness runs every combination that exists so far.

## Outcome

Anyone building a style (Loft first) gets one contract to arrange the app through, plus a sweep that catches breakage across every combination, in an installable pre-release build.

## Requirements

- R1 (parent R2): any theme renders in any style at any density with nothing tuned per pairing. A style reads role tokens only. `pnpm lint` and the package loader reject hex literals, theme ids, physical left/right and declared role properties in style CSS (architecture AD-9).
- R2 (parent R3): a style package, a `nylasStyle` manifest plus CSS in `@scope`, places or hides each of the seven regions (titlebar, nav, list, reading, rail, overlay, toast) with the shared feature components. It sets only radius, spacing, row heights per density and component variants (architecture AD-9, AD-20).
- R3 (parent R18): density (Compact, Comfortable, Spacious) scales the style's spacing roles and applies its row height for the level. List rows follow text size, and every message row keeps a 24px pointer target (architecture AD-10).
- R4 (parent R19): the two-tone focus ring reaches 3:1 and is never clipped. Every style lays out correctly with `dir="rtl"` on its look root, and lint fails unlayered CSS in `internal_packages/` and `static/` (architecture AD-22).
- R5 (parent R20): every window the app opens (except onboarding, which is already frameless) is frameless on macOS, Windows and Linux. The style draws its title bar with the OS controls placed per OS, and the top bar is the drag region (architecture AD-15).
- R6 (parent R32): in Linux CI, the sweep screenshots and overflow-checks every existing style × theme × density × variant across every window type. It checks contrast pairs directly, runs axe on high-contrast variants, and drives OS signals through the AppearanceSignals override (architecture AD-19).
- R7 (architecture AD-21): each style's manifest sets its region widths, window minimum and reflow breakpoints, and the style-geometry runtime applies them. `containerStyles` and `setMinimumWidth` in `sheet.jsx` stop applying.
- R8 (architecture AD-32): region components read data through a provider that defaults to the live stores, and `src/appearance/preview-fixtures/` gives preview and onboarding roots fixture data.

## Constraints

- Style CSS lives only in `@scope ([data-style="<id>"]) to ([data-look])`, and flag selectors are written `:scope[data-…]` (architecture AD-1).
- Classic is the baseline layer. Feature CSS keys on `[data-region]` and hooks, never on `data-style="classic"` (architecture AD-20).
- Style packages run no JavaScript (initiative Constraints).
- Fixed-height virtualisation stays. Row height is read once per look change from a probe, never measured per row (architecture AD-10).
- Chrome CSS lives only in `shell-chrome.css`, and the window chrome changes through the one `set-window-chrome` channel (architecture AD-2, AD-15).
- Must not change: `core.workspace.mode` single and split pane keeps working in Classic. The onboarding window stays 900×600.

## Done when

- The Classic style package lays out the app through the region contract in the real app. Changing density changes spacing and row heights, and the list still virtualises (R2, R3).
- The main window and popouts are frameless on macOS, Windows and Linux, with OS controls placed correctly on each (R5).
- Lint fails hex literals, theme ids, physical properties and unlayered CSS, and the loader rejects the same in a fixture style (R1, R4).
- The sweep runs every existing combination in Linux CI, including the RTL pass. Its overflow and diff thresholds are set, and performance budgets are recorded (R4, R6).
- It ships in an installable pre-release build.

## Boundaries

- Out: the token runtime, the look's computation, OS signals and the LESS port (epic-token-platform). Builds and the harness core (epic-platform-baseline).
- Out: Classic's narrow-list row heights and its full style spec (epic-classic-style). Every other style (epic-loft, epics 7 to 9). Each style's reflow ladder (its style epic).
- Out: the public community style API and its Appearance cards (epic-style-api).
- Must not change: `core.workspace.hiddenLocations` keeps working where the manifest has no `hide`.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R2, R3, R18, R19, R20, R32), Boundaries (touch points owned by epic-style-contract)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Layout & Spacing › Window chrome and minimum width, Density
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Style Contract; Accessibility Floor; Responsive & Platform › Window chrome; Verification Matrix
- architecture — `_bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md`, AD-1, AD-9, AD-10, AD-15, AD-19, AD-20, AD-21, AD-22, AD-32; Deferred (harness thresholds, performance budgets)

## Notes

- Decision: 2026-11-12. Split out of epic-token-platform, taking R2, R3, R18, R20 and R32 and sharing R19.
- Decision: 2026-11-12. The tracer bullet is story 1: the Classic style package lays out the list region, and the list takes its row height from the style's CSS through the probe.
- Decision: 2026-11-12. Look roots take `dir` from the window's document (`ltr` today). The sweep forces `rtl` once per style at its native theme and density across every window type, not across all 540 combinations. This answers the architecture Open Question about `dir`.
- Decision: 2026-11-12. Density (2) follows the tracer because every later style needs its row heights. The least certain stories, the frameless window (5) and the sweep (8), wait on the shell adapter (1.9), so they can't move earlier.
- Decision: 2026-11-12. The narrow 85px branch becomes a baseline default under a container query, the JS switch to narrow columns stays, and epic-classic-style sets Classic's narrow values.
- Decision: 2026-11-12. Popouts go frameless with the main window, because architecture AD-15 changes the window-launcher default every window shares. Each popout's toolbar is its drag region.
- Risk: every style builds on this contract. Beyond each story's check, epic-loft's first story is reviewed against it before this epic closes.
- Decision: 2026-11-12. The WebKitGTK check of `@scope` and `contrast-color()` (architecture AD-2) belongs to the platform-move research (https://github.com/heyjawrsh/nylas-mail/issues/6), not this initiative.
