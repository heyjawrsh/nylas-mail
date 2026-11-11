---
type: review
lens: accessibility
target: DESIGN.md, EXPERIENCE.md (theme and style system)
reviewed: 2026-11-09
standard: WCAG 2.2 AA, plus macOS, Windows and Linux platform accessibility conventions
---

# Accessibility review: theme and style system

## Scope and method

I read `DESIGN.md`, `EXPERIENCE.md` and `.memlog.md` in full, and skimmed `imports/loft-DESIGN.md`, `imports/loft-global.css` and `.working/appearance-directions.html`. Later decision-log entries win, and the decisions belong to the user. Where a finding challenges a deliberate decision, it says so and is framed as a risk to weigh, not an error.

Contrast ratios below come from the WCAG 2.x relative-luminance formula, applied to the token hexes in `DESIGN.md` and to the legacy accents in the Theme catalogue. Nothing was rendered, so the in-place ratios over shadows, opacity and anti-aliasing will be slightly worse. Platform-behaviour claims (what Electron and Chromium expose per OS) are marked **verify** where they need a spike before anyone relies on them.

## Overall verdict

**Not ready for a public release as specified. Fix forward; nothing needs a restart.**

The spines do more for accessibility than most theme systems. They have an explicit Increase contrast axis that follows the OS, a text-size setting separate from zoom, a reduced-motion rule, RTL through logical properties, radio-group semantics, text tags instead of tint, a labelled apply bar, and an onboarding text-size slider. The foundation is sound.

Five problems stand between it and an AA claim:

1. **The default experience is below AA**, and the only path to AA is a setting most affected users will never turn on (deliberate: memlog L21, L35).
2. **The focus ring cannot meet its own 3:1 rule.** It is bound to `accent-default`, and in 5 of the 6 themes that colour is mockup-exact and below 3:1.
3. **Windows Contrast themes (forced colours) and GNOME high contrast are not handled at all.** Loft's shadow-and-tint separation disappears entirely under forced colours.
4. **The accessibility settings sit behind Preview → Apply.** The person changing text size or contrast doesn't get it on the page they're using, and closing the page discards it silently (deliberate: L31, L64, L71).
5. **Reflow is defined only down to "collapse the rail, then the folders".** Text size at 150% plus zoom at a 1100px window already overflows the top bar and the panes, and nothing is defined near 320 CSS px.

The 360-combination sweep cannot catch most of these, because axe doesn't test focus indicators, non-text contrast, states, forced colours or reflow.

## Severity counts

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 5 |
| Medium | 12 |
| Low | 7 |
| **Total** | **25** |

## Findings

### C1 [critical] The default look fails AA, and Increase contrast is the only path to AA

- **Location.** `DESIGN.md`: Brand & Style; Colors › Measured Loft contrast; Do's and Don'ts ("Quietly fix a theme's contrast in standard mode"). `EXPERIENCE.md`: Accessibility Floor › Increase contrast; Information Architecture (Loft is the default; skipping lands on Loft).
- **Criterion.** WCAG 1.4.3 Contrast (Minimum), 1.4.11 Non-text Contrast. Technique G174, a control that switches to a sufficient-contrast presentation, is the only route by which a toggle satisfies 1.4.3. G174 requires the control to sit on the page and to meet contrast itself. Platform convention: on macOS and Windows, "Increase contrast" or a contrast theme means *more than the normal legible default*, not "make it reach the minimum".
- **Decision log.** Deliberate: L21 (mockup-exact, with Increase contrast for AA), L24 (cites accessibility as not optional), L35 (Loft is the default and the skip fallback). **This is a risk to weigh.**
- **Finding.** In the default look (Loft style, Loft theme, light, standard contrast), most text people read every minute fails 4.5:1:

  | Pair (in place) | Ratio | Where |
  |---|---|---|
  | `text-snippet` on `surface-sunken` | 2.02 | List snippets |
  | `text-secondary` on `surface-field` | 2.29 | Search placeholder |
  | `text-secondary` on `surface-sunken` | 2.33 | Sender and time in the list |
  | `text-secondary` on white | 2.52 | Nav labels, dates, rail emails, the Appearance explanations |
  | `text-reading` on white | 3.03 | **Every email body**: the app's main reading text |
  | white 80% on `accent-default` | 3.08 | Selected-card snippet |
  | `accent-default` on `accent-tint` | 3.54 | Inbox count badge |
  | white on `status-danger` | 3.91 | Error toast (13px) |
  | white on `accent-default` | 3.94 | Primary button labels and the selected-row subject (15px/600 is not large text) |
  | `highlight-text` on `highlight-bg` | 4.44 | Search hits |

  The G174 route isn't met as specified:
  - The control lives in a separate Preferences window, not on the page.
  - The Appearance page "renders in the applied theme" (L71), so the Increase contrast explanation itself is at 2.52:1.
  - People with mild low vision, ageing eyes or glare rarely turn on OS Increase contrast, which on macOS also adds heavy borders everywhere. They are the main audience for 4.5:1, and they get the failing default.
  - **Verify:** on Linux, Chromium probably doesn't map GNOME's high-contrast switch to `prefers-contrast`, so "Follow system" may never fire there (see H2).
