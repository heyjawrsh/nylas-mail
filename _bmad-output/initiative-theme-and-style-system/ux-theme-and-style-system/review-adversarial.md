---
type: review
lens: adversarial
target: DESIGN.md, EXPERIENCE.md, .memlog.md (ux-theme-and-style-system)
reviewed: 2026-11-09
---

# Adversarial review: theme and style system

## Verdict

**Not ready to hand to architecture as a release spec. It works as a long-term vision.**

The spines are carefully written and mostly consistent inside each document. The trouble is the combined scope. Taken together, the decisions describe a terminal state: five full-layout styles × six four-variant themes × three densities, a live real-app preview, per-style frameless chrome on three operating systems, RTL, text scaling, dark email adaptation and a third-party token API. That state sits on a foundation the codebase doesn't have yet: no CSS custom properties, about 15k lines of compile-time LESS, hard-coded JS row heights, no screenshot or axe harness, and about 52% test coverage mid-modernization. Nothing in the log names a smallest shippable slice. The free-mix guarantee is the central promise of the design, and the token contract cannot keep it, because the contract was derived from one theme (Loft) and cannot express three of the other five.

Four decisions turn a large project into an unbounded one:

1. Free mix across five styles that each lay out every feature.
2. Mockup-exact contrast as the default.
3. Per-style window chrome on three operating systems.
4. Promoting three legacy restyles to full styles.

Each one has a cheaper alternative that keeps most of the user value.

**Counts:** 4 critical, 8 high, 8 medium, 3 low (23 findings).

## Evidence base (measured in the repo, not assumed)

| Fact | Source | Why it matters |
|---|---|---|
| 156 LESS files, 15,043 lines; 2,427 `@var` references | `static/`, `internal_packages/` | Everything has to move to runtime tokens before any theme can switch without a recompile |
| **317 compile-time colour functions** (`darken`, `fade`, `mix`, `tint`, …) | same | These can't run on CSS custom properties. Each becomes a new role, a `color-mix()`, or a lost colour |
| 200 hex literals in component LESS, outside the ui-* themes and variables files | same | Every one breaks free mix until it becomes a role |
| **648 physical `left`/`right`/`float`/`text-align` declarations** | same | The size of the "RTL required for every style" work in the code that already exists |
| Thread-list row height is **hard-coded in JS**: `itemHeight = 36` (wide) / `85` (narrow) | `thread-list/lib/thread-list.jsx:188-191`; `ListTabular` positions rows at `idx * itemHeight` | Density and text size can't be CSS-only. Today, 150% text clips the rows. The Compact floor (44px) is taller than Classic's current row (36px) |
| Windows and Linux use the **native frame** today (`frame: process.platform !== "darwin"`) | `src/browser/window-launcher.js:36` | Frameless Win/Linux chrome is new work, not a port |
| **Preferences is a pushed Sheet inside the main window, not a separate window** | `preferences/lib/main.jsx:54`, `preferences-ui-store.js:62` (`Actions.pushSheet`) | The spines say "separate Preferences window" six times (memlog L59) |
| `pathwatcher` is **not installed** (`node_modules/pathwatcher` missing). `theme-manager.js` silently no-ops without it | `theme-manager.js:18-21, 66-71` | "Live reload on save" has no working watcher today |
| `nylas-private-fonts` is **`"license": "Proprietary"`** and ships 7 Nylas-Pro `.otf` files | `nylas-private-fonts/package.json` | The Nylas theme's typeface probably can't ship in a public OSS release |
| No code reads `prefers-contrast`, `forced-colors` or `nativeTheme.shouldUseHighContrastColors` | grep of `src`, `internal_packages`, `static` | The OS-driven Increase contrast path is entirely new, on three operating systems |
| The current dark email treatment is `invert() hue-rotate(180deg)` on the body and again on images | `ui-dark/styles/email-frame.less` | "Smart adaptation, images untouched" replaces it. It is new work, not a port |
| Plugins register into fixed workspace Locations: Center 8, RootSidebar 5, MessageList 5, ThreadList 4, MessageListSidebar 3 | ComponentRegistry calls | A style that moves regions has to keep every Location alive, or plugins vanish |
| Onboarding window is fixed at 900×600, `resizable: false` | `window-manager.js:240-250` | The text-size slider at 150% has to fit there |
| No Playwright, axe or Spectron dependency. The client-app scripts are `test` and `smoke` | `packages/client-app/package.json` | The "360-combination automated sweep" has no harness |
| Loft pairs I measured: snippet `#a7b0bd` on `#f3f6fb` **2.02:1**; secondary `#9aa4b2` on `#f3f6fb` 2.33:1; accent text on white 3.94:1; white card vs `surface-sunken` **1.08:1** | WCAG relative-luminance calculation | Contrast in place is worse than the log records (L20). Surfaces are told apart almost entirely by shadow |

