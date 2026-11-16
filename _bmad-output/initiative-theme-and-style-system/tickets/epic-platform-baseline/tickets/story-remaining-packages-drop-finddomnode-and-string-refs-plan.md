---
title: 'Remaining packages drop findDOMNode and string refs'
type: 'refactor'
ticket: '5'
created: '2026-11-13'
status: done
baseline_revision: '15676c142211eddc3675e3a2aa1deb3534fa0700'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/epic-platform-baseline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** About 25 files in `internal_packages/` outside the mail packages still call `findDOMNode` or use string refs, which React 19 removed. Each one throws when its component mounts or acts. Examples are the toolbar buttons that open popovers, preferences, the theme picker, keybase, main-calendar and notifications. Five packages also fail to load in the main window. account-sidebar calls `createRequire(import.meta.url)` under the CJS compile cache. composer-translate, github-contact-card and keybase import `request`, and phishing-detection imports `tld`. Neither library is installed.

**Approach:** Replace every remaining `findDOMNode` and string ref with object or callback refs, following story 13.3's `getDOMNode()` contract for child lookups. Move the three `request` users to `fetch` and phishing-detection to `tldts`. Guard account-sidebar's `createRequire` the way `src/` already does. Then widen the removed-API check to all of `internal_packages/`. Give the 9 tipped buttons `getDOMNode()` so HasTutorialTip can drop its `display: contents` span (deferred from 13.3).

## Boundaries & Constraints

**Always:**
- Behaviour stays the same: same DOM, same focus and measurement results, same popover anchoring, same public methods.
- HTTP replacements send the same URLs, query strings and `User-Agent` header, and parse JSON the same way. They keep each caller's callback or promise shape and its error path.
- Tests ship with the change: a spec per package group touched, covering the paths that used `findDOMNode`, plus the fetch and tldts replacements.
- Commit locally on `modernize/current` with no attribution lines, and never push. Refs heyjawrsh/nylas-mail#7.

**Never:**
- `componentWill*` rewrites (story 6).
- `src/` beyond `components/decorators/has-tutorial-tip.jsx` and the check script, unless a package's new ref contract forces a one-line change.
- New HTTP or polyfill libraries, or new `request`-style wrappers.
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Popover button | click Snooze, Send Later, Send Reminders, Activity List, quick event, thread sharing, encrypt, open-tracking | popover opens anchored to the button's rect, with no React errors | — |
| Tutorial tip | a tipped button mounts, unseen tip | the bubble positions on the button; the button has no wrapper span | if `getDOMNode()` returns null, no bubble and no throw |
| Package loads | main window starts on the fixture account | account-sidebar, composer-translate, github-contact-card, keybase and phishing-detection load with no load error | — |
| Phishing check | From `a@paypal.com`, Reply-To `b@paypal-secure.net` | warning shown (registered domains differ) | empty or invalid domain gives no warning and no throw |
| HTTP call fails | network error or non-2xx | caller's existing error path runs | no unhandled rejection |
| API reintroduced | `findDOMNode` or a string ref added anywhere under `internal_packages/` (specs excluded) | `pnpm check:react` exits non-zero naming `file:line` | — |

</frozen-after-approval>

## Code Map

- Remaining sites (re-run `grep -rnE 'findDOMNode|\bref\s*=\s*"|this\.refs\b' packages/client-app/internal_packages`; `href=` hits are false):
  - `main-calendar/lib/{event-description-frame,quick-event-button}.jsx`. The iframe in event-description-frame is an EventedIFrame with methods (`didReplaceDocument`, `setHeightQuietly`), so keep it as an object ref to the instance and get its node through `getDOMNode()`.
  - `keybase/lib/{key-manager,keybase-search,recipient-key-chip,key-adder,encrypt-button,modal-key-recommender,keybase-user,decrypt-button}.jsx`
  - `preferences/lib/preferences-root.jsx` (ConfigPropContainer content, so it needs a node accessor) and `preferences/lib/tabs/keymaps/command-item.jsx`
  - `nylas-private-salesforce/lib/{form/salesforce-object-picker,composer/salesforce-composer-picker,thread/*}.jsx`
  - `thread-snooze/lib/snooze-buttons.jsx` (`findDOMNode(inst)` callback and `findDOMNode(this).parentNode`), `send-reminders/lib/send-reminders-{popover,composer}-button.jsx`, `send-later/lib/send-later-button.jsx`, `activity-list/lib/activity-list-button.jsx`, `open-tracking/lib/open-tracking-{icon,message-status}.jsx`, `thread-sharing/lib/thread-sharing-{button,popover}.jsx`, `theme-picker/lib/theme-option.jsx`, `notifications/lib/notif-wrapper.jsx`
