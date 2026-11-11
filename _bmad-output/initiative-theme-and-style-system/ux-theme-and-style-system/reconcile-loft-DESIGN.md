# Reconciliation: imports/loft-DESIGN.md against DESIGN.md + EXPERIENCE.md

Input: `imports/loft-DESIGN.md`, with token values from `imports/loft-global.css` and the screens in `imports/loft-01.webp` (full mockup with page margin) and `imports/loft-02.webp` (same screen, full-bleed). Spines: `DESIGN.md`, `EXPERIENCE.md` (updated 2026-11-09). Decision log: `.memlog.md`, cited by line number (`L11` = line 11).
Where the spines and memlog diverge from the input, they win. This file records the divergences and fixes none of them. Regenerated after the post-review Update; it supersedes the earlier snapshot.

Classifications: **carried** (same value in the spines) · **changed** (different value, quoted both ways) · **intentional** (deliberate, memlog cited) · **dropped** (in neither spine). Feature content goes to the feature epics by decision (L53, L104) and is marked **dropped → feature epics**.

## Global

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Page background | `--bg: #e9edf5` | `colors.surface-app: #e9edf5` | carried | |
| App card | White rounded card, `--radius-xl: 18px`, large soft shadow | `app-card`: `surface-panel`, `rounded.xl` 18px, `shadow-card` role | carried | `shadow-card` is now a theme role with the same value (L101). |
| App inset | "~28-40px" from viewport edges | `app-inset-block` 28px × `app-inset-inline` 32px | carried | From `.app-frame` in global.css; matches `loft-01.webp`. |
| Typeface | Jost (variable), Futura-like geometric sans | Jost is the Loft *theme* typeface; a user font override applies app-wide | intentional | L23 |
| Font delivery | via `@fontsource-variable/jost` | Jost (OFL) is bundled with the app | intentional | L85. The package isn't named. |
| Body weight | "light (350–400)" | 400 | intentional | L71 ("Loft body weight 400"). |
| Letter spacing | `0.01em` | `0.01em` on every typography token | carried | |
| Heading weight | 500–600 | Every heading token is 600 | carried | Inside the input's range. |
| Body/secondary text colour | Soft grey `#9aa4b2` | `text-secondary #9aa4b2`, plus `text-default #5b6572` for UI text | carried | The input conflicts with itself (its CSS `body{color:var(--text)}` is `#5b6572`); the spines keep both roles. |
| Strong text | Dark slate `#3c4552` | `text-strong #3c4552` | carried | |
| Primary blue | `--blue: #2f7cf6` | `accent-default #2f7cf6` for fills; `accent-text #2f7cf6` for accent-coloured text | carried | The fill/text split is L95; Loft light values are identical. |
| Blue shadow | `0 10px 22px -6px rgba(47,124,246,.45)` on the compose button, selected item, Reply and numbered circles | `shadow-accent` role, same value, on every accent-filled element | carried | Renamed shadow-blue → `shadow-accent` and made a role (L101). |
| Numbered circles | Blue numbered circles cast the blue shadow | Not a component: they are sender email content | intentional | L101 ("drop 'numbered markers' as a component"). |
| Icon set | lucide-react, stroke ~1.75, 17–20px | lucide, stroke ~1.75, 17–20px (Sidebar) | carried | |
| Icon colours | Grey `#9aa4b2` by default, blue when active | `icon-default #9aa4b2`; active icons use `accent-text` | carried | |
| Radii | Cards 18, buttons/pills 999, list selection 14, inner cards/images 12 | `rounded.xl` 18, `full` 999, `lg` 14, `image` 12 | carried | The style owns radius (L48). |
| No harsh borders | "No harsh borders anywhere — separation via background tints and shadows" | Loft separates by tint and shadow at standard contrast; Increase contrast and forced colours add 1px borders | intentional | L83 |
| Separation tint value | `#f5f7fb` | `surface-sunken #f3f6fb` | intentional | L77 (CSS values win). |
| Light-only look | A "light, airy" client with one palette | Every theme defines light and dark; Loft dark is Night Slate; mode follows the OS by default | intentional | L17, L94 |
| Authority of the spec | "Authoritative… All UI work must match it" | Spines win on conflict. Loft is one style of five and one theme of nine | intentional | L11, L13, L97, L102 |
| Grey text contrast | `#9aa4b2`, `#a7b0bd`, `#8b95a5` on white, and white on `#2f7cf6`, used as-is | Exact at standard contrast (accepted risk with safeguards); Increase contrast swaps to AA values | intentional | L21, L80 |