## Findings

### F1 [critical]: The token contract is Loft-shaped, so free mix is a promise the contract can't keep

**Attacks:** memlog L11 ("every style must read only shared tokens"), L48 (ownership), L12 (port all six), and the DESIGN.md `colors` frontmatter ("Every theme defines every role below").

**Failure scenario:** The role list was built from `loft-global.css`. It has one hairline role (`border-subtle`, "the only hairline Loft uses … Not used for general separation") and no regional surfaces. Three of the six catalogue themes can't be expressed with it:

- **Darkside** is "light content with a dark sidebar" (`#313042`, sidebar text ~`#9f9f9f`). There's no `surface-sidebar` and no `text-on-sidebar` role. Either Darkside loses its identity, or the Darkside style hard-codes the sidebar hex, which DESIGN.md's Do's and Don'ts bans.
- **Ubuntu** has a dark toolbar (`#41403b`) with light text (`#f6f6f6`). There's no toolbar surface role.
- **The Taiga style** is "bordered message cards, outlined selection", which needs `border-default`, `border-strong` and a selection-outline role. Loft's contract has none of these. When a third-party theme leaves them out, they get filled from Nylas, so a "free mix" Taiga render shows Nylas borders inside someone else's theme.

Every new role added later is a breaking change for every third-party theme already published. The contract has to be complete before the token API goes public (L19, L65).

**Alternative:** Before freezing the contract, run a role inventory across all six themes and all five styles (or only the styles you actually ship; see F5). At minimum, add regional surfaces (`surface-sidebar`, `surface-toolbar`, each with an `on-*` text role), a border ramp (`border-subtle`, `border-default`, `border-strong`), selection roles (`selection-bg`, `selection-fg`, `selection-outline`), `on-category` for avatar initials, and an elevation strategy token (see F8). Version the contract (`$metadata.contractVersion`) so later additions are non-breaking: a missing role falls back to the nearest parent role, not to the Nylas theme.

### F2 [critical]: "Style" has no technical definition, yet it has to lay out every feature, about 40 layouts

**Attacks:** L16 ("each style must lay them out"), L13 (Loft scope), L12 (three legacy themes become styles).

**Failure scenario:** Five styles × at least 8 surfaces (mail view, right rail, top-bar search with overlay, account chip, compose, calendar, contacts, plus the Preferences sheet and onboarding) comes to about 40 layout designs. Only Loft's have a mockup. The other four styles have no Contacts or Calendar layout anywhere. The legacy themes predate those features, so "promoting" Taiga, Darkside and Less-is-more to styles means inventing four apps' worth of layout. It isn't a port.

Technically, the existing ui-darkside is 811 lines of CSS overrides against about 50 selectors in the Classic DOM. It's a restyle of one layout. In this architecture, layout lives in `WorkspaceStore.defineSheet` columns and in about 93 `ComponentRegistry` registrations into fixed Locations. CSS can reposition elements but can't re-parent them. Loft puts the right rail *inside* the reading card, while today `participant-profile` and plugins register into `MessageListSidebar`, which is a sibling column. Loft's top-bar search and account chip move components that today live in a toolbar and in `RootSidebar`. So a style either:

- (a) stays CSS-only and can't produce Loft, or
- (b) defines its own sheets, columns and container components, which makes it a code package that has to keep every plugin Location working.

The existing **split/list layout mode** (`mode-switch`, `WorkspaceStore.layoutMode()`) is a second layout axis that the spines never mention. Does Loft support list mode? Does Classic keep it?

