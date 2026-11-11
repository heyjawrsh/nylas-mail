---
type: design
title: Theme and style system
status: final
updated: 2026-11-11
name: Nylas Mail theme and style system
description: Semantic role tokens that every theme must define (colour, typography, shadow, categorical palette), with the Loft theme as reference values (light, plus Night Slate dark as -dark twins, both at standard contrast), and the Loft style's radius and spacing at Comfortable density. Styles read only these roles; themes supply them as W3C DTCG JSON.
sources:
  - imports/loft-01.webp
  - imports/loft-02.webp
  - imports/loft-DESIGN.md
  - imports/loft-global.css
  - mockups/appearance-directions.html
  - mockups/color-themes-loft-dark.html
  - mockups/key-loft-mail.html
  - mockups/key-appearance.html
  - mockups/key-onboarding.html
  - mockups/key-free-mix.html
  - reconcile-loft-DESIGN.md
  - https://github.com/heyjawrsh/nylas-mail/issues/2
colors:
  # THEME tokens. Plain keys: Loft theme, light mode, standard contrast
  # (imports/loft-global.css, imports/loft-DESIGN.md, mockups/color-themes-loft-dark.html .th-light).
  # -dark keys: Loft theme, dark mode (Night Slate), standard contrast (mockups/color-themes-loft-dark.html).
  # High-contrast values are in the body (Colors › High-contrast values). Shadow roles are in Elevation & Depth.
  # "derived" = computed in OKLCH, hand-check pending (Colors › Derived values pending hand-check).
  surface-app: '#e9edf5'              # --bg: window ground behind the app card
  surface-app-dark: '#0f141c'
  surface-panel: '#ffffff'            # --panel: app card, reading card, overlays
  surface-panel-dark: '#1b2230'
  surface-sunken: '#f3f6fb'           # --panel-2: message list column, reading area, contacts ground
  surface-sunken-dark: '#141a25'
  surface-hover: '#eef2f8'            # --panel-3: icon-button hover, quiet fills
  surface-hover-dark: '#252d3c'
  surface-field: '#f1f4f9'            # search pill and text-field fill
  surface-field-dark: '#212938'
  surface-sidebar: '#ffffff'          # sidebar region (Loft: white, loft-DESIGN.md)
  surface-sidebar-dark: '#1b2230'
  surface-toolbar: '#ffffff'          # top bar / toolbar region (Loft: white top bar)
  surface-toolbar-dark: '#1b2230'
  border-subtle: '#eef1f6'            # hairline divider (Loft: right-rail divider only)
  border-subtle-dark: '#283142'
  border-strong: '#86888d'            # derived: bordered cards, outlined selection, Increase-contrast borders
  border-strong-dark: '#616c7f'       # derived
  control-border: '#e6ebf2'           # Appearance style-card and theme-swatch ring at rest (mockups/appearance-directions.html)
  control-border-dark: '#2a3140'      # derived
  control-track: '#d3dae4'            # switch off track; style-card and theme-swatch ring on hover
  control-track-dark: '#373f4e'       # derived
  text-default: '#5b6572'             # --text: UI text
  text-default-dark: '#a9b2c1'
  text-strong: '#3c4552'              # --text-strong: headings, subjects, names
  text-strong-dark: '#e4e9f1'
  text-secondary: '#9aa4b2'           # --text-soft: sender, time, secondary labels
  text-secondary-dark: '#76818f'
  text-faint: '#c0c8d2'               # --text-faint: disabled text
  text-faint-dark: '#4d5768'
  text-snippet: '#a7b0bd'             # message-list snippet
  text-snippet-dark: '#6a7585'
  text-reading: '#8b95a5'             # email body in the reading card
  text-reading-dark: '#8f99a9'
  text-on-sidebar: '#9aa4b2'          # nav labels on surface-sidebar
  text-on-sidebar-dark: '#76818f'
  text-on-sidebar-active: '#2f7cf6'   # active nav label on surface-sidebar
  text-on-sidebar-active-dark: '#3a83f7'
  text-on-toolbar: '#3c4552'          # wordmark and labels on surface-toolbar
  text-on-toolbar-dark: '#e4e9f1'
  text-on-category: '#5b6572'         # avatar initials and chip labels on category fills
  text-on-category-dark: '#1b2230'
  icon-default: '#9aa4b2'             # resting icon colour
  icon-default-dark: '#7a8596'
  accent-default: '#2f7cf6'           # --blue: accent fills
  accent-default-dark: '#3a83f7'
  accent-hover: '#1e63d0'             # --blue-dark: accent fill hover
  accent-hover-dark: '#5a99ff'
  accent-tint: '#eef3fd'              # --blue-tint: count badges, quiet accent fills
  accent-tint-dark: '#1d2d4b'
  accent-on: '#ffffff'                # text and icons on accent-default
  accent-on-dark: '#ffffff'
  accent-text: '#2f7cf6'              # accent-coloured text: active nav, links, badge text, current timeline item
  accent-text-dark: '#3a83f7'
  highlight-bg: '#d7e6ff'             # <mark> search-hit fill
  highlight-bg-dark: '#24426f'
  highlight-text: '#1e63d0'           # <mark> search-hit text
  highlight-text-dark: '#acc9ff'
  status-danger: '#e5484d'            # --danger: error-toast bar and icon, bell notification dot
  status-danger-dark: '#ef5a5f'
  status-success: '#30c463'           # --ok: presence dot
  status-success-dark: '#34c96a'
  status-warning: '#f0ad4e'           # derived: warning bar fill (legacy @color-warning)
  status-warning-dark: '#f0ad4e'      # derived
  status-warning-on: '#3c4552'        # derived: text and icons on status-warning
  status-warning-on-dark: '#1b2230'   # derived
  status-info: '#0081a1'              # derived: notification bar fill (legacy @background-color-info, darkened)
  status-info-dark: '#009ec4'         # derived
  status-info-on: '#ffffff'           # derived: text and icons on status-info
  status-info-on-dark: '#1b2230'      # derived
  scrollbar-thumb: '#d3dae4'
  scrollbar-thumb-dark: '#323c4d'
  scrim: '#1e283c59'                  # rgba(30, 40, 60, 0.35) behind search overlay and modals
  scrim-dark: '#04070cb3'
  focus-ring: '#2f7cf6'               # dedicated focus ring colour, drawn two-tone with a surface-panel halo
  focus-ring-dark: '#74a9ff'
  inverse-surface: '#3c4552'          # toast fill
  inverse-surface-dark: '#e4e9f1'
  inverse-text: '#ffffff'             # toast text and action
  inverse-text-dark: '#1b2230'
  # Categorical palette: 8 roles per theme (folder tints, avatar initials backgrounds, calendar chips).
  # Light 1-4: Loft source pastels. Light 5-8: derived in OKLCH (L 0.880, C 0.049); hand-check pending.
  category-1: '#c9d7f2'               # blue-grey, H 264 (Loft "Office" folder)
  category-1-dark: '#8a9fc8'
  category-2: '#d9c9f2'               # purple, H 303 (Loft "Private" folder)
  category-2-dark: '#a695c0'
  category-3: '#f2c9dc'               # pink, H 349 (Loft "Newsletter" folder)
  category-3-dark: '#be8ea5'
  category-4: '#c9e9d3'               # green, H 155 (Loft "Travel" folder)
  category-4-dark: '#7eab8d'
  category-5: '#f6ccc4'               # peach, H 31 (derived)
  category-5-dark: '#c49086'
  category-6: '#ead4b4'               # sand, H 76 (derived)
  category-6-dark: '#b69971'
  category-7: '#d2ddba'               # sage, H 121 (derived)
  category-7-dark: '#98a578'
  category-8: '#b3e1ea'               # cyan, H 211 (derived)
  category-8-dark: '#6daab5'
typography:
  # THEME tokens: the theme owns typeface, type ramp and line height. Loft theme values.
  # Sizes are at text size 100%; the text-size setting scales every fontSize.
  wordmark:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 22px
    fontWeight: '600'
    letterSpacing: 0.01em
  heading-reading:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 26px
    fontWeight: '600'
    letterSpacing: 0.01em
  heading-view:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 24px
    fontWeight: '600'
    letterSpacing: 0.01em
  heading-rail:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 17px
    fontWeight: '600'
    letterSpacing: 0.01em
  heading-section:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 16px
    fontWeight: '600'
    letterSpacing: 0.01em
  title-row:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 15px
    fontWeight: '600'
    letterSpacing: 0.01em
  title-row-read:
    # Message-row subject, read. 400 in a theme whose face has no variable weight axis.
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 15px
    fontWeight: '500'
    letterSpacing: 0.01em
  title-row-unread:
    # Message-row subject, unread. 700 in a theme whose face has no variable weight axis.
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 15px
    fontWeight: '650'
    letterSpacing: 0.01em
  body-reading:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.8'
    letterSpacing: 0.01em
  label-nav:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 15px
    fontWeight: '400'
    letterSpacing: 0.01em
  label-control:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 14px
    fontWeight: '500'
    letterSpacing: 0.01em
  input:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 14px
    fontWeight: '400'
    letterSpacing: 0.01em
  input-search-overlay:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 18px
    fontWeight: '400'
    letterSpacing: 0.01em
  body-sm:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0.01em
  name-sm:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 13px
    fontWeight: '600'
    letterSpacing: 0.01em
  meta:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 12px
    fontWeight: '400'
    letterSpacing: 0.01em
  badge:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 12px
    fontWeight: '600'
    letterSpacing: 0.01em
  label-search-section:
    # Uppercase. Search overlay group labels (Messages, Contacts, Events).
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 11px
    fontWeight: '600'
    letterSpacing: 0.08em
  caption:
    fontFamily: 'Jost Variable, Jost, Avenir Next, system-ui, sans-serif'
    fontSize: 11px
    fontWeight: '400'
    letterSpacing: 0.01em
rounded:
  # STYLE tokens: the style owns radius. Loft style values (--radius-md/lg/xl plus values named in loft-DESIGN.md).
  hit: 3px       # search-hit <mark>
  md: 10px       # attachment thumbnails
  image: 12px    # inner cards, hero images
  lg: 14px       # selected message card
  compose: 16px  # compose card
  xl: 18px       # app card, reading card, search overlay, modals
  full: 999px    # pills, icon buttons, badges, avatars
spacing:
  # STYLE tokens: the style owns spacing; density scales it. Loft style at Comfortable density.
  # Density multiplies row-padding-block, row-padding-inline, row-gap and control-height (x0.75 / x1 / x1.25).
  app-inset-block: 28px
  app-inset-inline: 32px
  top-bar-height: 72px
  sidebar-width: 236px
  list-width: 380px
  rail-width: 280px
  row-padding-block: 18px
  row-padding-inline: 22px
  row-gap: 14px
  list-row-min-height: 44px      # floor for Loft's multi-line message rows at every density
  reading-card-margin: 24px
  reading-measure: 640px
  subject-margin-block: 18px     # reading-card subject, above and below
  control-height: 44px
  control-padding-inline: 26px
  primary-button-width: 180px    # sidebar primary pill
  search-height: 40px
  search-width: 440px
  overlay-width: 640px
  overlay-input-height: 48px
  icon-button: 36px
  compose-width: 560px
  avatar-row: 44px               # message row
  avatar-header: 40px            # reading-card header
  avatar-chip: 36px              # account chip, people in conversation
  avatar-detail: 72px            # contact detail card
  rail-thumb: 64px               # right-rail attachment thumbnail
  badge-height: 22px
  badge-min-width: 30px
  presence-dot: 10px
  selected-overhang: 10px        # selected card overhang past the list's inline-end edge
  focus-ring-width: 2px
  focus-ring-offset: 2px
  focus-ring-halo: 1px           # surface-panel halo outside the ring
  appearance-mini-preview: 160px