- `src/components/dom-node.js` -- `domNodeOf(x)` reads an element or a component's `getDOMNode()`; reuse it. The 13.3 and 13.4 plans beside this one show the converted patterns
- HasTutorialTip: `src/components/decorators/has-tutorial-tip.jsx:107` wraps `ComposedComponent` in a `display: contents` span (`_wrapRef`) and reads `firstElementChild`. Change it to a ref on `ComposedComponent` read through `getDOMNode()`, and attach the mouseover listener to that node. The tipped classes are SchedulerComposerButton (already has `getDOMNode`), LinkTrackingButton, SendRemindersPopoverButton, SendRemindersComposerButton, ToolbarSnooze, ModeToggle, SendLaterButton, ActivityListButton and OpenTrackingButton. The wrap sites are in each package's `lib/main.js` and `send-reminders-toolbar-button.jsx`. If a tipped export is itself wrapped by another HOC, that HOC forwards `getDOMNode`
- `request` users: `composer-translate/lib/main.jsx:83` (Yandex, `qs` query), `github-contact-card/lib/github-user-store.js:111` (`json: true`, User-Agent), and `keybase/lib/keybase.js:56,81,104` (callbacks, User-Agent). Electron's renderer has global `fetch` and `URLSearchParams`
- `phishing-detection/lib/main.jsx:65` -- `tld.registered(host)` becomes `getDomain(host)` from `tldts` (7.x, already in the lockfile through tough-cookie). Add `tldts` to `packages/client-app/package.json` dependencies
- `account-sidebar/lib/sidebar-item.js:3` -- use the guarded form already in `src/key-manager.js:3-6` (`typeof import.meta.url === "string" && …startsWith("file:") ? createRequire(import.meta.url) : require`)
- `scripts/check-removed-react-apis.mjs:87-113` -- the four entries use `only: CLEAN`. Drop the scope (or widen it to all of `internal_packages`), and update the comment at line 87
- Window types the packages declare: default, work, onboarding, composer, composer-preload, thread-popout, calendar, scheduler-calendar and SalesforceObjectForm. Openers: `src/flux/stores/message-store.js:491` (thread-popout), `internal_packages/composer/lib/main.jsx:73` (composer) and `composer-scheduler/lib/composer/new-event-helper.js:16` (scheduler-calendar). Open the others with `NylasEnv.newWindow({windowType, …})` over CDP
- Fixture and CDP: `packages/client-app/scripts/seed-fixture-account.mjs`, `scripts/lib/cdp.mjs`

## Tasks & Acceptance

**Execution:**
- [ ] each remaining package file -- object or callback refs; `findDOMNode(this)` becomes a root-element ref; child components a parent measures expose `getDOMNode()` -- React 19-safe, same behaviour
- [ ] `src/components/decorators/has-tutorial-tip.jsx` plus the 8 tipped buttons without it -- `getDOMNode()` on each, and the decorator drops its span -- same DOM
- [ ] `composer-translate`, `github-contact-card`, `keybase` -- `request` becomes `fetch`, keeping each caller's contract -- packages load
- [ ] `phishing-detection/lib/main.jsx`, `packages/client-app/package.json` -- `tldts` `getDomain` -- package loads
- [ ] `account-sidebar/lib/sidebar-item.js` -- guarded `createRequire` -- package loads
- [ ] `scripts/check-removed-react-apis.mjs` -- the findDOMNode and string-ref bans cover all of `internal_packages/` -- the guard
- [ ] specs -- per package group: popover-anchor rect, tutorial tip with no span, fetch success and failure, the phishing domain compare, and a check-script matcher case for a non-mail package -- proof

