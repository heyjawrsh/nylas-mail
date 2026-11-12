---
review: currency
target: architecture-theme-and-style-system.md
checked: 2026-11-11
lens: every committed decision web-researched or reality-checked, not asserted from training data
verdict: needs-fixes
---

# Currency review: theme-and-style-system spine

**Verdict: needs fixes.** Most versions and Electron APIs check out against the web and the lockfile. Three things break as written. The official DTCG schema rejects the `$metadata` key the spine puts in every theme file. The "proprietary faces stay out of the public build" gate fails because the proprietary fonts are committed to the repo. And the shell-neutral claim was only ever checked against Chromium: two committed decisions use CSS and iframe behaviour that WebKit lacks.

Severity: **High** = a committed decision is wrong or self-contradictory as written. **Medium** = a decision leans on an API behaviour or source the spine doesn't name, and an epic will trip on it. **Low** = stale number, wrong premise in a deferred item, or a cheap improvement.

## High

### H1. `$metadata` fails the official DTCG 2025.10 format schema (AD-5 vs AD-6)

- **Claim:** AD-6: a theme file holds `$metadata` (id, name, author, version, license) plus four groups. AD-5: the compiler "validates against the official DTCG 2025.10 format schema".
- **Found:** The schema exists at `https://www.designtokens.org/schemas/2025.10/format.json` (draft-07). Its root has `"additionalProperties": false`. The only `$`-prefixed root keys it allows are `$schema`, `$type`, `$description`, `$extensions`, `$extends`, `$deprecated` and `$root`. Its `patternProperties` excludes names starting with `$`. So `$metadata` fails validation. The Format spec reserves the `$` prefix for the spec's own properties (§5.1.1) and names `$extensions` as the place for vendor data (§5.2.3). Group names like `light-hc` are fine: the only banned characters are `{`, `}` and `.`, plus a leading `$`.
  - https://www.designtokens.org/schemas/2025.10/format.json
  - https://www.designtokens.org/tr/2025.10/format/
- **Note:** The `/schemas/2025.10/` index returns 404. Only the file URLs resolve. The TR text still says the group is "exploring" a JSON Schema, which is out of date. The memlog's "official JSON schemas at designtokens.org/schemas/2025.10/" is right about the files but not the folder.
- **Fix:** Move theme metadata to `$extensions["org.nylas.theme"]: { id, name, author, version, license }` at the root (`$extensions` is allowed there). Put `"$schema": "https://www.designtokens.org/schemas/2025.10/format.json"` in every file and pin that exact URL in AD-5. Update AD-6 and the Consistency Conventions.

### H2. The proprietary font package is committed, so AD-17's gate doesn't keep it out of the public build

- **Claim:** AD-17 prevents "proprietary faces in the public build". "Nylas-Pro appears only when the private `nylas-private-fonts` package is present."
- **Found (repo):** `packages/client-app/internal_packages/nylas-private-fonts/` is tracked in git (`git ls-files` lists the seven `Nylas-Pro-*.otf` files). Its `package.json` says `"license": "Proprietary"`. It isn't stylesheet-only either: it has `lib/main.js`. `static/email-frame.less` hard-references `nylas://nylas-private-fonts/fonts/Nylas-Pro-*.otf`. Any build from this repo therefore has the package "present".
- **Fix:** Pick one and record it. Either (a) remove the package from the public tree (git-ignore it, load it from an out-of-repo path) and drop the `email-frame.less` references, or (b) restate AD-17 as a build-flag gate the packager enforces. Either way, add a CI check that fails if a `Proprietary` package ends up in a public artifact. Flag this to the licence owner. It's a distribution issue, not only a theme one.

### H3. "Shell-neutral: CSS both Chromium and WebKit ship" was never checked against WebKit, and two decisions break it