## Layout

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Reference canvas | 1440×900 | 1440×900 | carried | |
| Top bar height | 72px | `top-bar-height` 72px | carried | |
| Sidebar | 236px, white | `sidebar-width` 236px, `surface-sidebar #ffffff` | carried | `surface-sidebar` is a new role (L83). |
| Message list | 380px, bg `#f3f6fb` | `list-width` 380px, `surface-sunken` | carried | |
| Reading split | Content ~64%, right rail ~36% | The same split; `rail-width` 280px | carried | |
| Reading area ground | bg `#f3f6fb`, continuing the list column | The reading card floats on `surface-sunken` | carried | |
| Reading card | White rounded card, big soft shadow, ~24px margin | `reading-card`, `reading-card-margin` 24px, `shadow-card` | carried | |
| Fixed dimensions | One set of px values | `spacing` is the Loft style at Comfortable; density is a separate setting | intentional | L22, L68 |
| Physical left/right placement | Sidebar left, list, then reading pane | Logical properties; the layout mirrors in RTL | intentional | L47 |

## TopBar

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Logo glyph | Blue paper-plane: lucide `Send`, filled-ish, rotated slightly | The app's own mark (Nylas Mail logo, or the fork's) | intentional | L62 |
| Wordmark type | 600 weight, dark slate, 22px | `typography.wordmark` 22/600, `text-on-toolbar #3c4552` | carried | |
| Wordmark text | "Loft" | The app's name (Nylas Mail, or the fork's name) | intentional | L62 |
| Placement | Above the sidebar column | Above the sidebar column | carried | |
| Search pill | bg `#f1f4f9`, radius 999, height 40, width ~440, grey icon at left, placeholder "Search" | `search-pill`: `surface-field #f1f4f9`, `full`, 40, 440, icon at inline-start, `text-secondary` | carried | |
| Search opens overlay | Clicking focuses or opens the as-you-type overlay | Click, `/` or ⌘K opens the overlay | carried | |
| Keyboard shortcuts | `/` or `⌘K` | `/` (outside text fields, can be turned off) or ⌘K / Ctrl+K | carried | Ctrl+K on Windows and Linux (L54); `/` rules (L99). |
| Bell | Bell icon with a tiny red dot | Bell with a `status-danger` dot | carried | Neither source says what the bell opens. |
| Settings gear | Gear icon | The gear opens the Preferences sheet | intentional | L59, L79 |
| User chip | 36px avatar, stacked name (13px, 600, dark) and email (11px, grey) | `account-chip`: `avatar-chip` 36px, `name-sm`, `caption` in `text-secondary` | carried | |
| Account switcher entries | "All accounts", each account, "Add account…" which jumps to the Settings view | The same entries; "Add account…" opens the Preferences sheet | intentional | L59, L79 |
| Account switcher rows | Each row shows avatar, name and email | Not specified | dropped → feature epics | L104 |
| Window controls | None in the mockup | macOS traffic lights left of the mark; Windows and Linux at inline-end via `titleBarOverlay` | intentional | L46, L69, L80 |

