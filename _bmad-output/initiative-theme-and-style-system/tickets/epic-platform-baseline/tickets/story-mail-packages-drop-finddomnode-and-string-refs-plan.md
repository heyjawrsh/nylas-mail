---
title: 'Mail packages drop findDOMNode and string refs'
type: 'refactor'
ticket: '4'
created: '2026-11-13'
status: done
baseline_revision: 'c32907ee82bf809aebf9bdab7dadf6a7eec19d9b'
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

**Problem:** The mail packages (thread-list, message-list, composer and the composer-* packages) still use `findDOMNode` and string refs: about 133 sites in 30 files. Under React 19 the thread list, message view and composer throw as soon as they mount or act. There's also no way to see them run without a real account, so nothing that needs the main window can be verified.

**Approach:** Replace every `findDOMNode` and string ref in those packages with object or callback refs, using the `getDOMNode()` / `domNodeOf` contract story 3 put on the shared components. Add a fixture account: a seeded config folder and database the app opens offline, showing threads with messages, which the harness (story 8) reuses. Extend the removed-API check to these packages.

## Boundaries & Constraints

**Always:**
- Behaviour stays the same: same DOM, focus, scrolling, selection and drafting behaviour.
- The fixture account works fully offline: no network, no credentials, no real mail provider. Sync may log that it can't start.
- The fixture lives in the repo as reproducible data or a seed script, not as a binary database copied from someone's machine.
- Tests ship with the change.
- Commit locally on `modernize/current` with no attribution lines, and never push. Refs heyjawrsh/nylas-mail#7.

**Never:**
- Packages outside thread-list, message-list, composer and composer-* (story 5), except a one-line `getDOMNode()` on a component these packages measure.
- `componentWill*` rewrites (story 6).
- Sending mail anywhere. "A reply can be composed" stops before send.
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fixture launch | dev app with NYLAS_HOME set to the fixture | the main window opens with the fixture threads in the thread list | — |
| Open thread | click (or select over CDP) a fixture thread | the message list renders its messages, the email frame shows the body | — |
| Compose reply | reply on an open message | the composer opens inline with the participants filled, the body is editable, and focus lands in the body | — |
| No send | the reply composer is open | nothing leaves the machine; the draft saves locally | — |
| Removed API reintroduced | `findDOMNode` or a string ref added in one of these packages | `pnpm check:react` fails naming `file:line` | — |

</frozen-after-approval>

## Code Map

- The 30 files: `thread-list/lib/thread-list.jsx`; `message-list/lib/{message-item-container,message-item,find-in-thread,email-frame,message-list}.jsx`; `composer/lib/{inline-image-upload-container,composer-header,send-action-button,composer-view,subject-text-field,main,collapsed-participants,composer-editor,account-contact-field}.jsx`; `composer-emoji/lib/{emoji-button-popover,emoji-picker,emoji-button}.jsx`; `composer-mail-merge/lib/{mail-merge-subject-text-field,mail-merge-participants-text-field,mail-merge-send-button,listens-to-mail-merge-session}.jsx`; `composer-markdown/lib/markdown-editor.jsx`; `composer-scheduler/lib/composer/{new-event-card-container,scheduler-composer-button,new-event-card}.jsx`; `composer-signature/lib/preferences-signatures.jsx`; `composer-templates/lib/{preferences-templates,template-picker}.jsx`; `composer-translate/lib/main.jsx`. Re-run `grep -rnE 'findDOMNode|ref="|ref=\{"|ref: "|this\.refs\b'` under those packages to confirm
- Story 3's contract: `src/components/dom-node.js` (`domNodeOf`), and `getDOMNode()` on Contenteditable, ScrollRegion, TokenizingTextField, InjectedComponent(Set), KeyCommandsRegion, Menu, FixedPopover, etc. `mail-merge-subject-text-field` calls `findDOMNode` on a Contenteditable, so switch it to `getDOMNode()`. MessageList already got `getDOMNode()` in 13.3
- `scripts/check-removed-react-apis.mjs` -- path-scoped `findDOMNode` / string-ref / `.refs` entries (`only: packages/client-app/src`). Widen their scope to these package folders
- Account and database: `src/flux/stores/account-store.js` (reads `nylas.accounts` config), `src/flux/stores/database-store.js` and `database-setup-query-builder.js` (schema), `src/flux/models/{thread,message,contact}.js`. The app's DB file lives in NYLAS_HOME. With no Nylas Identity, sync logs and skips (seen in 13.11)
- Deferred from 13.3: if a `HasTutorialTip`-wrapped button lives in these packages (e.g. the send button), give it `getDOMNode()`; the span wrapper stays until story 5 covers the rest