- **Suggested fix.** In order of preference:
  - **A. Invert the default.** Built-ins ship AA at standard contrast. "Match the reference exactly" becomes an opt-in, for example Increase contrast set to **Off (reference colours)**. Increase contrast On then goes beyond AA (around 7:1 body text, visible boundaries; see M11), which is what the macOS and Windows settings imply.
  - **B. Minimal lift.** Keep surfaces, accent hue and shadows mockup-exact, and raise only the failing *text* roles in standard contrast. For example, `#646e7d` gives 4.77:1 on `surface-sunken` and 5.16:1 on white, and is visually close to `#9aa4b2`'s role. Darken the accent fill under white text to about 4.5:1 or more (`#2a6fe0` gives 4.72:1; `accent-hover` `#1e63d0` gives 5.60:1). Most viewers won't notice; the diff against `loft-01.webp` will.
  - **C. If the decision stands,** meet G174 properly:
    - The Preferences window, the onboarding flow and the Increase contrast control always render at AA, whatever the applied theme.
    - Add Increase contrast to the onboarding looks step (see M9).
    - Add a menu command (View › Increase Contrast) so it is reachable from every window.
    - Say plainly in the release notes and the accessibility statement that the default look doesn't meet AA.

### H1 [high] A focus ring bound to `accent-default` can't meet 3:1 in five of six themes

- **Location.** `DESIGN.md`: frontmatter `components.focus-ring.color: '{colors.accent-default}'`; Components › Focus ring. `EXPERIENCE.md`: Accessibility Floor › Focus.
- **Criterion.** WCAG 1.4.11 Non-text Contrast (focus indicator against adjacent colours), 2.4.7 Focus Visible.
- **Decision log.** L67 (3:1 or better in every variant) conflicts with L21 (reference-exact colours) once the ring is bound to the accent. The spines contradict themselves here; this doesn't challenge either decision.
- **Finding.** Legacy accents against their own panels, at standard contrast:

  | Theme | Accent | Ratio |
  |---|---|---|
  | Loft | `#2f7cf6` on white | 3.94 |
  | Loft | on `surface-app` | 3.35 |
  | Nylas light | `#419bf9` on white | 2.88 |
  | Ubuntu | `#f07746` on white | 2.83 |
  | Darkside | `#f18260` on white | 2.59 |
  | Taiga | `#5dade1` on white | 2.46 |
  | Taiga | on `#f0f7fa` | 2.27 |
  | Nylas dark | `#5e6a77` on `#282828` | 2.67 |
  | Nylas dark | on `#333539` | 2.23 |

  Only Loft and Less-is-more (`#566c75`, 5.53) pass. On accent-filled elements (the selected card, primary buttons), an accent ring sits 2px from an accent fill (1.0:1). It reads as a slightly bigger button, not as focus.

  Two source artefacts also work against the rule:
  - `imports/loft-global.css` sets `input:focus, textarea:focus { outline: none; }`.
  - The directions mockup draws select focus as a `box-shadow`, which disappears under forced colours.
- **Suggested fix.**
  - Add a dedicated **`focus-ring` colour role** to the theme contract and the DTCG schema. It may differ from the reference, because no mockup draws focus.
  - Derive it for third-party themes with the same 3:1 guarantee as high-contrast values.
  - Alternatively, use a two-tone ring (2px `focus-ring` plus a 1–2px contrasting halo in `surface-panel` or `text-strong`), which reaches 3:1 on any background, accent fills included.
  - Add a Do/Don't: never port `outline: none`, and draw focus with `outline`, not `box-shadow`, so it survives forced colours.

### H2 [high] Windows Contrast themes (forced colours) and GNOME high contrast are unaddressed

- **Location.** Absent from both spines. Most affected: `DESIGN.md` Elevation & Depth (separation by tint and shadow), Components (selected card by accent fill, presence and unread dots, segmented controls, switch); `EXPERIENCE.md` Responsive & Platform and the Verification Matrix.
- **Criterion.** Windows convention: apps honour Contrast themes through `forced-colors: active` and system colours. WCAG 1.4.11 and 1.4.1 in that mode. GNOME convention: honour `org.gnome.desktop.a11y.interface high-contrast`. Orca users often pair it with large text.
- **Decision log.** No decision; this is a gap.
- **Finding.** Under forced colours, Chromium removes `box-shadow` and forces backgrounds to `Canvas`. In Loft that means:
  - Every region and control boundary disappears: the app card, reading card, secondary pills, search pill and compose card.
  - The selected message card loses its fill, so it can't be told apart from any other row.
  - Segmented-control selection drawn as a background disappears.
  - Unread and presence dots drawn as backgrounds vanish.
  - Category chips lose their colour.

  The spines also don't say how Increase contrast (Follow system) and forced colours interact. **Verify:** on Windows, Chromium likely reports `prefers-contrast: more` together with `forced-colors: active`. On Linux it likely reports neither for GNOME high contrast.