## Sidebar

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Primary button | Blue pill, white text, height 44, width ~180px, blue shadow | `button-primary`, `primary-button-width` 180px | carried | |
| View-dependent label | Compose email / New event / New contact / Add account | Compose email / New event / New contact | intentional | L59 (no in-window Settings view, so no "Add account" label). |
| Nav rows | Icon plus label, 15px, grey; active row blue text and icon | `nav-item`: `label-nav` 15, `text-on-sidebar`, active `text-on-sidebar-active` | carried | Same Loft values (`#9aa4b2`, `#2f7cf6`). |
| Mail nav items and icons | Inbox, Flagged, Drafts, Sent, Trash, with lucide glyphs | Not listed | dropped → feature epics | L53 |
| Inbox count badge | Pill bg `#eef3fb`, blue text, 12px | `badge`: `accent-tint #eef3fd`, `accent-text`, 12/600 | intentional | L77 (CSS values win). |
| Other folder counts | Similar badge, only when > 0 | "Counts show only when greater than 0, except Inbox" | carried | |
| "Folders" heading | 16px, 600, dark slate, generous top margin | `heading-section` 16/600, generous top margin | carried | |
| Pastel folder tints | Office `#c9d7f2`, Private `#d9c9f2`, Newsletter `#f2c9dc`, Travel `#c9e9d3` | `category-1` … `category-4`, same values, in an 8-role categorical palette with dark and high-contrast values | carried | L56, L76. Assignment by hash of the folder id (L84). |
| View switcher | Mail, Calendar, Contacts, Settings, pinned at the bottom; active blue | The same four; Settings opens the Preferences sheet | carried | Icon names not carried (minor). |

## MessageList

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Row padding and gap | Padding 18px 22px, gap 14px | `row-padding-block` 18, `row-padding-inline` 22, `row-gap` 14 | carried | |
| Avatar | 44px round, photo or initials on a pastel background | `avatar-row` 44px, initials in `text-on-category` on a categorical fill | carried | `text-on-category` is new (L101). |
| `avatarColor(email)` | The pastel is derived from the email address | Avatar colour from a hash of the email address | carried | |
| Subject | 15px, 600, dark slate, truncated | `title-row`, `text-strong` | carried | |
| Time | 12px, grey, right-aligned | `meta`, `text-secondary`, line 1 | carried | |
| Time formats | "10:15 AM", "Yesterday", "Wednesday", "Jun 12" | Not specified | dropped → feature epics | L53 |
| Sender | 13px, grey | `body-sm`, `text-secondary` | carried | |
| Snippet | 13px, `#a7b0bd`, line height 1.5, two lines | `body-sm`, `text-snippet #a7b0bd`, two-line clamp | carried | |
| Unread | Extra-dark subject plus a small blue dot left of the time | Bolder subject plus an accent dot; accessible name starts "Unread" | intentional | L100. The unread weight is a [GAP] in DESIGN. |
| Selected card visual | `--blue` bg, radius 14, white text, snippet 80% opacity, strong blue shadow | `message-row-selected`: accent fill, `accent-on`, 0.8, `rounded.lg`, `shadow-accent` | carried | |
| Selected card overhang | ~10px past the right edge, overlapping the reading area, above it | `selected-overhang` 10px past the list's inline-end edge, into the reading pane | carried | RTL via logical properties (L47). |
| Infinite scroll | An intersection observer loads older messages | "infinite scroll loads older messages" | carried | |
| Order | Newest at the top | "Newest first" | carried | |
| Row hover | White bg plus soft shadow | `surface-panel` plus `shadow-soft` | carried | |

## ReadingPane

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Header sender | 40px avatar plus sender name (15px, 600) | `avatar-header` 40px, `title-row` | carried | |
| Header date size | Grey, **13px** | `{typography.meta}` = **12px**, `text-secondary` | intentional | L77 |
| Header date format | "Today 9:35 AM" | Not specified | dropped → feature epics | L53 |
| Header action group | Reply, Reply all, Forward in a white pill group with soft shadow | The same, `shadow-soft` | carried | |
| Subject | H1, 26px, 600, dark slate, margin 18px 0 | `heading-reading`, `subject-margin-block` 18px | carried | |
| Body | 15px, `#8b95a5`, line height 1.8, max-width ~640px | `body-reading`, `text-reading`, `reading-measure` 640 | carried | |
| HTML rendering | Sanitized HTML (DOMPurify) or plaintext | Plain text, or sanitized HTML that keeps the sender's styling within the adaptation rule | carried | DOMPurify isn't named. |
| Remote images | Blocked by default, with a "Show remote images" chip | The same | carried | Chip visual and persistence unspecified. |
| Hero image | Image attachments may render as a hero card, radius 12, full body width | Hero card at `rounded.image` | carried | |
| Footer actions | Reply pill (blue) plus Forward pill (white, soft shadow), height 44 | `button-primary`, `button-secondary` | carried | |
| Email body in dark mode | Not covered (light only) | Smart adaptation with backing plates for transparent images, View original per sender address per account, original colours for replies, forwards and print | intentional | L34, L66, L84, L85 |