- **Claim:** AD-2 says theme and style CSS uses only features both Chromium and WebKit ship. The memlog version entry (line 19) lists Chromium milestones only, so no WebKit check was recorded.
- **Found:** The listed features themselves are fine in WebKit:

  | Feature | Chromium | Safari | Source |
  | --- | --- | --- | --- |
  | `@scope` (incl. `to (…)`) | 118 | 17.4 (26.0 fixed nested-context scoping) | https://caniuse.com/css-cascade-scope, https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ |
  | View Transitions (same-document) | 111 | 18.0; WebKitGTK 2.46+ | https://caniuse.com/view-transitions, https://webkitgtk.org/2024/10/04/webkitgtk-2.46.html |
  | `light-dark()` | 123 | 17.5 | https://caniuse.com/mdn-css_types_color_light-dark |
  | `color-mix()` / `oklch()` | 111 / 111 | 16.2 / 15.4 | https://caniuse.com/mdn-css_types_color_color-mix, https://caniuse.com/mdn-css_types_color_oklch |
  | `contrast-color()` | 147 | 26.0 | https://caniuse.com/mdn-css_types_color_contrast-color |
  | `@property` | 85 | 16.4 | https://caniuse.com/mdn-css_at-rules_property |
  | `lh` unit (not used by the spine) | 109 | 16.4 | https://caniuse.com/mdn-css_types_length_lh |

  These, though, are Chromium-only and appear in committed decisions:
  - **`env(titlebar-area-*)`** (AD-15: "the style places it with `env(titlebar-area-*)`"). Safari has no support in any version. https://caniuse.com/mdn-css_types_env_titlebar-area-x
  - **`app-region: drag` / `no-drag`** (AD-15). Chromium-only. In the `window-drag` Intent to Ship, WebKit has "no signal". http://www.mail-archive.com/blink-dev@chromium.org/msg16747.html
  - **Sender `prefers-color-scheme` inside the email iframe** (AD-18 relies on it matching the app's variant). Chromium 129+ makes an iframe's `prefers-color-scheme` follow the embedding element's `color-scheme`. Safari resolved it to the system setting through at least 18.2 and didn't re-evaluate on dynamic change. Reports put the fix in Safari 27. https://issues.chromium.org/issues/372510005, https://bugs.webkit.org/show_bug.cgi?id=284973, https://developer.chrome.com/docs/modern-web-guidance/guides/visual-design/dark-mode
  - WebKitGTK (Tauri on Linux) doesn't publish per-feature notes for `@scope` or `contrast-color()`. 2.50 (Sep 2025) lines up with Safari 26 and 2.54.2 is current (2026-10-23), but per-feature enablement is **unconfirmed**. https://webkitgtk.org/2026/10/23/webkitgtk2.54.2-released.html
- **Fix:** Turn AD-2 into a concrete floor: "Chromium ≥ 147 and Safari/WKWebView ≥ 26, WebKitGTK ≥ 2.50 (verify `@scope` and `contrast-color()` before the platform initiative relies on them)". Then either carve out window chrome (`env(titlebar-area-*)`, `app-region`) as adapter-owned CSS, emitted by the shell adapter into a small chrome sheet rather than written in style packages, or have the adapter publish titlebar insets as custom properties (`--titlebar-inset-start` / `-end`) that styles read instead of `env()`. For AD-18, don't rely on media-query propagation: the adaptation module should mark sender dark styles active explicitly (for example, rewrite or force the `@media (prefers-color-scheme: dark)` blocks) rather than depend on the iframe's media query.

## Medium

### M1. How the app's Mode reaches Chromium isn't stated, and the obvious route breaks OS detection

- **Claim:** AD-14: AppearanceSignals owns `colorScheme` from the OS. Renderers never call `nativeTheme`. Mode is applied by look-root attributes only (AD-11).
- **Found:** Electron docs: setting `nativeTheme.themeSource = 'dark'|'light'` makes `shouldUseDarkColors` return the override, not the OS, and makes `prefers-color-scheme` match it. So if any epic sets `themeSource` to follow Mode (to get native menus, dialogs, scrollbars and the email iframe to match), AppearanceSignals stops seeing the OS. If nobody sets it, native UI and form controls follow the OS, not the app. https://www.electronjs.org/docs/latest/api/native-theme
- **Fix:** Add a rule to AD-14/AD-11. Keep `themeSource = 'system'` so AppearanceSignals reads the real OS, and have the theme CSS set `color-scheme: light|dark` on each look root per variant (plus on the email `<iframe>` element, for Chromium 129+ propagation). Or, if native menus must follow Mode, the adapter sets `themeSource` and AppearanceSignals reads the OS scheme from another source (macOS `systemPreferences`, the portal `color-scheme` on Linux). Either way, write it down.

### M2. Fontsource files can't be served by today's `nylas://` handler, and its replacement API isn't named

- **Claim:** AD-17: Fontsource faces are "served by the shell adapter". AD-2: `nylas://` font serving "(today the deprecated `registerFileProtocol`) moves behind the adapter".
- **Found (repo):** `src/browser/nylas-protocol-handler.js` resolves only `~/.nylas-mail/assets`, `~/.nylas-mail/dev/packages`, `~/.nylas-mail/packages` and `<resourcePath>/internal_packages`. The header comment says `RESOURCE_PATH/node_modules`, but the code doesn't search it, so `@fontsource/*` in `node_modules` isn't reachable. The handler uses `protocol.registerFileProtocol`, which has been deprecated since Electron 25 in favour of `protocol.handle` (returns a `Response`, typically via `net.fetch(pathToFileURL(...))`). No removal version is published. Electron 45 changed no protocol APIs. https://www.electronjs.org/docs/latest/api/protocol, https://www.electronjs.org/docs/latest/breaking-changes, https://www.electronjs.org/blog/electron-45-0
- **Fix:** In AD-2/AD-17, name `protocol.handle` as the target and add an explicit `nylas://fonts/<id>/…` route that maps to the resolved Fontsource package directory (or copy the font files into `static/fonts/` at build). Check that the scheme stays registered with `registerSchemesAsPrivileged` where needed for `@font-face` fetches.

### M3. `trafficLightPosition` is constructor-only, so switching styles at runtime needs `setWindowButtonPosition`

- **Claim:** AD-15: macOS traffic lights are "positioned from the style's `titlebarHeight` through `trafficLightPosition`".
- **Found:** `trafficLightPosition` is a `BrowserWindow` constructor option. The runtime setters were removed in Electron 28 and replaced by `win.setWindowButtonPosition()` / `getWindowButtonPosition()` (macOS). A style switch in a live window (AD-1: attributes only, no reload) has to call the setter. https://www.electronjs.org/docs/latest/breaking-changes, https://www.electronjs.org/docs/latest/api/browser-window
- **Fix:** Add a `set-window-button-position` (macOS) IPC next to `set-title-bar-overlay` in the IPC conventions, routed through the adapter. Use the constructor option only for the initial style.

### M4. Playwright `emulateMedia` can't drive this app's signals, so the harness needs a seam

- **Claim:** AD-19: Playwright on the real Electron app covers the variant matrix, including high contrast.
- **Found:** Playwright 1.65.0's Electron support is still "experimental" (Electron v21+). `page.emulateMedia` covers `colorScheme` (1.9), `reducedMotion` (1.12), `forcedColors` (1.15) and `contrast` (1.51), and only in the renderer. By AD-14, renderers ignore `matchMedia` and the look runtime keys on `data-*` flags fed from main-process `nativeTheme`, so emulation changes nothing the app reads. There's no emulation for reduced transparency. Launch also breaks if a future packager sets the `EnableNodeCliInspectArguments` fuse to false. https://playwright.dev/docs/api/class-electron, https://playwright.dev/docs/api/class-page#page-emulate-media
- **Fix:** Add to AD-19: AppearanceSignals takes a test-only override (env var or `--appearance-signals=<json>` flag, or a main-side IPC used only by the harness) that the harness sets per combination. Note the fuse constraint for the packaging track.

### M5. Signal sources for reduced motion, reduced transparency and forced colours aren't named

- **Claim:** AD-14: AppearanceSignals owns `reducedMotion`, `reducedTransparency` and `forcedColors`.
- **Found:** `nativeTheme.inForcedColorsMode` is Windows-only. `nativeTheme.prefersReducedTransparency` exists. Reduced motion has no `nativeTheme` property: only `systemPreferences.getAnimationSettings().prefersReducedMotion`, which has no change event. The `nativeTheme` `updated` event documents only dark, high-contrast and inverted changes. On Linux the portal has a standard `reduced-motion` key next to `contrast`, and xdg-desktop-portal-kde implements `reduced-motion` but not `contrast`. https://www.electronjs.org/docs/latest/api/native-theme, https://www.electronjs.org/docs/latest/api/system-preferences, https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Settings.html, https://invent.kde.org/plasma/xdg-desktop-portal-kde/-/merge_requests/456
- **Fix:** Add a per-OS source table for every signal, with its change trigger: `updated` event, portal `SettingChanged`, or re-poll on `nativeTheme.updated` / window focus for `getAnimationSettings`. Use the portal `reduced-motion` key on Linux. If one hidden renderer `matchMedia` listener is the only live source for reduced motion, allow it inside the shell client as an explicit exception.

### M6. The theme compiler needs a JSON Schema validator the Stack doesn't list

- **Claim:** AD-5 / layer table: the compiler depends on "culori, the DTCG schema; nothing else".
- **Found:** `format.json` is JSON Schema draft-07. Validating against it needs a validator (Ajv 8.20.0 is current, 2026-04-24) or a hand-port of the schema. https://www.npmjs.com/package/ajv
- **Fix:** Add `ajv` (draft-07) to the Stack and the layer table, or state that the compiler vendors a hand-written validator generated from `format.json`, pinned to that `$id`.

## Low

- **L1. Electron patch is already stale.** The Stack says 45.3.0. 45.3.1 (Chromium 156.0.8078.96, Node 24.22.2) shipped 2026-11-11. The repo lock is on 44.0.0 while 44.11.2 is current, so the shipped runtime is 11 patch releases behind on security. 45 EOL is 2027-04-27 (tentative). **Fix:** Write the Stack as "45.x latest patch". Bump 44 to the latest patch now or land 45 early. https://releases.electronjs.org/release?channel=stable, https://releases.electronjs.org/schedule
- **L2. "Node 24" goes stale inside the initiative.** Electron 46 (stable 2027-01-05) and 47 move to Node 26.13. AD-4 ("each release ships on a supported major") will force that jump before 45's EOL. **Fix:** Stack row "Node: whatever the Electron major bundles (24 on 45, 26 from 46)". https://releases.electronjs.org/schedule
- **L3. AD-4's CSS rationale doesn't hold.** Every listed CSS feature ships at or below Chromium 147, and Electron 44 is Chromium 152. Electron 45 is justified by the support window, not CSS. **Fix:** Reword AD-4's "Prevents" line.
- **L4. `app-region` now has a standard name.** Chromium 151 shipped `window-drag: move | none` (CSS UI 4). `app-region` / `-webkit-app-region` stay "fully supported". Electron's tutorial still uses `app-region`. **Fix:** Optional. Keep `app-region` in AD-15, and note `window-drag` as the standard alias (Gecko positive). http://www.mail-archive.com/blink-dev@chromium.org/msg16747.html, https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
- **L5. `setTitleBarOverlay` colour scope.** It's Windows and Linux only. `symbolColor` applies only on Windows. On Linux, Electron auto-computes a contrasting symbol colour from `color`. Since Electron 43, Linux WCO follows the native button layout (left, right or both; GNOME shows close only), confirming the memlog. **Fix:** Note in AD-15 that themes control only `color` on Linux, and that `env(titlebar-area-x/width)` needs fallbacks on macOS, where WCO doesn't apply. https://www.electronjs.org/blog/electron-43-0, https://www.electronjs.org/docs/latest/api/browser-window
- **L6. Deferred item premise is wrong: IBM Plex Sans is on Fontsource.** `@fontsource/ibm-plex-sans` and `@fontsource-variable/ibm-plex-sans` are both 5.3.0, OFL-1.1. **Fix:** Rewrite the Deferred row as a product choice, not an availability gap. https://www.npmjs.com/package/@fontsource/ibm-plex-sans
- **L7. Fontsource package names and licences aren't pinned.** npm, checked 2026-11-11: `@fontsource/jost` 5.3.0 OFL-1.1, `@fontsource/ubuntu` 5.3.0 **UFL-1.0** (not OFL), `@fontsource/inter` 5.3.0 OFL-1.1, `@fontsource/source-serif-4` 5.3.1 OFL-1.1, `@fontsource/atkinson-hyperlegible-next` 5.3.0 OFL-1.1. `-variable` variants exist for Jost, Inter, Source Serif 4, Atkinson Hyperlegible Next and IBM Plex Sans. **Fix:** Name the exact packages, static or variable, in the Stack. Record the Ubuntu Font Licence alongside the GPL-3.0 app for the licence notice.
- **L8. The LESS shim is pinned to an unmaintained chain.** `less-cache` 1.1.1 is `atom/less-cache` (last published 2020-12-11) and depends on `less ^3.12.2`. `less` 3.13.1 dates from 2020-12-18, while `less` latest is 4.9.1 (2026-09-02). It works, but nobody maintains it. **Fix:** Note in AD-8 that the shim could call `less` 4 directly and drop `less-cache` when epic-onboarding-upgrade touches it. https://www.npmjs.com/package/less-cache, https://www.npmjs.com/package/less
- **L9. Vitest is unpinned.** `packages/client-app/package.json` has `"vitest": "latest"` and `"@vitest/coverage-v8": "latest"`. The lock is on 4.1.11, but npm `latest` is now **5.1.0**, so the next lock refresh jumps a major while the Stack says "Vitest 4". **Fix:** Pin `^4.1.11`, or adopt 5 on purpose and update the Stack. https://www.npmjs.com/package/vitest
- **L10. Linux D-Bus client options are thin (deferred item).** `dbus-next` was last published in 2021 (0.10.2). `@particle/dbus-next` 0.11.4 (2025) is the maintained fork. Shelling out to `gdbus` avoids a dependency. **Fix:** Leave it deferred, but list these options so epic-token-platform doesn't pick the stale one.
- **L11. Claims not confirmed this pass.** These are memlog claims I couldn't confirm on the web: (a) Chromium on Linux sets `prefers-contrast: more` from a GTK theme name containing "high" and "contrast"; (b) the portal `contrast` key needs xdg-desktop-portal ≥ 1.20. Confirmed: the portal key's shape (`u`, 0/1), `ReadOne` (interface v2) and `SettingChanged`, and that the KDE portal doesn't serve `contrast`. **Fix:** Cite the Chromium `ui/native_theme` Linux source and the portal NEWS entry in the memlog, or mark both as unverified. GTK4/libadwaita high contrast isn't a theme name, so the heuristic is a weak fallback anyway.
- **L12. esbuild target.** `scripts/build-renderer.js` targets `chrome130` for the JS bundles only, and CSS isn't bundled through esbuild today. **Fix:** If an epic routes style CSS through esbuild, raise the target to `chrome156` so `@scope` and the rest aren't lowered or flagged.

## Confirmed (no action)

- Electron 45 = Chromium 156, Node 24.22.x. 44 EOL 2027-03-02 (tentative). 46 stable 2027-01-05. Repo lock electron@44.0.0. https://releases.electronjs.org/schedule
- `titleBarStyle: 'hidden'` + `titleBarOverlay` on Windows and Linux; macOS keeps traffic lights; `app-region: drag` (unprefixed) in Electron docs; `setTitleBarOverlay` is `_Windows_ _Linux_`. https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
- `nativeTheme.shouldUseHighContrastColors` is `_macOS_ _Windows_`, not deprecated. https://www.electronjs.org/docs/latest/api/native-theme
- Chromium only enables forced colours from Windows High Contrast. https://groups.google.com/a/chromium.org/g/blink-dev/c/hkjRPJ1-Ruk/m/ksYRXedLAgAJ
- XDG `org.freedesktop.appearance` `contrast` (`u`, 0/1) with `ReadOne` + `SettingChanged`. https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Settings.html
- DTCG 2025.10 published 2025-10-28 (Format, Color, Resolver). https://www.designtokens.org/tr/2025.10/format/
- npm, 2026-11-11: culori 4.0.2 (MIT, ESM + CJS exports), Playwright 1.65.0, axe-core and @axe-core/playwright 4.14.0 (MPL-2.0), Style Dictionary 5.8.0 (2026-11-03, no resolver support per its docs), @terrazzo/cli 2.10.0, chokidar 6.0.0, @parcel/watcher 2.6.0, colorjs.io 0.7.1.
- Lockfile: react / react-dom 19.2.8 (npm latest is 19.3.1, informational), less 3.13.1, less-cache 1.1.1, vitest 4.1.11, color 5.0.3 (an existing colour lib; the spine picks culori instead, which is fine but worth noting so two colour libs don't drift).