**Alternative:** Define a style as three things: (1) a region manifest that maps abstract regions (`nav`, `list`, `reading`, `rail`, `search`, `account`) onto the **stable** existing Locations; (2) a CSS layer scoped under `[data-style=…]`; (3) optional container components for regions that need re-parenting. Styles are built-in only (say so explicitly). Every style must render every Location, or the manifest names a fallback host. Shared features such as Contacts and Calendar get **one** shared layout that reads style tokens (radius, spacing, density) rather than a bespoke layout per style. A style may override a feature layout, but it doesn't have to. That turns 40 layouts into about 8 plus overrides.

### F3 [critical]: The runtime migration underneath all of this isn't in scope, and it's the critical path

**Attacks:** L15 (survey), L32 ("architecture ratifies the runtime mapping"), L47 (RTL for all styles), L30 (text size reflows), L22 and L68 (density).

**Failure scenario:** The spines treat "DTCG to CSS custom properties" as a detail for architecture to ratify. It's the largest single work item in the initiative:

- 2,427 LESS variable references move to `var(--…)`.
- 317 compile-time colour functions have no runtime equivalent. Each `darken(@accent, 10%)` becomes a new role that every theme must define, or a `color-mix(in oklch, …)` whose output then fails the hand-checked contrast guarantee because nobody checked the mixed value.
- 200 component hex literals become roles.
- 648 physical declarations move to logical properties before RTL is even possible.
- Row heights move from JS constants to token-derived values that the virtualized `ListTabular` reads and recomputes when density or text size changes.

Third-party plugin LESS has the same problem. Until all of this lands, the 120ms preview cross-fade and the ~200ms apply are impossible: the code comment in `theme-manager.js:367` says a LESS cache refresh is "very expensive (hundreds of ms)". The build-sequencing rule ("lock single-width pixel fidelity before layering") puts this first. The spines put it nowhere.

**Alternative:** Make "token runtime + LESS retirement" an explicit epic zero with its own acceptance test: Classic + Nylas light renders pixel-identical to today with zero LESS colour functions, every colour a `var()`, and row height driven by a token. Count the colour-function call sites and budget for them. Gate every other epic on it.

### F4 [critical]: The default product fails WCAG AA, and the way out is itself low-contrast and slow

**Attacks:** L21 (mockup-exact default), L35 (skipping lands on Loft), L24 ("accessibility is not optional"), L71 ("the Appearance page renders in the applied theme").

**Failure scenario:** Every user who skips onboarding, plus everyone who picks the first card, gets these defaults:

- Email body at 3.03:1.
- List snippets at **2.02:1** where they actually sit (on `surface-sunken`; the log only measured them on white).
- Active nav text and the primary button label at 3.94:1.

Those are the most-read text in a mail client. The remedy is in Preferences › Appearance, which "renders in the applied theme": a low-vision user on macOS who hasn't turned on OS Increase contrast has to read a 2.3:1 page to find the setting that fixes it. Then (F11) they have to find Apply, or their change is silently discarded.

On **Windows**, OS contrast themes switch Chromium into `forced-colors: active`. That overrides every token, the hand-checked HC variant included, and strips box-shadows, so Loft's "separation by tint and shadow, not borders" (1.08:1 tint) collapses into an undifferentiated surface. On **Linux**, nothing in the repo or in Electron's `nativeTheme` gives a dependable high-contrast signal, so Ruth's climax ("no setting to hunt for") quietly fails there.

**Legal risk, calibrated:** low. The EAA targets economic operators placing products or services on the EU market (with a microenterprise exemption for services), and Section 508 binds federal procurement, not a solo OSS maintainer. **Reputational and user-harm risk is high.** Accessibility audits and distro and package reviewers check the default, and "accessible only if you find a toggle" reads as a defect in a public launch.

**Alternative:** Make standard contrast AA for *text* and mockup-exact for everything else (tints, dividers, icons at 3:1, decoration). The visual cost is close to nothing: `text-reading` `#8b95a5` → `#6b7585` gives 4.66:1, and the primary button stays `#2f7cf6` with a 600-weight label or moves to `accent-hover` `#1e63d0` for fills (5.6:1). If mockup-exact matters to the user, offer it as an opt-in "Reference contrast" and keep the default AA. Add a `forced-colors` layer (borders appear where shadows did) and treat Linux HC as "detect GTK `HighContrast` theme, or tell the user plainly".

### F5 [high]: No minimum shippable slice, and the default style depends on another initiative