- **Suggested fix.**
  - Add a **forced-colours contract** that every style must meet:
    - Regions and controls carry `border` in a transparent role (see M11), so they become visible in forced colours.
    - Selection uses `Highlight`/`HighlightText`.
    - Dots are SVG using `currentColor`, or set `forced-color-adjust: none` on that element only, with system colours.
    - Focus uses `outline`.
    - Never set `forced-color-adjust: none` broadly.
  - In Appearance, when forced colours are active, show "Windows contrast theme is on" by the contrast control, and grey out theme colours as not applicable.
  - On Linux, read the GNOME high-contrast key in the main process and feed it into Follow system.
  - Add forced colours (a light and a dark Contrast theme) to the sweep.

### H3 [high] Accessibility settings are held behind Preview → Apply and discarded silently

- **Location.** `EXPERIENCE.md`: Interaction Primitives › Preview, then Apply; State Patterns › Leaving Appearance with pending changes; Flow 3. `DESIGN.md`: Appearance page ("The page chrome renders in the applied theme").
- **Criterion.** WCAG 1.4.4 Resize Text and 1.4.3 in practice: the person changing text size or contrast can't use the result while operating the page. macOS convention: accessibility and display settings take effect immediately.
- **Decision log.** Deliberate: L31 (Preview then Apply), L64 (closing discards silently), L71 (the Appearance page renders in the applied theme). **This is a risk to weigh.**
- **Finding.** Ruth raises text size to 150% or turns Increase contrast On. Only the embedded preview changes. The controls, labels and the Apply button she must find stay at the old size and contrast (2.52:1 explanations in Loft). If she closes the window, or moves to another Preferences tab, she loses the change without notice. Preview → Apply suits style and theme, which are taste decisions. It's the wrong model for accessibility needs.
- **Suggested fix.**
  - Take **Increase contrast, text size and font** (and arguably Mode) out of the pending set, so they apply immediately to the whole app, Appearance included. The preview still reflects them. Keep Preview → Apply for style, theme and density.
  - If everything must stay pending, apply the pending accessibility settings to the Appearance page chrome too.
  - Never discard accessibility changes silently: keep them pending across close and reopen, or ask.

### H4 [high] Reflow and resize aren't defined below "collapse the rail, then the folders"

- **Location.** `EXPERIENCE.md`: Responsive & Platform › Narrow windows, Text size and zoom. `DESIGN.md`: Layout & Spacing › Window chrome and minimum width; frontmatter `spacing` (fixed `list-width`, `rail-width`, `search-width`, `top-bar-height`, `search-height`, badge `height: 22px`). `imports/loft-global.css`: `.app-card { min-width: 1100px; overflow: hidden }` with the comment "small windows scroll horizontally instead of crushing".
- **Criterion.** WCAG 1.4.4 Resize Text (200%), 1.4.10 Reflow (320 CSS px wide, no two-dimensional scrolling), 1.4.12 Text Spacing.
- **Decision log.** L30 and L69 are deliberate. This finding challenges their completeness, not their direction.
- **Finding.** Reaching 200% text needs text size 150% plus zoom of about 133%. In a 1100px window that leaves about 825 CSS px.
  - **Top bar.** It needs roughly 1040 CSS px: app mark column 236, search pill 440, bell, gear and account chip about 230, plus about 138 for the Windows caption buttons. It has no collapse rule, so it overflows.
  - **Panes.** After the rail and folders collapse, the list (380 fixed) plus insets (64) plus card margins (48) leaves about 330px for the reading card at 150% type.
  - **At 400% zoom** (320 CSS px), nothing is defined.
  - **Ambiguous collapse.** "Folders" could mean the whole sidebar or only its folder list. The spines don't say where collapsed regions go or how to reach them.
  - **Fixed heights.** At 150% they clip text: a 22px badge holding 18px type, a 40px search pill, a 72px top bar.
  - **Source mismatch.** The source CSS does the opposite of the rule (a CSS min-width, so any zoom scrolls sideways).
