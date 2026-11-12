---
type: epic
title: "Email bodies read well in dark mode"
parent: initiative-theme-and-style-system
covers: [R9, R22]
sources: []
companions: []
after: []
refined: false
risk: high
---

# Email bodies read well in dark mode

## Description

In dark mode, email bodies are adapted so their text meets the active contrast floor, and images are never altered. View original works per message and is remembered per sender per account. Replies, forwards and print use the original colours. Adapt email colours, in its Appearance slot, turns adaptation off app-wide. The adaptation algorithm is open, so a spike settles it first.

## Outcome

For people reading mail in a dark theme, message bodies are readable without losing the sender's images, and View original gets the original back.

## Done when

- In dark mode, adapted body text meets the active contrast floor across a fixture set of real-world emails, with images untouched (R22).
- View original switches one message, is remembered per sender per account, and uses the visual spec from epic-loft (R22).
- Replies, forwards and print use original colours (R22).
- Adapt email colours in Appearance turns adaptation off app-wide and applies at once (R9, R22).
- It passes integrated verification in the real Electron app on macOS, Windows and Linux, and ships in an installable pre-release build.

## Boundaries

- Out: the View original toggle's visual spec (epic-loft) and the Appearance page itself (epic-appearance).
- Must not change: images in email bodies are never altered.

## References

- parent — `_bmad-output/initiative-theme-and-style-system/initiative-theme-and-style-system.md`, section Requirements (R9, R22), Notes (email dark-adaptation algorithm)
- design — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`, Do's and Don'ts; Open Questions 2 (View original visual spec)
- experience — `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`, Email Body Rendering; Component Patterns › View original toggle; Open Questions 1

## Notes

- Waits on epic-token-platform because: the adaptation spike needs the token runtime and the active contrast floor, and may start once that epic is done.
- Waits on epic-loft because: it builds the View original toggle from Loft's visual spec.
- Waits on epic-appearance because: Adapt email colours lives in its Appearance slot.
- Decision: 2026-11-11 — this is the 4th epic, and its adaptation spike may start once epic-token-platform is done.
- Decision: 2026-11-12 — epic-token-platform ships a minimal email-frame binding (`color-scheme` plus role values, story 1.13), so bodies stay legible once LESS is gone. This epic extends that binding with adaptation and the sandbox rather than creating it.