**Attacks:** the absence of any release-scope entry in the log. Also L16 ("Contacts/Calendar may be scheduled under the state-of-the-art initiative") read against L13 (Loft style scope includes calendar and contacts).

**Failure scenario:** The default look's scope includes two features that another initiative owns and that don't exist yet. Loft can't be declared complete, or verified against its mockup (L57), until that initiative ships. The release then either slips, or ships a "Loft" whose sidebar view switcher points at missing Calendar and Contacts views.

**Alternative, proposed v1 slice:**

| In v1 | Deferred |
|---|---|
| Token runtime (F3); the contract from F1 | Taiga, Darkside and Less-is-more as *styles* |
| Styles: **Classic** (today's layout) and **Loft** (mail view, search overlay, compose, right rail) | Per-style Calendar and Contacts layouts; Loft's view switcher shows only the views that exist |
| Themes: Nylas (light and dark), Loft (light plus a *designed* dark), Ubuntu, Taiga, Darkside, Less-is-more **as themes on Classic**, which is what they are today | Third-party "Install theme…" UI (the themes folder only, documented as beta) |
| Increase contrast (Follow system on macOS and Windows; forced-colors layer), text size, density on the message list | Per-sender email memory; the onboarding text-size slider (F17) |
| Appearance page with a real-component preview on fixture data (F7) | Full 360-combination sweep (F9); RTL beyond lint-enforced logical properties in new code |

That cuts the style × surface matrix from about 40 to about 10, and the verification matrix from 360 to 2 × 6 × 2 × 2 × 3 = 144.

### F6 [high]: Per-style frameless chrome on three operating systems is a platform project

**Attacks:** L46 (frameless; each style owns the title bar on every OS), L69 (`titleBarOverlay` at inline-end; the top bar is the drag region).

**Failure scenario:**

- **It's new work.** Windows and Linux run on native frames today.
- **The overlay is drawn natively.** `titleBarOverlay` controls are drawn by the OS or Chromium, so `color`, `symbolColor` and `height` have to be pushed through `setTitleBarOverlay` on every change of theme, mode, contrast and style. The overlay height is a fixed pixel number that ignores text size and zoom, so Loft's 72px top bar and the overlay drift apart at 150% text plus zoom.
- **Linux.** The controls are Chromium-drawn, not GTK or KDE. On Wayland, frameless windows lose or vary in resize edges, snapping and double-click-to-maximize, depending on the compositor.
- **RTL.** The OS decides which side the overlay sits on, not the style. "Inline-end" in an RTL locale may not match where Windows actually puts the buttons.
- **Contradiction with Loft's own geometry.** Loft's app card is inset 28/32px from the window (`app-inset-*`), so the window's top-right corner, where the overlay sits, is on the `surface-app` ground and *not* "in the style's top bar". On macOS the traffic lights need `trafficLightPosition`, recomputed per style and per inset.
- **Secondary windows.** Composer pop-outs, the onboarding window (already `frame: false`) and the activity window: which style draws their chrome?

The total is 5 styles × 3 operating systems × 2 directions = 30 chrome configurations, each needing a manual check, because none of this shows up in a headless screenshot.

**Alternative:** One app-owned title-bar component, with style-provided slots (`start`, `center`, `end`) and two tokens (height, background). Styles never touch the OS controls. Keep the native frame as a Linux default, or as a user option. Specify what Loft does to its inset at the window edge (the top bar spans the full width when the window is maximized or fullscreen, or the overlay region is painted to match).

### F7 [high]: The "real app" live preview is underestimated, and the window it lives in doesn't exist

**Attacks:** L18 and L41 (live preview of the real app), L45 (sticky 160px mini-preview), L59 ("separate Preferences window"), L75 (preview is view-only).

**Failure scenario:** Preferences is a Sheet in the main window, so the spines rest on a false premise. If a separate window is meant, it's a new BrowserWindow, a new renderer with no mail stores, and "your own inbox in the preview" (Flow 1, step 6) requires shipping the thread and message data across processes. If it stays a sheet, the page has to render two styles, two themes, two densities and two text sizes in one DOM at once. That needs every style's layout CSS scoped to a container, and the preview's React tree mounted with style-specific containers (F2) without touching the live app's stores or plugins. Third-party plugins registered into Locations will render inside the preview with live side effects unless they're suppressed. A 160px strip of a scaled-down app can't show a text-size or density change legibly, which is the mini-preview's whole job (L45).

**Alternative:** Fix the premise in the spines: Appearance stays a sheet. The preview renders the *real components* (message list, reading card, top bar) on **fixture data** inside a container scoped with `[data-style][data-theme][data-density]`, with plugin Locations stubbed. Users read "real app" as "looks exactly like the app", which this delivers. The mini-preview shows an unscaled crop of two or three message rows, so density and text size are visible at 1:1.

### F8 [high]: The default look's dark mode is derived, and the design depends on shadows, which don't work on dark grounds

**Attacks:** L51 (built-ins "derived then hand-checked"), L35 (Loft is the default), L73 (Darkside and Less-is-more need a *designed* dark mode), L29 ("light/dark follows the OS regardless").

**Failure scenario:** A large share of the first users (developers on macOS) run dark mode. Their first impression is Loft dark, which has no source and is "derived in OKLCH, then hand-checked". Loft's structure is a white card on a 1.08:1 tint, separated by blue-grey `rgba(50,72,110,.22)` shadows. On a dark ground that shadow is invisible and the tint step disappears. Derivation can't invent the elevation strategy that dark mode needs (lighter raised surfaces, rim borders). Two of the three onboarding cards (Loft dark and Darkside dark) show looks that nobody has designed.

The log also contradicts itself: L73 says Darkside and Less-is-more need a "designed" dark mode, while L51 says every built-in variant is "derived then hand-checked".

**Alternative:** Treat "Loft dark" as a designed deliverable with a mockup, inside the Loft epic, before release. Add an elevation-strategy role (`elevation: shadow | tint | border`) so styles know how to separate surfaces in each variant. Until a built-in's dark mode is designed, leave it out of onboarding.

### F9 [high]: The verification policy has no harness, and its numbers hide the real matrix

**Attacks:** L57 (by eye at the native combination plus an automated sweep of all 360).

**Failure scenario:** No screenshot, axe or Electron-driver dependency exists. 360 combinations × at least 6 surfaces is about 2,160 screenshots per run. Screenshots without approved baselines are just pictures, so about 2,160 baselines need human approval, and every token edit re-opens them. Axe catches computed text contrast and nothing else: it won't notice an invisible card, a clipped focus ring or an overflowing top bar in a non-native mix. Only 5 of the 360 combinations get a human eye. The excluded axes (text size × font × direction × OS) multiply the space to about 90k.

Dev's climax ("looks right in a style he never tested") therefore rests entirely on F1's contract being complete. Nothing verifies it.

**Alternative:** Verify the *contract*, not the combinations. (1) A pair manifest: every style declares which fg role sits on which bg role, and a unit test checks every theme variant against those pairs. Fast, needs no harness, catches about 90% of contrast failures. (2) Visual baselines only for the native pairs, plus a small adversarial set (the lightest theme on the most shadow-dependent style, the darkest theme on Classic, 150% text on the narrowest style). (3) Build the Electron screenshot harness as its own story, with a cost estimate.

### F10 [high]: Nylas-Pro is proprietary, so the Classic upgrade look can't ship as specified

**Attacks:** L61 ("ported themes keep their original fonts (Nylas-Pro via nylas-private-fonts …) where licensable").

**Failure scenario:** `nylas-private-fonts/package.json` says `"license": "Proprietary"`. Redistributing those `.otf` files in a public release is a real copyright exposure, which F4's EAA concern is not. Without them, every upgrading `ui-light` or `ui-dark` user (L58) sees Classic + Nylas in a different typeface, and the "original" look isn't original. The "legacy theme's font" for Taiga, Darkside and Less-is-more is still unspecified in DESIGN.md's catalogue.

**Alternative:** Treat "where licensable" as resolved: Nylas-Pro is out. Pick an OFL stand-in with similar metrics now, so the Classic port has a fixed typeface before anyone hand-checks it. Name the typeface for each ported theme in the catalogue. Remove `nylas-private-fonts` from the release build.

### F11 [high]: Accessibility settings sit behind Preview/Apply, and closing the page discards them silently

**Attacks:** L31 (Preview then Apply), L64 (closing discards pending changes silently; contrast is part of the pending set).

**Failure scenario:** Ruth, on macOS without the OS setting turned on, opens Appearance, turns on Increase contrast and sets text size to 137.5%. Only the embedded preview changes. The page around it stays at 2.3:1 and 100%. She closes Preferences and loses both settings, with no warning. Settings meant for people who struggle to see the page are the ones the page makes hardest to commit.

**Alternative:** Split the model. Style, theme and font are previewed, then applied. Increase contrast, text size, mode and reduced-motion-like settings **apply at once to the whole app**, with a 10-second "Undo" toast. Never discard silently. If something is pending on close, apply it or ask.

### F12 [high]: Free mix produces structurally broken combinations, not just ugly ones

**Attacks:** L11 (free mix), L48 (the theme owns shadow), DESIGN.md › Elevation ("Less-is-more uses none").

**Failure scenario:** The Less-is-more theme (ground `#ffffff`, no shadows, a 1px ring) on the Loft style renders a white floating card on a white ground, with no shadow and no border, because Loft bans borders. The app has no visible structure. The Darkside theme on Loft loses its dark sidebar (F1). The Ubuntu theme on Loft puts the shadow tint that the theme owns onto an orange `shadow-accent` everywhere. The first screenshots of these mixes on a forum or in a review become the reputation.

**Alternative:** Keep free mix, but make it safe. Styles declare required capabilities (`needs: elevation.shadow` or `separation.border`), and themes declare what they provide. Where a capability is missing, the style uses a defined fallback, such as rendering `border-subtle` when there's no shadow. The picker leads with curated looks ("Recommended", with each style's native theme on top) and shows "Mix and match" second. That's direction C's strength, without its weakness.