- **Suggested fix.**
  - Define the full collapse ladder in CSS px, so zoom and text size trigger it:
    1. Rail becomes a toggle.
    2. Sidebar becomes an icon rail, then a menu button.
    3. Search pill becomes an icon button, and the account chip shrinks to its avatar.
    4. **Single-pane mode:** list ↔ reading, with a Back control, down to 320 CSS px.
  - Every collapsed region is reachable through a named button with `aria-expanded`.
  - The window minimum stays in device px. Widths become `max-*`, and heights become `min-height`.
  - Extend the Appearance page the same way: Display rows stack, and the mini-preview shrinks (M5).
  - Add 150% plus 200% zoom, 400% zoom, and the 1.4.12 spacing bookmarklet to the checks.

### H5 [high] The 360-combination sweep can't guarantee the floor

- **Location.** `EXPERIENCE.md`: Verification Matrix.
- **Criterion.** Coverage of WCAG 1.4.3, 1.4.11, 2.4.7, 2.4.11, 1.4.10 and 1.4.1.
- **Decision log.** Deliberate: L57. **This is a risk to weigh.**
- **Finding.** What axe contrast checks miss:
  - Focus indicators, icons, dots and control boundaries (1.4.11).
  - Any state that isn't on screen when the screenshot is taken: focus, hover, selected, unread, pending tags, open menus.
  - Text under opacity, shadows and backdrop. These come back as "needs review", for example the 0.8-opacity selected snippet.

  The sweep also has gaps in what it covers:
  - At standard contrast Loft fails by design, so 180 of the 360 runs will be red. That noise hides real regressions.
  - It excludes text size, RTL, the three OSes, forced colours, adapted email bodies and third-party or derived themes, which is where "derived variants pass AA automatically" has to hold.
- **Suggested fix.**
  - Add a **deterministic token-pair lint**: a role-pair matrix (each foreground role × each background role it is used on, per component and state) evaluated across all 24 built-in variants. Run it at install and live-reload on third-party files, where it can reject or flag the file.
  - Keep a baseline of known failures at standard contrast, so a new failure shows up.
  - Drive states in the screenshot pass: Tab through every focusable element, plus selected and unread rows and hover.
  - Add pairwise samples for forced colours, 150% plus zoom, and RTL.
  - Budget manual screen-reader passes of the four flows: VoiceOver (macOS), Narrator and NVDA (Windows), Orca (Linux).

### M1 [medium] Preview semantics: view-only, but it has to be scrollable and stay quiet

- **Location.** `EXPERIENCE.md`: Component Patterns › Appearance preview, Pending/Applied switch, Mini-preview.
- **Criterion.** WCAG 2.1.1 Keyboard, 2.4.3 Focus Order, 4.1.2 Name, Role, Value, 4.1.3 Status Messages.
- **Decision log.** View-only is deliberate (L75), and fine. This finding is about how to build it.
- **Finding.**
  - A render of the real app contains focusable controls. Tab would wander into a second inbox.
  - If the preview is made inert, keyboard users can't scroll it.
  - A live app render may fire its own live regions or toasts (new mail, sync) into the screen reader.
  - Screen-reader users get no textual equivalent of what is being previewed.
  - The semantics of the Pending/Applied switch aren't defined.
- **Suggested fix.**
  - Make the preview content `inert` and `aria-hidden`, inside a focusable wrapper (`tabindex="0"`, `role="region"`, name "Preview: Loft style, Taiga theme, pending"). Arrow and Page keys scroll it.
  - Point `aria-describedby` at the apply-bar summary.
  - Suppress notifications and live regions inside the preview.
  - Build the Pending/Applied switch as a two-option radio group and announce its change.
  - Don't put the mini-preview in the tab order a second time.

### M2 [medium] Esc discards everything, and closing discards silently

