---
type: experience
title: Theme and style system
status: final
updated: 2026-11-11
name: Nylas Mail theme and style system
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
---

# Theme and style system — Experience Spine

`DESIGN.md` is the visual reference and owns every token named here as `{path.to.token}`. This spine owns behaviour. Where this file and any mockup or import disagree, this file wins.

## Foundation

- **Form factor.** A desktop Electron app for macOS, Windows and Linux. The window is frameless and each style draws its own title bar.
- **UI system.** None external. The system is a shared token layer that nine built-in themes fill in and five built-in styles read, under the Style Contract below.
- **Stakes.** A public open-source release that people will install, so first-run defaults matter, the theme and style APIs face users, and accessibility is not optional.
- **Starting point.** Today `theme-manager.js` stacks `[ui-light base, chosen theme]` and recompiles LESS on every switch: 143 variables in `static/variables/ui-variables.less`, about 15k lines of LESS, no CSS custom properties. Thread-list row heights are fixed in JS (36/85px). Preferences is an in-window sheet (`WorkspaceStore.defineSheet` in `internal_packages/preferences/lib/main.jsx`), not a separate window. Existing packages behind Loft's surfaces: `main-calendar`, `participant-profile`, `preferences`, `thread-search`, `composer`, `account-sidebar`. No contacts view exists. The LESS-to-runtime migration is owned by architecture (see Open Questions).
- **Third party.** Themes come through the tokens API only (token files). Styles come through a public style API as plugin packages. Old community LESS themes stop working. The six built-in LESS themes are ported: `ui-light` and `ui-dark` merge into the Classic theme, `ui-ubuntu` becomes Aubergine, and the other three each become a style plus a theme.
- **Settings axes.** Style, theme, density and the accessibility settings (Increase contrast, text size, font override) are independent and mix freely. See `DESIGN.md` › Brand & Style.
- **Accepted risks** (reviewed and reaffirmed): standard contrast stays mockup-exact, with the safeguards in `DESIGN.md` › Colors › Contrast pairs; all five styles stay full-layout styles under free mix; each style keeps owning its frameless title bar on all three OSes.

## Information Architecture

### Where each setting lives

| Setting | Changed in | Values | Default | Applies |
|---|---|---|---|---|
| Style | Preferences › Appearance; onboarding looks step (as part of a look) | Classic, Loft, Taiga, Darkside, Less-is-more, then community styles | Loft (skipping onboarding lands on Loft) | Preview, then Apply |
| Theme | Preferences › Appearance; onboarding looks step; themes folder; Install theme… | Built-ins first (Classic, Aubergine, Taiga, Darkside, Less-is-more, Loft, Volt, Ember, Dusk), then installed themes alphabetically | Loft | Preview, then Apply |
| Mode | Preferences › Appearance | Auto (follows OS), Light, Dark | Auto. Onboarding follows the OS | Immediately |
| Increase contrast | Preferences › Appearance; onboarding looks step; OS `prefers-contrast` | Follow system, On, Off | Follow system | Immediately |
| Density | Preferences › Appearance | Compact, Comfortable, Spacious | First run: the onboarded style's native density (Comfortable, or Compact for Less-is-more). After that it persists across style switches | Preview, then Apply |
| Text size | Preferences › Appearance; onboarding looks step | 87.5–150% in 12.5% steps | 100% on every OS (Electron exposes no OS text scale). User-owned afterwards | Immediately |
| Font | Preferences › Appearance | Theme default, System font, Inter, IBM Plex Sans, Atkinson Hyperlegible, Ubuntu, Choose installed font… | Theme default | Preview, then Apply |
| Adapt email colours in dark mode | Preferences › Appearance | On / off | On | Immediately |
| `/` search shortcut | Preferences › Shortcuts | On / off | On | Immediately |
| Window zoom | ⌘+ / ⌘− (Ctrl on Windows and Linux) | Electron zoom | Unchanged; stacks on top of text size | Immediately |

The old theme-picker modal is retired. Preferences › Appearance replaces it.

| Place | Reached from | Purpose |
|---|---|---|
| **Preferences sheet** | Preferences menu item; in Loft, the sidebar's Settings entry, the top-bar gear and the account chip's "Add account…" | An in-window sheet holding every setting for every style, Appearance included. Every style shares one layout for it (a nav list and a content area), skinned by the active theme and the style's radius and spacing. No style has an in-window Settings view of its own; the Settings view in Loft's spec is not built. |
| **Preferences › Appearance** | Preferences sheet, Appearance tab | Choose style, theme, mode, contrast, density, text size, font and email adaptation. Preview real components, then Apply. Install a theme from a file. Link to the theme author guide. |
| **Onboarding looks step** | First launch, after account setup. Shown once per install; adding more accounts never repeats it | Pick one of three looks: Loft (Loft theme), Classic (Classic theme), Darkside (Darkside theme), then Continue. Set text size and Increase contrast in the same step. Skippable; skipping lands on Loft. The step renders in Loft. Appearance is the way back. |
| **"New: Appearance" notice** | First launch after upgrading from a version with LESS themes | A toast with an **Open Appearance** action. See State Patterns. |
| **Themes folder** | File system: `~/.nylas-mail/themes/*.tokens.json` | Theme authors' working folder. Saving a file live-reloads that theme. |