### F13 [medium]: The ownership split contradicts itself on rhythm and type

**Attacks:** L48 ("shape and rhythm are structural", owned by the style) against L23 and L48 (the theme owns the type ramp), and L30 (text size reflows).

**Failure scenario:** Type size *is* vertical rhythm. If a theme sets `heading-reading` to 32px or a `wordmark` of 28px, Loft's fixed 72px top bar and its px column widths (sidebar 236, list 380, search 440) overflow, and the style can't stop it. With 150% text on top, the px widths in DESIGN.md's `spacing` don't scale at all. The theme also owns shadow, yet "every accent-filled element gets shadow-accent" is a Loft *style* rule.

**Alternative:** The theme owns family, weight, tracking and *one* base size. The style owns the ramp as ratios and states layout dimensions in `rem` or `em`, so text size reflows them. Shadows split the same way: the theme provides tint and opacity, the style decides which elements get elevated.

### F14 [medium]: Density regresses Classic and contradicts Less-is-more's own signature

**Attacks:** L68 (44px floor at Compact; Less-is-more is natively Compact), L22 (any style at any density).

**Failure scenario:** Classic's wide-mode rows are 36px today. The Compact floor of 44px makes "Compact Classic" less dense than today's *default*, so Marco-type users who upgrade lose rows. Less-is-more's confirmed signature is "No toolbar, **generous padding**, hairline dividers" (DESIGN.md › Style catalogue), and its native density is Compact. Those two statements contradict each other.