components:
  # shadow values name a theme shadow role (shadow-card, shadow-soft, shadow-accent); see Elevation & Depth.
  app-frame:
    background: '{colors.surface-app}'
    padding-block: '{spacing.app-inset-block}'
    padding-inline: '{spacing.app-inset-inline}'
  app-card:
    background: '{colors.surface-panel}'
    radius: '{rounded.xl}'
    shadow: shadow-card
  top-bar:
    height: '{spacing.top-bar-height}'
    background: '{colors.surface-toolbar}'
    wordmark: '{typography.wordmark}'
    wordmark-color: '{colors.text-on-toolbar}'
  search-pill:
    background: '{colors.surface-field}'
    height: '{spacing.search-height}'
    width: '{spacing.search-width}'
    radius: '{rounded.full}'
    placeholder: '{colors.text-secondary}'
  account-chip:
    avatar-size: '{spacing.avatar-chip}'
    name: '{typography.name-sm}'
    name-color: '{colors.text-strong}'
    email: '{typography.caption}'
    email-color: '{colors.text-secondary}'
  sidebar:
    width: '{spacing.sidebar-width}'
    background: '{colors.surface-sidebar}'
    heading: '{typography.heading-section}'
    heading-color: '{colors.text-strong}'
  button-primary:
    background: '{colors.accent-default}'
    background-hover: '{colors.accent-hover}'
    foreground: '{colors.accent-on}'
    height: '{spacing.control-height}'
    padding-inline: '{spacing.control-padding-inline}'
    radius: '{rounded.full}'
    type: '{typography.label-control}'
    shadow: shadow-accent
  button-secondary:
    background: '{colors.surface-panel}'
    foreground: '{colors.text-default}'
    foreground-hover: '{colors.text-strong}'
    height: '{spacing.control-height}'
    radius: '{rounded.full}'
    type: '{typography.label-control}'
    shadow: shadow-soft
  icon-button:
    size: '{spacing.icon-button}'
    radius: '{rounded.full}'
    foreground: '{colors.icon-default}'
    background-hover: '{colors.surface-hover}'
    foreground-hover: '{colors.text-strong}'
    foreground-active: '{colors.accent-text}'
  focus-ring:
    color: '{colors.focus-ring}'
    halo: '{colors.surface-panel}'
    width: '{spacing.focus-ring-width}'
    offset: '{spacing.focus-ring-offset}'
    halo-width: '{spacing.focus-ring-halo}'
  badge:
    background: '{colors.accent-tint}'
    foreground: '{colors.accent-text}'
    height: '{spacing.badge-height}'
    min-width: '{spacing.badge-min-width}'
    radius: '{rounded.full}'
    type: '{typography.badge}'
  nav-item:
    type: '{typography.label-nav}'
    foreground: '{colors.text-on-sidebar}'
    foreground-active: '{colors.text-on-sidebar-active}'
    icon: '{colors.icon-default}'
  message-row:
    padding-block: '{spacing.row-padding-block}'
    padding-inline: '{spacing.row-padding-inline}'
    gap: '{spacing.row-gap}'
    min-height: '{spacing.list-row-min-height}'
    avatar-size: '{spacing.avatar-row}'
    initials-color: '{colors.text-on-category}'
    subject: '{typography.title-row-read}'
    subject-unread: '{typography.title-row-unread}'
    subject-color: '{colors.text-strong}'
    sender: '{typography.body-sm}'
    sender-color: '{colors.text-secondary}'
    snippet: '{typography.body-sm}'
    snippet-color: '{colors.text-snippet}'
    time: '{typography.meta}'
    time-color: '{colors.text-secondary}'
    unread-dot: '{colors.accent-default}'
    background-hover: '{colors.surface-panel}'
    shadow-hover: shadow-soft
  message-row-selected:
    background: '{colors.accent-default}'
    foreground: '{colors.accent-on}'
    unread-dot: '{colors.accent-on}'
    snippet-opacity: '0.8'
    radius: '{rounded.lg}'
    overhang-inline-end: '{spacing.selected-overhang}'
    shadow: shadow-accent
  reading-card:
    background: '{colors.surface-panel}'
    radius: '{rounded.xl}'
    margin: '{spacing.reading-card-margin}'
    shadow: shadow-card
    avatar-size: '{spacing.avatar-header}'
    subject: '{typography.heading-reading}'
    subject-margin-block: '{spacing.subject-margin-block}'
    date: '{typography.meta}'
    date-color: '{colors.text-secondary}'
    body: '{typography.body-reading}'
    body-color: '{colors.text-reading}'
    measure: '{spacing.reading-measure}'
  right-rail:
    width: '{spacing.rail-width}'
    divider: '{colors.border-subtle}'
    heading: '{typography.heading-rail}'
    thumb-size: '{spacing.rail-thumb}'
    thumb-radius: '{rounded.md}'
    email: '{typography.meta}'
    email-color: '{colors.text-secondary}'
    timeline: '{typography.meta}'
    timeline-current: '{colors.accent-text}'
  presence-dot:
    background: '{colors.status-success}'
    size: '{spacing.presence-dot}'
    ring: '{colors.surface-panel}'
  search-overlay:
    scrim: '{colors.scrim}'
    background: '{colors.surface-panel}'
    width: '{spacing.overlay-width}'
    radius: '{rounded.xl}'
    input-height: '{spacing.overlay-input-height}'
    input: '{typography.input-search-overlay}'
    section-label: '{typography.label-search-section}'
    section-label-color: '{colors.text-secondary}'
    shadow: shadow-card
  search-hit:
    background: '{colors.highlight-bg}'
    foreground: '{colors.highlight-text}'
    radius: '{rounded.hit}'
  compose-card:
    background: '{colors.surface-panel}'
    width: '{spacing.compose-width}'
    radius: '{rounded.compose}'
    shadow: shadow-card
  toast:
    background: '{colors.inverse-surface}'
    foreground: '{colors.inverse-text}'
    radius: '{rounded.full}'
    type: '{typography.body-sm}'
    shadow: shadow-soft
  toast-error:
    # Same inverse pill as every toast; error is carried by a leading bar, an icon and the word "Error".
    background: '{colors.inverse-surface}'
    foreground: '{colors.inverse-text}'
    bar: '{colors.status-danger}'
    icon: '{colors.status-danger}'
  modal:
    # Shared component: theme surface, the style's radius. Loft values (loft-global.css .modal-card).
    scrim: '{colors.scrim}'
    background: '{colors.surface-panel}'
    radius: '{rounded.xl}'
    shadow: shadow-card
  popover:
    # Shared component: theme surface, the style's radius. Loft: one step quieter than modals.
    background: '{colors.surface-panel}'
    radius: '{rounded.lg}'
    shadow: shadow-soft
  appearance-preview:
    background: '{colors.surface-sunken}'
    radius: '{rounded.xl}'
  appearance-mini-preview:
    height: '{spacing.appearance-mini-preview}'
  apply-bar:
    revert: '{components.button-secondary}'
    apply: '{components.button-primary}'
---

# Theme and style system — Design Spine

> **Structure of this file.** This product has no single visual identity. It has a token contract that nine built-in themes fill in and five built-in styles read. The frontmatter splits along the ownership rule (see Brand & Style):
>
> - `colors` and `typography` are **theme** tokens: the roles every theme must define. Plain keys hold **Loft theme, light mode, standard contrast**; `-dark` keys hold **Loft dark (Night Slate), standard contrast**. High-contrast values are in Colors › High-contrast values. Shadows are theme tokens too. The spec frontmatter has no shadow group, so the three shadow roles are listed with their values in Elevation & Depth, and `components` names them by role (`shadow: shadow-card`).
> - `rounded` and `spacing` are **style** tokens: the **Loft style** at **Comfortable** density.
> - `components` combines the two for the Loft style rendering the Loft theme.
>
> Token keys are flat kebab-case (`colors.surface-app`), as `references/design-md-spec.md` requires. Theme files are W3C DTCG JSON and may nest the same roles (`surface.app`); the architecture ratifies the runtime mapping (likely DTCG to CSS custom properties).
>
> **Spines win.** Where this file and any mockup or import disagree, this file wins. The reference images, the scale they are checked at and the key-screen mocks are in Layout & Spacing › Loft style layout › Reference scale.

## Brand & Style

Nylas Mail is an open-source Electron mail client getting its first public release, one that people will install. The theme and style system covers how the client looks. It has four independent axes that mix freely:

