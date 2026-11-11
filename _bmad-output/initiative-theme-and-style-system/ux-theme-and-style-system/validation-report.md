# Validation Report — nylas_mail

- **DESIGN.md:** `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/initiative-theme-and-style-system/ux-theme-and-style-system/EXPERIENCE.md`
- **Run at:** 2026-11-09

## Overall verdict

The pair is a carefully reasoned contract that traces back to its decisions. Every decision in `.memlog.md` landed, with superseded entries (L35, L40, L49) correctly overridden by later ones (L51, L60). All 229 `{token}` references resolve, and all four journeys are complete flows. It is not yet a contract downstream can build colour from. Only one of the 24 required token sets has values (Loft, light, standard contrast), so the default look in dark mode and under Increase contrast is unspecified. The Appearance page, which is the feature's main surface, has no component tokens for its own controls. Fix the critical finding and the nine high findings before architecture. The medium and low findings can go into an Update.

The accessibility, adversarial and edge-case reviewers push the picture further, from "close the token gaps, then hand off" to "not ready for architecture as a release spec". Their 146 findings plus the rubric's 32 combine into 74: 6 critical, 25 high, 26 medium and 17 low. They converge on six areas. **Default contrast policy:** accessibility and adversarial both rate the mockup-exact default critical, because the most-read text sits at 2.0–3.9:1 and the fix lives on a page that renders in the failing theme. **Scope of free mix:** the role contract can't express three of the six themes, "style" has no technical definition behind about 40 layouts, some mixes have no visible structure, and nothing names a minimum shippable slice or the LESS-to-runtime migration underneath. **Per-style frameless chrome:** it is new work on Windows and Linux, at odds with Loft's inset and with where each OS puts its controls in RTL. **Theme-file safety:** token values have no grammar, so an installed file can inject CSS or fetch remote URLs, and identity, the last-valid cache and live reload are undefined. **Forced colours:** Windows Contrast themes strip the shadows and tints Loft depends on, and Linux may report no contrast signal at all. **Fonts:** Nylas-Pro is proprietary and Jost's bundling is unstated. Many high findings challenge deliberate decisions (L21, L31, L46, L64), which the reviewers frame as risks for the user to weigh. They agree the foundation holds, so this is fix-forward work, not a restart.

## Category verdicts
- Flow coverage — adequate
- Token completeness — thin
- Component coverage — thin
- State coverage — adequate
- Visual reference coverage — adequate
- Bloat & overspecification — adequate
- Inheritance discipline — adequate
- Shape fit — strong

## Findings by severity

### Critical (6)

**[Token completeness]** — Only one of the 24 required token sets has values, and the default look's dark mode is undesigned (§ DESIGN frontmatter `colors` L8–45; Colors › Variants L411–416; Categorical palette L394; memlog L51, L73)
Only Loft light at standard contrast exists. There are no `-dark` or `-hc` keys and no theme file, yet Mode Auto follows the OS from first launch, so on any OS in dark mode the default look has no specified colours, and Ruth's flow starts in high contrast with none either. The categorical dark and high-contrast values are only "derived, then checked by hand", and none exist yet. The adversarial reviewer argues derivation can't close this: Loft separates surfaces with a 1.08:1 tint and blue-grey shadows that vanish on a dark ground, and derivation can't invent the elevation strategy dark mode needs. A large share of first users run dark mode, so their first impression is a look nobody designed. The log also contradicts itself: L73 calls for a designed dark mode for Darkside and Less-is-more, while L51 says every built-in variant is derived then hand-checked.
Raised by: Rubric, Token completeness (critical); Adversarial F8 (high); Edge cases #5 (low)
Fix: Add Loft `*-dark`, `*-hc` and `*-dark-hc` keys, or commit `loft.tokens.json` beside the spine and link it. At minimum, write down the OKLCH derivation recipe (lightness mapping, chroma clamp, contrast solve) and mark the hand-check as a blocker. Treat Loft dark as a designed deliverable with a mockup inside the Loft epic, add an elevation-strategy role (`shadow | tint | border`), and keep undesigned dark variants out of onboarding. Track all 24 sets as build deliverables.

**[Token completeness]** — The role contract is Loft-shaped, and the five ported themes have no role-level values (§ DESIGN Colors › Theme catalogue L396–409; frontmatter `colors`; Elevation & Depth L498; memlog L11, L12, L48)
The catalogue gives 4–8 representative hex values per theme, taken from a comment block in a `.working/` HTML file, and nothing maps the 143 LESS variables onto the 31 colour roles (the Nylas theme has no stated `text-snippet`, `text-reading`, `surface-field`, `highlight-*`, `scrim`, `category-1…8` or `accent-on`; where a theme has no accent shadow, `shadow-accent` is unresolved). The adversarial reviewer goes further: the contract can't express three of the six themes at all. Darkside's dark sidebar and Ubuntu's dark toolbar have no regional surface role, and the Taiga style's bordered cards and outlined selection need a border ramp that Loft's single hairline role lacks. Every role added after the token API goes public is a breaking change for published third-party themes.
Raised by: Rubric, Token completeness (high); Adversarial F1 (critical)
Fix: Run a role inventory across all six themes and the styles that ship, then add regional surfaces with `on-*` text roles (`surface-sidebar`, `surface-toolbar`), a border ramp (`border-subtle`, `border-default`, `border-strong`), selection roles and explicit "none" values (for example `shadow-accent: none`). Map LESS variables to roles per theme, or ship a token file per theme. Version the contract (`$metadata.contractVersion`) so a missing role falls back to its nearest parent role, not to the Nylas theme.