## Right rail

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Rail container | Inside the card, ~280px, left border `#eef1f6` | `rail-width` 280, divider at inline-start in `border-subtle #eef1f6`; a labelled complementary landmark | carried | Landmark semantics added (L100). |
| Attachments | "Attachments" heading (17px, 600), three 64px thumbs per row at radius 10 | `heading-rail`, `rail-thumb` 64px, `rounded.md` | carried | |
| Thumbnail source | `AttachmentMeta.thumb` data-URIs | Not specified | dropped → feature epics | L53 |
| People list | 36px avatar, name (13px, 600, dark), email (12px, grey) | `avatar-chip`, `name-sm`, email in `meta` `text-secondary` | carried | |
| Presence dots | Small green dot, bottom-right, white ring | `presence-dot` with a `surface-panel` ring, plus the label "Online" and an accessible name | carried | Label and name added (L100). What drives presence is unspecified. |
| People source | From the message's from, to and cc | The same | carried | |
| Thread timeline | Blue dot for the current message, grey for others, 12px one-liners, current item blue | Accent dot, `text-faint` dots, `meta` one-liners, current item bold in `accent-text` with `aria-current`; items scroll to their message | carried | Clickable (L71), bold + `aria-current` (L100). |

## Thread (below the card)

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Dimmed earlier messages | Dimmed one-liners or preview blocks, grey text on `#f3f6fb` | `text-secondary` on `surface-sunken` | carried | |
| Click to open | Clickable to open | "Clicking one opens it" | carried | |

## Search overlay

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Scrim | `rgba(30,40,60,.35)` | `scrim #1e283c59` | carried | |
| Panel | 640px wide, top ~15vh, white, radius 18, big shadow | `overlay-width` 640, ~15vh, `surface-panel`, `rounded.xl`, `shadow-card` | carried | |
| Input | 48px, no chrome, 18px text | `overlay-input-height` 48, `input-search-overlay` 18px | carried | |
| Result groups | Small uppercase labels: Messages, Contacts, Events | The same, `label-search-section` 11/600/0.08em uppercase | carried | Label spec settled (L71). |
| Message hit | Avatar, subject with `<mark>` highlights, snippet, folder · account, date | The same fields; `search-hit` | carried | |
| Highlight safety | Highlights via `dangerouslySetInnerHTML`, safe only because the server escapes them | Security contract: highlights render as HTML only because the search layer escapes the text first | carried | L54 |
| Performance badge | "N results · X.X ms", right-aligned, grey 12px, server `tookMs` to one decimal | Footer at inline-end, `meta` `text-secondary`, count and server time to one decimal | carried | |
| Keyboard | Arrow keys navigate, Enter opens, Esc closes | The same, as a combobox with a grouped listbox | carried | Semantics added (L100). |
| Operators | `from:`, `to:`, `in:`, `is:unread`, `is:flagged`, `has:attachment`, `account:` | The same seven | carried | |

## Compose

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Card | Bottom-right floating card, 560px, white, radius 16, big shadow | `compose-card`: 560, `rounded.compose` 16, `shadow-card`, bottom inline-end | carried | |
| Modality | Headed "modal card", described as floating | "Floats" | carried | Whether compose blocks the app is unspecified. |
| Header | "New message" or "Re: …" | The same | carried | |
| From picker | A From dropdown when there are several accounts | The same | carried | |
| Fields | To and Cc chip inputs, subject, auto-growing body | The same | carried | |
| Footer | Blue "Send" pill plus a trash icon | `button-primary` plus a trash icon button | carried | |
| Autocomplete | To and Cc from `/api/contacts?q=` | "To and Cc autocomplete from contacts" | carried | The endpoint is Loft's web API and doesn't apply. |