**Alternative:** Make the floor per style: Classic at 32px, Loft at 44px. The real floor is WCAG 2.5.8's 24px target, not 44px. Recheck Less-is-more's native density against its description.

### F15 [medium]: Dark email adaptation guarantees one common failure and leaves two others open

**Attacks:** L34 (darken backgrounds, leave images untouched), L66 (no text below the active floor; View original remembered per sender).

**Failure scenarios:**

- **Untouched images hide logos.** "Images untouched" plus darkened backgrounds makes the most common corporate email failure certain: dark logos and wordmarks on transparent PNGs become invisible.
- **Double adaptation.** Senders who already ship dark CSS (`<meta name="color-scheme">`, `@media (prefers-color-scheme: dark)`) get adapted twice.
- **No standard-contrast floor.** "The active contrast floor" has no value at standard contrast, because standard-contrast themes are deliberately below AA (F4).
- **Scope mismatch.** The toggle is per message, but the memory is per sender. Flipping one newsletter changes every message from that address, the spoofable From header included.
- **Unspecified edges.** Print (`print` package) and the reply quote aren't covered.

**Alternative:** Respect sender dark support first. Adapt only bodies that declare none. Give transparent images a light backing plate in dark mode, which changes their surroundings rather than the image itself. Set a concrete floor (4.5:1 always for adapted text). Make memory explicit ("Always show original for this sender") rather than implicit, and key it on the authenticated sender domain. Print and reply-quote always use the original.