Appearance layout reference: direction A, chosen in [`mockups/appearance-directions.html`](mockups/appearance-directions.html) (it shows an older 7-theme catalogue and a two-state contrast switch). The final page is [`mockups/key-appearance.html`](mockups/key-appearance.html): pending Loft · Taiga over an applied Classic, the apply bar, the sticky mini-preview and keyboard focus on Density. The onboarding looks step is [`mockups/key-onboarding.html`](mockups/key-onboarding.html).

### Surfaces every style must lay out

Every surface registers into a region of the Style Contract. Each built-in style lays out every surface before its feature ships; Loft does it first. Behaviour is shared across styles; only placement differs.

| Surface | Region | Exists today | Notes |
|---|---|---|---|
| Mail view: sidebar, message list, reading pane | nav, list, reading | Yes | |
| Right rail (attachments, people in conversation, thread timeline) | rail | No (`participant-profile` is related) | |
| Top-bar search pill and search overlay | titlebar, overlay | `thread-search` | |
| Top-bar account chip (account switcher) | titlebar | `account-sidebar` | |
| Compose | overlay | `composer` | |
| Calendar | list, reading | `main-calendar` (unfinished) | May be scheduled under the state-of-the-art initiative |
| Contacts | list, reading | No | May be scheduled under the state-of-the-art initiative |
| Toasts | toast | Partly | |

Feature content from Loft's spec that the reconcile file marks "dropped → feature epics" (contact fields, new-event modal fields, provider presets and forms, the OAuth note, account kind and status words, the folder set and icons, relative timestamp formats, the attachment thumbnail source) belongs to the feature epics (Contacts, Calendar, Settings, mail list). See [`reconcile-loft-DESIGN.md`](reconcile-loft-DESIGN.md).

## Style Contract

What a style can and cannot change, as users and style authors meet it. The technical form is owned by architecture (see Open Questions).

| Rule | Behaviour |
|---|---|
| **Shared components** | Every style uses the same feature components. A style arranges them into regions and sets radius, spacing, row heights per density and component variants through CSS. A style can't replace a component, so each feature is written once. |
| **Regions** | A fixed set of named regions: titlebar, nav, list, reading, rail, overlay, toast. Every style places each one or explicitly hides it. Features register into regions, not into styles. |
| **Tokens** | A style reads only role tokens. It never names a theme or a hex value. Colour, typography, line height and shadow come from the theme. |
| **Title bar** | Each style owns its title bar in the frameless window (see Responsive & Platform). |
| **Built-in coverage** | A feature can't ship until all five built-in styles lay it out. This is a release blocker. |
| **Free mix** | Any theme in any style at any density, with nothing tuned per pairing. [`mockups/key-free-mix.html`](mockups/key-free-mix.html) shows three crosses (Loft + Taiga, Classic + Ember, Less-is-more + Volt at Compact); its Classic and Less-is-more arrangements are illustrative until those styles have specs. |
| **Community styles** | The style API is public from day one; styles are plugin packages. Under a community style, a feature it doesn't cover renders in Classic's region arrangement, and its style card lists what it doesn't cover, for example "Doesn't cover: Contacts". |
| **Layout mode** | The existing `layoutMode` preference (single pane or split pane) is honoured by Classic, Taiga, Darkside and Less-is-more. Loft is always split pane and hides the option. |
| **Obligations every style meets** | Logical properties for RTL; the reflow ladder below its minimum width; focus rings never clipped; forced colours honoured; Increase contrast borders where separation is by shadow or tint only; every transition instant under reduced motion. |

## Voice and Tone

Microcopy only. The drafted strings were accepted; copy review happens in the build.

### Tone rules

| Do | Don't |
|---|---|
| Name the setting by its effect: "Increase contrast", "Text size", "Density". Use "high contrast" for the variant and "Increase contrast" for the setting. | Technical names like "High-contrast token set" or "Scale factor". |
| Say only what a setting does. | Promise more than a setting does, such as saying a theme changes corners. |
| Name the user's actual OS. The OS name and its setting's name in the Increase contrast strings and in the OS chip come from the platform at runtime. | Say "macOS" on Windows or Linux. |
| Say when the OS is driving a value, as the OS chip does. | Hide the fact that the OS is driving the value. |
| Call it "Text size", and say window zoom is separate. | Call text size "zoom". |
| Label the apply bar's buttons **Revert** and **Apply**. | "Save", "OK", "Cancel". |
| Name the whole new look in the Apply announcement. | Announce only the axis that changed. |
| Describe a derived variant as one the author hasn't made yet. | Imply the theme is broken or unofficial. |
| Use "View original" and "View adapted" for the email-colour toggle. | "Disable dark mode for this message". |
| Say "Install theme…". | "Import tokens", "Download tokens". |
| Let people skip the looks step. | Tell people they must choose. |
| Lead error toasts with the word "Error" before the message. | Show a stack trace, or fail silently. |

### Strings

Source: **Mockup** is a string from the mockup; **Mockup, edited** is a mockup string the spine changed; **Drafted** is a string the spine wrote.