## Tasks & Acceptance

**Execution:**
- [ ] the 30 files -- object or callback refs; `findDOMNode(this)` becomes a root ref; child-node lookups go through `getDOMNode()` / `domNodeOf` -- React 19-safe
- [ ] `spec/fixtures/account/` (new) plus a seed script (e.g. `scripts/seed-fixture-account.mjs`) -- builds a NYLAS_HOME with one account in config and a database holding a few threads, messages and contacts through the app's own schema; documents the command -- the offline fixture story 8 reuses
- [ ] `scripts/check-removed-react-apis.mjs` -- widen the path scope to these packages, plus a spec case
- [ ] specs -- update `findDOMNode` mocks in these packages' specs; add coverage for thread selection, message render and composer reply focus

**Acceptance Criteria:**
- Given the fixture NYLAS_HOME, when the dev app launches, then the main window lists the fixture threads, opening one renders its messages, and a reply composer opens with focus in the body, with no React errors in the console (checked over CDP)
- Given the repo, when `pnpm check:react` runs, then it exits 0, and it fails naming `file:line` for a removed API added in one of these packages

## Implementation Notes

Implementer, 2026-11-12.

Fixture:
- Seed: `node packages/client-app/scripts/seed-fixture-account.mjs [dir]`. The default dir is `<repo>/.nylas-fixture-home` (gitignored), rebuilt on every run. The seed only replaces a dir that is missing, empty, or holds the `.nylas-fixture` marker it writes; anything else is refused with a message. It launches on a free port and refuses a window whose `NylasEnv.getConfigDirPath()` isn't the seed's home. A home seeded before the marker existed must be deleted by hand once. The script prints the launch line (`NYLAS_HOME=<dir> pnpm --filter nylas-mail start`).
- The data is `spec/fixtures/account/{account,mailbox}.json`: one folder-type account on `@fixture.test`, 6 folders, 4 contacts, and 4 threads with 7 messages (3 threads in the inbox, 1 archived).
- The seed writes `config.json`, then launches the dev app on that dir. The work window builds the schema itself, and the models are written through `DatabaseStore.inTransaction` over CDP (`scripts/lib/cdp.mjs`, using Node's global WebSocket). So the join tables, message bodies and counts are exactly what the app writes. The script then calls `NylasEnv.quit()`.
- Nothing sync writes is needed: no identity stub and no flags. With no identity, sync logs "Can't start sync" and "Can't start DeltaStreamingConnection".
- The fixture wouldn't show anything until the app bugs below were fixed. AccountStore never loaded accounts in any window, so nothing had shown on a real account either.

Ref conversions: all 30 files in the code map, plus string refs the grep missed: `ref={Fields.X}` in composer-header and composer-view, `ref={type}` in event-datetime-input, and `componentProps.ref = "composed"` in listens-to-mail-merge-session. String refs nothing read were dropped: scrollregion, composeBody, composerBodyWrap, participantsContainer, subjectContainer, spinner, findInThread, newEventCard, description, signatureInput, templateInput and templateHTMLInput.
- Header fields and message containers use one stable callback ref per name/clientId (`_fieldRef`, `_messageContainerRef`). An inline callback would detach and reattach on every render.
- `getDOMNode()` was added where a parent measures or scrolls to a component: MessageItem, MessageItemContainer, ComposerView, InflatesDraftClientId (src), ParticipantsTextField (src), and the emoji/template/translate/scheduler toolbar buttons. The scheduler button is the one HasTutorialTip-wrapped button in these packages. The tip still uses its span wrapper, as 13.3 deferred.
- ListensToFluxStore (src) attaches `composedRef` again. The send button's `primarySend` had read `this.refs.composed`, which the decorator stopped setting before this initiative, so Cmd+Enter in the composer did nothing. It now reaches the wrapped button again. Not exercised past the button: no mail was sent.
- `composer-header.focus()` read `this.refs.subject`, which never existed (the subject field's ref is `textFieldSubject`), so it threw. It now focuses the subject field.
- `mail-merge-subject-text-field` used `findDOMNode` on a plain contenteditable div, not on the Contenteditable component, so it's a plain object ref.
- Interop: 6 `require()`s of ESM default exports lacked `.default` (thread-list ×4, message-list ×2), and the thread list crashed on `ThreadListStore.dataSource`.

`check:react`: `only` entries accept a folder prefix or a regex on the repo-relative path. The path-scoped entries now cover `src/` plus `internal_packages/(thread-list|message-list|composer|composer-*)/`. Spec cases cover each removed API in the mail packages, plus prefix look-alikes (`thread-list-extras`, `composerish`).

Specs: `spec/helpers/load-package-module.js` loads the CommonJS packages (extensionless `.jsx` requires, which vite and Node can't import) the way the compile cache does: esbuild in a Node child (esbuild won't load under jsdom), then `Module._compile` with stubbed requires. New: `mail-thread-and-message-list-refs.spec.jsx` (15: thread selection, context menu on the list root, layout from root width, message containers by ref, draft focus and scroll, email frame, find-in-thread, message item), `mail-composer-refs.spec.jsx` (23: reply focus lands in the body, header fields, editor, send button primarySend, toolbar buttons' popover rects, mail merge), `main-window-boot-fixes.spec.jsx` (8), `renderer-placeholder-env.spec.js` (10), `fixture-account.spec.js` (5), plus additions to `check-removed-react-apis`, `focused-perspective-store` and `nylas-env-delegation`.

Verified on the working tree after the follow-up commit:
- `check:react` exits 0, and a probe `findDOMNode` in `composer-emoji/lib` fails it with `file:line`.
- The build exits 0. A probe string-path kit registration (`load("Switch", "switch")`) fails it with `src/global/nylas-component-kit.js:83:2: Kit name "Switch" is registered by a string path…`.
- Vitest: 3737 passing across 191 files, none failed. The 4 known unhandled errors are unchanged (comp-root-3, core-infrastructure-deep, task-queue-processing-deep, window-event-handler).
- Biome: 1 known error.
- The seed rebuilds the fixture from scratch.
- CDP, on a fresh copy of the fixture with a dev launch, then quit:
  - The main window lists fixture-thread-welcome, -lunch and -notes.
  - "Lunch on Thursday?" renders 3 messages, 2 of them collapsed, and the frame shows "Noon is perfect. See you both there."
  - "Write a reply…" opens the inline composer with to cleo@ and cc ben@, subject "Re: Lunch on Thursday?", an editable body and focus in the body. Typed text is saved to the local DB.
  - No task is queued, there are no network requests from any window, and no console error appears during the flow.

Known at startup, and accepted for this story's check by the orchestrator:
- The one React error, owned by story 5: `TypeError: import_nylas_exports.ReactDOM.findDOMNode is not a function at NotifWrapper.componentDidMount (internal_packages/notifications/lib/notif-wrapper.jsx:12)`. NotifWrapper's error boundary catches it.

Package load failures, owned by story 5 (as logged after "Failed to load package named '<name>'"):
- account-sidebar: `TypeError: The argument 'filename' must be a file URL object, file URL string, or absolute path string. Received undefined at createRequire … at internal_packages/account-sidebar/lib/sidebar-item.js:3:21`
- composer-translate: `Error: Cannot find module 'request'`, require stack `internal_packages/composer-translate/lib/main.jsx`. It doesn't block the composer; only its Translate button is missing.
- github-contact-card: `Error: Cannot find module 'request'`, require stack `internal_packages/github-contact-card/lib/github-user-store.js`
- keybase: `Error: Cannot find module 'request'`, require stack `internal_packages/keybase/lib/keybase.js`
- phishing-detection: `Error: Cannot find module 'tld'`, require stack `internal_packages/phishing-detection/lib/main.jsx`

Also at startup, outside these packages: `TypeError: Cannot read properties of undefined (reading 'killed') at triggerExitCallback` (BufferedProcess, src).

Credential storage, for issue #10: keytar isn't installed, so `nodeRequire("keytar")` throws in every window. The old fallback was async: `getPassword` returned a truthy Promise, so `_getKeyHash` parsed `{}` and the migrate branch ran. The branch called the missing `keytar.replacePassword`, which threw `TypeError: keytar.replacePassword is not a function` inside `_try`. That popped the blocking `showErrorBox("Password Management Error", "We couldn't store your password securely! …")` once per account at boot, after the AccountStore fix. With no backend, KeyManager now does three things:
- `getPassword` returns null with no migrate branch and no dialog.
- `replacePassword` and `deletePassword` log `KeyManager: no secure storage backend (keytar is not available); <key> was not stored` (or `was not deleted`) and skip.
- A later read still returns null: nothing claims a write succeeded.

With no backend, account tokens are null. Sync already can't start without an identity.

## Plan Change Log

- 2026-11-12 (implementer; kit thunks and boot order approved by the orchestrator, keytar under its constraint, notif-wrapper and the package load failures left to story 5): the main window had never been run on an account. It couldn't list threads, open one or compose until these were fixed, all outside the code map, each minimal:
  - AccountStore boot order (orchestrator-approved, option a). Cause: the renderer bundle's banner (`scripts/build-renderer.js`) seeds a placeholder `NylasEnv` because stores are built at module scope while the bundle evaluates. AccountStore is one: it reads `nylas.accounts` and subscribes to `nylas.accountsVersion` in its constructor. The placeholder's `config.get` returned null and its `onDidChange` was a no-op, so the singleton loaded no accounts and listened on a config that never changed, in every window. Fix (an ordering and listener fix, no bootstrap redesign):
    - The placeholder reads the saved settings once from the main process, through the same `configPersistenceManager.getRawValuesString()` the real Config uses.
    - It records each `onDidChange`/`observe` call with the value its subscriber saw.
    - After `config.load()`, `loadConfig` calls `replayEarlyConfigSubscriptions(config)` (`src/early-config-subscriptions.js`). That moves the live subscriptions onto the real config and reports a value that changed in between, so there's no spurious event when nothing changed.
    - Spec: `early-config-subscriptions.spec.js` checks that AccountStore holds the saved accounts at boot and reloads when they change on the real config after the replay. `renderer-placeholder-env.spec.js` covers the placeholder.
  - The `nodeRequire` rewrite in the same build file now allows the formatter's trailing comma, so `account-store`'s wrapped `nodeRequire("./folder-sync-progress-store.js",)` is bundled.
  - `key-manager.js` (orchestrator constraint: no fake backend). With keytar missing, `getPassword` returns null (no migrate branch, no dialog), and writes log a warning and skip. There's no no-op `replacePassword`. The failure is recorded under Implementation Notes; real storage is issue #10.
  - `flux/models/model.js`: the constructor skips getter-only attributes, as `fromJSON` does (`new Thread(thread)` threw on `inAllMail`).
  - `flux/models/account.js`: `.default` on the three `category-store` requires (`canArchiveThreads` threw).
  - `flux/stores/focused-perspective-store.js`: initialize at construction if the categories already loaded. Otherwise the one category trigger can come first and the inbox never gets focused (offline, nothing triggers again).
  - `global/nylas-component-kit.js` (orchestrator-approved): the 10 entries still registered by string path (ListensToObservable, ListensToFluxStore, ListensToMovementKeys, Contenteditable, OverlaidComponents, OverlaidComposerExtension, MultiselectActionBar, MetadataComposerToggleButton, CalendarEventPopover, OpenIdentityPageButton) are literal-require thunks now, like the rest after 13.10. The bundle resolved them relative to `static/`, so thread-list, composer, draft-list, notifications, preferences, thread-search and undo-redo failed to load. The deprecated `Popover` entry pointed at `components/popover.jsx`, which no longer exists. It's now a thunk that throws "Popover was removed; use Actions.openPopover". The `check-kit-named-imports` build plugin now fails the build on any string-path registration (`kitStringPathRegistrations`), and a spec runs the check on the real kit and the real bundle build.
  - `components/evented-iframe.jsx`: the constructor called `super()` twice and threw, so every message body crashed the window.
  - `components/contenteditable/floating-toolbar.jsx`: imported neither `Utils` nor `DOMUtils`, so the composer crashed on mount.
  - `notifications/lib/sidebar/activity-sidebar.jsx`: `.default` on the compat transition group. It rendered a module object, and the whole sheet unmounted.
  - `category-picker` (story 5's package): its toolbar button's string ref unmounted the whole window when a thread opened. Converted to an object ref, and the unused popover `ref="menu"` dropped.
  - `composer-spellcheck` (in scope): skip the spellcheck pass when there's no native spellchecker (`Spellchecker.handler` is null), which threw on every keystroke pause.

## Review Triage Log

### Pass 1 (quick lens), 2026-11-13

Counts: high 0, medium 4, low 4, false 0, plus 1 boundary item decided by the orchestrator.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | key-manager null-backend rewrite uncommitted; committed spec expects undefined | medium | patch | The working tree differs from HEAD. Commit the rewrite with its spec. Writes warn and skip, never report as stored (#10). |
| 2 | category-picker and activity-sidebar changed, outside the frozen Never | — | accepted | Orchestrator decision 2026-11-13, under Josh's standing go-ahead. Without them, opening a thread unmounted the window and the sheet crashed, so the AC can't pass. Story 5 would make the same change. |
| 3 | `_focusDraft` with a loading draft: null getDOMNode, scrollTo throws, `_draftScrollInProgress` stuck | medium | patch | The placeholder span has no ref. Ref the placeholder and reset the flag on failure. |
| 4 | AC 1: notif-wrapper React error; composer-translate never exercised (missing `request`) | low | defer | notif-wrapper is known and owned by 13.5. composer-translate's load failure joins 13.5's load-failure list. |
| 5 | 14 old-format `-spec.jsx` files still mock findDOMNode/.refs | low | reject | Old-format specs never run and are out of the initiative (decision 2026-11-12, #9). |
| 6 | Seed script rm -rf's any path | medium | patch | Guard with a marker or empty dir. |
| 7 | Seed can attach to another app on port 9339 | medium | patch | Use a free port and verify the config dir. |
| 8 | readSetting() with no key returns the cache itself | low | patch | Return a copy. |
| 9 | ParticipantsTextField spec assigns the ref by hand | low | patch | Render and assert. |

Verification on 4770026e8 (orchestrator, 2026-11-13): `check:react` exits 0, build exits 0, vitest 3745 pass across 191 files with none failed (4 known unhandled errors), lint shows 1 known error. The seed rebuilds a fresh fixture (4 threads, 7 messages, 4 contacts, 6 folders, plus the `.nylas-fixture` marker). Dev app on the fixture, over CDP: 3 inbox threads listed; opening the first renders its message; the reply composer opens with focus in the body; no console errors during the flow. Startup still logs the 13.5-owned load failures (account-sidebar createRequire, `request` x3, `tld`) and a BufferedProcess `killed` error (deferred).

## Design Notes

Build the fixture first, since everything after it is checked against it. Then convert in lanes (thread-list, message-list, composer core, composer-* plugins), launching against the fixture after each lane. If the seeded account needs something sync would normally write before the main window shows (an identity stub, a flag), record exactly what in Implementation Notes.

## Verification

**Commands:**
- the seed command -- expected: creates the fixture NYLAS_HOME from scratch
- `pnpm check:react` -- expected: exit 0
- `cd packages/client-app && node scripts/build-renderer.js` -- expected: exit 0
- `pnpm --filter nylas-mail exec vitest run` -- expected: no failed file and no fewer passing tests than baseline (3627; 4 known unhandled errors)
- `pnpm lint` -- expected: no new findings (1 known error)
- dev launch on the fixture with CDP -- expected: per the acceptance criteria; quit afterwards