### F16 [medium]: The DTCG-only theme file has gaps in modes, security and reload

**Attacks:** L32 (DTCG JSON, Figma/Style Dictionary/Tokens Studio interop), L43 (live reload), L65 (robustness, single-file package).

**Failure scenarios:**

- **Modes.** The DTCG format module has no concept of modes. Modes and theming live in the separate Resolver spec, or in vendor `$extensions`. A *single* `.tokens.json` holding four variants is therefore a Nylas-specific convention, and Figma Variables and Tokens Studio export modes differently (one file per mode, or `$themes.json`). The interop claim holds only after a documented conversion.
- **Injection.** Token values become CSS custom properties. A font-family or shadow value containing `url(…)` or a `;}` break-out is CSS injection, or a remote-fetch tracking beacon, from an "Install theme…" file.
- **Reload.** The watcher behind "live reload" isn't installed (`pathwatcher` missing).
- **Fallback.** A failed theme falls back to *Loft* (L65), while a missing role fills from *Nylas*. So a Classic user with a broken theme lands on Loft's theme in Classic's layout, a mix nobody chose.

**Alternative:** Specify the file shape now (the DTCG Resolver, or a documented `$extensions.nylas.modes`), and ship a converter for Figma and Tokens Studio exports. Validate values strictly by `$type`: colours parsed, shadow and typography composites rebuilt from parts, no raw strings ever passed through, no `url()`. Use `fs.watch` or chokidar for reload. Fall back to the *active style's matching theme*.

The breakage of legacy community LESS themes is **fine** (F22).

### F17 [medium]: The onboarding text-size slider costs every user to serve a few, and the window can't hold it

**Attacks:** L74 (a slider on every first launch) against L64 ("so Ines's one click holds"), L67 (read the OS text size where Electron exposes it).

**Failure scenario:** The onboarding window is 900×600 and non-resizable. At 150%, the heading, three look cards and the slider won't fit unless the step scales and scrolls. Electron has no API for Windows `TextScaleFactor` (a registry read) or GNOME `text-scaling-factor` (gsettings). Both are native lookups that the spines treat as givens. Every user gets an extra control at the most decision-sensitive moment, while the user it serves (Ruth) is better served by a correct default (F4) and immediate apply (F11).

**Alternative:** Show a single "Text size" affordance (an "Aa" button) on the looks step, which opens the slider inline. Make the onboarding window resizable or scale its content. Treat the OS text-size reads as a spike with a fallback.

### F18 [medium]: The default look's minimum width is too wide for common laptops

**Attacks:** L69 (Loft minimum width 1100px; collapse before anything scrolls sideways, at 150% text plus zoom).

**Failure scenario:** A 1280×800 Windows laptop at 125% scaling gives about 1024 CSS px, below Loft's 1100, so the default look opens with its right rail already collapsed. "Holds at 150% text size plus zoom" has no upper bound: at 200% zoom the viewport is about 640 CSS px, and collapsing the rail and folders won't fit a list plus a reading card.

**Alternative:** Bound the guarantee (for example, 150% text **or** 125% zoom at a 1280px window). Define the full collapse ladder: rail → folders → list overlays the reading pane. Consider whether the 28/32px app insets disappear when the window is maximized or narrow.

### F19 [medium]: The categorical palette will collide, and the initials have no text colour

**Attacks:** L56 and L76 (8 colours, assigned by name hash).

**Failure scenario:** With 8 colours and hash assignment, two folders share a colour **79% of the time once a user has 5 folders** (birthday bound: 1 − 8·7·6·5·4 / 8⁵). Avatar initials sit on these pastels, but no `on-category` role exists, so each style picks a text colour, which free mix forbids. Hand-check load: 8 colours × 4 variants × 6 themes is 192 values.

**Alternative:** Assign folder colours round-robin (next unused colour) and keep the hash for avatars only. Add `on-category-n` roles, and add the pairs to the manifest from F9.

### F20 [medium]: The upgrade path has gaps

**Attacks:** L58 (legacy → style + theme mapping), L16 (every style lays out the new regions).