**Acceptance Criteria:**
- Given the repo, when `pnpm check:react` runs, then it exits 0, and it fails naming `file:line` when a string ref is added to any internal package
- Given the dev app on a seeded fixture account, when the main window starts, then the console shows no package load error and no React error
- Given that app, when each declared window type is opened over CDP, then each window loads its packages with no load error and no React error

## Implementation Notes

Implementer, 2026-11-13.

Ref conversions: every file in the code map. The unscoped check found 54 sites, matching the grep. String refs nothing read were dropped: all 15 in keybase, `popover` (salesforce-composer-picker), `objectPicker` (relate popover), `syncThreadToggle` (related objects) and `urlInput` (thread-sharing popover).
- Root-node reads became an object ref on the root, plus `getDOMNode()` where something outside measures the component. That covers ActivityListButton, QuickEventButton, ThreadSharingButton, EncryptMessageButton, NotifWrapper, SnoozeButton, ToolbarSnooze, QuickActionSnooze and the send-later and send-reminders buttons.
- ToolbarSnooze, QuickActionSnooze and ThreadSharingButton put the same ref on their empty `<span />` branch, so the node they hand over is always the one they render.
- SnoozeButton's and SendRemindersPopoverButton's default `getBoundingClientRect(inst)` call `inst.getDOMNode()`.
- main-calendar's EmailFrame and theme-picker's ThemeOption keep an object ref to the EventedIFrame instance and read its iframe through `getDOMNode()`, as message-list's EmailFrame does.
- PreferencesRoot: ConfigPropContainer renders the tab element itself and has no node of its own. So `_focusContent` reads the tab's root as the first element in the ScrollRegion's `.scroll-region-content-inner`, through a ref on the ScrollRegion. That's the node `findDOMNode(content)` returned. CommandKeybinding blurs its Flexbox through a ref.

HasTutorialTip drops its `display: contents` span. It holds a ref to ComposedComponent and reads the node through `domNodeOf()`. The mouseover listener goes on that node at mount, as it did before 13.3, and is removed at unmount. With no node there's no bubble and no throw.
- ModeToggle, LinkTrackingButton, OpenTrackingButton, ToolbarSnooze, SendLaterButton, ActivityListButton and both send-reminders buttons gained `getDOMNode()`.
- Two src HOCs/kit components forward it, one small change each: ListensToObservable (wraps SendRemindersPopoverButton) and MetadataComposerToggleButton (rendered by the link and open tracking buttons).

Package loads:
- keybase: `keybaseFetch(url, {json}, cb)` and github-contact-card's `_githubRequest`. Both keep `request`'s contract: any HTTP response calls back with `(null, response, body)`, with the body JSON-parsed when it parses and text otherwise, and only a network failure is an error. So GitHub's rate-limit 403 still caches `profile = false`, and keybase's non-OK `status.desc` still reaches its callers. User-Agent is `request` as before.
- composer-translate: the query is encoded the way `qs` did (RFC 3986). A network failure, a non-200 status or a bad body goes to `_onError`. Before, `resp.statusCode` threw on a network error and `_onError(null)` threw on a non-200.
- phishing-detection uses `getDomain` from tldts. An empty or invalid host gives null, and null on either side means no warning.
- account-sidebar: the guarded `createRequire`. The package then failed on `AccountCommands.registerCommands is not a function`, because 4 CommonJS `require()`s of ESM default exports lacked `.default` (sidebar-store ×3, account-sidebar.jsx ×1).
- keybase: once `request` was gone it failed on `React is not defined`. modal-key-recommender, key-manager and recipient-key-chip never imported React.
- composer-translate: its Menu header `<span>` got a `key`. Once the package loaded, React logged a key warning in the composer.

