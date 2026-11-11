# Spine Pair Review — nylas_mail

## Overall verdict
The pair is a carefully reasoned contract that traces back to its decisions. Every decision in `.memlog.md` landed, with superseded entries (L35, L40, L49) correctly overridden by later ones (L51, L60). All 229 `{token}` references resolve, and all four journeys are complete flows. It is not yet a contract downstream can build colour from. Only one of the 24 required token sets has values (Loft, light, standard contrast), so the default look in dark mode and under Increase contrast is unspecified. The Appearance page, which is the feature's main surface, has no component tokens for its own controls. Fix the critical finding and the nine high findings before architecture. The medium and low findings can go into an Update.

## 1. Flow coverage — adequate
No ticket Requirements were available, so `.memlog.md` journeys L25–L28 served as the source, as refined by L64, L71 and L74. All four journeys (Ines, Dev, Ruth, Marco) have a Key Flow. Each has a named protagonist, numbered steps, a marked climax and a failure path, and each name matches the memlog verbatim. Mechanically there are no misses. The findings below are contradictions inside the flows.
### Findings
- **high** Density's default is tied to the style, but nothing says what happens when the style changes. In the IA table, the Density default is "The style's native density", while the axes are "independent". Marco picks Less-is-more (native Compact) and then picks Compact by hand. That implies density does not follow style, but the IA table implies it might. The settings schema depends on this rule: either it stores an explicit value or a "follow style" sentinel. (EXPERIENCE IA table L29; Flow 4 steps 2–3 L283–284; DESIGN Layout & Spacing › Density table L478–482). *Fix:* State the rule. For example: density stays on "Style default" until the user picks a level, and the control shows what that resolves to.
- **medium** Dev's flow contradicts the rules for derived themes. "Export a copy…" of a built-in writes a complete file with all four variants and every role. In that case step 2's "derived on the variants he hasn't written and on any role his file leaves out" never happens, unless he deletes them. Until step 6 adds `$metadata`, the grid name of the copy is also undefined, and it could duplicate the built-in's name. (EXPERIENCE Flow 2 steps 1–2 and 6 L255–260; Theme Authoring › Packaging L208). *Fix:* Say what Export writes: all variants, or light standard only as a starter. Say which field supplies the theme's display name, for example `$metadata.name` pre-filled as "<Theme> copy".
- **low** Ines's failure path is circular. "The chosen theme fails to load… falls back to Loft", but Loft is both the default and the fallback. (Flow 1 Failure L249; State Patterns › Theme fails to load L134). *Fix:* Say whether bundled built-ins can fail at all. If they can, name the terminal fallback, for example a compiled-in Loft light.