- **Location.** `EXPERIENCE.md`: Interaction Primitives › Esc; State Patterns › Leaving Appearance with pending changes; Voice ("Esc discards").
- **Criterion.** Platform convention (macOS Preferences windows don't discard on Esc; Esc is a reflexive "get me out of this control" key for keyboard and screen-reader users). WCAG 3.3.4-style error prevention, by analogy.
- **Decision log.** Deliberate: L31 and L64 (first Esc closes a menu, the next discards; close discards silently). **This is a risk to weigh.**
- **Finding.**
  - Counting Esc presses is fragile. Native `<select>` popups on macOS are OS menus, and the Esc that closes them never reaches the page. The user's next Esc then discards every pending change, with no undo.
  - Screen-reader users also press Esc to leave interaction or browse states.
- **Suggested fix.**
  - After a discard, show "Changes discarded" with an **Undo** action (`role="status"`; ⌘Z works).
  - Or make Esc discard only when focus is in the apply bar.
  - On close, keep pending changes for the next visit, or ask. At minimum, never discard accessibility settings (H3).

### M3 [medium] Focus after Apply jumps to the heading, and a style switch loses position in the main window

- **Location.** `EXPERIENCE.md`: Accessibility Floor › Focus; State Patterns › Applied; Voice (the "Appearance updated: Loft, Taiga" announcement).
- **Criterion.** WCAG 2.4.3 Focus Order, 4.1.3 Status Messages.
- **Decision log.** Deliberate: L67 and L75 (focus moves to the heading and the change is announced). **This is a risk to weigh.**
- **Finding.**
  - ⌘↵ pressed from the text-size slider throws focus to the top of the page, although focus was never in the apply bar.
  - A focus move and a live announcement fired together often cut each other off in VoiceOver and NVDA.
  - The announcement names only style and theme. A text-size-only change would announce "Loft, Taiga", which says nothing.
  - Switching style re-lays out the main window, and the spines don't say where focus and the virtual cursor land there.
- **Suggested fix.**
  - On ⌘↵, leave focus where it is.
  - On a click of Apply or Revert, which removes the button, move focus to the last-changed control. Fall back to the heading, with `tabindex="-1"`.
  - Announce through a polite live region that exists at page load, not inside the bar that hides. List every changed axis, for example "Appearance updated: Loft style, Taiga theme, text size 125%".
  - After Apply, restore main-window focus to the equivalent element, such as the selected thread.

### M4 [medium] Radio-group details: nested actions, badge tooltip, selection following focus

- **Location.** `EXPERIENCE.md`: Component Patterns › Theme swatch, Derived badge, Style card, Mode, Increase contrast and Density controls, Text size slider. `DESIGN.md`: Appearance page › Theme swatch. `.working/appearance-directions.html`.
- **Criterion.** WCAG 4.1.2, 1.3.1, 2.1.1, 1.4.13 Content on Hover or Focus.
- **Decision log.** Radio semantics are deliberate (L67) and right. "Export a copy…" (L75) and the non-clickable badge with a tooltip (EXPERIENCE) create the conflicts below.
- **Finding.**
  - "Export a copy…" inside a swatch puts an interactive control inside `role="radio"`, which is invalid nesting.
  - The derived badge's tooltip sits on a non-focusable element, so keyboard and screen-reader users never reach it.
  - Arrow keys select, so each arrow press re-renders the near-full-width preview with a cross-fade. Holding an arrow key cycles themes rapidly.
  - The segmented controls and the slider have no stated semantics.
  - The directions mockup uses `aria-pressed` buttons, which contradicts the spine; the spine wins.
- **Suggested fix.**
  - Move "Export a copy…" outside the group: a single button that acts on the checked swatch, or a per-swatch "More" menu button placed after the group.
  - Expose the "Applied" and "derived" tags, and the badge tooltip text, through `aria-describedby`. Show the tooltip on focus of the radio, not only on hover.
  - Debounce preview updates while a key repeats.
  - Build Mode, Increase contrast and Density as radio groups.
  - The slider uses `role="slider"` with `aria-valuetext="125 percent"`, Home/End, and 12.5% arrow steps.
  - Note in the build ticket not to copy the mockup's markup.

### M5 [medium] The sticky mini-preview and the pinned apply bar can hide the focused control

- **Location.** `EXPERIENCE.md`: Mini-preview, Apply bar. `DESIGN.md`: `spacing.appearance-mini-preview: 160px`; Appearance page › Apply bar.
- **Criterion.** WCAG 2.4.11 Focus Not Obscured (Minimum).
- **Decision log.** Deliberate: L45. This is a risk to weigh; the fix keeps the decision.
- **Finding.** Take an 800px-tall Preferences window at 200% zoom: about 400 CSS px of viewport. The 160px strip plus an apply bar of about 72px cover more than half of it. Tabbing down the Display rows will land focus under one of the two.
- **Suggested fix.**
  - Set `scroll-padding-block` to the sticky heights.
  - Shrink or hide the mini-preview below a viewport-height threshold, and give it a collapse button.
  - Test at 150% text plus 200% zoom.

### M6 [medium] Colour as the only signal, and non-text contrast of dots and categories

- **Location.** `DESIGN.md`: Categorical palette; Components › Message row, Selected message card, Right rail, Calendar view; `components.presence-dot`, `message-row.unread-dot`. `EXPERIENCE.md`: Accessibility Floor › Never by colour alone, which only covers Appearance tags.
- **Criterion.** WCAG 1.4.1 Use of Color, 1.4.11, 1.1.1, 4.1.2.
- **Decision log.** The palette and its derivation are deliberate (L56, L76): same-lightness pastels, hash-assigned. **This is a risk to weigh.** The dot issues aren't covered by any decision.
- **Finding.**
  - **Presence dot.** Green `#30c463` is 2.28:1 on white, and colour is its only meaning. No text equivalent is specified.
  - **Unread dot.** It is accent-coloured, so on the accent-filled selected card it is 1.0:1 and disappears. The same applies to an unread thread you've just opened.
  - **Timeline.** The current item is marked only by accent colour and a filled dot.
  - **Calendar chips.** Which calendar an event belongs to is shown by colour alone. Eight hash-assigned colours collide often. At L 0.88 and C 0.049, the pastels are hard to tell apart with colour-vision deficiency, and are 1.31–1.45:1 against white.
  - **Unspecified text colours.** The colour of avatar initials and chip text on a category fill isn't specified. `text-strong` on `category-1` is 6.69, which passes, but no rule requires it.
- **Suggested fix.**
  - Extend "Never by colour alone" to the whole app.
  - **Presence:** an accessible name such as "Online", and a shape difference for away and busy.
  - **Unread:** the dot uses `accent-on` on the selected card, and the row's accessible name starts "Unread".
  - **Timeline:** `aria-current="true"` plus visible weight or a "Current" text cue.
  - **Calendar:** the chip's accessible name and tooltip include the calendar name, plus a calendar legend.
  - **Palette:** add a `category-*-on` text role (4.5:1 or better), and add a colour-vision-deficiency check of distinguishability to the planned hand-check of colours 5–8.

### M7 [medium] Email body: undefined floor, reading-text contrast, and transparent images

- **Location.** `EXPERIENCE.md`: Email Body Rendering; View original toggle. `DESIGN.md`: `colors.text-reading`; Do's and Don'ts ("Leave images in email bodies untouched").
- **Criterion.** WCAG 1.4.3, 1.4.11, 1.4.1 (links), 4.1.2.
- **Decision log.** L34 and L66 are deliberate (outcomes-first, images untouched, View original remembered per sender). This is a risk to weigh.
- **Finding.**
  - "No text below the active contrast floor" has no number at standard contrast, where themes are below AA by design. The adaptation algorithm could legally aim for 3:1.
  - Plain-text bodies are drawn in the app's own `text-reading` at 3.03:1. That is not sender content, so the third-party content exemption doesn't apply.
  - "Images untouched" means transparent PNG logos and signatures with dark ink vanish on darkened backgrounds.
  - The semantics and reading-order position of the View original toggle are open.
  - Remember-per-sender is invisible state.
- **Suggested fix.**
  - Set the adapted-text floor at 4.5:1 at both contrast levels.
  - Give images with transparency a light backplate behind them. This doesn't alter the image's pixels.
  - Keep links at 3:1 against body text, or underlined.
  - The View original toggle is a button with `aria-pressed`, placed before the body in reading order, with visible text "Always showing original for this sender".
  - Under forced colours, let Chromium force the body frame.

### M8 [medium] Frameless window: window controls, RTL mismatch, Linux layouts, title and keyboard move

- **Location.** `EXPERIENCE.md`: Responsive & Platform › Window chrome, RTL. `DESIGN.md`: Layout & Spacing › Window chrome; Components › Top bar.
- **Criterion.** WCAG 2.4.2 Page Titled (window title), 4.1.2, 2.1.1. Platform conventions on all three OSes.
- **Decision log.** Frameless, with each style owning the title bar, is deliberate (L46, L69). RTL is deliberate (L47). **This is a risk to weigh.**
- **Finding.**
  - "Controls at the inline-end" assumes the app locale and the OS agree. An RTL app on an LTR OS (or the reverse) puts the native caption buttons on the opposite side from where the style leaves room. **Verify** for both Electron `titleBarOverlay` and `trafficLightPosition`.
  - GNOME and elementary users with left-side button layouts get right-side controls.
  - The spines don't say what the window title is. Orca, Narrator and the window switcher read it.
  - Keyboard window moving isn't mentioned: Alt+Space on Windows, Alt+F7 on GNOME.
  - At narrow widths with every control excluded from the drag region, almost no drag area may be left, which is a motor-access problem.
- **Suggested fix.**
  - Lay out around `env(titlebar-area-x/width)` and `navigator.windowControlsOverlay.getTitlebarAreaRect()`, not around a logical side.
  - On Linux, honour the GNOME `button-layout` setting, or offer "Use system title bar".
  - Keep the window title current, for example "Inbox — Nylas Mail".
  - Name any controls a style draws itself: Close, Minimise, Zoom or Maximise.
  - Verify that Narrator reads the overlay caption buttons and that Alt+Space works.
  - Guarantee a minimum drag area of about 48px.

### M9 [medium] Onboarding: the text-size slider comes after account setup, and look cards apply directly

- **Location.** `EXPERIENCE.md`: Information Architecture › Onboarding looks step; Component Patterns › Onboarding look card, Text size slider; Flow 3.
- **Criterion.** WCAG 1.4.4, 3.2.2 On Input, 4.1.2.
- **Decision log.** Deliberate: L71 (the looks step comes after account setup) and L64 and L35 (cards apply directly). **This is a risk to weigh.**
- **Finding.**
  - On macOS, Ruth gets through account setup (forms and an OAuth window) at 100% text, in a theme with no Increase contrast on, before she ever reaches the slider.
  - The spines don't say whether the onboarding slider resizes the onboarding screen itself.
  - If the cards are radios with selection following focus, each arrow press applies a whole look.
- **Suggested fix.**
  - Put a "Text size and contrast" control on the first onboarding screen, or at least a visible "⌘+ to zoom" hint that works there.
  - The slider resizes the step live.
  - Add an Increase contrast switch to the step (ties to C1, option C).
  - Make the cards buttons, each named by look name plus description, with decorative thumbnails. Label Skip "Skip (uses Loft)".

### M10 [medium] `/` is a single-character shortcut

- **Location.** `EXPERIENCE.md`: Component Patterns › Search pill / search overlay; Interaction Primitives › Keyboard.
- **Criterion.** WCAG 2.1.4 Character Key Shortcuts. Speech-input users of Dragon and Voice Control can trigger it by accident.
- **Decision log.** Not a logged decision; it is inherited from the Loft spec.
- **Finding.** `/` opens search with no stated way to turn it off or remap it, and no rule that it works only outside text fields.
- **Suggested fix.** Route it through Nylas Mail's existing keymap preference so it can be disabled or remapped, and keep it inactive while focus is in any editable field.

### M11 [medium] Boundaries drawn only by shadow and tint, even under Increase contrast

- **Location.** `DESIGN.md`: Elevation & Depth; Do's and Don'ts ("Add borders in Loft beyond the right-rail divider"); `components.button-secondary`, `search-pill`.
- **Criterion.** WCAG 1.4.11, for control boundaries where they identify the component (text fields especially). macOS convention: Increase contrast adds borders to controls.
- **Decision log.** Deliberate: L48 (style owns structure, theme owns colour) and the Loft no-borders rule. **This is a risk to weigh.**
- **Finding.**
  - `surface-sunken` against white is 1.08:1, and the search pill fill against white is 1.10:1.
  - Secondary pills are white on white, defined only by `shadow-soft`.
  - The high-contrast variant is colour-only and the style bans borders, so under Increase contrast the field and region boundaries stay at about 1.1:1.
- **Suggested fix.**
  - Add `border-control` and `border-region` theme roles. The standard value may be transparent, which keeps the look mockup-exact; the high-contrast value is 3:1 or better.
  - Styles always draw these borders.
  - The same transparent borders become visible under forced colours, which solves part of H2 too.

### M12 [medium] Right rail and timeline structure for screen readers

- **Location.** `EXPERIENCE.md`: Component Patterns › Right rail; State Patterns › Narrow window. `DESIGN.md`: Components › Right rail.
- **Criterion.** WCAG 1.3.1, 2.4.3, 4.1.2.
- **Decision log.** L71 (timeline items are clickable and scroll to the message) is deliberate. The behaviour is fine; the semantics are missing.
- **Finding.**
  - Clicking a timeline item scrolls the view but doesn't move focus, which strands keyboard and screen-reader users.
  - The rail has no landmark or heading structure.
  - When the rail collapses at narrow widths, there's no route back to it.
- **Suggested fix.**
  - Make the rail `<aside aria-label="Conversation details">`, with its three headings.
  - Build the timeline as a list of buttons, with `aria-current` on the current item. Activating one moves focus to that message (`tabindex="-1"` on the message article).
  - A collapsed rail is reopened from a named toggle with `aria-expanded`.

### L1 [low] Toast timing, roles and reach

- **Location.** `EXPERIENCE.md`: Component Patterns › Toast. `DESIGN.md`: `components.toast-error`.
- **Criterion.** WCAG 2.2.1 Timing Adjustable, 4.1.3, 2.1.1, 1.4.3.
- **Decision log.** The 5-second auto-dismiss is deliberate (L71).
- **Finding.**
  - Toasts that dismiss after 5 seconds don't pause on hover or focus.
  - Persistent error toasts have no keyboard route.
  - Roles aren't stated.
  - Error toast text is 3.91:1.
- **Suggested fix.**
  - Pause toasts on hover and focus, and lengthen the timeout for longer messages.
  - Use `role="status"` for standard toasts and `role="alert"` for errors.
  - Add F6 or a shortcut that focuses the toast stack.
  - Error toasts are 4.5:1 or better in every variant.

### L2 [low] Reduced motion is scoped to "this feature" only

- **Location.** `EXPERIENCE.md`: Accessibility Floor › Reduced motion. `imports/loft-global.css` (button `translateY` press, `toast-in` slide, 0.12s transitions).
- **Criterion.** WCAG 2.3.3 (AAA, advisory). OS reduce-motion conventions on all three OSes.
- **Decision log.** L36 and L64 are deliberate and good. This finding only widens their scope.
- **Finding.** Loft's own motion isn't governed: the hover lift, button press, toast slide-in and search overlay. Neither is a live OS mode switch.
- **Suggested fix.** Make `prefers-reduced-motion` a style-contract rule: every style's transitions become instant or opacity-only. **Verify** that Linux GTK `gtk-enable-animations` maps through Chromium.

### L3 [low] Text-size range and OS tracking

- **Location.** `EXPERIENCE.md`: Information Architecture › Text size; Accessibility Floor › Text size.
- **Criterion.** WCAG 1.4.4, met only together with zoom. Windows text-scale convention: apps follow changes live.
- **Decision log.** Deliberate: L30 and L67 (read once on first launch, then the user owns it). **This is a risk to weigh.**
- **Finding.**
  - 150% alone doesn't reach 200%.
  - Later Windows or GNOME text-scale changes are ignored, unlike contrast, which has Follow system.
- **Suggested fix.** Add a "Follow system" state to text size, mirroring contrast. Consider extending the top of the range to 175–200%.

### L4 [low] Target sizes

- **Location.** `DESIGN.md`: Right rail (timeline items in 12px), Calendar view (chips, "+N more"); density multipliers.
- **Criterion.** WCAG 2.5.8 Target Size (Minimum).
- **Decision log.** None.
- **Finding.** Timeline rows, calendar chips and "+N more" are likely under 24px tall at Compact density.
- **Suggested fix.** Add a style-contract minimum of 24×24px, or the spacing exception, at every density.

### L5 [low] The Apply shortcut isn't discoverable

- **Location.** `EXPERIENCE.md`: Voice and Tone › Apply bar; Component Patterns › Apply bar.
- **Criterion.** WCAG 3.3.2 (instructions), with `aria-keyshortcuts`.
- **Decision log.** L64 is deliberate. Additive only.
- **Finding.** The hint says only "Esc discards".
- **Suggested fix.** Hint "⌘↵ applies · Esc discards" (Ctrl+Enter on Windows and Linux), with `aria-keyshortcuts` on Apply. Make sure the shortcut also works while focus is in the preview region.

### L6 [low] Search overlay semantics

- **Location.** `EXPERIENCE.md`: Component Patterns › Search pill / search overlay. `DESIGN.md`: Search overlay, `search-hit`.
- **Criterion.** WCAG 4.1.2, 4.1.3, 2.4.3, 1.4.3.
- **Decision log.** None. The escaping contract (L54) is unaffected.
- **Finding.**
  - No combobox or listbox model is specified.
  - The result count isn't announced.
  - Focus return on Esc isn't stated.
  - Hit highlights are 4.44:1.
- **Suggested fix.**
  - Build a combobox with a grouped listbox (`role="group"` plus labels).
  - Announce the result count politely.
  - Esc returns focus to the trigger.
  - Raise hits to 4.5:1.

### L7 [low] Custom scrollbars

- **Location.** `DESIGN.md`: `colors.scrollbar-thumb`. `imports/loft-global.css` (`::-webkit-scrollbar` at 8px).
- **Criterion.** WCAG 1.4.11. macOS "Show scroll bars: Always" and Windows "Always show scrollbars" conventions.
- **Decision log.** None.
- **Finding.** The thumb is 1.30:1 on `surface-sunken`, and 8px wide.
- **Suggested fix.** Use a 3:1 or better thumb in high-contrast variants. Respect the OS overlay or always-show setting, or leave scrollbars native under forced colours.

## Computed contrast reference

All ratios are WCAG 2.x, flat colour on flat colour:

| Pair | Ratio |
|---|---|
| accent `#2f7cf6` on `#ffffff` / `#e9edf5` / `#f3f6fb` | 3.94 / 3.35 / 3.63 |
| `text-secondary` on white / sunken / field | 2.52 / 2.33 / 2.29 |
| `text-snippet` on sunken | 2.02 |
| `text-reading` on white | 3.03 |
| `text-faint` on white | 1.69 |
| `text-default` on white | 5.92 |
| `accent-on` 80% on accent | 3.08 |
| badge (accent on `accent-tint`) | 3.54 |
| `highlight-text` on `highlight-bg` | 4.44 |
| white on `status-danger` | 3.91 |
| `status-success` on white | 2.28 |
| sunken vs white / field vs white | 1.08 / 1.10 |
| `category-1` / `category-4` on white | 1.45 / 1.31 |
| `text-strong` on `category-1` | 6.69 |
| Nylas light `#419bf9` / Ubuntu `#f07746` / Taiga `#5dade1` / Darkside `#f18260` on white | 2.88 / 2.83 / 2.46 / 2.59 |
| Nylas dark accent `#5e6a77` on `#282828` / `#333539` | 2.67 / 2.23 |
| Less-is-more `#566c75` on white | 5.53 |
| Candidate AA secondary `#646e7d` on sunken / white | 4.77 / 5.16 |
| Candidate AA accent `#2a6fe0` / `#1e63d0` under white | 4.72 / 5.60 |