| Axis | Owns | Values |
|---|---|---|
| **Style** | Layout, region placement, radius (component shapes), spacing, row heights per density, the title bar, its minimum window width | Classic, Loft, Taiga, Darkside, Less-is-more |
| **Theme** | Colour (including an 8-colour categorical palette), typography (typeface, type ramp, line height), shadow (tinted by the theme's colours). Each ships light and dark mode at standard and high contrast | Classic, Aubergine, Taiga, Darkside, Less-is-more, Loft, Volt, Ember, Dusk |
| **Density** | A multiplier on the style's spacing roles, and the style's row height for that density | Compact, Comfortable, Spacious (see Layout & Spacing) |
| **Accessibility** | Increase contrast, text size (87.5–150%), font override | Apply on top of any style and theme |

Free mix is the rule that matters most: any theme works with any style at any density. A style reads only shared role tokens. It never reads a theme's hex values or names a theme. A theme never changes layout, corners or spacing. Shape and rhythm are structural, so Loft stays pill-shaped under any theme, and the Less-is-more theme on the Loft style gets Loft's corners with Less-is-more's colours, type and shadows. [`mockups/key-free-mix.html`](mockups/key-free-mix.html) shows the rule on one mail screen in three crosses: Loft style with the Taiga theme, Classic style with Ember, and Less-is-more style with Volt at Compact. Its Classic and Less-is-more arrangements are illustrative only; those styles' layouts are set in their own style specs (see Open Questions).

**The style contract.** A style arranges shared components into fixed regions and sets radius and spacing through CSS only. The rules, the region list and the fallback for community styles are in `EXPERIENCE.md` › Style Contract.

Of the six legacy LESS themes, `ui-light` and `ui-dark` merge into one **Classic** theme (light mode from `ui-light`, dark mode from `ui-dark`), and `ui-ubuntu` becomes the **Aubergine** theme. `ui-taiga`, `ui-darkside` and `ui-less-is-more` each become a style plus a matching theme. Loft is a new style and theme taken from a reference mockup. **Volt**, **Ember** and **Dusk** are new dark-first built-in themes from the Loft dark palette study ([`mockups/color-themes-loft-dark.html`](mockups/color-themes-loft-dark.html)). The Classic style is the current three-pane layout.

Loft is the first style built against the new token layer. It also sets the default look: onboarding offers it first and skipping onboarding lands on it. Its look is light and airy: a white app card floating on a cool grey-blue ground, Jost geometric type, one blue accent with a coloured shadow, pill-shaped controls, and separation by tint and shadow instead of borders. "Loft" is only the name of the style and theme. Loft's top bar shows the app's own mark: the Nylas Mail logo and name, or the fork's name if the app is rebranded.

Each theme matches its reference exactly at standard contrast (Loft matches the mockup exactly), even where that fails WCAG AA. This is an accepted risk with safeguards (see Colors › Contrast pairs). Accessibility comes from the app-wide **Increase contrast** setting, which swaps every theme to its high-contrast variant.

## Colors

### Role tokens

The frontmatter `colors` block is the contract. Every theme defines every role for each of its four variants (light and dark, each at standard and high contrast). The other built-ins' standard-contrast values are in the Built-in theme role table below.

| Role | Loft light | Night Slate | Used for | Not used for |
|---|---|---|---|---|
| `surface-app` | `#e9edf5` | `#0f141c` | Window ground behind the app card | Panels |
| `surface-panel` | `#ffffff` | `#1b2230` | App card, reading card, overlays, hovered list row | — |
| `surface-sunken` | `#f3f6fb` | `#141a25` | Message list column, reading area, contacts ground | Cards |
| `surface-hover` | `#eef2f8` | `#252d3c` | Icon-button hover, quiet fills | Selection |
| `surface-field` | `#f1f4f9` | `#212938` | Search pill and text-field fill | — |
| `surface-sidebar` | `#ffffff` | `#1b2230` | The nav region (Darkside's dark sidebar) | Content panes |
| `surface-toolbar` | `#ffffff` | `#1b2230` | The top bar or toolbar region (Aubergine's dark toolbar) | Content panes |
| `border-subtle` | `#eef1f6` | `#283142` | Hairline dividers (Loft: the right-rail divider only) | Boundaries that must be seen |
| `border-strong` | `#86888d` (derived) | `#616c7f` (derived) | Bordered cards and outlined selection (Taiga), and the 1px borders Increase contrast adds where separation is by shadow or tint only. Must reach 3:1 in high contrast | Decoration |
| `control-border` | `#e6ebf2` | `#2a3140` (derived) | The 1px ring of Appearance style cards and theme swatches at rest | Boundaries that must be seen at standard contrast |
| `control-track` | `#d3dae4` | `#373f4e` (derived) | A switch's off track; the style-card and theme-swatch ring on hover | Text, icons |
| `text-strong` | `#3c4552` | `#e4e9f1` | Headings, subjects, names | Body copy |
| `text-default` | `#5b6572` | `#a9b2c1` | UI text, secondary button label | — |
| `text-secondary` | `#9aa4b2` | `#76818f` | Sender, timestamps, search section labels, placeholders | Long reading text |
| `text-faint` | `#c0c8d2` | `#4d5768` | Disabled text | Anything that must be read |
| `text-snippet` | `#a7b0bd` | `#6a7585` | Two-line list snippet | — |
| `text-reading` | `#8b95a5` | `#8f99a9` | Plain-text email body in the reading card | UI chrome |
| `text-on-sidebar` | `#9aa4b2` | `#76818f` | Nav labels on `surface-sidebar` | — |
| `text-on-sidebar-active` | `#2f7cf6` | `#3a83f7` | Active nav label on `surface-sidebar` | — |
| `text-on-toolbar` | `#3c4552` | `#e4e9f1` | Wordmark and labels on `surface-toolbar` | — |
| `text-on-category` | `#5b6572` | `#1b2230` | Avatar initials and calendar-chip labels on `category-*` fills | — |
| `icon-default` | `#9aa4b2` | `#7a8596` | Resting icons | — |
| `accent-default` | `#2f7cf6` | `#3a83f7` | Accent **fills**: Compose and Reply buttons, selected row, unread dot | Text (use `accent-text`) |
| `accent-hover` | `#1e63d0` | `#5a99ff` | Accent fill hover | — |
| `accent-tint` | `#eef3fd` | `#1d2d4b` | Count badges, quiet accent fills | Text |
| `accent-on` | `#ffffff` | `#ffffff` | Text and icons on `accent-default`. Stays white on accent fills in high contrast | Text on any other fill |
| `accent-text` | `#2f7cf6` | `#3a83f7` | Accent-coloured **text**: active nav, links, badge text, current timeline item, active icons | Fills |
| `highlight-bg` / `highlight-text` | `#d7e6ff` / `#1e63d0` | `#24426f` / `#acc9ff` | Search-hit `<mark>` | — |
| `status-danger` | `#e5484d` | `#ef5a5f` | The error toast's leading bar and icon, the bell's notification dot | A fill under text |
| `status-success` | `#30c463` | `#34c96a` | Presence dot | — |
| `status-warning` / `status-warning-on` | `#f0ad4e` / `#3c4552` (derived) | `#f0ad4e` / `#1b2230` (derived) | {colors.status-warning} fills the warning bar, with its text and icon in {colors.status-warning-on} | — |
| `status-info` / `status-info-on` | `#0081a1` / `#ffffff` (derived) | `#009ec4` / `#1b2230` (derived) | {colors.status-info} fills the notification bar, with its text and icon in {colors.status-info-on} | — |
| `scrollbar-thumb` | `#d3dae4` | `#323c4d` | Scrollbars | — |
| `scrim` | `#1e283c59` | `#04070cb3` | Behind the search overlay and modals | — |
| `focus-ring` | `#2f7cf6` | `#74a9ff` | Focus ring, drawn two-tone with a `surface-panel` halo | Decoration |
| `inverse-surface` / `inverse-text` | `#3c4552` / `#ffffff` | `#e4e9f1` / `#1b2230` | Toast fill and toast text and action | — |
| `category-1` … `category-8` | see below | see below | Folder tints, avatar initials backgrounds, calendar event chips | Status, selection, text |

Where `loft-DESIGN.md` and `loft-global.css` differ, the CSS values win; the differences are too small to see. The Inbox count badge uses `{colors.accent-tint}` (`#eef3fd`, not the spec's `#eef3fb`), the separation tint is `{colors.surface-sunken}` (`#f3f6fb`, not `#f5f7fb`), and the reading-card date uses `{typography.meta}` (12px, not 13px). The search pill fill `#f1f4f9` exists only in `loft-DESIGN.md`, so it gets its own role, `surface-field`. The Loft values for the roles this spine adds come from the Loft sources (sidebar and top bar are white; nav labels are `--text-soft`; the active nav is `--blue`; the toast is `--text-strong` with white text) and from the `.th-light` block of [`mockups/color-themes-loft-dark.html`](mockups/color-themes-loft-dark.html) (`focus-ring`, `inverse-*`, initials `#5b6572`). Night Slate's sidebar, toolbar and initials take the values of the roles the dark mockup renders them with.

`border-strong` has no source value for Loft light or Night Slate at standard contrast, so both are derived: {colors.border-strong} and its dark twin reach 3:1 against `surface-panel`, `surface-sunken` and `surface-app` (rules and ratios in Derived values pending hand-check). Night Slate's high-contrast value is `#6a7586`, the colour its card edges use in the dark mockup.

`control-border` and `control-track` carry the two greys the Appearance mockup draws its controls with ([`mockups/appearance-directions.html`](mockups/appearance-directions.html): the card and swatch ring, and the switch's off track). The Loft light values are the mockup's. Night Slate's are derived in OKLCH from its panel (rule in Derived values pending hand-check). In high contrast both roles take the variant's `border-strong` value, so they reach 3:1. At standard contrast they sit below 3:1, which the mockup-exact policy allows (see Contrast pairs).

`status-warning` and `status-info` carry the legacy warning and notification bars, which belong to the notifications feature. Every theme defines both, each with an on-colour role (`status-warning-on`, `status-info-on`) for the bar's text and icons. Loft and the dark palettes have no source of their own, so their values are derived from the legacy colours.

### Categorical palette

Each theme defines an 8-colour categorical palette, with values for light, dark and high contrast. Folder icon tints, avatar initials backgrounds and calendar event chips all draw from it, with labels in `{colors.text-on-category}`.

| Role | Loft light | Night Slate | Source (light) |
|---|---|---|---|
| `{colors.category-1}` | `#c9d7f2` blue-grey | `#8a9fc8` | Loft "Office" folder tint |
| `{colors.category-2}` | `#d9c9f2` purple | `#a695c0` | Loft "Private" folder tint |
| `{colors.category-3}` | `#f2c9dc` pink | `#be8ea5` | Loft "Newsletter" folder tint |
| `{colors.category-4}` | `#c9e9d3` green | `#7eab8d` | Loft "Travel" folder tint |
| `{colors.category-5}` | `#f6ccc4` peach | `#c49086` | Derived |
| `{colors.category-6}` | `#ead4b4` sand | `#b69971` | Derived |
| `{colors.category-7}` | `#d2ddba` sage | `#98a578` | Derived |
| `{colors.category-8}` | `#b3e1ea` cyan | `#6daab5` | Derived |

Light colours 5–8 were derived in OKLCH at the mean lightness and chroma of Loft's four pastels (L 0.880, C 0.049). Their hues (31°, 76°, 121°, 211°) fill the free slots of a 45° grid that the four source hues (155°, 264°, 303°, 349°) already sit close to. All four are in sRGB gamut and still need the hand-check (a build task, Open Questions 6). Night Slate's values come from the dark mockup.

Assignment: avatar initials take their colour from a hash of the email address (`avatarColor(email)` in the Loft source). A folder or calendar takes its colour from a hash of its **id**, so a rename keeps its colour. The user can override the colour of any folder or calendar; the override is stored as a palette index (1–8) keyed by the folder's or calendar's id, never as a hex, so it resolves in every theme and variant.

### Variants: modes, contrast levels, derivation

- **Every built-in ships all four variants.** Light and dark, each at standard and high contrast: 9 themes × 2 modes × 2 contrast levels = 36 token sets. Where no source exists, the variant is derived in OKLCH and hand-checked. Built-ins never show the "derived" badge. They are bundled, so they can't fail to load.
- **Designed, not derived.** The dark modes for Darkside and Less-is-more and the light modes for Volt, Ember and Dusk must be designed. The build tasks are in Open Questions 6.
- **Behaviour.** How a third-party theme's missing variants and roles are derived, badged and checked against Contrast pairs is in `EXPERIENCE.md` › Theme Authoring › Partial themes. How Mode follows the OS and how Increase contrast swaps to the high-contrast variant is in `EXPERIENCE.md` › Interaction Primitives and › Accessibility Floor.

### Contrast pairs

The automated sweep (`EXPERIENCE.md` › Verification Matrix) checks these pairs directly. Every high-contrast variant must pass all of them; at standard contrast themes match their reference, so failures there are expected and recorded. Thresholds: 4.5:1 for text, 3:1 for large text (24px, or 18.66px at weight 600), icons, focus rings and boundaries. This table owns the AA thresholds; other sections link here.

| Foreground | Background | Where | Min | Loft light | Loft light HC | Night Slate | Night Slate HC |
|---|---|---|---|---|---|---|---|
| `text-default` | `surface-panel` | UI text, secondary button | 4.5 | 5.92 | 5.92 | 7.45 | 12.62 |
| `text-default` | `surface-sunken` | UI text in the list column | 4.5 | 5.46 | 5.46 | 8.16 | 13.39 |
| `text-strong` | `surface-panel` | Headings, subjects, names; the Increase contrast row label | 4.5 | 9.70 | 9.70 | 13.07 | 16.05 |
| `text-strong` | `surface-sunken` | List subjects | 4.5 | 8.95 | 8.95 | 14.30 | 17.02 |
| `text-secondary` | `surface-panel` | Dates, rail emails, section labels | 4.5 | 2.52 | 5.01 | 4.03 | 8.23 |
| `text-secondary` | `surface-sunken` | Sender, time | 4.5 | 2.33 | 4.63 | 4.41 | 8.73 |
| `text-secondary` | `surface-field` | Search placeholder | 4.5 | 2.29 | 4.55 | 3.69 | 7.51 |
| `text-snippet` | `surface-sunken` | List snippet | 4.5 | 2.02 | 4.55 | 3.73 | 8.07 |
| `text-reading` | `surface-panel` | Plain-text email body | 4.5 | 3.03 | 5.01 | 5.54 | 10.88 |
| `text-on-sidebar` | `surface-sidebar` | Nav labels | 4.5 | 2.52 | 5.01 | 4.03 | 8.23 |
| `text-on-sidebar-active` | `surface-sidebar` | Active nav label | 4.5 | 3.94 | 5.04 | 4.38 | 7.81 |
| `text-on-toolbar` | `surface-toolbar` | Wordmark, toolbar labels | 4.5 | 9.70 | 9.70 | 13.07 | 16.05 |
| `accent-text` | `surface-panel` | Links, current timeline item | 4.5 | 3.94 | 5.04 | 4.38 | 7.81 |
| `accent-text` | `accent-tint` | Count badge | 4.5 | 3.54 | 4.53 | 3.77 | 5.79 |
| `accent-on` | `accent-default` | Primary buttons, selected row | 4.5 | 3.94 | 4.54 | 3.64 | 4.55 |
| `accent-on` | `accent-hover` | Primary button hover | 4.5 | 5.60 | 5.60 | 2.82 | 5.96 |
| `highlight-text` | `highlight-bg` | Search hits | 4.5 | 4.44 | 4.50 | 6.02 | 8.54 |
| `inverse-text` | `inverse-surface` | Toasts, including the error toast's "Error" | 4.5 | 9.70 | 9.70 | 13.07 | 17.19 |
| `status-warning-on` | `status-warning` | Warning bar | 4.5 | 4.98 | 4.98 | 8.19 | 9.49 |
| `status-info-on` | `status-info` | Notification bar | 4.5 | 4.51 | 4.51 | 5.07 | 5.88 |
| `text-on-category` | `category-1` … `category-8` | Avatar initials, calendar chips | 4.5 | 3.83–4.53 | 4.52–5.35 | 5.77–6.14 | 9.52–10.22 |
| `icon-default` | `surface-panel` | Resting icons | 3 | 2.52 | 3.27 | 4.27 | 8.23 |
| `icon-default` | `surface-sunken` | Icons in the list column | 3 | 2.33 | 3.02 | 4.67 | 8.73 |
| `accent-default` | `surface-panel` | Unread dot, accent fills against the card | 3 | 3.94 | 4.54 | 4.38 | 3.79 |
| `focus-ring` | `surface-panel` / `surface-sunken` / `surface-app` | Focus ring (the `surface-panel` halo carries it on accent fills) | 3 | 3.94 / 3.63 / 3.35 | 3.94 / 3.63 / 3.35 | 6.72 / 7.36 / 7.79 | 10.31 / 10.93 / 11.55 |
| `status-success` | `surface-panel` | Presence dot (also carried by a text label) | 3 | 2.28 | 3.03 | 7.37 | 9.66 |
| `status-danger` | `inverse-surface` | Error toast bar and icon (the word "Error" also carries it) | 3 | 2.48 | 3.00 | 2.73 | 3.00 |
| `status-danger` | `surface-toolbar` | Bell notification dot | 3 | 3.91 | 3.23 | 4.78 | 5.34 |
| `border-strong` | `surface-panel` / `surface-sunken` / `surface-app` | Increase-contrast borders, bordered cards | 3 | 3.55 / 3.27 / 3.02 | 3.55 / 3.27 / 3.02 | 3.00 / 3.29 / 3.48 | 3.70 / 3.92 / 4.14 |
| `control-border` | `surface-panel` | Style-card and theme-swatch ring at rest | 3 | 1.20 | 3.55 | 1.22 | 3.70 |
| `control-track` | `surface-panel` | Switch off track; card and swatch ring on hover | 3 | 1.41 | 3.55 | 1.50 | 3.70 |
| `scrollbar-thumb` | `surface-sunken` | Scrollbar thumb (high contrast only) | 3 | 1.30 | 3.00 | 1.57 | 3.10 |

Every Loft light HC and Night Slate HC cell passes. Derived cells (Loft light HC; `border-strong`, Night Slate `control-border` and `control-track`, and the status pairs at standard; Night Slate HC `accent-default`, `accent-hover` and `status-danger`) are pending the hand-check. Volt, Ember and Dusk's derived pairs, and the other built-ins' derived values (Built-in role completion), are measured in Derived values pending hand-check. Corrected values are in the Corrected mapping errors table (Colors › Built-in theme role table). The sweep measures every other pair at standard contrast. At standard contrast the error toast's bar and icon fall short (2.48:1 in Loft light, 2.73:1 in Night Slate); the word "Error" in `inverse-text` still carries the meaning. `text-faint` is used only for disabled text, which WCAG exempts.

At standard contrast `control-border` and `control-track` sit below WCAG 1.4.11's 3:1 for non-text contrast (1.20–1.50:1), as the mockup-exact policy allows. They never carry state alone: the selected card or swatch has a 2px `{colors.accent-default}` ring and a text tag, and a switch that is on has an accent track. In high contrast both take `border-strong` and pass.

**Accepted risk: mockup-exact contrast at standard.** The default look (Loft light) fails AA for secondary, snippet and reading text, accent text and button labels (2.02–4.44:1 above). This is deliberate, with two safeguards:

1. The onboarding looks step offers Increase contrast, so the switch is reachable before the inbox (see `EXPERIENCE.md` › Key Flows).
2. The Increase contrast control's own label is drawn in `{colors.text-strong}` on `{colors.surface-panel}`, a pair every theme variant must pass at 4.5:1, so the way out is always readable.

### Forced colours and Increase contrast borders

- **Forced colours** (Windows Contrast themes, GNOME high contrast) are honoured: CSS system colours replace the theme's roles, shadows and tints are dropped, and boundaries are drawn as 1px borders.
- **Increase contrast** also adds a 1px `border-strong` border wherever separation is by shadow or tint only (Loft's app card, reading card, secondary pills, search pill, list column).
- **Hairlines** are 1 device pixel at every scale factor.
- **Scrollbars**: `{colors.scrollbar-thumb}` reaches 3:1 against `{colors.surface-sunken}` in high-contrast variants.

### Theme catalogue

Built-ins are listed first; installed third-party themes follow alphabetically (see `EXPERIENCE.md` › Information Architecture).

| Theme | Origin | Typeface | Source modes | Build task |
|---|---|---|---|---|
| **Classic** | `ui-variables.less` + `ui-light` (light), `ui-dark` (dark) | System UI font in the open-source build; Nylas-Pro only when the private `nylas-private-fonts` package is present | Light and dark | Derive and hand-check both high-contrast variants |
| **Aubergine** | `ui-ubuntu` (renamed: trademark) | Ubuntu (bundled, UFL) | Light | Derive and hand-check dark and both high-contrast variants |
| **Taiga** | `ui-taiga` | Legacy stack (`Nylas-Pro`, `Helvetica`: Taiga sets no font of its own), so the Classic rule applies | Light | Derive and hand-check dark and both high-contrast variants |
| **Darkside** | `ui-darkside` | Legacy stack, Classic rule | Light content with a dark sidebar | **Design a dark mode**; hand-check both high-contrast variants |
| **Less-is-more** | `ui-less-is-more` | Legacy stack, Classic rule | Light | **Design a dark mode**; hand-check both high-contrast variants |
| **Loft** | `imports/loft-global.css` (light); Night Slate (dark) | Jost (bundled, OFL) | Light; dark standard and high contrast | Hand-check the derived light high contrast |
| **Volt** | OLED Volt in [`mockups/color-themes-loft-dark.html`](mockups/color-themes-loft-dark.html#oled) | Inter (bundled, OFL) | Dark standard and high contrast | **Design a light mode**; hand-check all four variants |
| **Ember** | Ember Charcoal, same file ([#ember](mockups/color-themes-loft-dark.html#ember)) | Source Serif (bundled, OFL) for reading text: the email body and the reading-card subject. Inter for the UI chrome | Dark standard and high contrast | **Design a light mode**; hand-check all four variants |
| **Dusk** | Dusk Float, same file ([#dusk](mockups/color-themes-loft-dark.html#dusk)) | Jost (bundled, OFL) | Dark standard and high contrast | **Design a light mode**; hand-check all four variants |

Typefaces are set in Typography. The build tasks are collected in Open Questions 6.

### High-contrast values

Loft light high contrast has no authored source, so by the built-in variant rule it is derived in OKLCH from Loft light. Roles that already pass their pairs keep their Loft light value; the rest move in lightness only as far as their pairs need.

Loft dark high contrast is Night Slate high contrast, from [`mockups/color-themes-loft-dark.html`](mockups/color-themes-loft-dark.html#night), with the `accent-text` split applied: the mockup's high-contrast accent (`#7cb0ff`) becomes `accent-text`, `accent-on` stays white on accent fills, and `accent-default` and `accent-hover` are derived dark enough to carry white text.

"(d)" marks a derived value. Every one is listed, with its rule and measured ratios, in Derived values pending hand-check.

| Role | Loft light high contrast | Night Slate high contrast |
|---|---|---|
| `surface-app` | `#e9edf5` | `#0a0e15` |
| `surface-panel` | `#ffffff` | `#151b27` |
| `surface-sunken` | `#f3f6fb` | `#10151e` |
| `surface-hover` | `#eef2f8` | `#212938` |
| `surface-field` | `#f1f4f9` | `#1c2331` |
| `surface-sidebar` | `#ffffff` | `#151b27` |
| `surface-toolbar` | `#ffffff` | `#151b27` |
| `border-subtle` | `#86888d` (d) | `#6a7586` |
| `border-strong` | `#86888d` (d) | `#6a7586` |
| `control-border` / `control-track` | `#86888d` (d; `border-strong`) | `#6a7586` (`border-strong`) |
| `text-strong` | `#3c4552` | `#f4f7fb` |
| `text-default` | `#5b6572` | `#d6dde8` |
| `text-secondary` | `#67707d` (d) | `#aab4c3` |
| `text-faint` | `#c0c8d2` | `#959fae` |
| `text-snippet` | `#69717d` (d) | `#a3adbc` |
| `text-reading` | `#66707f` (d) | `#c6cedb` |
| `text-on-sidebar` / `-active` | `#67707d` (d) / `#1a69e2` (d) | `#aab4c3` / `#7cb0ff` |
| `text-on-toolbar` | `#3c4552` | `#f4f7fb` |
| `text-on-category` | `#515a67` (d) | `#0f141c` |
| `icon-default` | `#868f9d` (d) | `#aab4c3` |
| `accent-default` | `#2471ea` (d) | `#4576c1` (d) |
| `accent-hover` | `#1e63d0` | `#3363ac` (d) |
| `accent-tint` | `#eef3fd` | `#1f3254` |
| `accent-on` | `#ffffff` | `#ffffff` |
| `accent-text` | `#1a69e2` (d) | `#7cb0ff` |
| `highlight-bg` / `highlight-text` | `#d7e6ff` / `#1d62cf` (d) | `#2b4c82` / `#ffffff` |
| `status-danger` | `#f6595b` (d) | `#e4686f` (d; mockup `#ff8085`) |
| `status-success` | `#00ab4e` (d) | `#4cdb82` |
| `status-warning` / `status-warning-on` | `#f0ad4e` / `#3c4552` (d) | `#f0ad4e` / `#0f141c` (d) |
| `status-info` / `status-info-on` | `#0081a1` / `#ffffff` (d) | `#009ec4` / `#0f141c` (d) |
| `scrollbar-thumb` | `#898f99` (d) | `#5a6577` |
| `scrim` | `#1e283c59` | `#000000cc` |
| `focus-ring` | `#2f7cf6` | `#acc9ff` |
| `inverse-surface` / `inverse-text` | `#3c4552` / `#ffffff` | `#f4f7fb` / `#0f141c` |
| `category-1` … `category-4` | `#c9d7f2` `#d9c9f2` `#f2c9dc` `#c9e9d3` | `#a5beef` `#c7b3e6` `#e3aac5` `#97cda9` |
| `category-5` … `category-8` | `#f6ccc4` `#ead4b4` `#d2ddba` `#b3e1ea` | `#eaaca1` `#dab887` `#b6c68f` `#83cbd9` |

Volt, Ember and Dusk take their high-contrast values from the same mockup, with the same `accent-text` split: their mockup high-contrast `accent-on` is dark ink, which the contract no longer allows on accent fills, so `accent-on` becomes white and `accent-default` and `accent-hover` are derived to carry it. Their changed values are in Derived values pending hand-check.

### Built-in theme role table

Every built-in theme defines every role. This table gives each built-in's value for every role in the contract at **standard contrast**, for the modes that have a source today. Loft light and Night Slate aren't repeated here; their values are the frontmatter's. Markers:

- **L** legacy: the LESS source is in the mapping table below, same role, same theme.
- **M** mockup: [`mockups/color-themes-loft-dark.html`](mockups/color-themes-loft-dark.html) at standard contrast. Volt, Ember and Dusk render their sidebar and top bar on `surface-panel`, nav labels in `text-secondary`, the active nav in the accent, the app mark in `text-strong` and avatar initials in `inverse-text`; the matching roles take those values, as Night Slate's do.
- **D** derived (hand-check pending): a role the theme never had, derived to pass AA against its pair. Rules and ratios are in Derived values pending hand-check.
- **C** corrected: a mapped pair the legacy app never drew (a mapping error), corrected to pass AA (for a field, to stand at least 1.10:1 off the toolbar). Reasons are in Corrected mapping errors below.

| Role | Classic light | Classic dark | Aubergine light | Taiga light | Darkside light | Less-is-more light | Volt dark | Ember dark | Dusk dark |
|---|---|---|---|---|---|---|---|---|---|
| `surface-app` | `#f6f6f6` L | `#333539` L | `#f6f6f6` L | `#ffffff` L | `#f6f6f6` L | `#ffffff` L | `#000000` M | `#141210` M | `#1d2132` M |
| `surface-panel` | `#ffffff` L | `#333539` L | `#ffffff` L | `#ffffff` L | `#ffffff` L | `#ffffff` L | `#0c0d10` M | `#201d1a` M | `#2d3249` M |
| `surface-sunken` | `#fdfdfd` L | `#282828` L | `#fdfdfd` L | `#f0f7fa` L | `#f5f5f6` L | `#ffffff` L | `#050607` M | `#191714` M | `#24283b` M |
| `surface-hover` | `#f5f5f5` L | `#292929` L | `#f5f5f5` L | `#ddedf4` L | `#f5f5f5` L | `#fafafa` L | `#181a1f` M | `#2b2723` M | `#383e58` M |
| `surface-field` | `#ffffff` L | `#242424` L | `#ffffff` L | `#eff5f8` C | `#f3f3f4` C | `#f3f3f3` C | `#131519` M | `#27231f` M | `#333952` M |
| `surface-sidebar` | `#f6f7f8` L | `#282b30` L | `#f6f7f8` L | `#ffffff` L | `#313042` L | `#ffffff` L | `#0c0d10` M | `#201d1a` M | `#2d3249` M |
| `surface-toolbar` | `#e9e9e9` L | `#333539` L | `#41403b` L | `#ffffff` L | `#ffffff` L | `#ffffff` L | `#0c0d10` M | `#201d1a` M | `#2d3249` M |
| `border-subtle` | `#dddddd` L | `#313236` L | `#ffffff` L | `#dddddd` L | `#eaeaec` L | `#dddddd` L | `#1f2229` M | `#312c27` M | `#3b4159` M |
| `border-strong` | `#8e8e8e` D | `#7c7e82` D | `#8e8e8e` D | `#87939a` L | `#8e8e90` D | `#949494` D | `#5b5f67` D | `#6d6761` D | `#737b95` D |
| `control-border` | `#6d7987` L | `#7c7e82` C | `#6d7987` L | `#6d7987` L | `#6d7987` L | `#6d7987` L | `#1a1b1e` D | `#2f2c29` D | `#3d425a` D |
| `control-track` | `#77828d` L | `#888888` L | `#77828d` L | `#77828d` L | `#77828d` L | `#77828d` L | `#26272b` D | `#3c3936` D | `#4a5069` D |
| `text-default` | `#231f20` L | `#c0c6cb` L | `#231f20` L | `#697278` L | `#231f20` L | `#566c75` L | `#a8afba` M | `#b3aa9e` M | `#c4c8db` M |
| `text-strong` | `#434648` L | `#ffffff` L | `#434648` L | `#434648` L | `#434648` L | `#434648` L | `#f4f6f9` M | `#ede6dd` M | `#eff1fa` M |
| `text-secondary` | `#4f4c4d` L | `#a4a9ae` L | `#4f4c4d` L | `#9da5aa` L | `#4f4c4d` L | `#788991` L | `#6b737f` M | `#817970` M | `#878da7` M |
| `text-faint` | `#918f90` L | `#888c91` L | `#918f90` L | `#87939a` L | `#918f90` L | `#abb6ba` L | `#3b4049` M | `#56504a` M | `#5e647d` M |
| `text-snippet` | `#777475` L | `#8a8e91` L | `#777475` L | `#a2a8ab` L | `#777475` L | `#96a4a9` L | `#5f6772` M | `#756e65` M | `#7c839e` M |
| `text-reading` | `#231f20` L | `#eeeeee` L | `#231f20` L | `#697278` L | `#231f20` L | `#231f20` L | `#8b939f` M | `#9c9489` M | `#a2a8c0` M |
| `text-on-sidebar` | `#4f4c4d` L | `#a4a9ae` L | `#4f4c4d` L | `#87939a` L | `#9f9f9f` L | `#899fa8` L | `#6b737f` M | `#817970` M | `#878da7` M |
| `text-on-sidebar-active` | `#3187e1` L | `#5e6a77` L | `#f07441` L | `#556066` L | `#ffffff` L | `#566c75` L | `#2a72ff` M | `#4a8af0` M | `#5a8bff` M |
| `text-on-toolbar` | `#231f20` L | `#c0c6cb` L | `#f6f6f6` L | `#697278` L | `#231f20` L | `#231f20` L | `#f4f6f9` M | `#ede6dd` M | `#eff1fa` M |
| `text-on-category` | `#231f20` D | `#323438` D | `#231f20` D | `#525a60` D | `#231f20` D | `#475c65` D | `#000000` M | `#201d1a` M | `#24283b` M |
| `icon-default` | `#919191` L | `#919191` L | `#919191` L | `#919191` L | `#919191` L | `#919191` L | `#6b737f` M | `#857d73` M | `#8f95af` M |
| `accent-default` | `#419bf9` L | `#5e6a77` L | `#f07746` L | `#297daf` C | `#f18260` L | `#566c75` L | `#2a72ff` M | `#4a8af0` M | `#5a8bff` M |
| `accent-hover` | `#3187e1` L | `#5e6a77` L | `#f07441` L | `#556066` L | `#c15636` D | `#455a63` D | `#4d8bff` M | `#669ef5` M | `#7aa2ff` M |
| `accent-tint` | `#dcebfa` L | `#3a3c3f` L | `#fce8e0` L | `#ddedf4` L | `#fef2ef` L | `#fafafa` L | `#0b1a3d` M | `#232b3a` M | `#36416b` M |
| `accent-on` | `#ffffff` L | `#ffffff` L | `#ffffff` L | `#ffffff` C | `#ffffff` L | `#ffffff` L | `#ffffff` M | `#ffffff` M | `#ffffff` M |
| `accent-text` | `#419bf9` L | `#419bf9` L | `#419bf9` L | `#419bf9` L | `#419bf9` L | `#419bf9` L | `#2a72ff` M | `#4a8af0` M | `#5a8bff` M |
| `highlight-bg` | `#fff000` L | `#3a2b00` C | `#fff000` L | `#fff000` L | `#fff000` L | `#fff000` L | `#0f2f6e` M | `#4a3a17` M | `#404f8b` M |
| `highlight-text` | `#231f20` L | `#eeeeee` C | `#231f20` L | `#697278` L | `#231f20` L | `#231f20` L | `#8fb8ff` M | `#f3cf7a` M | `#cbd7ff` M |
| `status-danger` | `#d9534f` L | `#d9534f` L | `#d9534f` L | `#d9534f` L | `#ff5f56` L | `#ff5f56` L | `#ff4d58` M | `#ec6a5e` M | `#ff6b7a` M |
| `status-success` | `#5cb346` L | `#5cb346` L | `#5cb346` L | `#5cb346` L | `#5cb346` L | `#5cb346` L | `#1fd46b` M | `#5bcf79` M | `#4fd18b` M |
| `status-warning` | `#f0ad4e` L | `#f0ad4e` L | `#f0ad4e` L | `#f0ad4e` L | `#f0ad4e` L | `#f0ad4e` L | `#f0ad4e` D | `#f0ad4e` D | `#f0ad4e` D |
| `status-warning-on` | `#434648` D | `#333539` D | `#434648` D | `#434648` D | `#434648` D | `#434648` D | `#000000` D | `#201d1a` D | `#24283b` D |
| `status-info` | `#009ec4` L | `#009ec4` L | `#009ec4` L | `#297daf` C | `#009ec4` L | `#009ec4` L | `#009ec4` D | `#009ec4` D | `#009ec4` D |
| `status-info-on` | `#ffffff` L | `#ffffff` L | `#ffffff` L | `#ffffff` C | `#ffffff` L | `#ffffff` L | `#000000` D | `#201d1a` D | `#24283b` D |
| `scrollbar-thumb` | `#c2c6cb` L | `#ffffff` L | `#c2c6cb` L | `#c2c6cb` L | `#c2c6cb` L | `#c2c6cb` L | `#25282e` M | `#3a342e` M | `#474e6a` M |
| `scrim` | `#1e283c59` D | `#04070cb3` D | `#1e283c59` D | `#1e283c59` D | `#1e283c59` D | `#1e283c59` D | `#000000cc` M | `#0a0806b3` M | `#0d1020a6` M |
| `focus-ring` | `#3691ef` D | `#727f8c` D | `#e36c3a` D | `#297daf` D | `#dc6f4d` D | `#566c75` D | `#4f95ff` M | `#80b0ff` M | `#93b3ff` M |
| `inverse-surface` | `#3e4246` L | `#cccccd` L | `#3e4246` L | `#3e4246` L | `#3e4246` L | `#3e4246` L | `#f4f6f9` M | `#ede6dd` M | `#eff1fa` M |
| `inverse-text` | `#ffffff` L | `#333539` L | `#ffffff` L | `#ffffff` L | `#ffffff` L | `#ffffff` L | `#000000` M | `#201d1a` M | `#24283b` M |
| `category-1` | `#c9d7f2` D | `#8a9fc8` D | `#c9d7f2` D | `#c9d7f2` D | `#c9d7f2` D | `#c9d7f2` D | `#83a4e7` M | `#8799bb` M | `#98abd2` M |
| `category-2` | `#d9c9f2` D | `#a695c0` D | `#d9c9f2` D | `#d9c9f2` D | `#d9c9f2` D | `#d9c9f2` D | `#b294db` M | `#9f90b5` M | `#b2a2cb` M |
| `category-3` | `#f2c9dc` D | `#be8ea5` D | `#f2c9dc` D | `#f2c9dc` D | `#f2c9dc` D | `#f2c9dc` D | `#d689af` M | `#b38b9e` M | `#c99cb1` M |
| `category-4` | `#c9e9d3` D | `#7eab8d` D | `#c9e9d3` D | `#c9e9d3` D | `#c9e9d3` D | `#c9e9d3` D | `#6bb888` M | `#7ea38a` M | `#8db79a` M |
| `category-5` | `#f6ccc4` D | `#c49086` D | `#f6ccc4` D | `#f6ccc4` D | `#f6ccc4` D | `#f6ccc4` D | `#de8b7c` M | `#b88c84` M | `#ce9d94` M |
| `category-6` | `#ead4b4` D | `#b69971` D | `#ead4b4` D | `#ead4b4` D | `#ead4b4` D | `#ead4b4` D | `#ca9b54` M | `#ac9472` M | `#c1a681` M |
| `category-7` | `#d2ddba` D | `#98a578` D | `#d2ddba` D | `#d2ddba` D | `#d2ddba` D | `#d2ddba` D | `#9baf62` M | `#939e78` M | `#a5b187` M |
| `category-8` | `#b3e1ea` D | `#6daab5` D | `#b3e1ea` D | `#b3e1ea` D | `#b3e1ea` D | `#b3e1ea` D | `#43b6ca` M | `#70a2ac` M | `#7eb6c0` M |
| `shadow-card` | `0 1px 4px 0 rgba(0,0,0,.15)` L | `0 1px 4px 0 rgba(0,0,0,.15)` L | `0 1px 4px 0 rgba(0,0,0,.15)` L | `0 1px 4px 0 rgba(0,0,0,.15)` L | `0 1px 4px 0 rgba(0,0,0,.15)` L | `none` L | `none` M | `0 24px 60px -16px rgba(0, 0, 0, 0.55)` M | `0 28px 64px -18px rgba(6, 8, 22, 0.70)` M |
| `shadow-soft` | `0 1px 4px 0 rgba(0,0,0,.15)` L | `0 1px 4px 0 rgba(0,0,0,.15)` L | `0 1px 4px 0 rgba(0,0,0,.15)` L | `0 1px 4px 0 rgba(0,0,0,.15)` L | `0 1px 4px 0 rgba(0,0,0,.15)` L | `none` L | `none` M | `0 8px 24px -8px rgba(0, 0, 0, 0.45)` M | `0 10px 26px -8px rgba(6, 8, 22, 0.55)` M |
| `shadow-accent` | `none` L | `none` L | `none` L | `none` L | `none` L | `none` L | `0 0 22px -2px rgba(42, 114, 255, 0.55)` M | `0 10px 22px -6px rgba(74, 138, 240, 0.35)` M | `0 10px 24px -6px rgba(90, 139, 255, 0.50)` M |

**Corrected mapping errors.**

| Theme | Role | Mapped (legacy) | Corrected | Why |
|---|---|---|---|---|
| Taiga | `accent-on` | `#87939a` | `#ffffff` | The mapped `@text-color-inverse` (`@taiga-light`) is never drawn on Taiga's accent; Taiga draws white there (`sidebar.less` `.item.selected`, `controls.less` `.btn-emphasis`, `notifications.less`). The mapped pair was 1.27:1. White is 4.52:1 on the corrected `accent-default` and 6.46:1 on `accent-hover`. |
| Taiga | `accent-default` | `#5dade1` | `#297daf` | White on `#5dade1` is 2.46:1, and a correction must pass AA, so the fill moves: `@taiga-accent`'s OKLCH hue and chroma at the lightest value carrying white at 4.5:1 (the accent split rule). White on it is 4.52:1; it is 4.52:1 on `surface-panel`. |
| Taiga | `status-info` / `status-info-on` | `#5dade1` / `#87939a` | `#297daf` / `#ffffff` | Taiga's notification bar is its accent with white text (`notifications.less`); the mapped text colour was never drawn on it (1.27:1). The fill follows the corrected accent: 4.52:1. |
| Taiga, Darkside, Less-is-more | `surface-field` | `#ffffff` | `#eff5f8`, `#f3f3f4`, `#f3f3f3` | Equal to `surface-toolbar` (`#ffffff`, 1.00:1), so the borderless search pill vanishes; the legacy search box was separated by a hairline the Loft pill doesn't draw. Corrected by the Field rule (Built-in role completion) to 1.10:1 against the toolbar (Taiga 1.10:1, Darkside and Less-is-more 1.11:1). `text-secondary` on the corrected field: Taiga 2.27:1, Darkside 7.66:1, Less-is-more 3.27:1. Less-is-more drew its search with no fill or border by design; the same correction applies because the pill has no other edge. |
| Classic dark | `control-border` | `#333539` | `#7c7e82` | Equal to `surface-panel` (1.00:1); legacy drew the ring around a `#282828` card, not on the panel. Corrected to 3:1 (3.02:1), the same value as `border-strong`. |
| Classic dark | `highlight-bg` / `highlight-text` | `#fff000` / `#c0c6cb` | `#3a2b00` / `#eeeeee` | `ui-dark` inverts the email frame (`invert() hue-rotate(180deg)`), so light text on yellow (1.60:1) was never drawn; the frame renders the hit as `#eeeeee` on `#3a2b00` (11.87:1). |

**Re-sourced legacy values.** Checking what the legacy stylesheets draw moved three mappings without making them corrections: `text-on-sidebar` is `@text-color-subtle` (`outline-view.less` `.item`), not `@text-color`, in Classic and Aubergine (`#4f4c4d`), and Taiga's own `sidebar.less` draws it in `@taiga-light` (`#87939a`, 3.14:1 on white, a legacy failure kept at standard). `surface-toolbar`, `text-on-toolbar` and `accent-tint` gained Darkside and Less-is-more sources.

**Standard-contrast failures that stay.** At standard contrast each theme matches its reference, so pairs the legacy app (or the dark mockup) actually draws keep their failing ratios, as Loft's do: for example Taiga `text-secondary` on `surface-panel` 2.50:1, Taiga `highlight-text` on `#fff000` 4.14:1, Classic `accent-on` on `accent-default` 2.88:1, Darkside `accent-on` on `accent-default` 2.59:1, and every theme's `accent-text` link blue on `surface-panel`. Three pairs meet only in new components and fail in some ported themes: the badge (`accent-text` on `accent-tint`, 2.37–3.83:1), the error-toast bar (`status-danger` on `inverse-surface`, 2.46–2.55:1) and the bell dot (`status-danger` on `surface-toolbar`, 2.62:1 Aubergine, 2.99:1 Darkside and Less-is-more). Each colour is legacy in its own use, so by decision these stay as they are at standard contrast; Increase contrast lifts them to the floor.

**Not in this table, by decision.** The modes with no source today, and every high-contrast variant. Volt, Ember and Dusk take their high-contrast values from the dark mockup (Colors › High-contrast values). The build tasks for the rest are in Open Questions 6.

### LESS variable → role mapping (legacy themes)

The ported themes' legacy role values come from this table. Values are from the LESS sources in `packages/client-app/static/variables/ui-variables.less`, `static/components/*.less`, the feature stylesheets named in the table and `internal_packages/ui-*/`. Where a value is computed, the function is shown with its result, computed with LESS rounding; `fadeout`/`fade` and `opacity` results are composited on the theme's panel or list background. A theme that doesn't override a variable inherits the base value (`theme-manager.js` stacks the base under the chosen theme). Each package's `theme-colors.less` only feeds the old theme-picker swatch, not the running theme. The table records what the legacy app actually draws: where a theme's stylesheet overrides the variable for an element, the override is the source. "—" means the legacy theme has no source for the role; its value is derived (Built-in theme role table).

| LESS source (theme-specific source) | Role | Classic light | Classic dark (`ui-dark`) | Aubergine (`ui-ubuntu`) | Taiga | Darkside | Less-is-more |
|---|---|---|---|---|---|---|---|
| `@background-secondary` | `surface-app` | `#f6f6f6` | `#333539` | `#f6f6f6` | `@white` `#ffffff` | `#f6f6f6` | `@less-background` `#ffffff` |
| `@background-primary`; Darkside `@threadlist-bg` | `surface-panel` | `#ffffff` | `#333539` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` |
| `@background-off-primary`; Taiga `@taiga-lighter`; Darkside `@messagelist-bg` | `surface-sunken` | `#fdfdfd` | `#282828` | `#fdfdfd` | `#f0f7fa` | `tint(@sidebar, 95%)` `#f5f5f6` | `#ffffff` |
| `@list-hover-bg`; Less-is-more `@less-highlight` | `surface-hover` | `darken(@list-bg, 4%)` `#f5f5f5` | `darken(#333, 4%)` `#292929` | `#f5f5f5` | `darken(@taiga-lighter, 5%)` `#ddedf4` | `#f5f5f5` | `#fafafa` |
| `@input-bg` (the legacy search box adds a `@shadow-border` hairline) | `surface-field` | `#ffffff` | `#242424` | `#ffffff` | `#ffffff` (corrected) | `#ffffff` (corrected) | `#ffffff` (corrected) |
| `@panel-background-color`; Darkside `@sidebar` | `surface-sidebar` | `lighten(@gray-base, 92.5%)` `#f6f7f8` | `#282b30` | `#f6f7f8` | `@white` `#ffffff` | `#313042` | `#ffffff` |
| `@toolbar-background-color`; Darkside `@threadlist-bg` (`darkside-threadlist.less` `.toolbar-ThreadList`); Less-is-more `@less-background` (`.sheet-toolbar-container`) | `surface-toolbar` | `darken(@white, 17.5%)` `#d2d2d2` under `@background-gradient` (rendered ~`#e9e9e9`) | `#333539` | `#41403b` (gradient to `darken(…, 5%)` `#34332f`) | `@white` `#ffffff` | `#ffffff` (toolbar folded into each pane) | `#ffffff` |
| `@border-color-divider` (= `@border-color-secondary`); Darkside `@border-color`; Less-is-more `@less-divider` | `border-subtle` | `darken(#f6f6f6, 10%)` `#dddddd` | `darken(#333539, 1%)` `#313236` | `lighten(#f6f6f6, 10%)` `#ffffff` | `#dddddd` | `fade(@sidebar, 10%)` ~`#eaeaec` | `#dddddd` |
| Taiga control border `@taiga-light` | `border-strong` | — | — | — | `darken(#a3acb1, 10%)` `#87939a` | — | — |
| `@background-tertiary` (`preferences.less` `.appearance-mode` card border) | `control-border` | `#6d7987` | `#333539` (corrected) | `#6d7987` | `#6d7987` | `#6d7987` | `#6d7987` |
| `@gray-light` (`switch.less` `.slide-switch` off track) | `control-track` | `lighten(@gray-base, 46.7%)` `#77828d` | `darken(#fff, 46.7%)` `#888888` | `#77828d` | `#77828d` | `#77828d` | `#77828d` |
| `@text-color` | `text-default` | `@black` `#231f20` | `#c0c6cb` | `#231f20` | `@taiga-dark` `darken(#727c83, 4%)` `#697278` | `#231f20` | `@less-text` `#566c75` |
| `@text-color-heading` | `text-strong` | `#434648` | `#ffffff` | `#434648` | `#434648` | `#434648` | `#434648` |
| `@text-color-subtle` | `text-secondary` | `fadeout(@text-color, 20%)` ~`#4f4c4d` | `fadeout(…, 20%)` ~`#a4a9ae` | ~`#4f4c4d` | `lighten(@taiga-dark, 20%)` `#9da5aa` | ~`#4f4c4d` | `fadeout(#566c75, 20%)` ~`#788991` |
| `@text-color-very-subtle` | `text-faint` | `fadeout(@text-color, 50%)` ~`#918f90` | `fadeout(…, 40%)` ~`#888c91` | ~`#918f90` | `@taiga-light` `#87939a` | ~`#918f90` | `fadeout(#566c75, 50%)` ~`#abb6ba` |
| Row text at `opacity: 0.62` (`thread-list.less` `.snippet`) on `@list-bg` | `text-snippet` | ~`#777475` | ~`#8a8e91` | ~`#777475` | `@taiga-dark` row text ~`#a2a8ab` | ~`#777475` | `@less-text` row text ~`#96a4a9` |
| `@text-color` on the email frame body (`static/email-frame.less`); Taiga `@taiga-dark` (`ui-taiga/email-frame.less`); `ui-dark` draws `#111` under `invert() hue-rotate(180deg)` | `text-reading` | `#231f20` | `#eeeeee` | `#231f20` | `#697278` | `#231f20` | `#231f20` |
| `@text-color-subtle` (`outline-view.less` `.item`); Taiga `@taiga-light` (`ui-taiga/sidebar.less` `.item`); Darkside and Less-is-more `@sidebar-text` | `text-on-sidebar` | ~`#4f4c4d` | ~`#a4a9ae` | ~`#4f4c4d` | `#87939a` | `desaturate(lighten(@sidebar, 40%), 75%)` `#9f9f9f` | `lighten(@less-text, 20%)` `#899fa8` |
| `@source-list-active-color` (= `@component-active-color`); Darkside `@active-sidebar-text`; Less-is-more `@less-text` (`.item.selected`) | `text-on-sidebar-active` | `@accent-primary-dark` `#3187e1` | `#5e6a77` | `darken(#f07746, 1%)` `#f07441` | `darken(@taiga-light, 20%)` `#556066` (Taiga's own `sidebar.less` draws the selected item white on `@taiga-accent`) | `#ffffff` | `#566c75` |
| `@text-color` on the toolbar; Aubergine `@light` | `text-on-toolbar` | `#231f20` | `#c0c6cb` | `rgb(246, 246, 246)` `#f6f6f6` | `#697278` | `#231f20` | `#231f20` |
| `@btn-icon-color` | `icon-default` | `#919191` | `#919191` | `#919191` (`@light` on the toolbar) | `#919191` | `#919191` | `#919191` |
| `@accent-primary`; Taiga `@taiga-accent`; Darkside `@accent` | `accent-default` | `@blue` `#419bf9` | `#5e6a77` | `#f07746` | `#5dade1` (corrected; `@accent-primary` itself is `@taiga-light` `#87939a`) | `#f18260` | `@less-text` `#566c75` (active states drawn in the text colour) |
| `@accent-primary-dark` | `accent-hover` | `@blue-dark` `#3187e1` | `#5e6a77` | `#f07441` | `darken(@taiga-light, 20%)` `#556066` | — | — |
| `@list-selected-bg`; Darkside `tint(@accent, 90%)` (`darkside-threadlist.less` `.selected`); Less-is-more `@less-highlight` (`.list-item.selected`) | `accent-tint` | `mix(#3187e1, #fff, 17%)` `#dcebfa` | `mix(#5e6a77, #333, 17%)` `#3a3c3f` | `mix(#f07746, #fff, 17%)` ~`#fce8e0` | `darken(@taiga-lighter, 5%)` `#ddedf4` | `#fef2ef` | `#fafafa` |
| `@text-color-inverse` (white on accent fills: focused rows, tokens, menus); Taiga `@white` on `@taiga-accent` (`sidebar.less`, `controls.less` `.btn-emphasis`) | `accent-on` | `#ffffff` | `#ffffff` | `#ffffff` | `@taiga-light` `#87939a` (corrected) | `#ffffff` | `#ffffff` |
| `@text-color-link` | `accent-text` | `@blue` `#419bf9` | `#419bf9` (not overridden) | `#419bf9` | `#419bf9` | `#419bf9` | `#419bf9` |
| `@text-color-search-match` (`email-frame.less` `.search-match`) | `highlight-bg` | `#fff000` | `#fff000` (corrected) | `#fff000` | `#fff000` | `#fff000` | `#fff000` |
| Body text inherited inside `.search-match` | `highlight-text` | `#231f20` | `#c0c6cb` (corrected) | `#231f20` | `#697278` | `#231f20` | `#231f20` |
| `@color-danger` / `@color-error`; Darkside `@danger`; Less-is-more `@close` | `status-danger` | `#d9534f` | `#d9534f` | `#d9534f` | `#d9534f` | `#ff5f56` | `#ff5f56` |
| `@color-success` | `status-success` | `#5cb346` | `#5cb346` | `#5cb346` | `#5cb346` | `#5cb346` | `#5cb346` |
| `@color-warning` | `status-warning` | `#f0ad4e` | same | same | same | same | same |
| (none: `@color-warning` carries no text) | `status-warning-on` | — | — | — | — | — | — |
| `@background-color-info` (= `@blue-light`); Taiga notifications | `status-info` | `#009ec4` | same | same | `#5dade1` (corrected), hover `darken(…, 20%)` `#227cb6` | same as base | same as base |
| `@text-color-inverse` on the notification bars (`notifications/stylesheets/styles.less`); Taiga `@white` (`ui-taiga/notifications.less`) | `status-info-on` | `#ffffff` | `#ffffff` | `#ffffff` | `@taiga-light` `#87939a` (corrected) | `#ffffff` | `#ffffff` |
| `lighten(@gray, 40%)` (`scroll-region.less` `.scrollbar-handle`) | `scrollbar-thumb` | `#c2c6cb` | `#ffffff` (`ui-dark` `@gray`) | `#c2c6cb` | `#c2c6cb` | `#c2c6cb` | `#c2c6cb` |
| `@gray-darker` at `opacity: 0.9` (`toast.less`) / `@background-primary` (`undo-toast.less`) | `inverse-surface` / `inverse-text` | ~`#3e4246` / `#ffffff` | ~`#cccccd` / `#333539` | ~`#3e4246` / `#ffffff` | ~`#3e4246` / `#ffffff` | ~`#3e4246` / `#ffffff` | ~`#3e4246` / `#ffffff` |
| `@background-color-success/warning/error/pending`, `@text-color-search-current-match` | no role | `#00ac6f` / `#ff4800` / `#ca2541` / `#b4babd`; current match `#ff8b1a` | same | same | same | same as base | same as base |
| `@standard-shadow` | `shadow-soft`, `shadow-card` | `0 1px 4px 0 rgba(0,0,0,.15)` | same | same | same | same | `none` (a 1px `#dddddd` divider instead) |
| (none) | `shadow-accent` | `none` | `none` | `none` | `none` | `none` | `none` |
| `@font-family-sans-serif` | typography `fontFamily` | `"Nylas-Pro", "Helvetica", sans-serif` in every legacy theme; see Theme catalogue for the bundled faces | | | | | |

"(corrected)" marks a legacy mapping the Built-in theme role table replaces as a mapping error. Roles with no legacy source (the "—" cells, `focus-ring`, `text-on-category`, `status-warning-on`, `scrim` and the categorical palette) are derived; the rules are in Derived values pending hand-check. The legacy mapping for the bars is settled: `@color-warning` maps to `status-warning` and `@background-color-info` to `status-info`. The other legacy notification-bar fills (`@background-color-success`, `@background-color-warning`, `@background-color-error`, `@background-color-pending`) and the search current-match colour get no role (`@background-color-warning` and `@color-warning` are both unused in the client today).

### Derived values pending hand-check

Every value in this section is **(hand-check pending)**. A script derived each one in OKLCH, keeping the source hue and chroma (chroma is reduced only to stay inside sRGB) and moving lightness in 0.0005 steps to the nearest value that passes. Ratios are WCAG 2.x, measured on the rounded hex. The hand-check is a build task (see Open Questions 6).

Rules:

- **`border-strong`**: `border-subtle`'s hue and chroma at the nearest lightness reaching 3:1 against `surface-panel`, `surface-sunken` and `surface-app` of the same variant. In Loft light high contrast `border-subtle` takes the same value, as it does in Night Slate high contrast.
- **Loft light high contrast**: each role moves only as far as its pairs need. Text roles keep their Loft light rank on `surface-panel` (strong, default, reading, secondary, snippet), which pulled `text-reading` from `#6e7787` to `#66707f`. `text-on-sidebar` and `text-on-sidebar-active` follow `text-secondary` and `accent-text`, as they do in Loft light. `text-faint` (disabled text, exempt) and every surface, fill and category keep their Loft light values.
- **Dark accent split, high contrast**: `accent-text` is the mockup's high-contrast accent; `accent-on` is white; `accent-default` is that accent's hue and chroma at the lightest value carrying white at 4.5:1 (and still 3:1 on `surface-panel`); `accent-hover` is the same colour one step darker, by the theme's standard default-to-hover lightness step (Night Slate 0.063, Volt 0.062, Ember 0.058, Dusk 0.063).
- **Dark accent split, standard contrast**: themes stay reference-exact, as Night Slate does. The mockup accent becomes `accent-text`, and `accent-on` is already white.
- **Error toast in high contrast**: `status-danger` moves to the nearest lightness reaching 3:1 on both `inverse-surface` (the toast bar and icon) and `surface-toolbar` (the bell dot). This departure from the mockup is decided: the dark mockup's high-contrast `status-danger` values fall below 3:1 on their light inverse surface (Night Slate `#ff8085` is 2.25:1 on `#f4f7fb`), so Night Slate (`#ff8085` → `#e4686f`), Volt, Ember and Dusk use the derived values, not their mockup values. Only the exact hexes wait for the hand-check.
- **`control-border` and `control-track`, Night Slate**: Night Slate `surface-panel`'s OKLCH hue and chroma (H 263.9, C 0.029), at the panel's lightness raised by the lightness gap between Loft's white panel and the Loft light value (`#e6ebf2` 0.062, `#d3dae4` 0.114). In a dark mode the step goes lighter, as `border-subtle` and `scrollbar-thumb` do. In both high-contrast variants each role takes that variant's `border-strong`.
- **`status-warning` and `status-info`**: start from the legacy `@color-warning` `#f0ad4e` and `@background-color-info` `#009ec4`. The `-on` colour is either white or the variant's darkest text (`text-strong` or `inverse-text`), whichever needs the smaller lightness shift of the fill to reach 4.5:1.
- **Shadows, Loft light high contrast** (decided): Loft light high contrast keeps the standard `shadow-card` and `shadow-soft`; `shadow-accent` is `none`, as in all four high-contrast palettes of the dark mockup.

#### Loft light and Night Slate

"—": not derived in that variant.

| Role | Pair (min) | Loft light | Loft light HC | Night Slate | Night Slate HC |
|---|---|---|---|---|---|
| `border-strong` | on panel / sunken / app (3) | `#86888d` 3.55 / 3.27 / 3.02 | `#86888d` 3.55 / 3.27 / 3.02 | `#616c7f` 3.00 / 3.29 / 3.48 | — |
| `border-subtle` | on panel / sunken / app (3) | — | `#86888d` 3.55 / 3.27 / 3.02 | — | — |
| `control-border` | OKLCH gap from panel; on panel (3 in HC) | — | `#86888d` 3.55 | `#2a3140` 1.22 (light `#e6ebf2` 1.20) | — |
| `control-track` | OKLCH gap from panel; on panel (3 in HC) | — | `#86888d` 3.55 | `#373f4e` 1.50 (light `#d3dae4` 1.41) | — |
| `text-secondary`, `text-on-sidebar` | on panel / sunken / field (4.5) | — | `#67707d` 5.01 / 4.63 / 4.55 | — | — |
| `text-snippet` | on sunken (4.5) | — | `#69717d` 4.55 | — | — |
| `text-reading` | on panel (4.5), rank | — | `#66707f` 5.01 | — | — |
| `accent-text`, `text-on-sidebar-active` | on tint / panel (4.5) | — | `#1a69e2` 4.53 / 5.04 | — | — |
| `accent-default` | white on it (4.5); on panel (3) | — | `#2471ea` 4.54; 4.54 | — | `#4576c1` 4.55; 3.79 |
| `accent-hover` | white on it (4.5) | — | — | — | `#3363ac` 5.96 |
| `highlight-text` | on `highlight-bg` (4.5) | — | `#1d62cf` 4.50 | — | — |
| `text-on-category` | on `category-1` … `-8` (4.5) | — | `#515a67` 4.52–5.35 | — | — |
| `icon-default` | on panel / sunken (3) | — | `#868f9d` 3.27 / 3.02 | — | — |
| `status-success` | on panel (3) | — | `#00ab4e` 3.03 | — | — |
| `status-danger` | on inverse / toolbar (3) | — | `#f6595b` 3.00 / 3.23 | — | `#e4686f` 3.00 / 5.34 |
| `scrollbar-thumb` | on sunken (3) | — | `#898f99` 3.00 | — | — |
| `status-warning` / `-on` | `-on` on fill (4.5) | `#f0ad4e` / `#3c4552` 4.98 | `#f0ad4e` / `#3c4552` 4.98 | `#f0ad4e` / `#1b2230` 8.19 | `#f0ad4e` / `#0f141c` 9.49 |
| `status-info` / `-on` | `-on` on fill (4.5) | `#0081a1` / `#ffffff` 4.51 | `#0081a1` / `#ffffff` 4.51 | `#009ec4` / `#1b2230` 5.07 | `#009ec4` / `#0f141c` 5.88 |
| `shadow-accent` | — | — | `none` | — | — |

#### Volt, Ember and Dusk

At standard contrast, `accent-text` comes from the mockup, not derivation, and keeps its reference ratios.

| Role | Pair (min) | Volt | Volt HC | Ember | Ember HC | Dusk | Dusk HC |
|---|---|---|---|---|---|---|---|
| `accent-text` | on panel / tint (4.5) | `#2a72ff` 4.58 / 4.03 | `#5c9dff` 7.24 / 5.67 | `#4a8af0` 4.94 / 4.18 | `#86b5ff` 8.41 / 6.22 | `#5a8bff` 3.95 / 3.09 | `#9dbaff` 7.36 / 5.22 |
| `accent-on` | — | `#ffffff` (mockup) | `#ffffff` | `#ffffff` (mockup) | `#ffffff` | `#ffffff` (mockup) | `#ffffff` |
| `accent-default` | white on it (4.5); on panel (3) | — | `#3675d4` 4.51; 4.36 | — | `#4b77bc` 4.50; 3.90 | — | `#5b75b5` 4.51; 3.14 |
| `accent-hover` | white on it (4.5) | — | `#2362bf` 5.88 | — | `#3b66a9` 5.74 | — | `#4a62a1` 5.91 |
| `status-danger` | on inverse / panel (3) | — | `#f7646d` 3.00 / 6.56 | — | `#df6e65` 3.00 / 5.48 | — | `#d97883` 3.02 / 4.70 |
| `status-warning` / `-on` | `-on` on fill (4.5) | `#f0ad4e` / `#000000` 10.79 | `#f0ad4e` / `#000000` 10.79 | `#f0ad4e` / `#201d1a` 8.62 | `#f0ad4e` / `#141210` 9.60 | `#f0ad4e` / `#24283b` 7.49 | `#f0ad4e` / `#1c2031` 8.30 |
| `status-info` / `-on` | `-on` on fill (4.5) | `#009ec4` / `#000000` 6.69 | `#009ec4` / `#000000` 6.69 | `#009ec4` / `#201d1a` 5.34 | `#009ec4` / `#141210` 5.95 | `#009ec4` / `#24283b` 4.64 | `#009ec4` / `#1c2031` 5.14 |

`accent-hover` has no pair against `surface-panel`; its ratios there are 2.89 (Night Slate HC), 3.35 (Volt HC), 3.06 (Ember HC) and 2.40 (Dusk HC). The hover fill always carries a white label at 4.5:1 or better.

#### Built-in role completion

Every value the Built-in theme role table marks **D**, at standard contrast. The **C** values, with their ratios, are in the Corrected mapping errors table (Colors › Built-in theme role table). Rules:

- **`border-strong` rule**: as above, on the theme's own `surface-panel`, `surface-sunken` and `surface-app`.
- **Focus-ring rule**: `accent-default`'s OKLCH hue and chroma at the nearest lightness reaching 3:1 on `surface-panel`, `surface-sunken` and `surface-app` (the legacy themes drew focus only as an `@accent-primary` field border, `inputs.less`).
- **Category-label rule**: `text-on-category` takes `text-default`'s hue and chroma (light modes) or `inverse-text`'s (Classic dark) at the nearest lightness reaching 4.5:1 on all eight categorical fills.
- **Status `-on` rule**: the `status-warning` and `status-info` rule above, applied to the legacy `@color-warning` fill; in every theme the darkest text needs no shift of the fill, so the fill stays legacy.
- **Hover-step rule** (Darkside, Less-is-more, which have no `@accent-primary-dark` of their own): `accent-default` one Classic hover step darker (the OKLCH lightness gap from `#419bf9` to `#3187e1`, 0.063), then further only until `accent-on` reaches 4.5:1.
- **Night Slate control rule** (Volt, Ember, Dusk): the `control-border` and `control-track` rule above, from each theme's `surface-panel`.
- **Field rule** (correction): `surface-sunken`'s hue and chroma at the nearest lightness giving 1.10:1 against `surface-toolbar`.
- **Adopted fills**: roles with no legacy source and no contrast pair of their own take the Loft theme's value for the same mode, so a folder or calendar keeps its hue across themes: the categorical palette (Loft light's eight in light modes, Night Slate's in Classic dark) and `scrim` (Loft light's `#1e283c59`, Night Slate's `#04070cb3`). Their legibility is carried by `text-on-category`.

| Theme | Role | Value | Status | Rule | Ratios (min) |
|---|---|---|---|---|---|
| Classic light | `border-strong` | `#8e8e8e` | derived | `border-strong` rule | on surface-panel 3.28 (3); on surface-sunken 3.22 (3); on surface-app 3.03 (3) |
| Classic light | `text-on-category` | `#231f20` | derived | Category-label rule | on category-1 … -8 10.55–12.48 (4.5) |
| Classic light | `status-warning-on` | `#434648` | derived | Status `-on` rule (legacy fill kept) | on status-warning 4.89 (4.5) |
| Classic light | `focus-ring` | `#3691ef` | derived | Focus-ring rule | on surface-panel 3.25 (3); on surface-sunken 3.20 (3); on surface-app 3.01 (3) |
| Classic dark | `border-strong` | `#7c7e82` | derived | `border-strong` rule | on surface-panel 3.02 (3); on surface-sunken 3.63 (3); on surface-app 3.02 (3) |
| Classic dark | `text-on-category` | `#323438` | derived | Category-label rule | on category-1 … -8 4.51–4.81 (4.5) |
| Classic dark | `status-warning-on` | `#333539` | derived | Status `-on` rule (legacy fill kept) | on status-warning 6.31 (4.5) |
| Classic dark | `focus-ring` | `#727f8c` | derived | Focus-ring rule | on surface-panel 3.00 (3); on surface-sunken 3.60 (3); on surface-app 3.00 (3) |
| Aubergine light | `border-strong` | `#8e8e8e` | derived | `border-strong` rule | on surface-panel 3.28 (3); on surface-sunken 3.22 (3); on surface-app 3.03 (3) |
| Aubergine light | `text-on-category` | `#231f20` | derived | Category-label rule | on category-1 … -8 10.55–12.48 (4.5) |
| Aubergine light | `status-warning-on` | `#434648` | derived | Status `-on` rule (legacy fill kept) | on status-warning 4.89 (4.5) |
| Aubergine light | `focus-ring` | `#e36c3a` | derived | Focus-ring rule | on surface-panel 3.24 (3); on surface-sunken 3.19 (3); on surface-app 3.00 (3) |
| Taiga light | `text-on-category` | `#525a60` | derived | Category-label rule | on category-1 … -8 4.54–5.38 (4.5) |
| Taiga light | `status-warning-on` | `#434648` | derived | Status `-on` rule (legacy fill kept) | on status-warning 4.89 (4.5) |
| Taiga light | `focus-ring` | `#297daf` | derived | Focus-ring rule | on surface-panel 4.52 (3); on surface-sunken 4.17 (3); on surface-app 4.52 (3) |
| Darkside light | `border-strong` | `#8e8e90` | derived | `border-strong` rule | on surface-panel 3.27 (3); on surface-sunken 3.00 (3); on surface-app 3.03 (3) |
| Darkside light | `text-on-category` | `#231f20` | derived | Category-label rule | on category-1 … -8 10.55–12.48 (4.5) |
| Darkside light | `accent-hover` | `#c15636` | derived | Hover-step rule | under accent-on 4.51 (4.5) |
| Darkside light | `status-warning-on` | `#434648` | derived | Status `-on` rule (legacy fill kept) | on status-warning 4.89 (4.5) |
| Darkside light | `focus-ring` | `#dc6f4d` | derived | Focus-ring rule | on surface-panel 3.27 (3); on surface-sunken 3.00 (3); on surface-app 3.02 (3) |
| Less-is-more light | `border-strong` | `#949494` | derived | `border-strong` rule | on surface-panel 3.03 (3); on surface-sunken 3.03 (3); on surface-app 3.03 (3) |
| Less-is-more light | `text-on-category` | `#475c65` | derived | Category-label rule | on category-1 … -8 4.55–5.38 (4.5) |
| Less-is-more light | `accent-hover` | `#455a63` | derived | Hover-step rule | under accent-on 7.25 (4.5) |
| Less-is-more light | `status-warning-on` | `#434648` | derived | Status `-on` rule (legacy fill kept) | on status-warning 4.89 (4.5) |
| Less-is-more light | `focus-ring` | `#566c75` | derived | Focus-ring rule | on surface-panel 5.53 (3); on surface-sunken 5.53 (3); on surface-app 5.53 (3) |
| Volt dark | `border-strong` | `#5b5f67` | derived | `border-strong` rule | on surface-panel 3.03 (3); on surface-sunken 3.16 (3); on surface-app 3.28 (3) |
| Volt dark | `control-border` | `#1a1b1e` | derived | Night Slate control rule | on surface-panel 1.13 (3) |
| Volt dark | `control-track` | `#26272b` | derived | Night Slate control rule | on surface-panel 1.30 (3) |
| Ember dark | `border-strong` | `#6d6761` | derived | `border-strong` rule | on surface-panel 3.01 (3); on surface-sunken 3.21 (3); on surface-app 3.35 (3) |
| Ember dark | `control-border` | `#2f2c29` | derived | Night Slate control rule | on surface-panel 1.21 (3) |
| Ember dark | `control-track` | `#3c3936` | derived | Night Slate control rule | on surface-panel 1.46 (3) |
| Dusk dark | `border-strong` | `#737b95` | derived | `border-strong` rule | on surface-panel 3.00 (3); on surface-sunken 3.47 (3); on surface-app 3.80 (3) |
| Dusk dark | `control-border` | `#3d425a` | derived | Night Slate control rule | on surface-panel 1.28 (3) |
| Dusk dark | `control-track` | `#4a5069` | derived | Night Slate control rule | on surface-panel 1.59 (3) |

## Typography

The theme owns typography: typeface, type ramp and line height. Loft's typeface is **Jost** (variable, OFL, bundled), a geometric sans in the Futura family, with the stack `'Jost Variable', Jost, 'Avenir Next', system-ui, sans-serif`. Aubergine uses **Ubuntu** (UFL, bundled). Volt uses **Inter** and Dusk uses Jost. Ember sets its reading text (the email body and the reading-card subject) in **Source Serif** and its UI chrome in Inter. Inter and Source Serif are bundled under OFL. Volt, Ember and Dusk took their dark values from palette studies rendered in Jost on the Loft screen; Volt and Ember now set their own faces. Classic, Taiga, Darkside and Less-is-more inherit the legacy `Nylas-Pro` stack, which is proprietary: in the open-source build they render in the system UI font, and in Nylas-Pro only when the private `nylas-private-fonts` package is present. Every stack ends in system fallbacks that cover CJK, Arabic and Hebrew.

Two settings act on top of the theme:

- **Font override.** Replaces the theme's typeface everywhere in the app. Choices: Theme default, System font, Inter, IBM Plex Sans, Atkinson Hyperlegible, Ubuntu, and "Choose installed font…".
- **Text size** (87.5–150%). Scales every `fontSize` and lets layouts reflow. Window zoom is separate and stacks on top.

The `typography` frontmatter is the Loft theme's ramp. The other themes' type ramps (sizes, weights and line heights in their own faces) are set in the themes epic (see Open Questions 4); this file fixes only their typefaces and the unread/read weight rule below.

Loft's type rules come from `imports/loft-DESIGN.md`:

- Body text is weight 400 with slight tracking (`0.01em` everywhere).
- Headings and strong text are 600 in `{colors.text-strong}`. Body and secondary text are soft grey.
- Ramp: `{typography.heading-reading}` 26/600 for the reading-card subject, `{typography.heading-view}` 24/600 for view titles (calendar month, contact name), `{typography.wordmark}` 22/600, `{typography.heading-rail}` 17/600, `{typography.heading-section}` 16/600, `{typography.title-row}` 15/600, `{typography.body-reading}` 15/400 with line height 1.8, `{typography.label-control}` 14/500, `{typography.input}` 14/400 for text fields, `{typography.body-sm}` 13 with line height 1.5, `{typography.meta}` 12, `{typography.caption}` 11.
- Search overlay section labels use `{typography.label-search-section}`: 11px, 600, `0.08em` tracking, uppercase.
- Unread rows have a bolder subject than read rows: `{typography.title-row-unread}` at 650 for unread and `{typography.title-row-read}` at 500 for read, on Jost's variable weight axis. A theme whose face has no variable weight axis uses 700 and 400. `{typography.title-row}` (600) stays for the reading-card sender.

## Layout & Spacing

The style owns spacing and layout. Density scales the style's spacing. Themes carry no spacing. This section specifies the Loft style. The Classic, Taiga, Darkside and Less-is-more styles' spacing, row and selection treatment and rail placement are designed in a short style spec at the start of each style's epic (see Open Questions); only their minimum widths, row heights per density and layout-mode rule are fixed here.

### Loft style layout

**Reference scale.** This list owns the reference-image rule; other sections link here.

- **Reference images.** [`imports/loft-01.webp`](imports/loft-01.webp) is the full Loft mockup with its page margin (the app card inset on the `{colors.surface-app}` ground; the verification target). [`imports/loft-02.webp`](imports/loft-02.webp) is the same screen full-bleed, with no app-frame inset.
- **Canonical values.** The CSS token values (the `spacing` and `rounded` frontmatter) are canonical. `loft-01.webp` draws the same layout smaller than the tokens (its type is about 23% smaller), so it is not a pixel target. Fidelity is checked against it for composition, proportion and colour at the image's own scale: scale-normalised, tolerant of anti-aliasing, with the redacted mark region in the top bar masked.
- **Key-screen mocks.** All four use a 1504×956 window, the size at which the token values fit: [`mockups/key-loft-mail.html`](mockups/key-loft-mail.html), [`mockups/key-appearance.html`](mockups/key-appearance.html), [`mockups/key-onboarding.html`](mockups/key-onboarding.html) and [`mockups/key-free-mix.html`](mockups/key-free-mix.html). `key-loft-mail.html` shows this layout in Loft light and Night Slate, at standard and high contrast.

```
┌───────────────────────────────────────────────────────────────────┐
│ Top bar 72px: [window controls] app mark | search pill | bell · gear · account chip │
├──────────┬──────────────────┬────────────────────────────────────┤
│ Sidebar  │ Message list     │ Reading area: floating reading card │
│ 236px    │ 380px            │  content ~64% | right rail ~36%    │
│ sidebar  │ surface-sunken   │                                    │
└──────────┴──────────────────┴────────────────────────────────────┘
```

- The app card is inset from the window by `{spacing.app-inset-block}` × `{spacing.app-inset-inline}` on `{colors.surface-app}` (as in `imports/loft-01.webp`).
- Column widths: sidebar `{spacing.sidebar-width}`, list `{spacing.list-width}`, rail `{spacing.rail-width}`.
- The reading card floats on `{colors.surface-sunken}` with a margin of `{spacing.reading-card-margin}`. Older thread messages sit below the card as dimmed one-liners.
- Reading measure: `{spacing.reading-measure}`.
- The Calendar and Contacts views replace the list and reading area.
- All layout uses logical properties (inline-start and inline-end); RTL is required for every style.
- Search, compose and modals open in the overlay region (`EXPERIENCE.md` › Style Contract).

### Window chrome and minimum width

- The window is frameless and each style draws the title bar inside its own top bar. Per-OS placement of the window controls is owned by `EXPERIENCE.md` › Responsive & Platform.
- Minimum window widths: Classic, Taiga and Darkside 900px; Less-is-more 800px; Loft 1100px. Below a style's minimum, regions collapse along the reflow ladder in `EXPERIENCE.md` › Responsive & Platform.
- Loft is always split pane. The other four styles honour the existing single-pane and split-pane layout preference (see `EXPERIENCE.md` › Style Contract).

### Density

Density is the third independent setting. Any style works at any density.

| Level | Multiplier on spacing roles | Native for |
|---|---|---|
| Compact | ×0.75 | Less-is-more |
| Comfortable | ×1 (the `spacing` frontmatter) | Classic, Loft, Taiga, Darkside |
| Spacious | ×1.25 | — |

- Density multiplies the style's spacing roles: row padding (`{spacing.row-padding-block}`, `{spacing.row-padding-inline}`), row gap (`{spacing.row-gap}`) and control height (`{spacing.control-height}`).
- Avatar size and font size don't scale. Text size handles type.
- Each style defines its own message-row height per density:

| Style | Compact | Comfortable | Spacious |
|---|---|---|---|
| Classic | 30px | 36px (today's single-line rows) | 44px |
| Loft | At least `{spacing.list-row-min-height}`; snippet hidden; subject, sender and time kept | Natural height from row padding, at least `{spacing.list-row-min-height}` | At least `{spacing.list-row-min-height}` |
| Taiga, Darkside | 30px | 36px | 44px (Classic's single-line rows) |
| Less-is-more | 26px | 30px | 36px |

The 44px floor applies only to Loft's multi-line rows. Every row, in every style and density, keeps a pointer target of at least 24px (WCAG 2.5.8).

## Elevation & Depth

Shadows belong to the theme and are tinted by the theme's colours. They are contract roles; theme files carry them as DTCG `shadow` tokens. Loft separates surfaces by tint and shadow, not borders.

| Role | Loft light | Loft light HC | Night Slate | Night Slate HC | Used on |
|---|---|---|---|---|---|
| `shadow-card` | `0 24px 60px -16px rgba(50, 72, 110, 0.22)` | same as Loft light | `0 24px 60px -16px rgba(0, 0, 0, 0.60)` | `0 24px 60px -16px rgba(0, 0, 0, 0.70)` | App card, reading card, search overlay, compose card, modals |
| `shadow-soft` | `0 8px 24px -8px rgba(50, 72, 110, 0.16)` | same as Loft light | `0 8px 24px -8px rgba(0, 0, 0, 0.50)` | `0 8px 24px -8px rgba(0, 0, 0, 0.60)` | Secondary pills, reply/forward icon group, hovered list rows, toasts, popovers |
| `shadow-accent` | `0 10px 22px -6px rgba(47, 124, 246, 0.45)` | `none` (derived) | `0 10px 22px -6px rgba(58, 131, 247, 0.40)` | `none` | Every accent-filled element: Compose and Reply pills, the selected row |

- Loft light high contrast keeps the standard `shadow-card` and `shadow-soft` (decided); only `shadow-accent` drops to `none`, matching the dark high-contrast palettes.
- A theme may set a shadow role to `none` (Volt sets `shadow-card` and `shadow-soft` to `none`; Less-is-more uses no shadows). Legacy values are in Colors › LESS variable → role mapping.
- On a dark ground, Night Slate keeps its cards legible with a 1px top highlight (`inset 0 1px 0 rgba(255, 255, 255, 0.05)` in the mockup). In high contrast every card gets a 1px `border-strong` edge instead.
- Under forced colours there are no shadows (see Colors).
- The selected message card sits above the reading area (higher z-index) and overhangs into it.

## Shapes

The style owns radius, so corners don't change with the theme.

Loft's corners: `{rounded.xl}` for the app card, reading card, search overlay and modals; `{rounded.compose}` for the compose card; `{rounded.lg}` for the selected message card and popovers; `{rounded.image}` for inner cards and hero images; `{rounded.md}` for attachment thumbnails; `{rounded.hit}` for search hits; `{rounded.full}` for buttons, pills, icon buttons, badges and avatars.

The legacy looks use much tighter corners, which belong to the matching styles: Classic 6/4/4px, Taiga and Darkside 4px throughout (`@base-border-radius` in Taiga), Less-is-more 0–2px.

## Components

Visual specs for the Loft style rendering the Loft theme, then the shared components, the Appearance page and the onboarding looks step. Loft is described in [`imports/loft-DESIGN.md`](imports/loft-DESIGN.md) with token values from [`imports/loft-global.css`](imports/loft-global.css) and pictured in [`imports/loft-01.webp`](imports/loft-01.webp) and [`imports/loft-02.webp`](imports/loft-02.webp) (see Layout & Spacing › Loft style layout › Reference scale). Loft covers the mail view with the right rail, the top bar, the search overlay, compose, calendar and contacts. Contacts, the finished Calendar, the right rail, top-bar search and the account chip are app features every style lays out; Loft does it first. No style has an in-window Settings view: Settings opens the Preferences sheet. Behaviour for every component below is in `EXPERIENCE.md` › Component Patterns, under the same name, group and order.

### Style catalogue

The structural signatures are the style cards' one-line descriptions, not layout specs: Classic's, Taiga's, Darkside's and Less-is-more's spacing, row and selection treatment and rail placement are designed in each style's spec (see Open Questions).

| Style | Structural signature | Matching theme | Native density |
|---|---|---|---|
| **Classic** | The original three-pane layout with a full-width toolbar | Classic | Comfortable |
| **Loft** | Top bar, floating reading card and a people rail | Loft | Comfortable |
| **Taiga** | Flat panes, outlined selection, bordered message cards | Taiga | Comfortable |
| **Darkside** | Full-height sidebar, toolbar folded into each pane | Darkside | Comfortable |
| **Less-is-more** | Minimal chrome, dense lists | Less-is-more | Compact |

A community style's card adds a "Doesn't cover: …" line naming the features it leaves to Classic's arrangement.

### Loft mail surfaces

[`mockups/key-loft-mail.html`](mockups/key-loft-mail.html) shows these surfaces in Loft light and Night Slate at standard and high contrast: the selected card's overhang, an unread row, the two-tone focus ring and stacked info and error toasts.

| Component | Visual spec |
|---|---|
| **App frame / app card** | `{components.app-frame}` ground; the app sits in one `{components.app-card}` with `{rounded.xl}` corners and `shadow-card`. |
| **Top bar** | `{components.top-bar}`: `{colors.surface-toolbar}`. Inline-start: the OS window controls on macOS, then the app's own mark (Nylas Mail logo and name, or the fork's name), the name in `{typography.wordmark}` and `{colors.text-on-toolbar}`, above the sidebar column. Then the search pill. Inline-end: bell (with a `{colors.status-danger}` dot), settings gear, account chip, and on Windows and Linux the window controls. |
| **Search pill** | `{components.search-pill}`: search icon at inline-start, placeholder "Search" in `{colors.text-secondary}`. |
| **Account chip** | `{components.account-chip}`: round avatar, name stacked over email. |
| **Sidebar** | `{components.sidebar}`. Top: a `{components.button-primary}` `{spacing.primary-button-width}` wide, labelled by view ("Compose email", "New event", "New contact"). Nav rows use `{components.nav-item}` with lucide icons (stroke ~1.75, 17–20px); the active row is `{colors.text-on-sidebar-active}` text and icon. Inbox count uses `{components.badge}`. "Folders" heading in `{typography.heading-section}` with generous top margin; folder icons filled with a categorical colour. A view switcher pinned at the bottom: Mail, Calendar, Contacts, Settings. |
| **Message row** | `{components.message-row}`: avatar (photo, or initials in `{colors.text-on-category}` on a categorical colour chosen from the email address), subject plus time on line 1, sender on line 2, two-line clamped snippet. Unread: subject in `{typography.title-row-unread}` (read rows use `{typography.title-row-read}`) plus an accent dot before the time. Hover: `{colors.surface-panel}` fill plus `shadow-soft`. At Compact density the snippet is hidden (see Layout & Spacing › Density). |
| **Selected message card** | `{components.message-row-selected}`: accent fill, all text `{colors.accent-on}`, unread dot in `{colors.accent-on}`, snippet at 80% opacity, `{rounded.lg}`, `shadow-accent`. It overhangs `{spacing.selected-overhang}` past the list's inline-end edge, into the reading pane, and sits above it. |
| **Focus ring** | `{components.focus-ring}`: a `{spacing.focus-ring-width}` ring in `{colors.focus-ring}` at a `{spacing.focus-ring-offset}` offset, with a `{spacing.focus-ring-halo}` `{colors.surface-panel}` halo outside it, so the ring reaches 3:1 on every surface, accent fills included. Loft's overhanging selected card never clips it. Under forced colours it is a system-colour outline. |
| **Reading card** | `{components.reading-card}`. Header: avatar, sender in `{typography.title-row}`, date in `{typography.meta}` `{colors.text-secondary}`, and a `{colors.surface-panel}` pill group of three icon buttons (Reply, Reply all, Forward) with `shadow-soft`. Subject in `{typography.heading-reading}` with `{spacing.subject-margin-block}` above and below. Body in `{typography.body-reading}`, `{colors.text-reading}`, measure `{spacing.reading-measure}`. Image attachments can render as a hero card at `{rounded.image}`. Remote images are blocked by default, with a "Show remote images" chip. Footer: "Reply" `{components.button-primary}` and "Forward" `{components.button-secondary}`. |
| **View original toggle** | In the reading pane, per message, in dark mode. Visual spec and placement are open (see Open Questions 2). |
| **Right rail** | `{components.right-rail}`: inside the reading card, divider at inline-start in `{colors.border-subtle}`. "Attachments": three thumbnails per row at `{spacing.rail-thumb}` and `{rounded.md}`. "People in conversation": avatar at `{spacing.avatar-chip}` with `{components.presence-dot}`, name in `{typography.name-sm}`, email in `{typography.meta}` `{colors.text-secondary}`. Thread timeline at the bottom of the rail: an accent dot for the current message, `{colors.text-faint}` dots for others, one-line snippets in `{typography.meta}`; the current item is 600 weight in `{colors.accent-text}`. |
| **Presence dot** | `{components.presence-dot}` with a `{colors.surface-panel}` ring; the people list also shows the text label "Online". |
| **Older thread messages** | Below the card, dimmed preview blocks in `{colors.text-secondary}` on `{colors.surface-sunken}`. |
| **Search overlay** | `{components.search-overlay}`: scrim, centred panel about 15vh from the top, chromeless input `{spacing.overlay-input-height}` tall at `{typography.input-search-overlay}`. Results grouped as Messages, Contacts, Events under uppercase `{typography.label-search-section}` labels. Message hits show avatar, subject with `{components.search-hit}` highlights, snippet, folder · account, date. Footer at inline-end: "N results · X.X ms" in `{typography.meta}` `{colors.text-secondary}`. |
| **Compose card** | `{components.compose-card}`, floating at the bottom inline-end corner. Header "New message" or "Re: …" with a From picker when there are several accounts; To and Cc chip inputs, subject, auto-growing body; footer with a "Send" `{components.button-primary}` and a trash icon button. |
| **Calendar view** | Month title in `{typography.heading-view}`, previous/next chevrons, a "Today" pill and a Month/Week toggle. Seven-column grid headed MON–SUN, date number at the top inline-end of each cell, today in an accent circle. Event chips use a categorical fill with `{colors.text-on-category}` labels in `{typography.meta}`, truncated, at most three plus "+N more". |
| **Contacts view** | Two columns on `{colors.surface-sunken}`. Left: searchable list with sticky first-letter headers. Right: `{colors.surface-panel}` detail card with a `{spacing.avatar-detail}` avatar, name in `{typography.heading-view}`, then icon + label + value rows. Edit and Delete at the top inline-end. |
| **Toast** | `{components.toast}` pill centred near the bottom, in `{colors.inverse-surface}` with `{colors.inverse-text}` and a close button at inline-end; up to three stack upward. Errors use `{components.toast-error}`: the same inverse pill with a `{colors.status-danger}` bar at inline-start, a danger icon in `{colors.status-danger}`, and the word "Error" before the message. |
| **Upgrade notice toast** | `{components.toast}`, titled "New: Appearance", with an "Open Appearance" text action at inline-end in `{colors.inverse-text}` and `{typography.label-control}`. |

Icon button, badge, nav item and buttons: `{components.icon-button}`, `{components.badge}`, `{components.nav-item}`, `{components.button-primary}` and `{components.button-secondary}`.

### Shared components

Every style uses these; each takes the theme's surfaces and the style's radius and spacing. Values below are the Loft style rendering the Loft theme.

| Component | Visual spec |
|---|---|
| **Preferences sheet** | One layout for every style: a nav list at inline-start and the content area beside it, inside the main window. It is skinned by the active theme's roles and the style's radius and spacing; no style lays it out differently. |
| **Modal** | `{components.modal}`: `{colors.scrim}` behind, a `{colors.surface-panel}` card with `{rounded.xl}` corners and `shadow-card` (the Loft source's modal card). New event and New contact open in it. |
| **Popover** | `{components.popover}`: a `{colors.surface-panel}` panel anchored to its trigger, on the style's radius. Used for the calendar's day and event popovers. Loft gives popovers `{rounded.lg}` corners and `shadow-soft`, one step quieter than modals. |

### Appearance page (Preferences › Appearance)

Layout is direction A, preview-first, chosen in [`mockups/appearance-directions.html`](mockups/appearance-directions.html) (it shows an older 7-theme catalogue and a two-state contrast switch). [`mockups/key-appearance.html`](mockups/key-appearance.html) is the final page: Classic applied, Loft · Taiga pending, the full page unrolled and the scrolled page with the sticky mini-preview and focus on Density. Appearance is a page of the **Preferences sheet** inside the main window, so its chrome and controls take the sheet's shared layout and skin: the active theme's roles and the style's radius and spacing. The page chrome renders in the applied theme; only the preview shows the pending look.

| Component | Visual spec |
|---|---|
| **Appearance preview** | `{components.appearance-preview}`: real app components on sample data in the pending look, nearly full width at the top of the page, under a header that shows "Preview" and the pending "Style · Theme" name, with the Pending/Applied switch at inline-end. |
| **Pending/Applied switch** | A small two-segment control in the preview header. The "Pending" segment carries an eye icon. |
| **Mini-preview** | `{components.appearance-mini-preview}`: on scroll, the large preview collapses into a strip `{spacing.appearance-mini-preview}` tall, pinned at the top of the page. It holds a thumbnail of the whole pending screen at inline-start, then the label ("Preview" and the pending "Style · Theme" name) with the Pending/Applied switch under it. |
| **Style card** | Grid of five built-in cards, then community styles: a wireframe thumbnail drawn in the card's theme tokens, the style name, a one-line description, "Previewing" and "Applied" tags, and on community styles a "Doesn't cover: …" line. |
| **Theme swatch** | Grid of nine built-in swatches, then third-party themes alphabetically: an "Aa" chip in the theme's typeface and colours, the theme name, four dots (ground, panel, accent, strong text), "Previewing" and "Applied" tags, and the derived badge on third-party themes whose shown variant is derived. A separate "⋯" menu button sits at the swatch's bottom inline-end corner, outside the swatch's own button. |
| **Derived badge** | A tag on a third-party theme swatch. Visual spec is open (see Open Questions 2). |
| **Install theme… / theme author link** | Below the theme grid. The author link is a card-width row with a palette icon, a bold title, a one-line sub-line and an external-link arrow. |
| **Display rows** | Label plus a one-line explanation at inline-start, the control at inline-end. Mode: three-segment control (Auto, Light, Dark). Increase contrast: three-segment control (Follow system, On, Off) plus an OS-state chip; its label in `{colors.text-strong}` on `{colors.surface-panel}`. Density: three-segment control. Text size: slider. Font: select. Adapt email colours in dark mode: switch. Mode, Increase contrast, Text size and Adapt email colours carry an "Applies immediately" caption under the label and explanation; the other rows apply through the apply bar. |
| **Text size slider** (Display rows › Text size) | A small "A" at the low end, a large "A" at the high end, and the current percentage shown as a value. |
| **Control states** | As drawn in direction A, read through roles. Segmented controls (Mode, Increase contrast, Density): a `{colors.surface-hover}` track with `{colors.text-default}` labels, `{colors.text-strong}` on hover; the selected segment is a raised `{colors.surface-panel}` pill with its label in `{colors.accent-text}` at weight 500. Switch: `{colors.control-track}` track when off, `{colors.accent-default}` when on, `{colors.surface-panel}` knob. Select: `{colors.surface-hover}` fill. Text-size value: an `{colors.accent-tint}` pill with `{colors.accent-text}`. Style cards and theme swatches: `{colors.surface-panel}` with a 1px `{colors.control-border}` ring at rest; on hover the ring turns `{colors.control-track}` and `shadow-soft` is added; a 2px `{colors.accent-default}` ring when selected. In high contrast both control roles take `{colors.border-strong}`'s value (see Colors › High-contrast values). Focus: `{components.focus-ring}` on every control. Disabled buttons: 45% opacity, no shadow. |
| **Apply bar** | `{components.apply-bar}`, pinned to the bottom of the page and hidden when nothing is pending: a status dot, the "Previewing changes" title with a summary, an "Esc discards" hint, Revert and Apply. The Apply button shows its shortcut. |

### Onboarding looks step

| Component | Visual spec |
|---|---|
| **Onboarding look card** | Visual reference: [`mockups/key-onboarding.html`](mockups/key-onboarding.html). The looks step renders in Loft: one `{colors.surface-panel}` card with `{rounded.xl}` corners and `shadow-card` on the `{colors.surface-app}` ground. Header: "Pick a look" in `{typography.heading-view}` `{colors.text-strong}` with its sub-line in `{colors.text-default}`, and "Skip" as a text button in `{typography.label-control}` `{colors.text-default}` at the header's top inline-end. Three look cards in a row: Loft (Loft theme), Classic (Classic theme), Darkside (Darkside theme). Each card takes the style card's anatomy and states: a wireframe thumbnail drawn in that look's own theme roles, the look's name in `{typography.heading-section}` `{colors.text-strong}`, and the style catalogue's one-line description in `{colors.text-default}`; `{colors.surface-panel}` with a 1px `{colors.control-border}` ring at rest, a 2px `{colors.accent-default}` ring and `shadow-soft` when selected, `{rounded.lg}` corners. Below the cards, the Text size and Increase contrast display rows; "Continue" as `{components.button-primary}` at the bottom inline-end. In high contrast each thumbnail gains a 1px `{colors.border-strong}` edge. |

## Do's and Don'ts

| Do | Don't |
|---|---|
| Have styles read role tokens only (`{colors.accent-default}`, `{colors.surface-panel}`) | Put a hex value, or a theme name, in a style |
| Keep radius and spacing in the style, and colour, type, line height and shadow in the theme | Let a theme change corners, spacing or layout |
| Use `{colors.accent-text}` for accent-coloured text and `{colors.accent-default}` for accent fills | Put text in `accent-default` on a panel, or anything but `accent-on` on an accent fill |
| Draw folder tints, avatar backgrounds and event chips from the categorical palette, labels in `{colors.text-on-category}` | Hard-code pastel hexes in a style, or store an override as a hex |
| Match each theme's reference exactly at standard contrast | Quietly fix a theme's standard-contrast ratios. That job belongs to Increase contrast |
| Make every high-contrast variant pass every pair in Colors › Contrast pairs | Ship a high-contrast variant that fails a pair |
| Draw focus with `{components.focus-ring}`, two-tone | Port `outline: none` from the Loft source |
| Lay out with logical properties (inline-start and inline-end) | Use `left` or `right` in style layout |
| In Loft, separate surfaces by tint and shadow at standard contrast | Add borders in Loft at standard contrast beyond the right-rail divider (Increase contrast and forced colours add them) |
| In Loft, give every accent-filled element `shadow-accent` | Put `shadow-accent` on non-accent surfaces |
| Leave images in email bodies untouched in dark mode; give transparent images a light backing plate | Invert or filter sender images |
| Draw hairlines at 1 device pixel | Let hairlines blur between scale factors |
| Show the derived badge only on third-party themes | Badge a built-in theme |

## Open Questions

Visual questions and build tasks, open by decision. Architecture-owned ones are in `EXPERIENCE.md` › Open Questions.

1. **Loft multi-select** (Loft epic). The floating accent card marks the single open thread. How a bulk selection of threads looks is undecided.
2. **Visual specs for the derived badge and the View original toggle** (Loft epic).
3. **Non-Loft style specs** (owner: each style's epic: Classic, Taiga, Darkside, Less-is-more). Each style's spacing, row and selection treatment and rail placement are designed in a short style spec, an Update of these docs, at the start of its epic. These docs specify only the system and the Loft style; the arrangements in [`mockups/key-free-mix.html`](mockups/key-free-mix.html) are illustrative.
4. **Theme type ramps** (owner: themes epic). Every theme except Loft gets its type ramp (sizes, weights, line heights in its own face) there.
5. **New-component pairs in the ported themes** (owner: user, themes epic). The badge (`accent-text` on `accent-tint`), the error-toast bar (`status-danger` on `inverse-surface`) and the bell dot (`status-danger` on `surface-toolbar`) fail at standard contrast in some ported themes (Colors › Built-in theme role table). Each colour is legacy in its own use, so correcting them would move a legacy link, error or toast colour. Mapping errors to correct, or standard-contrast failures to keep like Loft's?
6. **Build tasks.** The one list; the Theme catalogue's Build task column gives each theme's share.
   - Design, not derive, the light modes for Volt, Ember and Dusk and the dark modes for Darkside and Less-is-more.
   - Derive the dark modes for Aubergine and Taiga in OKLCH and hand-check them. The derivation rule for a whole mode is not decided yet.
   - Derive every high-contrast variant of the ported themes (Classic, Aubergine, Taiga, Darkside, Less-is-more), then hand-check it against Colors › Contrast pairs.
   - Hand-check the derived Loft light high contrast, and all four variants of Volt, Ember and Dusk.
   - Hand-check every other derived value: categorical colours 5–8, every derived variant, and every value in Colors › Derived values pending hand-check.