| Surface | String | Source |
|---|---|---|
| Appearance group intros | "Layout and component shapes. Any style works with any theme." · "Colour, type and shadow tokens." · "These apply on top of any style and theme." | Mockup, edited |
| Mode explanation | "Auto follows your macOS appearance. Right now that's Light." | Mockup |
| Increase contrast explanation | "Raises text and icon contrast to WCAG AA in every theme. Follows the macOS 'Increase contrast' setting until you change it here." | Mockup |
| Increase contrast OS chip | "Following macOS: off" | Mockup |
| Text size explanation | "Resizes text and lets layouts reflow. Window zoom (⌘+ and ⌘−) is separate and stacks on top." | Mockup |
| Font explanation | "Overrides the theme's typeface everywhere in the app." | Mockup |
| Density explanation | "How much space rows and panes get. Works with any style." | Mockup |
| Caption on settings that skip the apply bar (Mode, Increase contrast, Text size, Adapt email colours) | "Applies immediately" | Drafted |
| Adapt email colours explanation | "Recolours emails so they're easy to read in dark mode. Images are never changed." | Drafted |
| Apply bar | Title "Previewing changes"; a summary such as "Style: Classic → Loft · Theme: Classic → Taiga"; hint "Esc discards"; buttons **Revert** and **Apply**. Apply shows its shortcut (⌘↵, or Ctrl+Enter). | Drafted |
| After Esc | "Changes discarded · Undo" | Drafted |
| Apply announcement | "Appearance updated: Loft style, Taiga theme, Compact" | Drafted |
| Derived badge | "derived" (the single lowercase word). Tooltip: "Generated from this theme's light colours. The author hasn't made this version yet." | Drafted |
| Email body toggle | "View original" restores sender colours; its counterpart is "View adapted". | Drafted |
| Install | "Install theme…" opens a file picker. Clash with an installed third-party theme: **Replace** / **Keep both**. | Drafted |
| Swatch "⋯" menu | "Export a copy…" (creates "<Name> copy"), "Remove theme" | Drafted |
| Community style card | "Doesn't cover: Contacts" | Drafted |
| Theme author link | "Get more themes or make your own." Sub-line: "Themes are DTCG JSON token files. Read the theme author guide." | Mockup |
| Upgrade toast | "New: Appearance", with the action **Open Appearance** | Drafted |
| Onboarding looks step | Heading "Pick a look"; sub-line "You can change this any time in Preferences › Appearance. Light and dark follow your system."; buttons **Continue** and "Skip" | Drafted |
| Error toasts | "Couldn't load 'Ocean'. Using Loft instead." · "'Ocean' has an error on line 12: expected a colour value. Showing the last version that worked." · "'Fira Sans' isn't installed. Using the theme's default font." | Drafted |
| Presence | "Online" | Drafted |

Still to draft in the build: the inline error for a clash with a built-in theme's id or name, and the community-LESS-theme and deleted-theme toasts, which name the theme.

## Component Patterns

Behaviour only. Visual specs are in `DESIGN.md` › Components under the same names, grouped and ordered as there.

### Loft mail surfaces

| Component | Use | Behavioural rules |
|---|---|---|
| **App frame / app card** | Window | Static. |
| **Top bar** | Every view (Loft) | Holds the window controls (per OS), the app's own mark, search pill, bell, gear and account chip. It is the window's drag region; the interactive controls inside it are not. The gear opens the Preferences sheet. The bell opens the notifications feature, which is its own epic; Loft only places the bell. |
| **Search pill** | Top bar (Loft) | Click, `/`, or ⌘K (Ctrl+K on Windows and Linux) opens the search overlay. `/` fires only when focus is not in a text field, and can be turned off in Preferences › Shortcuts. |
| **Account chip** | Top bar (Loft) | Opens a dropdown: "All accounts", each account, and "Add account…", which opens the Preferences sheet. |
| **Sidebar** | Every view (Loft) | The primary button's label and action follow the view: Compose email, New event, New contact. Nav rows switch folder. The pinned view switcher changes view (Mail, Calendar, Contacts); its Settings entry opens the Preferences sheet. |
| **Message row** | Mail view | Newest first; infinite scroll loads older messages. Hover lifts the row. Clicking opens it in the reading card. Unread: bolder subject plus a dot, and the row's accessible name says "Unread". At Compact density Loft rows drop the snippet. |
| **Selected message card** | Message list (Loft) | Marks the single open thread. Bulk selection is open (see `DESIGN.md` › Open Questions 1). |
| **Focus ring** | Everywhere | See Accessibility Floor. |
| **Reading card** | Mail view | Reply, Reply all and Forward in the header; Reply and Forward pills in the footer. Remote images stay blocked until "Show remote images" is clicked. Clicking a dimmed older message below the card opens it. |
| **View original toggle** | Reading pane, per message, in dark mode | Switches between adapted colours ("View adapted") and the sender's colours ("View original"). Remembered per sender address, per account. |
| **Right rail** | Reading card | A labelled complementary landmark with headings (Attachments, People) and list semantics. Built from the message's From, To and Cc fields. The thread timeline sits at the bottom of the rail; its items are clickable and scroll to that message; the current item is bold with `aria-current`. |
| **Presence dot** | Right rail, people | Has a ring, an accessible name, and the text label "Online" in the people list. |
| **Older thread messages** | Below the reading card | Clicking one opens it. |
| **Search overlay** | Over the window | A combobox with a listbox of results grouped as Messages, Contacts, Events, updated as you type. Arrow keys move, Enter opens, Esc closes. Supports `from:`, `to:`, `in:`, `is:unread`, `is:flagged`, `has:attachment`, `account:`. The footer shows the result count and the server time to one decimal. **Security contract:** hit highlights render as HTML, which is safe only because the search layer escapes the text first. |
| **Compose card** | Mail view | Floats at the bottom inline-end corner. From picker when there are several accounts. To and Cc autocomplete from contacts. Send, or trash to discard. |
| **Calendar view** | Calendar | Previous and next move by month or week; "Today" jumps to now; Month/Week toggles the view. Clicking a day lists its events in a side panel or popover; clicking an event opens a detail popover with edit and delete. Chips show the calendar's name on hover and focus and in the day panel. "New event" opens a modal. |
| **Contacts view** | Contacts | Searchable list with sticky letter headers. Selecting a contact fills the detail card. Edit and Delete are on the card. "New contact" opens a modal with the same fields. |
| **Toast** | Global | Bottom centre. At most three stack; toasts are de-duplicated by key, and each live-reload error replaces the previous one. Info toasts are `role="status"` and auto-dismiss after 5 seconds, paused on hover and focus. Error toasts (`{components.toast-error}`) are `role="alert"`, persist until dismissed, and carry the word "Error" as text, so the danger bar and icon are never the only signal. Every toast has a close button; clicking a toast also dismisses it. |
| **Upgrade notice toast** | First launch after upgrade | Its **Open Appearance** action opens Preferences › Appearance. Persists until dismissed or acted on. |
| **Icon button** | Everywhere | Hover tints the button; active state uses the accent. Every icon-only button has an accessible name. |
| **Badge** | Nav item | A count shows only when it is greater than 0, Inbox included. |
| **Nav item** | Sidebar | Clicking switches folder; the active row is marked by colour and by `aria-current`. |
| **Button (primary, secondary)** | Everywhere | Hover changes fill (primary) or label colour (secondary); press nudges 1px (Loft micro-motion). Instant under reduced motion. |