`check:react`: the findDOMNode, string-ref and `.refs` entries have no `only` scope now. `MAIL_PACKAGES`/`CLEAN` are gone. The `only` mechanism stays for later entries.

Specs:
- `remaining-packages-refs.spec.jsx` (25): popover origin rects for 12 buttons, tipped buttons' `getDOMNode()`, HasTutorialTip on real SendLaterButton and SendRemindersPopoverButton with no wrapper, both iframes, NotifWrapper, PreferencesRoot focus, CommandKeybinding blur, the sharing popover and the Salesforce picker.
- `remaining-packages-loads.spec.jsx` (18): keybase, GitHub and translate fetch success and failure, the phishing domain compare, and SidebarItem loaded as CommonJS.
- Updated: `decorators-more` (no wrapper, a null node, the listener removed on unmount), `components-presentational-remaining` (MetadataComposerToggleButton.getDOMNode) and `check-removed-react-apis` (keybase, thread-snooze, preferences and a generic plugin are flagged, and the whole repo passes).
- The new specs fail on the old code (44 of 73 with the src and package changes stashed).

Verified on the working tree:
- `check:react` exits 0. A probe `ref="x"` in `theme-picker/lib` fails it with `…/zz-probe.jsx:1: string ref`.
- The build exits 0, with the same 504 `import.meta` warnings as baseline.
- Vitest: 3808 passing across 193 files, none failed. The 4 known unhandled errors are unchanged.
- Biome: the 1 known error, and no findings in the changed or new files.
- Dev launch on a fresh copy of a seeded fixture, over CDP. The main window opened thread-popout, composer, scheduler-calendar, calendar, onboarding and SalesforceObjectForm (`newWindow`; Salesforce is disabled in config, so that window loads no Salesforce code). Work and the hot window were up too. There were no package load errors and no React errors in any window. The only errors are the known BufferedProcess `killed` TypeError (main window) and DevTools' own Autofill messages.
- A second run on the same fixture with `env: "development"` in config.json loaded the `supportedEnvs` packages (activity-list, send-later, send-reminders, open-tracking, link-tracking, composer-scheduler). Packages with no env set are skipped at load.
  - Popovers opened from their buttons' rects: Snooze, thread sharing, Activity, Send Later, Send Reminders (composer), Translate and Emoji.
  - The composer showed 5 tutorial tips and the main window 3, with 0 `.tutorial-tip-target` wrappers.
  - The Activity tip's bubble sat at the button's rect +5px (169.5px, 10px). Hovering the button opened the tip popover, and the button's parent is its toolbar container.
  - Preferences focused `.preferences-wrap`, then the first `[tabindex]` in the Shortcuts tab.
  - A shortcut edit blurred the row through its ref and saved ⇧K, to the copy's keymap.json.
  - The theme picker wrote all 6 previews into their iframes, with Light active.
  - No errors beyond the BufferedProcess one. Each run quit the app.

Not exercised in the app: EncryptMessageButton's popover (with no recipients it opens a blocking error dialog), OpenTrackingIcon and OpenTrackingMessageStatus (no message has open metadata), main-calendar's EmailFrame and QuickEventButton (no events), and the Salesforce views (package disabled). The specs cover them.

Seen while verifying, outside this story:
- The seed failed once with `SqliteError: database table is locked` at `wal_checkpoint(TRUNCATE)`, and the next run passed.
- composer-markdown also lacks a React import (`markdown-editor.jsx`), so it would fail to load. It's disabled in the fixture config.
- With github-contact-card loading, focusing a thread now sends a real GitHub search for the focused contact's email. That's the package working as designed, and it means the dev app is no longer silent on the network.

## Plan Change Log