## Calendar view

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Available in every style | Part of the Loft app | An app feature every built-in style lays out before it ships | intentional | L16, L91 |
| Placement | Replaces the list and reading area | The same (list and reading regions) | carried | |
| Header | Month title (24px, 600), prev/next, "Today" pill, Month/Week toggle | `heading-view` 24/600, the same controls | carried | |
| Month grid | 7 columns, MON–SUN, date at top-right, today in a blue circle | MON–SUN, date at the top inline-end, today in an accent circle | carried | |
| Event chips | Pastel bg from the calendar colour, 12px, truncated, max 3 plus "+N more" | Categorical fill, `text-on-category` labels in `meta`, max 3 plus "+N more"; calendar name on hover, focus and in the day panel | carried | Palette roles (L56); name cue (L100). |
| Day and event clicks | Day opens a side panel or popover; event opens a detail popover | The same | carried | |
| New event modal fields | Title, calendar picker, date/time, all-day, location, description | "'New event' opens a modal" | dropped → feature epics | L53 |

## Contacts view

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Available in every style | Part of the Loft app | An app feature every built-in style lays out before it ships | intentional | L16, L91 |
| Layout | Two columns on `#f3f6fb` | Two columns on `surface-sunken` | carried | |
| List | Searchable, grouped by first letter, sticky headers | The same | carried | |
| List row contents | Avatar, name, email | Not specified | dropped → feature epics | L53 |
| Detail card | White, 72px avatar, name 24px 600 | `avatar-detail` 72px, `heading-view` | carried | |
| Title · org line | Below the name | Not specified | dropped → feature epics | L53 |
| Detail fields | Emails, phones, birthday, URLs, addresses, notes | "icon + label + value rows" | dropped → feature epics | L53 |
| Actions | Edit and Delete top-right; "New contact" modal with the same fields | Edit and Delete at top inline-end; the same modal | carried | |

## Settings view

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| In-window Settings view | An in-window Settings view in the Loft app | Not built; Settings opens the in-window Preferences sheet in every style | intentional | L59, L79 |
| Content area | White, max-width 720 | No Settings view, so no measure | intentional | L59 |
| "Accounts" heading | Above the account list | Not specified | dropped → feature epics | L104 |
| Account row | Colour dot, name, email, kind badge, status, last sync, Sync now, Remove | Not specified | dropped → feature epics | L53 |
| Kind and status values | IMAP/JMAP/Gmail/…; idle, syncing, error | Not specified | dropped → feature epics | L53 |
| Provider grid | IMAP/SMTP, POP3, JMAP, Gmail, Microsoft 365, iCloud, Yahoo, Demo | Not specified | dropped → feature epics | L53 |
| Provider forms | Host/port/user/pass, OAuth, CalDAV/CardDAV, ICS URLs | Not specified | dropped → feature epics | L53 |
| Presets prefill | Presets prefill hosts | Not specified | dropped → feature epics | L53 |
| Preset host values | iCloud, Yahoo, Fastmail hosts | Not specified | dropped → feature epics | L53 |
| OAuth env note | Requires `GOOGLE_CLIENT_ID` / `MS_CLIENT_ID` on the server | Not specified | dropped → feature epics | L53 |

## Tokens (`loft-global.css`)