**Failure scenario:** Users on a *community* LESS theme (`core.themes` containing an unknown package) aren't covered by the mapping. The upgraded Classic gains a top-bar search, an account chip and a right rail, so "the original three-pane layout" changes under the users promised continuity. The split/list mode preference isn't mapped either.

**Alternative:** Add the rule "unknown legacy theme → Classic + Nylas, and the toast names the theme that no longer loads". Make Classic's new regions opt-in, or make them occupy the existing Locations (the rail stays in `MessageListSidebar`). Map `layoutMode` explicitly.

### F21 [low]: Trademark

**Attacks:** L60 (the theme is named "Nylas"), L62 (the Nylas Mail logo in the top bar).

**Failure scenario:** A public revival that ships Nylas, Inc.'s name as the default theme and its logo in every top bar invites a takedown, and the L62 clause ("or the fork's name if rebranded") shows the risk is already known.

**Alternative:** Use a neutral theme name ("Classic Light/Dark" or the fork's name), and make the logo a build-time brand token.

### F22 [low]: Breaking legacy community themes is acceptable

**Attacks:** L19.

**Assessment:** The ecosystem has been dormant since 2017, and those themes override DOM selectors that this initiative changes anyway. The break costs little. Keep it, document it, and cover the unknown-theme upgrade case (F20).

### F23 [low]: Motion and mini-preview details

**Attacks:** L36 (~200ms app cross-fade), L64 (120ms preview cross-fade).

**Failure scenario:** Cross-fading an entire Electron window between two styles means snapshotting the old frame (`capturePage`) and overlaying it while the DOM re-lays out. On a large mailbox the re-layout can take longer than 200ms, so the fade ends on a half-painted frame.

**Alternative:** Overlay the snapshot until the next idle frame, then fade, with a bounded duration.

## Internal contradictions (collected)

| # | Entry A | Entry B | Conflict |
|---|---|---|---|
| 1 | L59 "separate Preferences window" | Code: Preferences is a Sheet in the main window | False premise for chrome, preview and "renders in applied theme" (F7) |
| 2 | L46 and L69: window controls "in the style's top bar" | DESIGN.md: Loft's app card inset 28/32px | The overlay sits on the ground, outside the top bar (F6) |
| 3 | L48 "rhythm is structural" (style) | L48 and L23: the theme owns the type ramp | Themes can break style rhythm (F13) |
| 4 | L64 "so Ines's one click holds" | L74: slider on every first launch | Adds a control to the one-click step (F17) |
| 5 | L65: failed theme → Loft | L65: missing role → Nylas | Two different fallbacks; one produces an unchosen mix (F16) |
| 6 | L24 "accessibility is not optional" | L21 and L35: the default fails AA; L71: the Appearance page renders in the failing theme | F4 |
| 7 | L73: Darkside and Less-is-more need a *designed* dark mode | L51: built-ins are "derived then hand-checked" | Designed or derived? (F8) |
| 8 | DESIGN.md: Less-is-more is "generous padding" | L68: Less-is-more is natively Compact | F14 |
| 9 | L22 "any style at any density" | L68: 44px Compact floor > Classic's 36px rows | Compact Classic is less dense than today (F14) |
| 10 | Flow 3: "Failure: none for built-in themes" | Windows forced-colors overrides tokens; Linux has no HC signal | F4 |
| 11 | L13: Loft scope includes calendar and contacts | L16: those features belong to another initiative | The default style can't be finished on its own (F5) |

## The three decisions I'd most urge the user to revisit

1. **Free mix across five full-layout styles (L11 + L12 + L16).** Ship two styles (Classic and Loft) at launch. Taiga, Darkside and Less-is-more ship as themes on Classic, which is what they already are. Freeze a role contract built from all six themes, not from Loft alone.
2. **Mockup-exact as the default contrast (L21).** Make standard contrast AA for text, a near-invisible change (`#8b95a5` → `#6b7585`), and keep the exact mockup as an opt-in. Make the accessibility settings apply at once rather than through Preview/Apply with a silent discard.
3. **Each style owns frameless chrome on three operating systems (L46 + L69).** Use one app-owned title bar with style slots and two tokens, keep a native frame on Linux, and resolve Loft's inset against where the OS puts its controls.

Runner-up: the "real app" preview in a "separate window" (L18, L59). Correct the premise and preview real components on fixture data.