## 2. Token completeness — thin
I extracted every frontmatter token: 31 colours, 18 typography roles, 6 radii, 23 spacing tokens and 24 components. I resolved every `{path}` reference: 99 in the DESIGN frontmatter, 118 in the DESIGN body and 12 in EXPERIENCE. All of them resolve. The light reference set is complete, and each value carries its source. The gaps are the variants the contract itself requires, roles that are missing, and roles used outside their meaning.
### Findings
- **critical** Only one of the 24 required token sets has values. The Loft dark variant (standard and high contrast) and the Loft light high-contrast variant are absent. There are no `-dark` or `-hc` keys (the spec's common pattern) and no theme file. Mode Auto follows the OS from first launch, so on any OS in dark mode the default look has no specified colours. Ruth's flow starts in high contrast and has none either. The categorical dark and high-contrast values are also only "derived, then checked by hand", and none exist yet. (DESIGN frontmatter `colors` L8–45; Colors › Variants L411–416; Categorical palette L394). *Fix:* Add Loft `*-dark`, `*-hc` and `*-dark-hc` keys, or commit `loft.tokens.json` beside the spine and link it. At minimum, write down the OKLCH derivation recipe (lightness mapping, chroma clamp, contrast solve) so builds are reproducible, and mark the hand-check as a blocker.
- **high** The five ported themes have no values at the role level. The Theme catalogue gives 4–8 representative hex values per theme, taken from a comment block in a `.working/` HTML file. Nothing maps the 143 LESS variables onto the 31 colour roles. For example, the Nylas theme has no stated `text-snippet`, `text-reading`, `surface-field`, `highlight-*`, `scrim`, `category-1…8` or `accent-on`. Where a theme has "no accent shadow", nothing says what its `shadow-accent` resolves to. (DESIGN Colors › Theme catalogue L396–409; Elevation & Depth L498). *Fix:* Add a table mapping LESS variables to roles for each theme, or a token file per theme, and give explicit "none" values (for example `shadow-accent: none`).
- **high** Typeface delivery and licensing are unresolved:
  - Nothing says Jost is bundled. The reconcile flagged this as dropped. If Jost isn't bundled, Loft renders in Avenir Next or the system font and fails the `loft-01.webp` diff.
  - The Nylas theme's Nylas-Pro comes from `nylas-private-fonts`, and the spine keeps it only "where the font can be licensed", with no fallback named. Nylas is the Classic onboarding look and the upgrade target for three legacy themes.
  - The Taiga, Darkside and Less-is-more typefaces are only "the legacy theme's font".
  - Nothing says whether Inter, IBM Plex Sans and Atkinson Hyperlegible ship with the app or must be installed.

  (DESIGN Typography L433; Theme catalogue L402–409; EXPERIENCE Component Patterns › Font select L102). *Fix:* Give each theme's font family and stack, the fallback when a font can't be licensed, and the list of fonts the app bundles.
- **high** The toast tokens borrow roles outside their meaning. `toast.background` is `{colors.text-strong}`, and `toast.foreground`, `toast-error.foreground` and the upgrade toast's action text are all `{colors.accent-on}`. In a dark variant `text-strong` is near-white (Nylas dark heading `#ffffff`), and `accent-on` only has to contrast with the accent, not with this fill. Toasts can therefore become unreadable in other themes, and they are the only feedback for theme-load errors. (DESIGN frontmatter `components.toast` and `toast-error` L295–302; Colors role table L357 and L367; Components › Upgrade notice toast L548). *Fix:* Add `surface-inverse`, `text-on-inverse` and `status-danger-on` roles, and repoint the toasts to them.
- **medium** Some foreground roles are missing. Categorical fills have no role for the text on them, which affects avatar initials and calendar chip labels. High-contrast variants need such a role to pass 4.5:1. The unread subject is "darker", but `message-row.subject-color` is `text-strong` for read and unread rows alike, and no role is darker. (DESIGN Categorical palette L377–394; Components › Message row L537 and Calendar view L545; frontmatter L243). *Fix:* Add `text-on-category` (or per-category `-on` roles) and either `text-unread` or a statement that unread differs by the dot alone.
- **medium** The shadow roles sit outside the contract. The three roles exist only as literals in `components` and as names in the Elevation table. Theme authors writing DTCG shadow tokens have no role keys to target, and the legacy themes' shadows are described only in words ("small 1px", "hairline"). (DESIGN header note L318; Elevation & Depth L490–498; EXPERIENCE Theme Authoring › Contents L200). *Fix:* List the shadow role keys and their values for each theme in Theme Authoring or in an extension group in the frontmatter.
- **medium** The contrast inventory is incomplete. The measured table lists four failing pairs. Other load-bearing pairs also fail at standard contrast (my measurements):

  | Pair | Ratio | Where it appears |
  |---|---|---|
  | White on `status-danger` | 3.9:1 | Error toast text |
  | `accent-default` on `accent-tint` | 3.5:1 | Inbox badge |
  | `accent-default` on white | 3.9:1 | Active nav label, 15px |
  | `highlight-text` on `highlight-bg` | 4.4:1 | Search hits |
  | `text-secondary` on `surface-sunken` | 2.3:1 | Text on the list column |
  | `text-snippet` on `surface-sunken` | 2.0:1 | The "hasn't been measured" case |
  | `icon-default` on white | 2.5:1 | Icons, against the 3:1 icon target |

  This table is the to-fix list for whoever authors the high-contrast variant. (DESIGN Colors › Measured Loft contrast L418–429). *Fix:* Extend the table with these pairs.

## 3. Component coverage — thin
I extracted 24 frontmatter components, 18 rows for Loft surfaces and 12 for the Appearance page in DESIGN, and 31 rows in EXPERIENCE Component Patterns. The mail surfaces are well covered in both spines. The Appearance page has thorough behavioural rows, but its visual specs are prose only, and three of them are explicitly open.
### Findings
- **high** The Appearance page controls have no tokens and no visuals for their states. The frontmatter covers only `appearance-preview`, `appearance-mini-preview` and `apply-bar`. None of these has a radius, size, or selected, hover, focus or disabled appearance: the style card, the theme swatch, the segmented controls (Mode, Contrast, Density, Pending/Applied), the slider, the select, the switch, the "Previewing" and "Applied" tags, the OS-state chip and the derived badge. Apart from its text tag, a selected card has no visual. (DESIGN Components › Appearance page L551–568; frontmatter `components` L303–311). *Fix:* Add a component token for each control, with its state visuals, read from role tokens only.
- **medium** The Preferences window has no style that owns it. Appearance "renders in the applied theme", but nothing says which style's radius, spacing and title bar the separate Preferences window uses. It is frameless, and every style "owns its title bar". (DESIGN Components › Appearance page L553; EXPERIENCE IA L39; Responsive & Platform L178). *Fix:* State the rule. For example, the Preferences window always uses Classic structure in the applied theme, or it follows the applied style.
- **medium** Some interactive or data-driven elements have no behavioural rule, and some have no visual spec:
  - The bell has no behaviour in either spine.
  - Nothing says what data drives the presence dot.
  - The "Show remote images" chip has no visual spec, and nothing says whether the choice persists per message or per sender.
  - The rows of the account switcher dropdown have no visual spec.
  - The modals and popovers (New event, New contact, event detail, day popover) have no `modal` or `popover` component, although `rounded.xl`, shadow-card and `scrim` all cite "modals".

  (EXPERIENCE Component Patterns › Top bar L112 and Calendar view L119; DESIGN Components › Right rail L541 and Reading card L540). *Fix:* Add the rows, or defer each element by name to a feature epic in Open Questions.
- **medium** "Numbered markers" are listed as accent-filled elements with shadow-accent, but no component exists. In `loft-01.webp` and `loft-02.webp`, the numbered circles 1–3 are content inside the email body, which is sender HTML, not app chrome. A consumer will either hunt for a component that doesn't exist or apply app tokens to email content. (DESIGN Colors role table L364; Elevation & Depth L496). *Fix:* Remove "numbered markers", or reclassify them as example email content.
- **low** Component names differ between the spines:

  | EXPERIENCE | DESIGN |
  |---|---|
  | "Search pill / search overlay" (one row) | Two separate rows |
  | "Message list / message row" | "Message row" |
  | Five control rows (Mode, Contrast, Density, Font, Adapt) | "Display rows" |
  | "Install theme…" and "Theme author link" (two rows) | Combined in one row |
  | "Upgrade notice toast" (Component Patterns) | — |
  | '"New: Appearance" notice' (IA) | — |

  *Fix:* Use one name per component in both files.
- **low** Several DESIGN components have no Component Patterns row: Focus ring, App frame / app card, Older thread messages, Badge, Nav item and the primary and secondary buttons. Their behaviour lives elsewhere or is static. The buttons have no press or disabled behaviour, because Loft's 0.12s transitions and its 1px press nudge were dropped, per the reconcile. *Fix:* Add short rows, or note that these components are static.

## 4. State coverage — adequate
I walked every IA surface: Preferences window, Preferences › Appearance, the onboarding looks step, the "New: Appearance" notice and the themes folder. Appearance is strong on the pending, applied, derived, load-failure, invalid-file, live-reload, name-clash and missing-font states. Deferring the empty, loading and error states of the mail surfaces to the feature epics is explicit and defensible (L146).
### Findings
- **high** The platform assumptions are unverified. Ruth's flow depends on Electron reading `prefers-contrast` on Windows and Linux, and on an OS text scale being readable on Windows and GNOME. Windows Contrast themes also turn on `forced-colors`, which overrides author colours in Chromium unless the app opts out. The spines don't say whether the app honours forced colours or opts out and maps them to Increase contrast. The chip string "Following macOS: on" has no Windows or Linux version, although the Mode row requires naming the actual OS. (EXPERIENCE State Patterns › OS Increase contrast on L133; Responsive & Platform L180–181; Flow 3 steps 3–4 L271–272; Voice and Tone L72). *Fix:* Run a spike on all three OSes before architecture. Add a state row for `forced-colors`, and add chip strings for each OS.
- **high** Users of legacy community themes have no upgrade rule. The spines map the six built-in themes. A user whose applied theme was a community LESS theme gets no fallback look and no message. The spines also don't say whether upgraders see the onboarding looks step, which is "shown on every first launch". (EXPERIENCE State Patterns › Upgrade from a legacy theme L140; Theme Authoring › Legacy L206; IA Onboarding L41). *Fix:* Add a state row, for example: land on Classic with the Nylas theme and show a toast "'<name>' is a LESS theme and no longer loads…". State whether upgraders skip onboarding.
- **high** The embedded preview has no defined focus or screen-reader behaviour. It renders the real app as "view-only". If it is not inert, Tab walks through the entire embedded app and screen readers read out the user's mail. (EXPERIENCE Component Patterns › Appearance preview L92; Accessibility Floor L164–172). *Fix:* Make the preview `inert` and unfocusable, and expose it as one labelled region, for example "Preview: Loft, Taiga".
- **medium** The theme lifecycle has gaps:
  - There is no way to remove an installed theme.
  - Nothing covers the applied or pending theme's file being deleted or renamed while the app runs.
  - Nothing says whether "Replace" against a built-in theme's name is allowed.
  - The naming rule for "Keep both" is undefined.
  - Nothing covers a missing or unwritable themes folder during Install or "Export a copy…".

  (EXPERIENCE State Patterns L134–138; Component Patterns › Install theme… L105; Theme Authoring L201–204). *Fix:* Add rows for these states.
- **medium** How the onboarding step proceeds is undefined. Picking a card "applies directly", and Flow 1 implies that picking also advances to the inbox. Ruth, however, sets text size on the slider in the same step, so she must do it before picking. No Continue control is named, only "Skip". If the cards are a radio group like the style cards, arrow keys would apply each look in turn. It is also unclear whether the slider applies live, given that applying outside the preview is banned except from a look card. (EXPERIENCE Component Patterns › Onboarding look card L107; Interaction Primitives › Banned L160; Voice L83; Flow 1 L245–246; Flow 3 L273). *Fix:* Define the step's controls, its keyboard model, and what ends the step.
- **low** Toasts have no screen-reader announcement rule. Standard toasts auto-dismiss after 5 seconds, but nothing says that they are announced through a live region or that hover or focus pauses the timer. (Component Patterns › Toast L121; Accessibility Floor). *Fix:* Add one line to the Accessibility Floor.

## 5. Visual reference coverage — adequate
Visual reference files:
- `imports/loft-01.webp` and `imports/loft-02.webp`
- `imports/loft-DESIGN.md` and `imports/loft-global.css`
- `.working/appearance-directions.html` (there is no `mockups/` or `wireframes/` folder)

Every file is linked inline at least once, so there are no orphans. Each spine states once that the spine wins on conflict: DESIGN at L510, EXPERIENCE at L45.
### Findings
- **medium** `.working/appearance-directions.html` is load-bearing but lives in a working folder. It is the only layout reference for the Appearance page and the only source of the legacy theme hex values, which sit in a style comment. Consumers treat `.working/` as scratch. The file also drifts from the spine:
  - The mockup's Theme intro reads "Colour, type, corner and shadow tokens.", but EXPERIENCE quotes it as "(mockup)" in the edited form "Colour, type and shadow tokens.".
  - The mockup's Increase contrast control is a two-state switch, not the spine's three-way segmented control.

  (DESIGN Theme catalogue L398; Components L510; EXPERIENCE IA L45; Voice L70). *Fix:* Move the file to `mockups/` and link direction A by anchor. Lift the legacy hex extraction into the spine or into theme files. Mark the Voice quote as edited.
- **medium** `reconcile-loft-DESIGN.md` is stale, yet EXPERIENCE links to it as the record of dropped content. It cites:
  - Open Questions 6, 7, 9, 13 and 14, and [GAP] items that no longer exist
  - a `settings-measure` token
  - an "Add account" sidebar label
  - seven themes
  - highlight escaping and Ctrl+K as dropped, although both are now carried
  - the CSS-wins badge value as "not a memlog decision", although memlog L77 now covers it

  (EXPERIENCE IA L61). *Fix:* Re-run the reconcile, or add a "superseded snapshot" header and move the list of dropped items into the spine.
- **low** The two Loft images aren't told apart. Both are described as the "main mail view". `loft-01` is the framed composition (app card on the ground) and the verification target. `loft-02` is a full-bleed crop with no app-frame inset. (DESIGN Components L510; EXPERIENCE Inspiration L228). *Fix:* Say what each image illustrates, and that the app-frame inset follows `loft-01`.

## 6. Bloat & overspecification — adequate
DESIGN's editorial prose is restrained and tied to decisions. EXPERIENCE prose stays behavioural. The main cost is that the same rules are restated across sections, not that the files are padded.
### Findings
- **medium** The same rules are restated many times, which risks drift:
  - The AA thresholds (4.5:1 and 3:1) appear about 8 times (DESIGN Variants L416 and Do's L578; EXPERIENCE State Patterns L132, Accessibility Floor L166, Theme Authoring L204, Verification L223, Flows 2 and 3).
  - The window-chrome rule appears 5 times.
  - The narrow-window collapse rule appears 3 times.
  - The text size and zoom rule appears 5 times.

  *Fix:* Give each rule one owning section, and have the others link to it.
- **low** Some pixel literals stand in for existing tokens:
  - The right-rail email and the timeline snippets are "12px", which is `{typography.meta}`.
  - EXPERIENCE says "about 160px" (L94, L153), which is `{spacing.appearance-mini-preview}`.
  - Avatar sizes 36, 40, 44 and 72 are scattered literals.

  (DESIGN Components › Right rail L541). *Fix:* Reference the tokens, and consider adding avatar size tokens.
- **low** The feature-scope boundary is inconsistent. Component Patterns specifies feature behaviour for Calendar (popover versus side panel), Contacts, Compose and the search operators. Meanwhile State Patterns hands those surfaces' states to the feature epics (L146). *Fix:* Keep only the contracts for cross-style placement and the security contract, and link the feature epics for the rest.

## 7. Inheritance discipline — adequate
Journey names match memlog L25–28 verbatim. EXPERIENCE token references all resolve to DESIGN tokens by name. Theme and style names agree across both spines.
### Findings
- **high** Neither spine has `sources` frontmatter. The tracking ticket (GitHub `heyjawrsh/nylas-mail#2`, memlog L55) is not referenced, and its body is stale. Its Themes bullet lists seven themes ("Light, Dark, Ubuntu, Taiga, Darkside, Less-is-more and Loft"), against the spines' six with Nylas (memlog L60). A PO slicing epics from the ticket would produce separate Light and Dark theme stories. (DESIGN and EXPERIENCE frontmatter; issue #1 "Themes" bullet, checked live). *Fix:* Add `sources:` (the memlog, issue #1 and the imports), and update the issue's Themes bullet.
- **medium** The terms for the contrast variant drift, and the theme file's shape is unspecified. The variant is called "high contrast" in DESIGN Brand & Style (L331) and Variants, and "increased" in the frontmatter comment (L11) and the Verification Matrix (L217). The setting is "Increase contrast". Theme files need exact keys for the variants. Theme Authoring doesn't define how a DTCG file expresses mode × contrast, or whether roles are flat (`surface-app`) or nested (`surface.app`). DESIGN L322 says only "may nest". (EXPERIENCE Theme Authoring L199–200). *Fix:* Use one term: "high contrast" for the variant and "Increase contrast" for the setting. Add a minimal example of the file's shape, or list it in Open Questions as an architecture handoff.
- **low** The RTL overhang wording conflicts with the frontmatter. Responsive & Platform says the selected card "overhangs at inline-start" (L182), but the frontmatter key is `overhang-inline-end`. With logical properties, RTL needs no special handling, and the extra sentences invite a wrong flip. (Also DESIGN L538; EXPERIENCE Accessibility Floor L169). *Fix:* Say "past the list's inline-end edge, into the reading pane" everywhere.

## 8. Shape fit — strong
DESIGN sections are in canonical order (Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts), with Open Questions appended after them. EXPERIENCE has every required default. Responsive & Platform is triggered (three OSes and window widths) and present. Inspiration is triggered (directions B and C rejected, plus the legacy themes and the Loft mockup) and present. Three sections are invented:
- **Email Body Rendering** earns its place.
- **Theme Authoring** earns its place, because the authoring API is user-facing (memlog L24).
- **Verification Matrix** is decision-backed (L57), but it is acceptance criteria and could live in the ticket.
### Findings
- **low** The frontmatter departs from the spec in places. EXPERIENCE lacks the `name` and `sources` that both examples carry. DESIGN `spacing` holds a value that isn't spacing (`app-min-width`). `components.appearance-mini-preview.position: sticky` is CSS behaviour, not a token. *Fix:* Add the missing keys. Move `app-min-width` to a layout note or a `size` group, and move `position` to prose.

## Mechanical notes
- **Cross-references:** I checked all 229 `{path}` references: 99 in the DESIGN frontmatter, 118 in the DESIGN body and 12 in EXPERIENCE. All of them resolve. The only unresolved string is `{path.to.token}` in EXPERIENCE Foundation L13, which illustrates the syntax.
- **Unreferenced tokens:** These are defined but never referenced with `{}`: `colors.scrollbar-thumb`, `colors.text-faint`, `spacing.list-width` and `typography.input`. The role table names the two colours bare. `list-width` appears only as the literal "380px" in the layout diagram, and `typography.input` is used nowhere.
- **Hex format:** `colors.scrim` is an 8-digit hex (`#1e283c59`). Confirm that the DTCG pipeline and the parser accept alpha hex.
- **Frontmatter:** DESIGN has `name` and `description`. EXPERIENCE has neither `name` nor `sources`. The initiative file has frontmatter only. `ux-theme-and-style-system.md` links both spines.
- **Superseded memlog entries:** these are handled correctly in the spines:
  - L35 "Classic (Light)" → Nylas (L60)
  - L40 "28 token sets" → 24 (L51, L60)
  - L49 "420" → 360 (L60)
  - L60 "designed light mode" → dark (L73)
  - L11 "theme owns radius" → style owns radius (L48)
- **Codebase names:** Issue #1 names `theme-package.js` and a `theme-picker` package. EXPERIENCE Foundation names only `theme-manager.js`. The modal it calls retired is presumably `theme-picker`, so name it.
- **Mermaid:** There are no Mermaid blocks. The ASCII layout diagram (DESIGN L453–461) is fine.
- **Spine-wins rule:** The rule is consistent across the spines: DESIGN L510 says "any mockup or import", and EXPERIENCE L45 says "the mockup".