### Shared components

| Component | Use | Behavioural rules |
|---|---|---|
| **Preferences sheet** | Main window | An in-window sheet with one shared layout in every style: the nav list switches pages and the content area shows the page. Skinned by the active theme and the style's radius and spacing. |
| **Modal** | Over the window (New event, New contact) | Opens over a `{colors.scrim}`; focus is trapped inside it; Esc closes it. |
| **Popover** | Anchored to its trigger (calendar day and event popovers) | Focus is trapped inside it; Esc closes it. |

### Appearance page

| Component | Use | Behavioural rules |
|---|---|---|
| **Appearance preview** (`{components.appearance-preview}`) | Top of Appearance | Renders real components (top bar, message list, reading card) on fixture (sample) data, never the user's mail, in the pending style, theme, density and font and the current mode, contrast and text size. Updates on every change with a 120ms cross-fade (instant with reduced motion). Inert: out of the Tab order, no click interaction, hidden from screen readers. OS mode and contrast changes re-render it at once. |
| **Pending/Applied switch** | Preview header | Two-segment toggle. "Applied" shows the committed look for comparison; "Pending" shows the change. Changes nothing in the app. |
| **Mini-preview** (`{components.appearance-mini-preview}`) | Appearance, on scroll | When the large preview scrolls out of view it collapses into a sticky strip `{spacing.appearance-mini-preview}` tall at the top. Scrolling back restores the large preview. `scroll-padding` keeps the focused control clear of it and of the apply bar. |
| **Style card** | Appearance › Style | Standard radio group: arrow keys move and select, and selecting only previews (changes the pending style). Tags mark "Previewing" and "Applied". Community styles follow the built-ins and show "Doesn't cover: …". |
| **Theme swatch** | Appearance › Theme | Standard radio group, same rules. Built-ins first, then third-party themes alphabetically. A "⋯" menu button at each swatch's bottom inline-end, outside the radio group, holds "Export a copy…" (built-ins) and "Remove theme" (third-party). Shows the derived badge on a third-party theme whose variant for the current mode and contrast is derived. |
| **Derived badge** | Third-party theme swatch | Shown when a third-party theme doesn't ship the active mode or contrast level, when its file is missing a role (filled from the Classic theme), or when its high-contrast variant failed the pair check and the failing pairs were re-derived. Never on built-ins. Not clickable; its tooltip is also exposed through `aria-describedby`. |
| **Install theme… / theme author link** | Below the theme grid | Install opens a file picker for a `.tokens.json` file. A valid file is copied into the themes folder and becomes the pending theme. An invalid file, or one that clashes with an installed or built-in theme, is handled as in Theme Authoring › Validation and › Install, export, remove. The author link opens the theme author guide. |
| **Display rows › Mode** | Appearance | Auto, Light or Dark. Applies immediately. Auto tracks the OS live. |
| **Display rows › Increase contrast** | Appearance; onboarding looks step | Follow system (tracks `prefers-contrast` live), On, Off. Applies immediately. An OS-state chip shows the OS setting. Its label passes AA in every theme. |
| **Display rows › Density** | Appearance | Compact, Comfortable, Spacious; pending until Apply. The user's density persists when the style changes. |
| **Display rows › Text size** | Appearance; onboarding looks step | 87.5–150% in 12.5% steps. Applies immediately to the whole app, Appearance included. Scales `{typography.*}` sizes and lets layouts reflow. Independent of window zoom. |
| **Display rows › Font** | Appearance | "Theme default" (naming the active theme's typeface) plus the override list; pending until Apply; applies app-wide. |
| **Display rows › Adapt email colours** | Appearance | App-wide switch, on by default. Applies immediately. Off shows every email body in the sender's colours in dark mode. |
| **Apply bar** (`{components.apply-bar}`) | Bottom of Appearance | Visible only while a style, theme, density or font change is pending. Lists what changed. **Apply** (or ⌘Enter / Ctrl+Enter) commits all pending changes at once. **Revert** discards them. Esc discards them and the bar shows "Changes discarded · Undo" for 5 seconds. |

### Onboarding looks step

| Component | Use | Behavioural rules |
|---|---|---|
| **Onboarding look card** | Onboarding looks step | Three cards in a radio group: Loft, Classic, Darkside, each with its style-catalogue line. Skip sits at the step's top inline-end; Continue at its bottom inline-end. Picking a card and pressing Continue applies that look directly, with no preview step. Skip applies Loft. Mode follows the OS either way. At 150% text the step scrolls vertically. |

## State Patterns

Empty, loading and error states for the mail surfaces themselves (inbox, search, calendar, contacts) belong to those feature epics.

### Appearance

| State | Surface | Treatment |
|---|---|---|
| **Pending equals applied** | Appearance | The apply bar is hidden. |
| **Pending differs from applied** | Appearance | The preview shows pending. Cards and swatches carry "Previewing" and "Applied" tags. The apply bar lists the changes. Nothing outside the preview changes until Apply. |
| **Applied** | App-wide | The app cross-fades in about 200ms, starting only after the new look has painted; instant with reduced motion. Focus stays where it was. Screen readers hear the whole new look ("Appearance updated: Loft style, Taiga theme, Compact"). |
| **Discarded** | Appearance | After Esc the bar shows "Changes discarded · Undo" for 5 seconds; Undo restores the pending set. |
| **Leaving Appearance with pending changes** | Appearance | Closing the page discards pending changes silently. |
| **Immediate setting changed** | App-wide | Mode, Increase contrast, text size and Adapt email colours apply at once to the app, the Appearance page and the preview. Pending style, theme, density and font picks are kept. |

### OS signals

| State | Surface | Treatment |
|---|---|---|
| **OS light/dark or contrast changes** | App-wide | Applies at once to the applied look and the preview. Pending picks are kept. |
| **OS Increase contrast on** | App-wide, first launch included | With Follow system, high-contrast values apply with no in-app action. The chip shows "Following macOS: on". |
| **Forced colours active** | App-wide | Honoured. See Accessibility Floor; the visuals are in `DESIGN.md` › Colors › Forced colours and Increase contrast borders. |
| **Font missing** | App-wide | The theme's default font is used, with a toast. |

### Theme files

| State | Surface | Treatment |
|---|---|---|
| **Derived variant active** | Third-party theme swatch, app | Values derived in OKLCH from the theme's light values; the swatch shows the derived badge. Built-ins never enter this state. |
| **Third-party high contrast fails AA** | Theme load | Failing pairs are re-derived and the derived badge shows. Built-ins can't fail. |
| **Theme fails to load** | App start, Appearance | Falls back to the last valid version, then Loft, with an error toast. See Theme Authoring › Last valid cache. |
| **Active theme file deleted** | Running app | The cached copy stays in use, with a toast. See Theme Authoring › Last valid cache. |
| **Token file missing a role** | Any | Filled from the Classic theme; the swatch shows the derived badge. See Theme Authoring › Partial themes. |
| **Token file invalid** | Install, themes folder, app start | Rejected, with an error naming the file and line. See Theme Authoring › Validation. |
| **Live-reload error** | Themes folder → running app | The last valid version stays, with an error toast naming the file and line. See Theme Authoring › Live reload. |
| **Themes folder not there yet** | Install, Export a copy…, app start | Created on the first install or export. See Theme Authoring › Location. |
| **Themes folder can't be written** | Appearance, running app | "Install theme…" is disabled with an inline note; live reload is off. See Theme Authoring › Location. |
| **Install clash** | Appearance | **Replace** or **Keep both** for a third-party clash; an inline error for a built-in one. See Theme Authoring › Install, export, remove. |

### Upgrade

| State | Surface | Treatment |
|---|---|---|
| **Upgrade from a built-in legacy theme** | First launch after upgrade | `ui-taiga` → Taiga style + Taiga theme; `ui-darkside` → Darkside + Darkside; `ui-less-is-more` → Less-is-more + Less-is-more; `ui-light` and `ui-dark` → Classic style + Classic theme; `ui-ubuntu` → Classic style + Aubergine. A `ui-dark` user keeps Mode pinned to Dark. The "New: Appearance" toast appears and persists until dismissed. |
| **Upgrade from a community LESS theme** | First launch after upgrade | Lands on Classic style + Classic theme, with a persistent toast naming the theme that no longer loads. |
| **Legacy settings and files** | Upgrade | The legacy `core.themes` key is left untouched (so a downgrade still works); new settings use new keys. When themes are stacked, the first non-base entry is the one that maps. A user's `styles.less` is not loaded; the app hasn't loaded one since Nylas removed it. No LESS compiler ships: a package's `.less` stylesheet is not loaded, and the app logs a deprecation naming the package once per launch. The theme and plugin author guide publishes the legacy-variable → role map so plugin authors can port to CSS on role tokens. |

### Reading pane

| State | Surface | Treatment |
|---|---|---|
| **Email in dark mode** | Reading pane | Adapted by default. See Email Body Rendering. |
| **Remote images blocked** | Reading pane (Loft) | Blocked by default, with a "Show remote images" chip. |

### Layout

| State | Surface | Treatment |
|---|---|---|
| **Community style missing a feature** | App-wide | The feature renders in Classic's region arrangement. |

## Interaction Primitives

- **Two apply models.** Mode, Increase contrast, text size and Adapt email colours apply immediately. Style, theme, density and font change only the preview until **Apply**; **Revert** or **Esc** discards them; closing the page discards silently. Onboarding look cards apply on Continue with no preview step.
- **Esc.** The first Esc closes an open menu or select; the next discards pending changes, with Undo for 5 seconds.
- **Compare.** The Pending/Applied switch flips the preview between the two looks.
- **Sticky mini-preview.** Keeps the effect of the lower controls in view.
- **Motion.** Apply cross-fades in about 200ms after the new look paints; preview updates cross-fade in 120ms. Loft's micro-motion (0.12s hover and press transitions, a 1px press nudge, a 0.18s toast entrance, from `imports/loft-global.css`) applies to its components. With reduced motion, every motion in the app is instant.
- **Live OS tracking.** Mode Auto and Increase contrast Follow system track the OS while running.
- **Live reload.** Saves in the themes folder reload the theme after a 300ms debounce.
- **Keyboard.**
  - Appearance: Tab moves between groups in reading order. Style cards and theme swatches are radio groups; arrow keys move and select (preview only). "⋯" menus sit outside the groups. ⌘Enter / Ctrl+Enter applies. Esc closes a menu, then discards.
  - Loft: `/` (outside text fields) or ⌘K / Ctrl+K opens search. Arrow keys, Enter and Esc work inside the overlay.
  - Window zoom: ⌘+ / ⌘− (Ctrl on Windows and Linux).
- **Banned.** A separate theme-picker modal (retired). Applying a style, theme, density or font outside the preview, except from onboarding. Applying an installed theme directly: it becomes the pending theme.

## Accessibility Floor

Behavioural. Contrast thresholds, pairs and measured values are owned by `DESIGN.md` › Colors › Contrast pairs.

- **Increase contrast.** Follow system, On, Off; applies immediately. When on, every theme swaps to its high-contrast variant for the current mode, which passes every pair. At standard contrast themes match their reference, an accepted risk with two safeguards: onboarding offers Increase contrast, and the control's own label passes AA in every theme.
- **Forced colours.** Windows Contrast themes and GNOME high contrast are honoured. What they change on screen, and the borders Increase contrast adds where separation is by shadow or tint only, is owned by `DESIGN.md` › Colors › Forced colours and Increase contrast borders.
- **Text size.** 87.5–150%, applies immediately, separate from window zoom. Starts at 100% on every OS, because Electron exposes no OS text scale; every first launch offers the slider in the onboarding looks step. WCAG 1.4.4 (200%) is met by text size (max 150%) combined with zoom, and this is documented.
- **Reduced motion.** App-wide: every transition in every style is instant, Loft micro-motion included.
- **Focus.** `{components.focus-ring}` in the dedicated `{colors.focus-ring}` role, drawn two-tone with a `{colors.surface-panel}` halo, 3:1 against every surface, never clipped by Loft's overhanging selected card. After Apply focus stays where it was. `scroll-padding` keeps focus clear of the sticky mini-preview and the apply bar (WCAG 2.4.11).
- **Screen readers.** Style cards and theme swatches are radio groups that expose their "Previewing", "Applied" and "derived" tags; the derived tooltip is on `aria-describedby`. The apply bar is a labelled region ("Pending appearance changes", from the mockup). Apply announces the whole new look. The Appearance preview and mini-preview are inert and hidden from screen readers. Info toasts are `role="status"`, errors `role="alert"`. The right rail is a labelled complementary landmark; search is a combobox with a grouped listbox. Every icon-only button has an accessible name.
- **Never by colour alone.** Applied and previewing state is carried by text tags. Presence: ring, "Online" label, accessible name. Unread: bolder subject plus dot. Current timeline item: bold plus `aria-current`. Calendar chips: the calendar name on hover, focus and in the day panel.
- **Pointer targets.** Every message-list row, in every style and density, keeps a pointer target of at least 24px (WCAG 2.5.8); row heights are in `DESIGN.md` › Layout & Spacing › Density.
- **Single-key shortcut.** `/` fires only outside text fields and can be turned off (WCAG 2.1.4).
- **Mixed scripts.** Names, subjects and snippets use `dir="auto"` with bidi isolation.
- **Scrollbars.** Reach 3:1 in high-contrast variants.

## Responsive & Platform

| Concern | Rule |
|---|---|
| **Window chrome** | Frameless on all three OSes. Each style owns its title bar and places the OS window controls in its own top bar. macOS: traffic lights at inline-start (in Loft, left of the app mark). Windows and Linux: controls at the inline-end of the style's top bar through Electron `titleBarOverlay`. The top bar is the drag region; interactive controls inside it are not. Per-OS mechanics are owned by architecture. |
| **Reflow ladder** | Each style declares its minimum window width (values in `DESIGN.md` › Layout & Spacing › Window chrome and minimum width). Below it, in order: collapse the right rail; collapse the folders; reduce the sidebar to an icon strip; merge list and reading pane into one pane with Back. The top bar collapses too: search becomes an icon and the account chip its avatar. Below the single-pane step the window scrolls instead of reflowing further, an accepted risk against WCAG 1.4.10 at 320 CSS px. The ladder holds at 150% text plus zoom. |
| **OS appearance** | Mode Auto follows macOS, Windows and Linux light/dark. Increase contrast on Follow system follows `prefers-contrast`. Forced colours are honoured. How the high-contrast signal is detected on Linux is owned by architecture. |
| **OS text size** | Read once on first launch where Electron exposes it (Windows, Linux GNOME); macOS starts at 100%. |
| **RTL** | Every style mirrors through logical properties: sidebar, list and reading pane swap sides; the selected card overhangs past the list's inline-end edge, into the reading pane; the compose card docks at inline-end. |
| **Text size and zoom** | Text size reflows layout; zoom scales everything on top of it. |
| **Scale factors** | Hairlines are 1 device pixel at every scale factor. |
| **Shortcuts** | ⌘ on macOS maps to Ctrl on Windows and Linux: ⌘K / Ctrl+K, ⌘Enter / Ctrl+Enter, ⌘+ and ⌘− / Ctrl++ and Ctrl+−. |

## Email Body Rendering

- **Dark mode.** Email bodies are adapted by default: backgrounds darken, images stay untouched. Transparent images get a light backing plate; the image itself is unaltered.
- **Outcome.** Adapted text meets the active contrast floor, and follows Increase contrast. The algorithm is owned by architecture and a build spike.
- **View original.** A per-message toggle restores the sender's colours. The choice is remembered per sender address, per account.
- **Replies, forwards and print.** Use the email's original colours, never the adapted ones. Printing uses the light standard variant.
- **App-wide switch.** "Adapt email colours in dark mode" on the Appearance page, on by default.
- **Body type in Loft.** Plain text in `{typography.body-reading}` and `{colors.text-reading}`. Sanitised HTML keeps the sender's styling within the adaptation rule.

## Theme Authoring

| Topic | Rule |
|---|---|
| **Format** | W3C DTCG JSON design tokens (interop with Figma, Style Dictionary, Tokens Studio). Architecture ratifies the runtime mapping (likely to CSS custom properties) and how one file expresses light/dark × standard/high contrast, under this UX constraint: one file per theme, holding four variant groups, `light`, `dark`, `light-hc` and `dark-hc`. |
| **Contents** | Every theme role in `DESIGN.md` (colours including the categorical palette and the new structural roles, typography including line height, the three shadow roles), for each mode and contrast level the author ships. Radius and spacing belong to styles. |
| **Validation** | Every value is validated against its DTCG `$type`. Only colour, dimension, font-family string, shadow and font-weight values are allowed. A value containing `url()`, `@import`, `var()`, `;` or `}` rejects the file. Files over 256KB are rejected. Alias cycles are rejected. A rejected file is never copied. Whether it fails at install, in the themes folder or at app start, the app keeps the last valid version, or falls back to Loft, and shows an error naming the file and line. |
| **Identity** | A theme is identified by `$metadata.id`. Built-in ids and names are reserved: installing a file that uses one is rejected with an inline error, and nothing is copied. The `$metadata` block carries id, name, author, version and license. |
| **Location** | `~/.nylas-mail/themes/*.tokens.json`, created when it's first needed (the first install or export), not on first launch. If it can't be written, "Install theme…" is disabled, with an inline note below it naming the folder's path, and live reload is off. |
| **Live reload** | Saving a file reloads that theme in the running app and the Appearance preview after a 300ms debounce. A parse failure counts as a partial save: the last valid version stays, and an error toast names the file and line, replacing any earlier one. |
| **Last valid cache** | The last valid version of each third-party theme is cached in the config folder on every successful load. If a theme fails to load, at app start or from Appearance, the app uses its last valid (cached) version, then Loft, with an error toast. If the active file is deleted, the cached copy stays in use, with a toast. Built-in themes are bundled, so they can't fail to load. |
| **Install, export, remove** | "Install theme…" validates a file and copies it into the themes folder; on success the new theme becomes the pending theme. A clash with an installed third-party theme's id asks **Replace** or **Keep both** before copying; **Keep both** asks the user to name the copy and gives the copy a new id. A clash with a built-in theme's id or name is rejected (see Identity). "Export a copy…" on a built-in creates "<Name> copy" with a new id. "Remove theme" in a third-party swatch's "⋯" menu removes it. |
| **Partial themes** | A third-party theme may ship only light standard. Missing modes and contrast levels are derived in OKLCH from its light values; missing roles are filled from the Classic theme; the picker shows "derived". At load, an authored high-contrast variant is checked against the pair table, and failing pairs are re-derived. |
| **Free mix** | A theme never targets a style. Any theme works in every style. |
| **Legacy** | Community LESS themes no longer load (see State Patterns). |
| **Styles** | Style authors use the public style API (see Style Contract). |
| **Docs** | The theme author guide is user-facing. Appearance links to it. Theme distribution is out of scope. |

## Verification Matrix

| Axis | Values | Count |
|---|---|---|
| Style | Classic, Loft, Taiga, Darkside, Less-is-more | 5 |
| Theme | Classic, Aubergine, Taiga, Darkside, Less-is-more, Loft, Volt, Ember, Dusk | 9 |
| Mode | Light, dark | 2 |
| Contrast | Standard, high | 2 |
| Density | Compact, Comfortable, Spacious | 3 |
| **Total** | | **540** |

- **By eye, in the real app.** Each style is checked by eye in the real Electron app at its native theme and density. Loft is compared against [`imports/loft-01.webp`](imports/loft-01.webp) with a scale-normalised diff, tolerant of anti-aliasing, that masks the redacted mark region in the titlebar. What the image is checked for, why it is not a pixel target, and the key-screen mock size are in `DESIGN.md` › Layout & Spacing › Loft style layout › Reference scale.
- **Automated sweep.** All 540 combinations get screenshots plus overflow checks. Contrast is checked against the pair table in `DESIGN.md` › Colors › Contrast pairs directly; axe runs only on high-contrast variants.
- Not in the count: text size, font override, LTR/RTL, forced colours and the three OSes, each of which multiplies the matrix.

## Inspiration & Anti-patterns

- **Lifted from the Loft mockup** ([`imports/loft-01.webp`](imports/loft-01.webp) and [`imports/loft-02.webp`](imports/loft-02.webp); see `DESIGN.md` › Layout & Spacing › Loft style layout › Reference scale): the visual and layout language of the Loft style and theme. Not lifted: the reference wordmark (redacted in both images; the app shows its own mark) and the in-window Settings view (Settings opens the Preferences sheet).
- **Loft dark:** Night Slate, chosen from four palettes in [`mockups/color-themes-loft-dark.html`](mockups/color-themes-loft-dark.html). The other three (OLED Volt, Ember Charcoal, Dusk Float) became the Volt, Ember and Dusk themes.
- **Kept from the legacy themes:** all six, ported to tokens.
- **Chosen: direction A (preview-first)** in [`mockups/appearance-directions.html`](mockups/appearance-directions.html). It gives the largest preview and suits Ines, who decides by looking. Its weakness, controls changing out of sight, is solved by the sticky mini-preview.
- **Not chosen:** direction B, split pane (small preview, cramped cards), and direction C, looks gallery (hides free mix). C's curated pairs survive as the onboarding looks.
- **Rejected:** the theme-picker modal, and LESS-based third-party themes.

## Key Flows

The four journeys were drafted by Sally and selected by the user.

### Flow 1 — Ines, first launch

New user; installs, adds a Gmail account, lands in a default look that feels current.

1. Ines installs Nylas Mail and opens it for the first time.
2. She adds her Gmail account.
3. The looks step appears, rendered in Loft: three cards (Loft, Classic, Darkside), a text-size slider and an Increase contrast control. Light or dark follows her OS. ([`mockups/key-onboarding.html`](mockups/key-onboarding.html))
4. She picks the Loft card and presses Continue. The look applies with no preview step. Skipping would also land on Loft.
5. Her inbox opens in Loft at Comfortable density.
6. **Climax:** She never needs Settings. One pick and she has fallen for Loft. If she later opens Preferences › Appearance, a large preview of real components shows any other look before she applies it.

Failure: none of the three looks can fail to load, because built-in themes are bundled. If she later applies a third-party theme that fails, the app uses its last valid version, then Loft: "Couldn't load '<theme>'. Using Loft instead."

### Flow 2 — Dev, theme author

Community contributor.

1. Dev opens Preferences › Appearance, opens the "⋯" menu beside the Classic swatch and chooses "Export a copy…". "Classic copy", with a new id, appears in the themes folder and the theme grid.
2. He edits its `$metadata` name and its colours in his editor. Each save reloads the theme in the running app and the Appearance preview after a 300ms debounce.
3. Any variant or role his file leaves out is derived, and the swatch shows "derived".
4. He arrows through the style cards to preview his theme in each style, using the Pending/Applied switch to compare.
5. He sets Increase contrast to On, which applies at once. His high-contrast variant is checked against the pair table; failing pairs are re-derived and marked "derived".
6. He completes the `$metadata` block (id, name, author, version, license), so the single `.tokens.json` file is a package users can add with "Install theme…".
7. **Climax:** His theme looks right in a style he never tested by hand.

Failure: a save the app can't parse, or a value with `url()`. The last valid version stays and an error toast names the file and line, replacing the previous one. Dev fixes it, saves, and the theme reloads.

### Flow 3 — Ruth, low vision

OS-level Increase contrast and larger text are on.

1. Ruth has Increase contrast and larger text turned on in her OS.
2. She installs and opens Nylas Mail.
3. With Increase contrast on Follow system, the app starts in high contrast: AA in every theme, Loft included. If she uses a Windows Contrast theme, forced colours are honoured instead.
4. Text size starts at 100%, since the app can't read her OS text scale.
5. The onboarding looks step shows the text-size slider and the Increase contrast control; both apply at once, to the step and the app. Loft is still recognisably Loft.
6. Later, in Appearance, text size and Increase contrast still apply immediately, the Appearance page included.
7. **Climax:** There is no setting to hunt for.

Failure: none for built-in themes. If she installs a third-party theme whose high-contrast variant fails AA, the failing pairs are re-derived and the swatch shows "derived".

### Flow 4 — Marco, triage power user

300 emails a morning on a laptop.

1. Marco opens Preferences › Appearance.
2. He leaves Mode on Auto, so the app turns dark with his OS at night.
3. He picks the Less-is-more style and the Classic theme; the preview changes.
4. He scrolls to Density and picks Compact. The sticky mini-preview shows the rows tightening. ([`mockups/key-appearance.html`](mockups/key-appearance.html), section 2)
5. He presses Apply (⌘Enter). The app cross-fades into the new look once it has painted, and focus stays where it was.
6. He triages his morning mail.
7. **Climax:** More rows per screen without losing scannability.

Failure: rows too cramped to scan. Each style sets its own row height per density; Less-is-more's Compact rows are 26px, and every row keeps a 24px pointer target. If he later switches style, his Compact density persists.

## Open Questions

The visual questions (Loft multi-select, the derived badge and View original toggle specs, non-Loft style specs, theme type ramps) and the build tasks are in `DESIGN.md` › Open Questions.

1. **Architecture-owned:**
   - the technical form of the style contract
   - the LESS-to-runtime migration
   - the email dark-adaptation algorithm (with a build spike)
   - the theme-folder file watcher
   - cross-fade timing (starting after the new look has painted)
   - per-OS frameless title-bar mechanics
   - how one DTCG file per theme expresses mode × contrast (UX constraint: one file, four variant groups `light`, `dark`, `light-hc`, `dark-hc`)
   - Linux high-contrast signal detection