| Item | Input says | Spines say | Classification | Note |
|---|---|---|---|---|
| Token naming | "use these, don't invent" (`--bg`, `--panel`, `--blue`…) | Semantic roles (`surface-app`, `accent-default`…), plus roles promoted from spec literals and the structural roles the ported themes need | intentional | L11, L32, L83, L95, L101 |
| Surfaces | `--bg`, `--panel`, `--panel-2`, `--panel-3` | `surface-app`, `surface-panel`, `surface-sunken`, `surface-hover` | carried | |
| Accent | `--blue`, `--blue-dark`, `--blue-tint` | `accent-default`, `accent-hover`, `accent-tint` (+ `accent-text`) | carried | |
| Text | `--text`, `--text-strong`, `--text-soft`, `--text-faint` | `text-default`, `text-strong`, `text-secondary`, `text-faint` | carried | |
| Status | `--danger #e5484d`, `--ok #30c463` | `status-danger`, `status-success` | carried | |
| Shadows | `--shadow-card`, `--shadow-soft`, `--shadow-blue` | `shadow-card`, `shadow-soft`, `shadow-accent` roles, same values | carried | Roles in the contract (L101). |
| Radii | `--radius-xl 18`, `--radius-lg 14`, `--radius-md 10` | `rounded.xl`, `lg`, `md` | carried | |
| Font | `--font` stack | The same stack, ending in system fallbacks | carried | L103 |
| `<mark>` | bg `#d7e6ff`, colour `--blue-dark`, radius 3px, padding 0 1px | `search-hit`: `highlight-bg`, `highlight-text`, `rounded.hit` 3px | carried | Padding not carried (minor). |
| Scrollbar | 8px, thumb `#d3dae4`, radius 4px | `scrollbar-thumb #d3dae4`; 3:1 in high contrast | carried | Width and radius not carried (minor). |
| Pill button | Height 44, padding 0 26, gap 9, 14/500 | `control-height` 44, `control-padding-inline` 26, `label-control` | carried | 9px gap not carried (minor). |
| Icon button | 36px, radius 999, `--text-soft`; hover `--panel-3` plus strong text; active blue | `icon-button`, the same values, active `accent-text` | carried | |
| Badge | min-width 30, height 22, padding 0 8, 12/600, tint bg | `badge`: `badge-min-width`, `badge-height`, `badge` type | carried | Padding not carried (minor). |
| Presence dot | 10px, `--ok`, 2px `--panel` border, offset -1px | `presence-dot` 10px, `status-success`, `surface-panel` ring | carried | Ring width and offset not carried. |
| Input focus | `input:focus { outline: none }` | Focus is always drawn with the two-tone `focus-ring`; never port `outline: none` | intentional | L67, L83 |
| App min width | `min-width: 1100px`, scrolls horizontally | Loft's minimum 1100px; below it the reflow ladder collapses regions; the window scrolls only below single-pane | intentional | L69, L85 |
| Toast | `--text-strong` bg, white, 13px, padding 10 18, pill, soft shadow, bottom centre | `toast`: `inverse-surface #3c4552`, `inverse-text #ffffff`, `body-sm`, `shadow-soft`, pill, bottom centre; up to 3 stacked, close button | carried | Same Loft values through inverse roles (L83, L84, L99). |
| Modal card and scrim | panel, `--radius-xl`, shadow-card; scrim aligned to the top | Search overlay and modals use `rounded.xl` and `shadow-card` | carried | |
| Micro-motion | 0.12s pill and icon-button transitions, `translateY(1px)` press nudge, 0.18s toast-in | The same values in EXPERIENCE › Interaction Primitives; instant under reduced motion app-wide | carried | L104 |
| Font smoothing | `-webkit-font-smoothing: antialiased` | Not specified | dropped | |

## Dropped qualitative ideas

- **Font smoothing.** `-webkit-font-smoothing: antialiased`, which matters for Jost's light weights on macOS. Not a feature-epic item; no decision covers it.
- **Minor CSS details.** `<mark>` padding `0 1px`, the 8px scrollbar width and 4px radius, the pill button's 9px icon gap, the badge's `0 8px` padding, the presence ring's 2px width and -1px offset.

Dropped → feature epics (by decision L53, L104): relative timestamp formats; the mail folder set and icons; account switcher row contents; attachment thumbnail source; New event modal fields; contact list row contents, the title · org line and detail fields; and the whole Settings view content (Accounts heading, account rows, kind and status words, provider grid and forms, preset hosts, OAuth note).