- 2026-11-13 (implementer): beyond the code map, each change minimal:
  - `src/components/decorators/listens-to-observable.jsx` and `src/components/metadata-composer-toggle-button.jsx` now have `getDOMNode()`. The plan expects a HOC around a tipped export to forward it, and these two sit between HasTutorialTip and three tipped buttons' nodes.
  - account-sidebar `.default` on 4 requires, and the React import in 3 keybase files. Without them both packages still failed to load after the planned fix.
  - keybase `autocomplete`: `request` sent `q` as a form body on a GET, which fetch can't do, so `q` is now in the query string.
  - phishing-detection: an empty or invalid domain on either side gives no warning, per the I/O matrix. Before, a valid From with an invalid Reply-To compared a domain against null.

## Review Triage Log

### Pass 1 (quick lens), 2026-11-13

Counts: high 0, medium 2, low 2, false 1.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | HasTutorialTip binds its hover listener once, to a node ToolbarSnooze can replace (span ↔ button on a perspective change) | medium | patch | ToolbarSnooze and SnoozeButton swap element types, so React replaces the node. The 13.3 span was a stable target, so this is a regression. Rebind in componentDidUpdate when the node changes, and add a spec. |
| 2 | fetch wrappers have no terminal catch, so a throwing callback is an unhandled rejection | medium | patch | Confirmed: a repos network failure calls back with `repos` undefined, then `repos.items` throws in the rejection handler. Add a terminal catch that reports, an early return in the repos callback, and a spec through a real caller. |
| 3 | Renderer fetch may hit CORS or drop the User-Agent, unlike Node `request` | false | reject | Checked in the dev app (origin `file://`, headers as the new code sets them): GitHub search, keybase lookup and keybase key.asc return 200. The Yandex call reaches the server and gets 403 for the old key. |
| 4 | ListensToObservable and MetadataComposerToggleButton exceed the frozen "one-line" `src/` allowance | low | kept, flagged to Josh | Real conflict inside the frozen block: the Approach (tipped buttons give getDOMNode so the span goes) requires these two wrappers to forward the node, which takes about 7–13 lines each. No functional harm found. React 19 passes a ref to function components as a plain prop. Kept, pending Josh's sign-off. |
| 5 | related-objects-for-thread `_editObj` (formerly findDOMNode) has no spec | low | patch | grep finds no spec loading it, and the frozen Always requires coverage of every converted path. Add a spec. |

Deferred: keybase's autocomplete endpoint returns 404 and the Yandex v1.5 key is rejected. Both are dead external services, not caused by this change (see deferred-work.md).

Orchestrator verification on bf7437777, on a seeded fixture account: the dev app opened default, work, onboarding, composer (blank draft), thread-popout (a fixture thread), calendar, scheduler-calendar and SalesforceObjectForm. No window showed a package load error or a React error; the only error was the deferred BufferedProcess `killed` one.

Verification on 5657bee0e (orchestrator, 2026-11-13): `check:react` exits 0, the build exits 0, vitest has 3813 passing across 193 files with none failed (4 known unhandled errors), and lint shows 1 known error. All 3 patch findings are fixed.

## Design Notes

Work package by package and run that package's specs after each. Popover buttons all share one pattern: a root `ref` and `this._ref.current.getBoundingClientRect()`. A `getDOMNode()` returning the same node lets HasTutorialTip and any outside measurer use it too. The grep count is the progress meter.

Keep the fetch wrappers small and local to each package. Example for keybase's callback shape:

```js
fetch(url, { headers: { "User-Agent": "request" } })
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
  .then((body) => cb(null, body), (err) => cb(err));
```

## Verification

**Commands:**
- `pnpm check:react` -- expected: exit 0
- `cd packages/client-app && node scripts/build-renderer.js` -- expected: exit 0
- `cd packages/client-app && npx vitest run` -- expected: no failed file and no fewer passing tests than baseline (3745; 4 known unhandled errors)
- `npx biome check .` -- expected: no new findings (1 known error, `.nylas-smoke-home/config.json`)
- dev launch on a seeded fixture account with `--remote-debugging-port`, then open each declared window type over CDP -- expected: no package load errors and no React errors in any window; quit afterwards

- 2026-11-16, Josh signed off: the crossing of the src boundary is accepted.