**[Accessibility review]** — The default look fails AA, and Increase contrast is the only way out (§ DESIGN Brand & Style; Colors › Measured Loft contrast; Do's and Don'ts; EXPERIENCE Accessibility Floor › Increase contrast; IA; memlog L21, L24, L35, L71)
Deliberate (L21, L35), so both reviewers frame it as a risk to weigh. In the default look (Loft style, Loft theme, light, standard contrast) the most-read text fails 4.5:1: list snippets 2.02:1 on `surface-sunken`, sender and time 2.33:1, nav labels, dates and the Appearance explanations 2.52:1, every email body 3.03:1, primary button labels and the selected-row subject 3.94:1, the inbox badge 3.54:1, search hits 4.44:1. WCAG technique G174 lets a toggle satisfy 1.4.3 only if the control sits on the page and meets contrast itself; here it lives in Preferences, which renders in the failing theme, so a low-vision user reads a 2.3:1 page to find the fix. On macOS and Windows "Increase contrast" means more than a legible default, and people with mild low vision, ageing eyes or glare rarely turn it on. The adversarial reviewer calibrates the risk: legal exposure is low for a solo OSS maintainer (the EAA and Section 508 don't bind it), but reputational and user-harm risk is high, because audits and distro reviewers check the default, and "accessible only if you find a toggle" reads as a defect. It also collides with L24: "accessibility is not optional".
Raised by: Accessibility C1 (critical); Adversarial F4 (critical)
Fix: Both reviewers prefer the same fix: make standard contrast AA for text and keep everything else mockup-exact (tints, dividers, decoration). `text-reading` `#8b95a5` → `#6b7585` gives 4.66:1; `#646e7d` for secondary text gives 4.77:1 on `surface-sunken` and 5.16:1 on white; `accent-hover` `#1e63d0` (or `#2a6fe0`) under white labels gives 5.6:1 (4.72:1). Offer the exact mockup as an opt-in ("Reference contrast", or Increase contrast "Off (reference colours)"), and let Increase contrast On go beyond AA. If the decision stands, meet G174 properly: Preferences, onboarding and the contrast control always render at AA whatever the applied theme, Increase contrast joins the onboarding step and a View menu command, and the release notes say the default doesn't meet AA.

**[Adversarial review]** — "Style" has no technical definition, yet each one has to lay out every feature (§ Attacks memlog L12, L13, L16; EXPERIENCE › Surfaces every style must lay out)
**Attacks:** L16 ("each style must lay them out"), L13, L12. Five styles × at least 8 surfaces comes to about 40 layout designs, and only Loft's have a mockup. The legacy themes predate Contacts and Calendar, so "promoting" Taiga, Darkside and Less-is-more to styles means inventing four apps' worth of layout. It isn't a port. Layout lives in `WorkspaceStore.defineSheet` columns and about 93 `ComponentRegistry` registrations into fixed Locations, and CSS can reposition elements but can't re-parent them: Loft puts the right rail inside the reading card, while `participant-profile` registers into the sibling `MessageListSidebar`. So a style either stays CSS-only and can't produce Loft, or defines its own sheets and containers and becomes a code package that has to keep every plugin Location working. The existing split/list `layoutMode` is a second layout axis the spines never mention. The edge-case reviewer asks the follow-on question: what renders when a style hasn't laid out a shared surface yet?
Raised by: Adversarial F2 (critical); Edge cases #80 (medium)
Fix: **Alternative:** define a style as (1) a region manifest mapping abstract regions (`nav`, `list`, `reading`, `rail`, `search`, `account`) onto the stable existing Locations, (2) a CSS layer scoped under `[data-style=…]`, and (3) optional container components for regions that need re-parenting. Styles are built-in only; say so. Every style renders every Location, or the manifest names a fallback host. Contacts and Calendar get one shared layout that reads style tokens; a style may override it but doesn't have to. That turns 40 layouts into about 8 plus overrides, and the shared layout is the answer for any surface a style hasn't laid out.

**[Adversarial review]** — The runtime migration underneath all of this isn't in scope, and it's the critical path (§ Attacks memlog L15, L22, L30, L32, L47, L68; `theme-manager.js:367`; `thread-list/lib/thread-list.jsx:188-191`)
**Attacks:** L32 ("architecture ratifies the runtime mapping"), plus L15, L47, L30, L22 and L68. The spines treat DTCG-to-custom-properties as a detail. It's the largest single work item: 2,427 LESS variable references to move to `var(--…)`; 317 compile-time colour functions with no runtime equivalent, each becoming a new role every theme must define or a `color-mix()` whose output nobody contrast-checked; 200 component hex literals; 648 physical declarations to move to logical properties before RTL is even possible; and row heights hard-coded in JS (`itemHeight = 36` / `85`) that the virtualized `ListTabular` must recompute on density or text-size change. Third-party plugin LESS has the same problem. Until this lands, the 120ms preview cross-fade and ~200ms apply are impossible; the code itself calls a LESS cache refresh "very expensive (hundreds of ms)". The build-sequencing rule puts this first. The spines put it nowhere.
Raised by: Adversarial F3 (critical)
Fix: **Alternative:** make "token runtime + LESS retirement" an explicit epic zero with its own acceptance test: Classic + Nylas light renders pixel-identical to today with zero LESS colour functions, every colour a `var()`, and row height driven by a token. Count the colour-function call sites and budget for them. Gate every other epic on it.

**[Edge-case review]** — Theme files from strangers have no value grammar: CSS injection and remote fetches (§ EXPERIENCE Theme Authoring ("an invalid value rejects the file"); Component Patterns › Install theme…; memlog L65)
Token values become CSS custom properties, and validation has no grammar. A value like `red; } * { display:none`, a `url(https://tracker/…)` beacon, `expression()`, `@import`, or a font-family that loads a remote font is CSS injection or a tracking fetch from an "Install theme…" file in a public release. The adversarial reviewer raises the same attack. Nothing caps file size (50 MB) or nesting depth, and nothing says whether alias cycles (`{a}` → `{b}` → `{a}`) or aliases to tokens that don't exist count as invalid values or missing roles.
Raised by: Edge cases #23 (critical); Edge cases #22 (high); Adversarial F16 (injection part)
Fix: Validate strictly by DTCG `$type`: colours parsed (hex, rgb(a), hsl, oklch), dimensions, fontFamily as a list of names, shadow and typography composites rebuilt from parts. Never interpolate raw strings into CSS; reject anything containing `;`, `{`, `}`, `url(` or `@`. Cap file size (for example 1 MB) and alias depth, treat cycles and dangling aliases as invalid with an error naming the token path, and parse off the UI thread. Document the grammar in the author guide.

### High (25)

**[Flow coverage]** — Density's default has no rule for what happens when the style changes (§ EXPERIENCE IA table L29; Flow 4 steps 2–3 L283–284; DESIGN Layout & Spacing › Density L478–482)
The IA table makes the Density default "the style's native density", while the axes are "independent". Marco picks Less-is-more (native Compact) and then picks Compact by hand, which implies density does not follow style, but the IA table implies it might. The settings schema depends on the answer: it stores either an explicit value or a "follow style" sentinel.
Raised by: Rubric, Flow coverage (high)
Fix: State the rule. For example: density stays on "Style default" until the user picks a level, and the control shows what that resolves to.

**[Flow coverage]** — Theme identity and "Export a copy…" naming are undefined (§ EXPERIENCE Flow 2 steps 1–2 and 6 L255–260; Theme Authoring › Packaging L208; Component Patterns › Install theme…)
Exporting a built-in writes a complete file with all four variants and every role, so Flow 2 step 2's "derived on the variants he hasn't written" never happens unless he deletes them. Until step 6 adds `$metadata`, the copy has no defined display name and can duplicate the built-in's. The edge-case reviewer widens this into a build blocker: nothing says whether a theme is identified by filename or by `$metadata.name`, so two files with the same name (Flow 2's own path) collide; a third-party file named "Loft" or "Nylas" makes fallback copy ("Using Loft instead") ambiguous; `$metadata` is neither required nor optional; and Export's default location and filename are open.
Raised by: Rubric, Flow coverage (medium); Edge cases #24 (high); Edge cases #25 (high); Edge cases #26 (medium); Edge cases #36 (medium); Edge cases #37 (low)
Fix: Identify a theme by filename stem and display `$metadata.name` (optional, defaulting to the stem), appending the filename when names collide. Reserve built-in names: a third-party "Loft" shows as "Loft (custom)", and fallback always means the built-in. Say what Export writes (all variants, or light standard only as a starter), and pre-fill "<Theme> copy.tokens.json" in the themes folder with `$metadata.name` "<Theme> copy", then offer "Preview it".

**[Token completeness]** — Typeface delivery and licensing are unresolved, and Nylas-Pro is proprietary (§ DESIGN Typography L433; Theme catalogue L402–409; EXPERIENCE Component Patterns › Font select L102; `nylas-private-fonts/package.json`)
Nothing says Jost is bundled; if it isn't, Loft renders in Avenir Next or the system font and fails the `loft-01.webp` diff. The Taiga, Darkside and Less-is-more typefaces are only "the legacy theme's font", and nothing says whether Inter, IBM Plex Sans and Atkinson Hyperlegible ship with the app. The adversarial reviewer checked the repo: `nylas-private-fonts` is `"license": "Proprietary"`, so Nylas-Pro, the typeface of the Classic onboarding look and the upgrade target for three legacy themes, probably can't ship in a public OSS release, and redistributing it is a real copyright exposure. The edge-case reviewer notes there is no fallback when a theme's own face is missing; the Font missing state covers only the override.
Raised by: Rubric, Token completeness (high); Adversarial F10 (high); Edge cases #39 (high)
Fix: Treat "where licensable" as resolved: Nylas-Pro is out. Pick an OFL stand-in with similar metrics before anyone hand-checks the Classic port, and remove `nylas-private-fonts` from the release build. Name each theme's family and stack, list the fonts the app bundles, and let a missing theme face fall back silently down its stack.

**[Token completeness]** — Toast tokens borrow roles that make toasts unreadable in dark themes (§ DESIGN frontmatter `components.toast`, `toast-error` L295–302; Colors role table L357, L367; Components › Upgrade notice toast L548)
`toast.background` is `{colors.text-strong}`, and `toast.foreground`, `toast-error.foreground` and the upgrade toast's action text are all `{colors.accent-on}`. In Nylas dark the heading colour is `#ffffff` and `accent-on` is white, so the toast is white on white. `accent-on` only has to contrast with the accent, not with this fill. Toasts are the only feedback for theme-load errors.
Raised by: Rubric, Token completeness (high); Edge cases #96 (high)
Fix: Add `surface-inverse`, `text-on-inverse` and `status-danger-on` roles, defined per variant, and repoint the toasts to them.

**[Token completeness]** — Contrast pairs are not enumerated, and the 360-combination sweep can't verify the floor (§ DESIGN Colors › Measured Loft contrast L418–429; Colors › Variants; EXPERIENCE Verification Matrix; memlog L57)
The measured table lists four failing pairs, but other load-bearing pairs fail at standard contrast: white on `status-danger` 3.9:1 (error toast), `accent-default` on `accent-tint` 3.5:1 (inbox badge), `accent-default` on white 3.9:1 (active nav), `highlight-text` on `highlight-bg` 4.4:1 (search hits), `text-secondary` and `text-snippet` on `surface-sunken` 2.3:1 and 2.0:1, and `icon-default` on white 2.5:1 against the 3:1 icon target. The edge-case reviewer notes the derivation is said to "pass AA automatically" with no pair list defined anywhere. Accessibility and adversarial both find the sweep can't guarantee the floor: axe checks computed text contrast only, missing focus rings, icons, dots, boundaries and any state not on screen; 180 of the 360 runs will be red by design at standard contrast, hiding real regressions; text size, RTL, the OSes, forced colours and third-party themes are excluded; and no screenshot, axe or Electron-driver dependency exists, so the sweep has no harness and about 2,160 baselines to approve.
Raised by: Rubric, Token completeness (medium); Accessibility H5 (high); Adversarial F9 (high); Edge cases #30 (high); Edge cases #97 (medium)
Fix: Publish one role-pair table in DESIGN › Colors: each foreground role × each background role it is used on, per component and state, with its 4.5:1 or 3:1 threshold. Derivation, the author guide and a deterministic unit-test lint across all 24 built-in variants read that table, and the lint runs at install and live reload on third-party files. Keep a baseline of known standard-contrast failures so new ones show. Limit visual baselines to native pairs plus a small adversarial set, drive states in the screenshot pass, budget manual screen-reader passes of the four flows, and build the Electron screenshot harness as its own costed story.

**[Component coverage]** — The Appearance page's own controls have no tokens or state visuals (§ DESIGN Components › Appearance page L551–568; frontmatter `components` L303–311)
The frontmatter covers only `appearance-preview`, `appearance-mini-preview` and `apply-bar`. None of the page's controls has a radius, size, or selected, hover, focus or disabled appearance: the style card, theme swatch, segmented controls (Mode, Contrast, Density, Pending/Applied), slider, select, switch, the "Previewing" and "Applied" tags, the OS-state chip and the derived badge. Apart from its text tag, a selected card has no visual. This is the feature's main surface.
Raised by: Rubric, Component coverage (high)
Fix: Add a component token for each control, with its state visuals, read from role tokens only.

**[Component coverage]** — The "separate Preferences window" doesn't exist, and its owning style is undefined (§ DESIGN Components › Appearance page L553; EXPERIENCE IA L39; Responsive & Platform L178; memlog L59; `preferences/lib/main.jsx:54`)
Appearance "renders in the applied theme", but nothing says which style's radius, spacing and title bar the frameless Preferences window uses, or whether it takes the applied text size and font, which Ruth needs. The adversarial reviewer found the premise is false: Preferences is a Sheet pushed inside the main window (`Actions.pushSheet`), not a separate window, though the spines say "separate Preferences window" six times. A real separate window would be a new renderer with no mail stores, and "your own inbox in the preview" would mean shipping thread data across processes.
Raised by: Rubric, Component coverage (medium); Edge cases #11 (medium); Adversarial F7 (premise part) (high)
Fix: Fix the premise in the spines: Appearance stays a sheet, or a new window becomes an explicit, scoped decision. Then state the rule for its look, for example: Preferences uses the applied theme, contrast, text size and font, with its own fixed layout rather than the style's.

**[State coverage]** — Forced colours and Linux high contrast are unhandled, and the platform signals are unverified (§ EXPERIENCE State Patterns › OS Increase contrast on L133; Responsive & Platform L180–181; Flow 3 steps 3–4 L271–272; Voice and Tone L72; DESIGN Elevation & Depth)
Ruth's flow depends on Electron reading `prefers-contrast` on Windows and Linux, and on an OS text scale being readable, yet no code reads `prefers-contrast`, `forced-colors` or `nativeTheme.shouldUseHighContrastColors` today. Windows Contrast themes turn on `forced-colors: active`, which overrides every token (the hand-checked high-contrast variant included) and strips `box-shadow`. In Loft that erases every region and control boundary, the selected card's fill, segmented-control selection, the unread and presence dots and category colour. On Linux Chromium probably maps neither GNOME's high-contrast switch nor a usable dark signal, so Follow system and Auto may never fire, and Flow 3's "Failure: none for built-in themes" quietly fails there. The chip string "Following macOS: on" has no Windows or Linux version, and nothing covers an OS that reports nothing.
Raised by: Rubric, State coverage (high); Accessibility H2 (high); Adversarial F4 (Windows and Linux part); Edge cases #3 (high); Edge cases #4 (medium)
Fix: Run a spike on all three OSes before architecture. Honour forced colours (all three reviewers lean this way) with a contract every style meets: boundaries as borders in a transparent role, selection in `Highlight`/`HighlightText`, focus drawn with `outline`, dots in `currentColor`, and no broad `forced-color-adjust: none`. Show "Windows contrast theme is on" by the contrast control. On Linux read GNOME's high-contrast key in the main process, or show "Your system doesn't report this" and resolve to Off and Light. Add per-OS chip strings, and add light and dark Contrast themes to the checks.

**[State coverage]** — Users of community LESS themes have no upgrade rule, and upgraders' onboarding is ambiguous (§ EXPERIENCE State Patterns › Upgrade from a legacy theme L140; Theme Authoring › Legacy L206; IA Onboarding L41)
The spines map the six built-in themes only. A user whose `core.themes` names a community LESS theme gets no fallback look and no message, and Install theme… pointed at an old LESS theme would show a confusing generic error. The adversarial reviewer adds that the upgraded Classic gains a top-bar search, an account chip and a right rail, so "the original three-pane layout" changes under users who were promised continuity, and the split/list `layoutMode` preference isn't mapped. Nothing says whether upgraders see the onboarding looks step, which is "shown on every first launch", or only the toast.
Raised by: Rubric, State coverage (high); Adversarial F20 (medium); Edge cases #44 (high); Edge cases #50 (medium); Edge cases #34 (medium)
Fix: Add a state row: an unknown legacy theme lands on Classic + Nylas (Mode Dark pinned if the old theme was detectably dark), and the toast names the theme that no longer loads. Add an Install error: "This looks like an old LESS theme. Nylas Mail now uses token files." Map `layoutMode` explicitly, and keep Classic's new regions in the existing Locations or make them opt-in. Upgraders get the toast only; "first launch" means no accounts are configured.

**[State coverage]** — The embedded live preview has no focus, screen-reader or data model (§ EXPERIENCE Component Patterns › Appearance preview L92, Pending/Applied switch, Mini-preview; Accessibility Floor L164–172; memlog L18, L41, L45, L75)
The preview renders the real app as "view-only". If it isn't inert, Tab walks through a second inbox and screen readers read out the user's mail; if it is inert, keyboard users can't scroll it. Its own live regions and toasts (new mail, sync) may fire into the screen reader, and the Pending/Applied switch has no semantics. The adversarial reviewer calls the build underestimated: in one DOM the page must render two styles, themes, densities and text sizes, plugins registered into Locations will render inside the preview with live side effects, and a 160px scaled strip can't show a density or text-size change legibly, which is the mini-preview's whole job. The edge-case reviewer asks what the preview shows on a fresh account with no mail yet, given Flow 1 promises "her own inbox".
Raised by: Rubric, State coverage (high); Accessibility M1 (medium); Adversarial F7 (preview part) (high); Edge cases #19 (medium)
Fix: Render the real components (message list, reading card, top bar) on fixture data inside a container scoped by `[data-style][data-theme][data-density]`, with plugin Locations stubbed and notifications suppressed. Make the content `inert` and `aria-hidden` inside a focusable `role="region"` wrapper named, for example, "Preview: Loft style, Taiga theme, pending", scrollable with arrow and Page keys, and point `aria-describedby` at the apply-bar summary. Build Pending/Applied as a two-option radio group. Make the mini-preview an unscaled crop of two or three rows, kept out of the tab order. Label fallback content "Sample messages" when the inbox is empty.

**[State coverage]** — The theme lifecycle has gaps: removal, deletion while running, the last-valid cache (§ EXPERIENCE State Patterns L134–138; Component Patterns › Install theme… L105; Theme Authoring L201–204)
There is no way to remove an installed theme or reveal the themes folder. Nothing covers the applied or pending theme's file being deleted or renamed while the app runs, a missing or unwritable themes folder during Install or Export, Install pointed at a file already in the folder (Replace onto itself risks truncating it), Replace against a built-in's name, or "Keep both" naming. Both fallback rules rely on a "last valid version", but nothing says where it is stored, when it is written, or whether it survives a restart, a deletion or a reinstall.
Raised by: Rubric, State coverage (medium); Edge cases #27 (high); Edge cases #28 (high); Edge cases #38 (high); Edge cases #18 (medium); Edge cases #33 (medium); Edge cases #35 (low)
Fix: Add "Remove…" (with confirmation) and "Show in folder" to third-party swatches. Cache each theme's last valid parse in the app data directory, outside the themes folder, keyed by theme id and written after every successful load. A deleted active theme keeps rendering from cache for the session with a persistent toast, then falls back on next start; a deleted pending theme reverts the pending theme to the applied one. Detect same-path installs ("'Ocean' is already installed"). "Keep both" appends " 2" to the stem and the display name.

**[Inheritance discipline]** — Neither spine has `sources` frontmatter, and the tracking issue is stale (§ DESIGN and EXPERIENCE frontmatter; GitHub issue #1 "Themes" bullet; memlog L55, L60)
The tracking issue (`heyjawrsh/nylas-mail#2`) isn't referenced, and its body is stale: its Themes bullet lists seven themes ("Light, Dark, Ubuntu, Taiga, Darkside, Less-is-more and Loft"), against the spines' six with Nylas. A PO slicing epics from the issue would produce separate Light and Dark theme stories.
Raised by: Rubric, Inheritance discipline (high)
Fix: Add `sources:` (the memlog, issue #1 and the imports), and update the issue's Themes bullet.

**[Inheritance discipline]** — Contrast-variant naming drifts, and the theme file's shape is unspecified (§ DESIGN Brand & Style L331, frontmatter L11, L322; EXPERIENCE Verification Matrix L217, Theme Authoring L199–200; memlog L32)
The variant is "high contrast" in DESIGN and "increased" in the frontmatter comment and the Verification Matrix; the setting is "Increase contrast". Theme Authoring doesn't define how a DTCG file expresses mode × contrast, or whether roles are flat (`surface-app`) or nested (`surface.app`); DESIGN says only "may nest". The adversarial reviewer notes the DTCG format module has no concept of modes (they live in the separate Resolver spec or in vendor `$extensions`), so a single four-variant `.tokens.json` is a Nylas-specific convention, and the Figma and Tokens Studio interop claim holds only after a documented conversion. The edge-case reviewer adds file-shape cases nobody answers: a theme that ships only dark (derivation runs only from light), an intentionally single-mode theme, a file that sets style-owned radius or spacing, and a newer-version file read by an older app.
Raised by: Rubric, Inheritance discipline (medium); Adversarial F16 (modes part); Edge cases #6 (high); Edge cases #40 (medium); Edge cases #7 (low); Edge cases #41 (low)
Fix: Use one term: "high contrast" for the variant, "Increase contrast" for the setting. Specify the file shape now (the DTCG Resolver or a documented `$extensions.nylas.modes`) with a minimal example, and ship a converter for Figma and Tokens Studio exports. Define the derivation source order (light standard, then dark standard, then whatever exists), allow `$metadata.modes`, ignore style-owned tokens with an author warning, and add `$metadata.schemaVersion` so a newer major version is rejected clearly.

**[Accessibility review]** — A focus ring bound to `accent-default` can't meet 3:1 in five of six themes (§ DESIGN frontmatter `components.focus-ring.color`; Components › Focus ring; EXPERIENCE Accessibility Floor › Focus)
L67 requires 3:1 in every variant, and L21 keeps accents reference-exact; once the ring is bound to the accent, the two contradict. Legacy accents against their own panels: Nylas light 2.88, Ubuntu 2.83, Darkside 2.59, Taiga 2.46 (2.27 on its tint), Nylas dark 2.67 and 2.23. Only Loft (3.94) and Less-is-more (5.53) pass. On accent-filled elements (the selected card, primary buttons) an accent ring 2px from an accent fill is 1.0:1 and reads as a slightly bigger button. `imports/loft-global.css` sets `outline: none` on focused inputs, and the mockup draws select focus as a `box-shadow`, which vanishes under forced colours. The edge-case reviewer adds that a weak third-party accent makes "3:1 against adjacent colours" unreachable.
Raised by: Accessibility H1 (high); Edge cases #90 (medium)
Fix: Add a dedicated `focus-ring` colour role to the contract and DTCG schema; no mockup draws focus, so it may differ from the reference. Derive it for third-party themes with the same 3:1 guarantee, or use a two-tone ring (`focus-ring` plus a `surface-panel` or `text-strong` halo) that reaches 3:1 on any background, accent fills included. Add a Don't: never port `outline: none`, and draw focus with `outline`, not `box-shadow`.

**[Accessibility review]** — Accessibility settings wait behind Preview → Apply and are discarded silently (§ EXPERIENCE Interaction Primitives › Preview, then Apply; State Patterns › Leaving Appearance with pending changes; Flow 3; memlog L31, L64, L71)
Deliberate, and a risk to weigh. Ruth raises text size to 150% or turns Increase contrast on, and only the embedded preview changes; the controls, labels and the Apply button she must find stay at the old size and contrast. If she closes the window she loses the change without notice, and the edge-case reviewer notes nothing says whether switching Preferences tabs also counts as closing. Preview → Apply suits taste decisions (style, theme). It is the wrong model for access needs. The two reviewers differ only on font: accessibility would apply it at once, adversarial would keep it previewed.
Raised by: Accessibility H3 (high); Adversarial F11 (high); Edge cases #12 (medium)
Fix: Take Increase contrast and text size (and arguably Mode and font) out of the pending set, so they apply at once to the whole app, Appearance included, with a 10-second Undo toast; keep Preview → Apply for style, theme and density. Never discard silently: keep pending changes while the Preferences window stays open and across close and reopen, or ask on close.

**[Accessibility review]** — Reflow is defined only down to "collapse the rail, then the folders" (§ EXPERIENCE Responsive & Platform › Narrow windows, Text size and zoom; DESIGN Layout & Spacing › Window chrome and minimum width; frontmatter `spacing`; `imports/loft-global.css`; memlog L30, L69)
Reaching 200% text needs text size 150% plus zoom of about 133%, leaving about 825 CSS px in an 1100px window. The top bar needs about 1040 and has no collapse rule; after the rail and folders collapse, the reading card gets about 330px; at 400% zoom (320 CSS px) nothing is defined. "Folders" could mean the whole sidebar or only its list, nothing says where collapsed regions go or how to reach them, and steps that don't apply (no rail in Calendar) aren't explicitly skipped. Fixed heights clip at 150%: a 22px badge holding 18px type, a 40px search pill, a 72px top bar. It is unstated whether `app-min-width` is CSS px after zoom, and the other four styles declare no minimum. The adversarial reviewer adds that a 1280×800 laptop at 125% scaling gives about 1024 CSS px, so the default look opens with its rail already collapsed, and the source CSS does the opposite of the rule (`min-width: 1100px`, scrolling sideways).
Raised by: Accessibility H4 (high); Adversarial F18 (medium); Edge cases #8 (high); Edge cases #73 (high); Edge cases #10 (medium); Edge cases #74 (medium); Edge cases #75 (medium); Edge cases #9 (low)
Fix: Define the full collapse ladder in CSS px, so zoom and text size trigger it: rail becomes a toggle overlay; sidebar becomes an icon strip, then a menu button; search pill becomes an icon and the account chip its avatar; a final single-pane mode (list ↔ reading, with Back) down to 320 CSS px. Every collapsed region opens from a named `aria-expanded` button, steps skip per view, and every step reverses. Widths become `max-*`, heights become `min-height`, and rows grow past the density floor. Bound the guarantee (for example 150% text or 125% zoom at a 1280px window), set each style's minimum width in its epic, and add 150% plus 200% zoom, 400% zoom and the 1.4.12 spacing check to the sweep.

**[Accessibility review]** — Dark email adaptation hides transparent logos and has no contrast floor (§ EXPERIENCE Email Body Rendering; View original toggle; Open Questions 2; DESIGN `colors.text-reading`; Do's and Don'ts; `ui-dark/styles/email-frame.less`)
"No text below the active contrast floor" has no number at standard contrast, where themes are below AA by design, so the adaptation could legally aim for 3:1. Plain-text bodies use the app's own `text-reading` at 3.03:1, which isn't sender content, so the third-party exemption doesn't apply. "Images untouched" plus darkened backgrounds makes dark logos and signatures on transparent PNGs disappear, the most common corporate email failure. The adversarial and edge-case reviewers add that senders who ship their own dark CSS get adapted twice, mixed light and dark sections are unaddressed, and nothing sets precedence between View original or Adapt off and Increase contrast. This replaces today's `invert() hue-rotate(180deg)`, so it is new work, not a port.
Raised by: Accessibility M7 (medium); Adversarial F15 (medium); Edge cases #60 (high); Edge cases #65 (high); Edge cases #59 (medium); Edge cases #62 (medium); Edge cases #61 (low); Edge cases #68 (low)
Fix: Set the adapted-text floor at 4.5:1 at both contrast levels. Give transparent images a light backing plate, which changes their surroundings, not their pixels. Detect sender dark CSS (`color-scheme`, `prefers-color-scheme`) and adapt only bodies that declare none; leave already-dark sections alone. State that an explicit user choice wins, with an "Original colours may be hard to read" note under Increase contrast. Plain text is theme-rendered with no toggle; open bodies re-adapt when the OS flips; under forced colours Chromium forces the frame. Put these fixtures in the spike's corpus.

**[Adversarial review]** — No minimum shippable slice, and the default style depends on another initiative (§ Attacks memlog L13, L16 (no release-scope entry in the log))
**Attacks:** the absence of any release-scope entry in the log, and L16 ("Contacts/Calendar may be scheduled under the state-of-the-art initiative") read against L13 (Loft's scope includes calendar and contacts). The default look's scope includes two features another initiative owns and that don't exist yet. Loft can't be declared complete, or verified against its mockup (L57), until that initiative ships. The release either slips, or ships a Loft whose sidebar view switcher points at missing views. (The rubric's bloat finding on the feature-scope boundary sits on the same seam.)
Raised by: Adversarial F5 (high)
Fix: **Alternative v1 slice:** the token runtime and a contract built from all six themes; styles Classic (today's layout) and Loft (mail view, search overlay, compose, right rail); all six themes, with Ubuntu, Taiga, Darkside and Less-is-more as themes on Classic, which is what they are today; Increase contrast (Follow system on macOS and Windows, plus a forced-colours layer), text size and density on the message list; and Appearance with a real-component preview on fixture data. Defer the three legacy styles, per-style Calendar and Contacts layouts, the Install theme… UI (themes folder only, documented as beta), per-sender email memory, the onboarding slider, the full 360 sweep and RTL beyond lint-enforced logical properties. That cuts the style × surface matrix from about 40 to about 10, and verification from 360 to 144 combinations.

**[Adversarial review]** — Per-style frameless chrome on three operating systems is a platform project (§ Attacks memlog L46, L69; `src/browser/window-launcher.js:36`; DESIGN Layout & Spacing › Window chrome; EXPERIENCE Responsive & Platform)
**Attacks:** L46 (frameless; each style owns the title bar on every OS) and L69 (`titleBarOverlay` at inline-end; the top bar is the drag region). It's new work: Windows and Linux run on native frames today. `titleBarOverlay` controls are drawn natively, so colour, symbol colour and height have to be pushed through `setTitleBarOverlay` on every change of theme, mode, contrast and style, and the fixed overlay height ignores text size and zoom, so Loft's 72px top bar and the overlay drift apart. On Linux the controls are Chromium-drawn, and Wayland compositors vary on resize edges, snapping and double-click-to-maximize. Loft's own geometry contradicts the rule: the app card is inset 28/32px, so the corner where the overlay sits is on the ground, not in the style's top bar. Accessibility and edge cases pile on: the OS, not the style, decides the control side in RTL (an RTL app on an LTR OS reverses it), GNOME left-side button layouts are ignored, the window title and keyboard window moves (Alt+Space, Alt+F7) are unspecified, narrow widths may leave almost no drag area, macOS full screen hides the traffic lights, and composer and thread popouts have no defined chrome. That's 5 styles × 3 OSes × 2 directions = 30 chrome configurations, none of which a headless screenshot sees.
Raised by: Adversarial F6 (high); Accessibility M8 (medium); Edge cases #72 (high); Edge cases #78 (medium); Edge cases #77 (low)
Fix: **Alternative:** one app-owned title-bar component, with style-provided slots (`start`, `center`, `end`) and two tokens (height, background). Styles never touch the OS controls. Lay out around `env(titlebar-area-x/width)` and `getTitlebarAreaRect()`, not a logical side. Keep the native frame as the Linux default or as a user option, or honour GNOME `button-layout`. Specify what Loft's inset does at the window edge (full-width top bar when maximized, or a painted overlay region). Keep the window title current ("Inbox — Nylas Mail"), guarantee about 48px of drag area, drop the reserved inset in full screen, and give popouts a minimal top bar under the same per-OS rule. Verify `titleBarOverlay` and `trafficLightPosition` in RTL before committing.

**[Adversarial review]** — Free mix produces structurally broken combinations, not just ugly ones (§ Attacks memlog L11, L48; DESIGN Elevation & Depth ("Less-is-more uses none"))
**Attacks:** L11 (free mix), L48 (the theme owns shadow). The Less-is-more theme (ground `#ffffff`, no shadows, a 1px ring) on the Loft style renders a white floating card on a white ground with no shadow and no border, because Loft bans borders. The app has no visible structure. The Darkside theme on Loft loses its dark sidebar (see the role-contract finding), and the Ubuntu theme on Loft puts an orange `shadow-accent` everywhere. The first screenshots of these mixes on a forum or in a review become the reputation.
Raised by: Adversarial F12 (high)
Fix: **Alternative:** keep free mix, but make it safe. Styles declare required capabilities (`needs: elevation.shadow` or `separation.border`), and themes declare what they provide. Where a capability is missing, the style uses a defined fallback, such as rendering `border-subtle` when there's no shadow. The picker leads with curated looks ("Recommended", each style's native theme on top) and shows "Mix and match" second. That's direction C's strength, without its weakness.

**[Edge-case review]** — Third-party contrast isn't enforced when a theme loads (§ DESIGN Colors › Variants; Brand & Style; EXPERIENCE Accessibility Floor; Theme Authoring)
DESIGN says "every high-contrast variant, hand-checked or derived, must meet 4.5:1", but nothing enforces it when a third party authors a failing high-contrast variant. At standard contrast a third-party theme can ship text equal to its background, or a focus ring below 3:1, although the ring must reach 3:1 "in every theme variant".
Raised by: Edge cases #29 (high); Edge cases #31 (medium)
Fix: Check authored high-contrast variants against the pair table on load. If one fails, replace the failing roles with derived values, show the derived badge, and tell the author which pairs failed. At standard contrast, warn only, except for the focus ring, which is always enforced (falling back to `text-strong`).

**[Edge-case review]** — Legacy migration rules are missing: downgrade, stacked themes, user stylesheets, plugin LESS (§ EXPERIENCE State Patterns › Upgrade from a legacy theme; Foundation; Component Patterns › Upgrade notice toast)
A downgrade after upgrading, or a re-upgrade, can leave `core.themes` unrecognisable or overwrite choices made in the new version. `core.themes` can list several entries (a stale `ui-light` base plus the chosen theme). A user `~/.nylas-mail/styles.less` references removed variables and selectors. Third-party plugins that `@import "ui-variables"` or use the 143 LESS variables break, and "old community LESS themes stop working" covers themes, not plugins. A `ui-light` user on a dark OS gets Mode Auto and sees the app turn dark after the upgrade. Whether an undismissed upgrade toast returns next launch is open.
Raised by: Edge cases #43 (high); Edge cases #46 (high); Edge cases #47 (high); Edge cases #45 (medium); Edge cases #48 (medium); Edge cases #51 (low)
Fix: Leave `core.themes` untouched and write the new settings under new keys, running the mapping only when they're absent, and key the notice to a "seen" flag. Use the last non-base entry that maps. Load a user `styles.css` after the token layer and say what happens to `styles.less`. Keep a one-release compatibility layer that aliases the old LESS variable names to custom properties, or say plainly that plugin styles break. Pin Light for upgrading `ui-light` and `ui-ubuntu` users, with the toast pointing to Auto. The toast returns each launch until dismissed or acted on.

**[Edge-case review]** — Adapted colours could leak into replies, and print has no palette (§ EXPERIENCE Email Body Rendering)
Replying to or forwarding an adapted message could quote the adapted DOM, and typing in the dark-mode composer could write theme colours inline into outgoing HTML. Printing a message in dark mode or high contrast has no defined palette. The adversarial reviewer flags print (the `print` package) and the reply quote as the same unspecified edges.
Raised by: Edge cases #66 (high); Edge cases #67 (high); Adversarial F15 (print and reply part)
Fix: Quote the original HTML, never the adapted DOM, and keep composer colours in CSS only, with a test. Print always uses sender colours on white, with Nylas light standard tokens for chrome, regardless of mode, contrast, View original or text size.

**[Edge-case review]** — Toasts have no stacking, de-duplication or placement rule (§ EXPERIENCE Component Patterns › Toast; DESIGN Loft mail surfaces)
The first launch after an upgrade can raise the upgrade notice, a theme-load error and a font-missing error together, but the spine has one bottom-centre toast. Dev saving a broken file 20 times gets 20 persistent toasts. Nothing says which window shows a toast (main, Preferences, a popout), the compose card collides with the toast at 1100px, and "clicking any toast dismisses it" lets an off-target click lose the upgrade toast's action.
Raised by: Edge cases #93 (high); Edge cases #94 (high); Edge cases #95 (medium); Edge cases #79 (low); Edge cases #98 (low)
Fix: Stack upward from the bottom centre, newest nearest the edge, at most three plus "+N more", with errors above notices and each dismissible on its own. Keep one toast per theme file, replaced in place and dismissed when the next save succeeds. Theme errors show in the focused window and the main window, never twice in one; Appearance errors show in Preferences. Toasts shift to clear an open compose card. Only a close control dismisses toasts that carry an action.

**[Edge-case review]** — Categorical colours: overrides, renames and collisions are undefined (§ DESIGN Categorical palette; memlog L56, L76)
An override that stores a hex breaks free mix, dark mode and AA. Renaming a folder changes its colour, because the hash is of the name. Nested labels (`Work/Clients`) and same-named folders across accounts have no hashing rule, provider label colours are unaddressed, and there is no UI for overriding. The adversarial reviewer quantifies the collisions: with 8 colours and hash assignment, two of five folders share a colour 79% of the time, and the hand-check load is 8 × 4 × 6 = 192 values.
Raised by: Edge cases #84 (high); Edge cases #83 (medium); Edge cases #87 (medium); Edge cases #81 (low); Edge cases #82 (low); Edge cases #86 (low); Adversarial F19 (collision part)
Fix: Overrides store a category index (1–8), never a hex, resolved per theme and variant. Pin the index at first sight, or hash a stable folder id, so a rename keeps the colour. Assign folder colours round-robin and keep the hash for avatars. Hash the full path without the account. Ignore provider colours or map them to the nearest index. Offer the override from the folder or calendar context menu, with eight swatches from the active theme and "Automatic".

### Medium (26)

**[Flow coverage]** — The theme fallback chain is circular and splits two ways (§ EXPERIENCE Flow 1 Failure L249; State Patterns › Theme fails to load L134; memlog L65)
Ines's failure path falls back to Loft when the chosen theme fails to load, but Loft is both the default and the fallback, so the path is circular unless bundled built-ins can't fail. The adversarial reviewer adds that the two fallback rules disagree: a failed theme falls back to Loft, while a missing role fills from Nylas. A Classic user with a broken theme lands on Loft's theme in Classic's layout, a mix nobody chose.
Raised by: Rubric, Flow coverage (low); Adversarial F16 (fallback part) (medium)
Fix: Say whether bundled built-ins can fail; if they can, name a terminal fallback such as a compiled-in Loft light. Fall back to the active style's native theme rather than a fixed built-in, and use one rule for failed files and missing roles.

**[Token completeness]** — Text roles for categorical fills and unread rows are missing (§ DESIGN Categorical palette L377–394; Components › Message row L537, Calendar view L545; frontmatter L243)
Avatar initials and calendar chip labels sit on category fills with no text role, so each style would pick its own colour, which free mix forbids, and high-contrast variants need such a role to pass 4.5:1. The unread subject is "darker", but `message-row.subject-color` is `text-strong` for read and unread rows alike, and no role is darker. Accessibility notes `text-strong` on `category-1` passes at 6.69:1 today, but no rule requires it.
Raised by: Rubric, Token completeness (medium); Edge cases #85 (medium); Adversarial F19 (initials part); Accessibility M6 (palette part)
Fix: Add `text-on-category` (or per-category `-on` roles) at 4.5:1 or better per variant, and add those pairs to the contrast pair table. Add `text-unread`, or state that unread differs by the dot alone.

**[Token completeness]** — Shadow roles sit outside the token contract (§ DESIGN header note L318; Elevation & Depth L490–498; EXPERIENCE Theme Authoring › Contents L200)
The three shadow roles exist only as literals in `components` and as names in the Elevation table. Theme authors writing DTCG shadow tokens have no role keys to target, and the legacy themes' shadows are described only in words ("small 1px", "hairline").
Raised by: Rubric, Token completeness (medium)
Fix: List the shadow role keys and their values for each theme, in Theme Authoring or in an extension group in the frontmatter.

**[Component coverage]** — Some interactive and data-driven elements have no behavioural or visual spec (§ EXPERIENCE Component Patterns › Top bar L112, Calendar view L119; DESIGN Components › Right rail L541, Reading card L540)
The bell has no behaviour in either spine. Nothing says what data drives the presence dot. The "Show remote images" chip has no visual spec and no persistence rule (per message or per sender). The account switcher dropdown rows have no visual spec. Modals and popovers (New event, New contact, event detail, day popover) have no `modal` or `popover` component, although `rounded.xl`, shadow-card and `scrim` all cite "modals".
Raised by: Rubric, Component coverage (medium)
Fix: Add the rows, or defer each element by name to a feature epic in Open Questions.

**[Component coverage]** — "Numbered markers" are email content, not a component (§ DESIGN Colors role table L364; Elevation & Depth L496)
They are listed as accent-filled elements with shadow-accent, but in `loft-01.webp` and `loft-02.webp` the numbered circles 1–3 sit inside the email body, which is sender HTML, not app chrome. A consumer will either hunt for a component that doesn't exist or apply app tokens to email content.
Raised by: Rubric, Component coverage (medium)
Fix: Remove "numbered markers", or reclassify them as example email content.

**[State coverage]** — The onboarding looks step has no defined controls, keyboard model or fit at 150% (§ EXPERIENCE Component Patterns › Onboarding look card L107; Interaction Primitives › Banned L160; Voice L83; Flow 1 L245–246; Flow 3 L273; `window-manager.js:240-250`)
Picking a card "applies directly", and Flow 1 implies it also advances to the inbox, yet Ruth sets text size on the slider in the same step, so she must do it before picking; only "Skip" is named. If the cards are radios with selection following focus, each arrow press applies a whole look, and it is unclear whether the slider applies live given the ban on applying outside the preview. Accessibility adds that on macOS Ruth gets through account setup and OAuth at 100% text before she reaches the slider. The adversarial reviewer notes the onboarding window is fixed at 900×600 and non-resizable, so the heading, three cards and slider won't fit at 150%, and the slider adds a control to the one-click step L64 protects.
Raised by: Rubric, State coverage (medium); Accessibility M9 (medium); Adversarial F17 (medium); Edge cases #55 (medium); Edge cases #56 (medium); Edge cases #57 (medium)
Fix: A pick applies, selects the card and re-themes the step; a "Continue" button advances; re-picking is allowed; Skip reads "Skip (uses Loft)". Choose one keyboard model (buttons named by look plus description, or a radio group under the style-card rules), and give the slider `aria-valuetext` "125%". Resize the step live and let the window grow or scroll. Consider a single "Aa" affordance that opens the slider inline, plus an Increase contrast switch and a "⌘+ to zoom" hint on the first onboarding screen.

**[State coverage]** — Toasts have no announcement, pause or keyboard rule (§ EXPERIENCE Component Patterns › Toast L121; Accessibility Floor; DESIGN `components.toast-error`)
Standard toasts auto-dismiss after 5 seconds with no live-region rule and no pause on hover or focus, which leaves a screen-reader user no time to read them. Persistent error toasts have no keyboard route, and roles aren't stated.
Raised by: Rubric, State coverage (low); Accessibility L1 (low); Edge cases #92 (medium)
Fix: Use `role="status"` for standard toasts and `role="alert"` for errors. Pause on hover and focus, and lengthen the timeout for longer messages. Add F6 or a shortcut that focuses the toast stack, and let Esc dismiss the focused toast. Put the rule in one line of the Accessibility Floor.

**[Visual reference coverage]** — The only Appearance layout reference lives in `.working/` and drifts from the spine (§ DESIGN Theme catalogue L398; Components L510; EXPERIENCE IA L45; Voice L70)
`.working/appearance-directions.html` is the only layout reference for the Appearance page and the only source of the legacy theme hex values, which sit in a style comment, but consumers treat `.working/` as scratch. The mockup's Theme intro reads "Colour, type, corner and shadow tokens.", which EXPERIENCE quotes as "(mockup)" in an edited form, and its Increase contrast control is a two-state switch, not the spine's three-way segmented control.
Raised by: Rubric, Visual reference coverage (medium)
Fix: Move the file to `mockups/` and link direction A by anchor. Lift the legacy hex extraction into the spine or into theme files. Mark the Voice quote as edited.

**[Visual reference coverage]** — `reconcile-loft-DESIGN.md` is stale but linked as the record of dropped content (§ EXPERIENCE IA L61)
It cites Open Questions 6, 7, 9, 13 and 14 and [GAP] items that no longer exist, a `settings-measure` token, an "Add account" sidebar label and seven themes. It lists highlight escaping and Ctrl+K as dropped, though both are now carried, and calls the CSS-wins badge value "not a memlog decision", though memlog L77 now covers it.
Raised by: Rubric, Visual reference coverage (medium)
Fix: Re-run the reconcile, or add a "superseded snapshot" header and move the list of dropped items into the spine.

**[Bloat & overspecification]** — The same rules are restated across sections (§ DESIGN Variants L416, Do's L578; EXPERIENCE State Patterns L132, Accessibility Floor L166, Theme Authoring L204, Verification L223, Flows 2 and 3)
The AA thresholds (4.5:1 and 3:1) appear about 8 times, the window-chrome rule 5 times, the narrow-window collapse rule 3 times, and the text size and zoom rule 5 times. Each copy is a drift risk.
Raised by: Rubric, Bloat & overspecification (medium)
Fix: Give each rule one owning section, and have the others link to it.

**[Accessibility review]** — Esc discards every pending change, with no undo (§ EXPERIENCE Interaction Primitives › Esc; State Patterns › Leaving Appearance with pending changes; Voice ("Esc discards"))
Deliberate (L31, L64), and a risk to weigh. Counting Esc presses is fragile: native `<select>` popups on macOS are OS menus whose Esc never reaches the page, so the user's next Esc discards every pending change. Screen-reader users press Esc reflexively to leave interaction or browse modes, and macOS Preferences windows don't discard on Esc. Nothing says what Esc does when nothing is pending and no menu is open.
Raised by: Accessibility M2 (medium); Edge cases #13 (low)
Fix: After a discard, show "Changes discarded" with Undo (`role="status"`, ⌘Z works), or make Esc discard only when focus is in the apply bar. With nothing pending, pass Esc through to the Preferences window's own behaviour.

**[Accessibility review]** — Focus after Apply jumps to the heading, and the announcement says too little (§ EXPERIENCE Accessibility Floor › Focus; State Patterns › Applied; Voice)
Deliberate (L67, L75). ⌘↵ pressed from the text-size slider throws focus to the top of the page, though focus was never in the apply bar. A focus move and a live announcement fired together often cut each other off in VoiceOver and NVDA. A text-size-only change would announce "Loft, Taiga", which says nothing, and nothing says where focus lands in the main window after a style switch re-lays it out.
Raised by: Accessibility M3 (medium)
Fix: On ⌘↵, leave focus where it is. On an Apply or Revert click, which removes the button, move focus to the last-changed control, falling back to the heading with `tabindex="-1"`. Announce through a polite live region present at page load, listing every changed axis. After Apply, restore main-window focus to the equivalent element, such as the selected thread.

**[Accessibility review]** — Radio-group details: nested actions, an unreachable tooltip, selection that follows focus (§ EXPERIENCE Component Patterns › Theme swatch, Derived badge, Style card, Mode/Increase contrast/Density controls, Text size slider; `.working/appearance-directions.html`)
"Export a copy…" inside a swatch puts an interactive control inside `role="radio"`, which is invalid nesting. The derived badge's tooltip sits on a non-focusable element. Arrow keys select, so each press re-renders the near-full-width preview with a cross-fade, and holding a key cycles themes rapidly. The segmented controls and slider have no stated semantics, and the directions mockup uses `aria-pressed` buttons, contradicting the spine.
Raised by: Accessibility M4 (medium)
Fix: Move "Export a copy…" outside the group (one button acting on the checked swatch, or a per-swatch More menu after the group). Expose the tags and badge text through `aria-describedby`, and show the tooltip on focus. Debounce preview updates during key repeat. Build Mode, Increase contrast and Density as radio groups; the slider uses `role="slider"`, `aria-valuetext="125 percent"`, Home/End and 12.5% steps. Tell the build ticket not to copy the mockup's markup.

**[Accessibility review]** — The sticky mini-preview and pinned apply bar can hide the focused control (§ EXPERIENCE Mini-preview, Apply bar; DESIGN `spacing.appearance-mini-preview`; Appearance page › Apply bar)
Deliberate (L45). In an 800px-tall Preferences window at 200% zoom (about 400 CSS px of viewport), the 160px strip and the ~72px apply bar cover more than half of it, so tabbing down the Display rows lands focus under one of them (WCAG 2.4.11).
Raised by: Accessibility M5 (medium)
Fix: Set `scroll-padding-block` to the sticky heights. Shrink or hide the mini-preview below a viewport-height threshold and give it a collapse button. Test at 150% text plus 200% zoom.

**[Accessibility review]** — Colour is the only signal for presence, unread, the current timeline item and calendars (§ DESIGN Categorical palette; Components › Message row, Selected message card, Right rail, Calendar view; `components.presence-dot`, `message-row.unread-dot`; EXPERIENCE Accessibility Floor › Never by colour alone)
The green presence dot is 2.28:1 on white, and colour is its only meaning. The accent unread dot disappears (1.0:1) on the accent-filled selected card. The current timeline item is marked only by accent colour and a filled dot. Calendar chips show their calendar by colour alone; eight hash-assigned colours collide often, and the L 0.88 pastels are 1.31–1.45:1 against white and hard to tell apart with colour-vision deficiency. "Never by colour alone" covers only the Appearance tags.
Raised by: Accessibility M6 (medium)
Fix: Extend "Never by colour alone" to the whole app. Presence gets an accessible name ("Online") and a shape for away and busy. The unread dot uses `accent-on` on the selected card, and the row's accessible name starts "Unread". The timeline uses `aria-current="true"` plus a visible cue. Chips carry the calendar name in their name and tooltip, with a legend. Add a colour-vision check to the hand-check of colours 5–8.

**[Accessibility review]** — `/` is a single-character shortcut with no off switch (§ EXPERIENCE Component Patterns › Search pill / search overlay; Interaction Primitives › Keyboard)
Inherited from the Loft spec rather than logged. Speech-input users of Dragon and Voice Control can trigger it by accident (WCAG 2.1.4), and no rule says it is inactive in text fields.
Raised by: Accessibility M10 (medium)
Fix: Route it through Nylas Mail's existing keymap preference so it can be disabled or remapped, and keep it inactive while focus is in any editable field.

**[Accessibility review]** — Boundaries are drawn only by shadow and tint, even under Increase contrast (§ DESIGN Elevation & Depth; Do's and Don'ts ("Add borders in Loft beyond the right-rail divider"); `components.button-secondary`, `search-pill`)
Deliberate (L48 and Loft's no-borders rule). `surface-sunken` against white is 1.08:1 and the search pill fill 1.10:1; secondary pills are white on white, defined only by `shadow-soft`. The high-contrast variant is colour-only and the style bans borders, so field and region boundaries stay near 1.1:1 even with Increase contrast on. The adversarial reviewer hits the same gap from the free-mix side (Less-is-more on Loft, under "Free mix produces structurally broken combinations").
Raised by: Accessibility M11 (medium)
Fix: Add `border-control` and `border-region` theme roles: transparent at standard contrast, keeping the look exact, and 3:1 or better in high contrast. Styles always draw them, and the same borders become visible under forced colours.

**[Accessibility review]** — The right rail and timeline have no screen-reader structure (§ EXPERIENCE Component Patterns › Right rail; State Patterns › Narrow window; DESIGN Components › Right rail)
Clicking a timeline item scrolls the view but doesn't move focus, which strands keyboard and screen-reader users. The rail has no landmark or heading structure, and there is no route back once it collapses at narrow widths.
Raised by: Accessibility M12 (medium)
Fix: Make the rail `<aside aria-label="Conversation details">` with its three headings. Build the timeline as a list of buttons with `aria-current`, and move focus to the message on activation (`tabindex="-1"` on the article). Reopen a collapsed rail from a named `aria-expanded` toggle.

**[Accessibility review]** — The text-size range and OS tracking leave gaps (§ EXPERIENCE IA › Text size; Accessibility Floor › Text size; memlog L30, L67)
150% alone doesn't reach 200%, and later Windows or GNOME text-scale changes are ignored, unlike contrast, which has Follow system. The edge-case reviewer adds that OS values outside the range (Windows up to 225%, GNOME 0.8) or off the 12.5% step (Windows 110%) have no fitting rule, and that at 87.5% `{typography.caption}` renders near 9.6px. The adversarial reviewer notes Electron has no API for Windows `TextScaleFactor` or GNOME `text-scaling-factor`; both are native lookups the spines treat as givens.
Raised by: Accessibility L3 (low); Edge cases #17 (medium); Edge cases #91 (low); Adversarial F17 (OS text-size part)
Fix: Clamp OS values to 87.5–150% and round to the nearest step, telling the user when a value was clamped ("window zoom goes further"). Add a Follow system state that mirrors contrast, consider extending the range to 175–200%, set a 10px rendered floor for every role, and treat the OS reads as a spike with a fallback.

**[Adversarial review]** — The ownership split contradicts itself on rhythm and type (§ Attacks memlog L23, L30, L48)
**Attacks:** L48 ("shape and rhythm are structural", owned by the style) against L23 and L48 (the theme owns the type ramp), and L30 (text size reflows). Type size is vertical rhythm. If a theme sets `heading-reading` to 32px or a 28px wordmark, Loft's fixed 72px top bar and its px columns (sidebar 236, list 380, search 440) overflow, and the style can't stop it. With 150% text on top, the px widths don't scale at all. The theme also owns shadow, yet "every accent-filled element gets shadow-accent" is a Loft style rule.
Raised by: Adversarial F13 (medium)
Fix: **Alternative:** the theme owns family, weight, tracking and one base size. The style owns the ramp as ratios and states layout dimensions in `rem` or `em`, so text size reflows them. Shadows split the same way: the theme provides tint and opacity, the style decides which elements are elevated.

**[Adversarial review]** — Density regresses Classic and contradicts Less-is-more's own signature (§ Attacks memlog L22, L68; DESIGN Style catalogue; Layout & Spacing › Density)
**Attacks:** L68 (44px floor at Compact; Less-is-more is natively Compact) and L22 (any style at any density). Classic's wide-mode rows are 36px today, so "Compact Classic" is less dense than today's default, and Marco-type upgraders lose rows. Less-is-more's confirmed signature is "No toolbar, generous padding, hairline dividers", and its native density is Compact. Those two statements contradict each other. Accessibility comes at the floor from the other side: timeline rows, calendar chips and "+N more" are likely under WCAG 2.5.8's 24px at Compact, and nothing guarantees the minimum.
Raised by: Adversarial F14 (medium); Edge cases #49 (medium); Accessibility L4 (low)
Fix: **Alternative:** make the floor per style (Classic 32px, Loft 44px). The real floor is WCAG 2.5.8's 24px target, applied at every density. Recheck Less-is-more's native density against the legacy `ui-less-is-more` rendering, and fix either the description or the default.

**[Edge-case review]** — View original memory has no key or scope (§ EXPERIENCE Email Body Rendering; View original toggle)
"Remembered per sender" doesn't say whether the key is the exact address, the display name or the domain, which matters for rotating addresses (`bounce+123@`), one person with several addresses, and spoofable From headers. Nor does it say whether the memory is per account or global. Accessibility calls it invisible state; the adversarial reviewer notes the toggle is per message while the memory is per sender, so flipping one newsletter changes every message from that address.
Raised by: Edge cases #63 (medium); Edge cases #64 (low); Accessibility M7 (memory part); Adversarial F15 (memory part)
Fix: Make the memory explicit ("Always show original for this sender") rather than implicit, keyed by exact lowercase address or the authenticated sender domain, with "Always for <domain>" as an option, and keep it global. Make the toggle a button with `aria-pressed`, placed before the body in reading order, and add "Reset email colour choices" on Appearance.

**[Edge-case review]** — OS mode and contrast changes during pending edits are unspecified (§ EXPERIENCE Interaction Primitives › Live OS tracking; Component Patterns › Increase contrast control)
The app follows the OS live, but nothing says whether the preview, the Pending/Applied comparison or "Right now that's Light" re-resolve when the OS flips light/dark or `prefers-contrast` mid-edit, whether the pending set survives, or whether an OS-driven change is announced.
Raised by: Edge cases #1 (medium); Edge cases #2 (medium); Edge cases #88 (low)
Fix: Auto and Follow system resolve live everywhere: the main app, both preview segments, the mode copy and the OS chip. An OS event never discards or changes a pending set, and the apply-bar summary shows "Follow system", not the resolved value. No announcement; the chip updates.

**[Edge-case review]** — Live reload has no working watcher and no partial-save rule (§ EXPERIENCE Theme Authoring; State Patterns › Live-reload error; `theme-manager.js:18-21, 66-71`)
The adversarial reviewer found `pathwatcher` isn't installed and `theme-manager.js` silently no-ops without it, so "live reload on save" has no working watcher today. Editors write 0-byte files during atomic saves, and a new file with no valid version yet has no defined behaviour. Swap, temp and cloud conflict copies land in the folder. Nothing says reload reaches every surface rendering the theme: the applied theme in every window, popouts included, and the pending theme in the preview.
Raised by: Adversarial F16 (reload part); Edge cases #20 (medium); Edge cases #32 (medium); Edge cases #21 (low)
Fix: Use `fs.watch` or chokidar, debounced about 300ms, watching only `*.tokens.json`, ignoring dotfiles and 0-byte writes that a non-empty write follows. List files that never loaded under an "Errors" row in the grid instead of raising a toast. Reload every surface currently rendering that theme.

**[Edge-case review]** — Onboarding re-entry and the pre-pick look are undefined (§ EXPERIENCE IA › Onboarding looks step; State Patterns)
Nothing covers quitting after adding an account but before picking a look, adding a second account (the legacy app reuses the onboarding window for account setup), the look the onboarding window renders in before any pick, or whether card thumbnails honour OS Increase contrast.
Raised by: Edge cases #52 (medium); Edge cases #53 (medium); Edge cases #54 (medium); Edge cases #58 (low)
Fix: Reopen on the looks step until a pick or Skip is recorded, and never show it for a second account. Render onboarding in Loft at the OS mode, contrast and text size, the same look Skip produces, with thumbnails in the active contrast.

**[Edge-case review]** — Mixed direction and non-Latin scripts aren't handled (§ DESIGN Typography; EXPERIENCE Responsive & Platform › RTL)
An RTL UI with LTR mail, or Arabic and Hebrew subjects in an LTR list, has no direction rule. Jost has no Arabic or Hebrew glyphs, `letterSpacing: 0.01em` on every role breaks Arabic cursive joining, and `0.08em` uppercase labels make no sense for scripts without case.
Raised by: Edge cases #70 (medium); Edge cases #71 (medium)
Fix: Set message bodies, subjects and snippets to `dir="auto"`, with UI direction from the locale. Give each theme a per-script fallback stack, and set letter-spacing to 0 and text-transform to none for `:lang(ar, fa, he, ur)`.

### Low (17)

**[Component coverage]** — Component names differ between the spines (§ DESIGN Components; EXPERIENCE Component Patterns, IA)
EXPERIENCE has one "Search pill / search overlay" row where DESIGN has two; "Message list / message row" against "Message row"; five control rows (Mode, Contrast, Density, Font, Adapt) against "Display rows"; two rows for "Install theme…" and "Theme author link" against one combined row; and "Upgrade notice toast" and the '"New: Appearance" notice' have no DESIGN row.
Raised by: Rubric, Component coverage (low)
Fix: Use one name per component in both files.

**[Component coverage]** — Several DESIGN components have no Component Patterns row (§ DESIGN Components; EXPERIENCE Component Patterns)
Focus ring, App frame / app card, Older thread messages, Badge, Nav item and the primary and secondary buttons have no behaviour row. Their behaviour lives elsewhere or is static. The buttons have no press or disabled behaviour, because Loft's 0.12s transitions and its 1px press nudge were dropped in the reconcile.
Raised by: Rubric, Component coverage (low)
Fix: Add short rows, or note that these components are static.

**[Visual reference coverage]** — The two Loft images aren't told apart (§ DESIGN Components L510; EXPERIENCE Inspiration L228)
Both are described as the "main mail view". `loft-01` is the framed composition (app card on the ground) and the verification target; `loft-02` is a full-bleed crop with no app-frame inset.
Raised by: Rubric, Visual reference coverage (low)
Fix: Say what each image illustrates, and that the app-frame inset follows `loft-01`.

**[Bloat & overspecification]** — Pixel literals stand in for existing tokens (§ DESIGN Components › Right rail L541; EXPERIENCE L94, L153)
The right-rail email and timeline snippets are "12px", which is `{typography.meta}`. EXPERIENCE says "about 160px", which is `{spacing.appearance-mini-preview}`. Avatar sizes 36, 40, 44 and 72 are scattered literals.
Raised by: Rubric, Bloat & overspecification (low)
Fix: Reference the tokens, and consider adding avatar size tokens.

**[Bloat & overspecification]** — The feature-scope boundary is inconsistent (§ EXPERIENCE Component Patterns; State Patterns L146)
Component Patterns specifies feature behaviour for Calendar (popover versus side panel), Contacts, Compose and the search operators, while State Patterns hands those surfaces' states to the feature epics. The adversarial reviewer's release-scope finding turns on the same seam (see "No minimum shippable slice" under the adversarial review).
Raised by: Rubric, Bloat & overspecification (low)
Fix: Keep only the contracts for cross-style placement and the security contract, and link the feature epics for the rest.

**[Inheritance discipline]** — The RTL overhang wording conflicts with the frontmatter key (§ EXPERIENCE Responsive & Platform L182, Accessibility Floor L169; DESIGN L538)
Responsive & Platform says the selected card "overhangs at inline-start", but the key is `overhang-inline-end`. The edge-case reviewer confirms it is geometrically consistent (the list's inline-end edge is the reading pane's inline-start edge) but easy to build mirrored twice. With logical properties, RTL needs no special handling, and the extra sentences invite a wrong flip.
Raised by: Rubric, Inheritance discipline (low); Edge cases #69 (low)
Fix: Say "past the list's inline-end edge, into the reading pane" everywhere, and add an RTL reference screenshot.

**[Shape fit]** — The frontmatter departs from the spec in places (§ EXPERIENCE frontmatter; DESIGN `spacing`, `components.appearance-mini-preview`)
EXPERIENCE lacks the `name` and `sources` that both examples carry. DESIGN `spacing` holds `app-min-width`, which isn't spacing, and `components.appearance-mini-preview.position: sticky` is CSS behaviour, not a token.
Raised by: Rubric, Shape fit (low)
Fix: Add the missing keys. Move `app-min-width` to a layout note or a `size` group, and move `position` to prose.

**[Accessibility review]** — Reduced motion covers only this feature (§ EXPERIENCE Accessibility Floor › Reduced motion; `imports/loft-global.css`)
Loft's own motion isn't governed (the hover lift, button press, toast slide-in and search overlay), nor is a live OS switch, including one that lands during the 200ms apply or 120ms preview fade.
Raised by: Accessibility L2 (low); Edge cases #89 (low)
Fix: Make `prefers-reduced-motion` a style-contract rule, so every style's transitions become instant or opacity-only, and finish any running fade when it turns on. Verify that GTK `gtk-enable-animations` maps through Chromium.

**[Accessibility review]** — The Apply shortcut isn't discoverable (§ EXPERIENCE Voice and Tone › Apply bar; Component Patterns › Apply bar)
The hint says only "Esc discards".
Raised by: Accessibility L5 (low)
Fix: Hint "⌘↵ applies · Esc discards" (Ctrl+Enter on Windows and Linux), put `aria-keyshortcuts` on Apply, and make the shortcut work while focus is in the preview.

**[Accessibility review]** — Search overlay semantics are unspecified (§ EXPERIENCE Component Patterns › Search pill / search overlay; DESIGN Search overlay, `search-hit`)
No combobox or listbox model, no result-count announcement, no stated focus return on Esc, and hit highlights at 4.44:1. The escaping contract (L54) is unaffected.
Raised by: Accessibility L6 (low)
Fix: Build a combobox with a grouped listbox, announce the result count politely, return focus to the trigger on Esc, and raise hits to 4.5:1.

**[Accessibility review]** — Custom scrollbars are faint and narrow (§ DESIGN `colors.scrollbar-thumb`; `imports/loft-global.css`)
The thumb is 1.30:1 on `surface-sunken` and 8px wide.
Raised by: Accessibility L7 (low)
Fix: Use a 3:1 or better thumb in high-contrast variants, respect the OS always-show setting, and leave scrollbars native under forced colours.

**[Adversarial review]** — Trademark (§ Attacks memlog L60, L62)
**Attacks:** L60 (the theme is named "Nylas") and L62 (the Nylas Mail logo in the top bar). A public revival that ships Nylas, Inc.'s name as the default theme and its logo in every top bar invites a takedown, and L62's "or the fork's name if rebranded" shows the risk is already known.
Raised by: Adversarial F21 (low)
Fix: **Alternative:** use a neutral theme name ("Classic Light/Dark" or the fork's name), and make the logo a build-time brand token.

**[Adversarial review]** — Breaking legacy community themes is acceptable (§ Attacks memlog L19)
**Assessment:** the ecosystem has been dormant since 2017, and those themes override DOM selectors this initiative changes anyway. The break costs little.
Raised by: Adversarial F22 (low)
Fix: Keep it, document it, and cover the unknown-theme upgrade case (see the community LESS theme finding under State coverage).

**[Adversarial review]** — Whole-window cross-fades can end on a half-painted frame (§ Attacks memlog L36, L64)
**Attacks:** L36 (~200ms app cross-fade) and L64 (120ms preview cross-fade). Cross-fading an entire Electron window between two styles means snapshotting the old frame (`capturePage`) and overlaying it while the DOM re-lays out. On a large mailbox the re-layout can take longer than 200ms, so the fade ends on a half-painted frame.
Raised by: Adversarial F23 (low)
Fix: **Alternative:** overlay the snapshot until the next idle frame, then fade, with a bounded duration.

**[Edge-case review]** — Apply-bar and Pending/Applied edge behaviour (§ EXPERIENCE Component Patterns › Pending/Applied switch, Apply bar; Interaction Primitives; Voice and Tone)
Changing a control while the switch shows "Applied" is unspecified. A summary listing every changed setting overflows at 150% text. It's unclear whether "Adapt email colours in dark mode" is pending like every other Appearance control, given the preview shows the inbox, not a dark email body.
Raised by: Edge cases #14 (low); Edge cases #15 (low); Edge cases #16 (low)
Fix: Any control change flips the switch back to Pending. Truncate the summary after two items with "+N more", keeping the full list in the region's accessible description. Say whether Adapt is pending or applies immediately.

**[Edge-case review]** — Grid order with many installed themes (§ EXPERIENCE Component Patterns › Theme swatch)
Scores of installed themes have no order or scrolling rule.
Raised by: Edge cases #42 (low)
Fix: Built-ins first, then third-party themes sorted by name. The grid wraps, and the mini-preview stays pinned.

**[Edge-case review]** — Mixed-DPI monitors blur hairlines (§ DESIGN Layout & Spacing › Window chrome; `colors.border-subtle`)
Moving the window between 1×, 1.25× and 2× monitors blurs or drops the 1px `border-subtle` divider and the shadows, and the minimum width's unit isn't stated.
Raised by: Edge cases #76 (low)
Fix: State that the minimum width is in DIP, snap hairlines to device pixels or use a tint instead, and run the sweep at 1× and 2×.

## Mechanical notes
- **Cross-references:** all 229 `{path}` references resolve (99 in the DESIGN frontmatter, 118 in the DESIGN body, 12 in EXPERIENCE). The only unresolved string is `{path.to.token}` in EXPERIENCE Foundation L13, which illustrates the syntax.
- **Unreferenced tokens:** `colors.scrollbar-thumb`, `colors.text-faint`, `spacing.list-width` and `typography.input` are defined but never referenced with `{}`. `list-width` appears only as the literal "380px" in the layout diagram, and `typography.input` is used nowhere.
- **Hex format:** `colors.scrim` is an 8-digit hex (`#1e283c59`). Confirm that the DTCG pipeline and the parser accept alpha hex.
- **Frontmatter:** DESIGN has `name` and `description`. EXPERIENCE has neither `name` nor `sources`. The initiative file has frontmatter only, and links both spines.
- **Superseded memlog entries are handled correctly:** L35 "Classic (Light)" → Nylas (L60); L40 "28 token sets" → 24 (L51, L60); L49 "420" → 360 (L60); L60 "designed light mode" → dark (L73); L11 "theme owns radius" → style owns radius (L48).
- **Codebase names:** issue #1 names `theme-package.js` and a `theme-picker` package; EXPERIENCE Foundation names only `theme-manager.js`. The retired modal is presumably `theme-picker`, so name it.
- **Mermaid:** none. The ASCII layout diagram (DESIGN L453–461) is fine.
- **Spine-wins rule:** consistent across the spines (DESIGN L510 "any mockup or import"; EXPERIENCE L45 "the mockup").
- **De-duplication:** 178 raw findings (rubric 32, accessibility 25, adversarial 23, edge cases 98) combine into 74. A combined finding takes the highest severity any reviewer gave it and lists every source with its own rating; "part" means only part of that source finding was merged there. Each finding lives once: in its rubric category when the rubric raised it, otherwise under the reviewer who raised it most severely.

## Reviewer files
- `review-rubric.md`
- `review-accessibility.md`
- `review-adversarial.md`
- `review-edge-cases.md`
