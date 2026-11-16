---
title: 'Legacy lifecycles are rewritten'
type: 'refactor'
ticket: '6'
created: '2026-11-13'
status: done
baseline_revision: '9888598f888c13b38631c3165206f4800f3ea4d0'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/epic-platform-baseline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 75 `UNSAFE_componentWillMount`, `UNSAFE_componentWillReceiveProps` and `UNSAFE_componentWillUpdate` methods remain in 68 files under `src/` and `internal_packages/`. React only tolerates them: they warn under StrictMode, they can run more than once under concurrent rendering (which `createRoot` enables), and a later React will remove them. They also hide a few stale reads, where code uses `this.props` where it meant `nextProps`.

**Approach:** Rewrite each one as a current lifecycle: the constructor, `componentDidMount`, `componentDidUpdate(prevProps)` with a change check, `getDerivedStateFromProps` only where state must be right on the same render, and `getSnapshotBeforeUpdate` for DOM reads taken before an update. Delete each method's `.bind(this)` line. Add a `check:react` entry so none can come back.

## Boundaries & Constraints

**Always:**
- Visible behaviour stays the same: same rendered output, subscriptions, focus, scroll and measurements, with no new flash or extra empty frame.
- State derived from props re-derives when the props it reads change, not on every parent render. Local edits in a field (dropdown, time picker, mail-merge input and the like) survive an unrelated parent re-render. Before, they were wiped.
- Stale `this.props` reads that meant the new props (thread-list-scroll-tooltip, salesforce-sync-label, week-view) are fixed to use the new props.
- Subscriptions moved to `componentDidMount` are torn down in `componentWillUnmount` exactly as before. Re-subscriptions on prop change dispose the old one first.
- Tests ship with the change: a prop-change spec for each decorator or HOC and for each tricky (E/F) site, and the existing specs stay green.
- Commit locally on `modernize/current` with no attribution lines, and never push. Refs heyjawrsh/nylas-mail#7.

**Never:**
- `src/vendor/` (vendored Reflux's `componentWillMount` mixin is unused: nothing uses `Reflux.Component`).
- Converting class components to hooks, or other refactors beyond the lifecycle move.
- `componentWillUnmount` (current API, not legacy).
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Prop change re-derives | a C-pattern component gets a changed prop it reads | state updates to the derived value | — |
| Unrelated re-render | same props re-rendered while a field holds a local edit | the edit is kept | — |
| HOC re-subscribe | ListensToObservable or InflatesDraftClientId gets a new key prop (`draftClientId`, observable inputs) | old subscription or session disposed, new one set up, wrapped component gets new state | — |
| Unmount mid-change | component unmounts right after a prop change | no setState-after-unmount, no leaked listener | — |
| Snapshot read | message-list or overlaid-components updates | DOM offsets and observer teardown happen before the DOM changes, as before | — |
| Legacy API added | `componentWillMount`, `componentWillReceiveProps` or `componentWillUpdate` (prefixed or not) in `src/` or `internal_packages/`, specs and vendor excluded | `pnpm check:react` exits non-zero naming `file:line` | — |

</frozen-after-approval>

## Code Map

- Find sites: `grep -rnE '(UNSAFE_)?componentWill(Mount|ReceiveProps|Update)\b' packages/client-app/src packages/client-app/internal_packages --include='*.js' --include='*.jsx'`, excluding `spec/` and `src/vendor/`. About 40 hits are `this.UNSAFE_x = this.UNSAFE_x.bind(this)` lines; delete them with their method.
- Patterns (75 methods):
  - **A, 2 sites (to the constructor):** contenteditable:212, thread-list-scroll-tooltip:30.
  - **B, 9 sites (to componentDidMount):** metadata-composer-toggle-button, billing-modal, nylas-calendar, salesforce-object-form, salesforce-object-picker, salesforce-manually-relate-thread-button, participant-decorator, related-objects-for-thread, message-item-body. Constructors already seed state, and `MessageBodyProcessor.subscribe` defers its callback.
  - **C, 27 sites (pure derivation):** use `componentDidUpdate(prevProps)` that sets state when the read props differ. Where a helper doesn't read `this` and the value must be right on the first render after the change, use `getDerivedStateFromProps` with a stored-prev-prop check. The no-check setters are dropdown-menu, toast, time-picker, calendar-event-popover, preferences-account-details, keybase-search and mail-merge-header-input.
  - **D, 8 sites (side effects on prop change, to componentDidUpdate(prevProps)):** key-commands-region:121, scenario-editor-row:44, new-event-card:47, salesforce-contact-info:42, participant-decorator:26, encrypt-button:67, message-item-body:54, thread-sharing-button:23.
  - **E, 28 sites (tricky):**
    - HOCs: `src/decorators/inflates-draft-client-id.jsx:44`, `src/components/decorators/listens-to-flux-store.jsx:31`, `listens-to-observable.jsx:32`, `flux-container.jsx:23`.
    - Cached fields cleared before render: `swipe-container.jsx:89` (`isEnabled`) and `scroll-region.jsx:376` (`_scrollbarComponent`). Clear or recompute these in render or in a memo keyed on props; don't defer them.
    - Flash-sensitive, where state must land before paint: `list-tabular.jsx:130` (`setupDataSource`) and `composer/lib/collapsed-participants.jsx:42`.
    - DOM reads: `message-list/lib/message-list.jsx:46,49` and `lazy-rendered-list.jsx:43`.
    - Other: `webview.jsx:91`, `contenteditable/floating-toolbar.jsx:116` (mutates `innerProps`), `menu.jsx:265`, `multiselect-list.jsx:82`, `multiselect-action-bar.jsx:88`, `spinner.jsx:71`, `tokenizing-text-field.jsx:421`, `nylas-calendar/week-view.jsx:70,86`, `composer-header.jsx:52`, `composer-view.jsx:62`, `category-picker-popover.jsx:41`, `events/lib/event-header.jsx:77` (stale `this.state` read after setState), `send-reminders-thread-timestamp.jsx:52`, `copy-button.jsx:20`, `salesforce-sync-label.jsx:28`, `related-objects-for-thread.jsx:46`.
  - **F, 1 site:** `overlaid-components/overlaid-components.jsx:83` disconnects MutationObservers before the DOM updates. Use `getSnapshotBeforeUpdate`.
- Reuse: `_getStateFromStores(props)`/`_getStateFromProps` helpers (36 files, mostly props-in), and the paired `setupForProps`/`teardownForProps` in multiselect-list, multiselect-action-bar, composer-view and key-commands-region. `Utils.isEqualReact` is the shared shallow compare.
- `scripts/check-removed-react-apis.mjs` -- add an entry with pattern `/\b(?:UNSAFE_)?componentWill(?:Mount|ReceiveProps|Update)\b/`, which must not match `componentWillUnmount`. Vendor and spec are already skipped (`SKIP_DIRS`)
- `spec/remaining-packages-refs.spec.jsx` calls a legacy lifecycle directly. Re-render with new props instead. Spec coverage per busy file is in `spec/` and `internal_packages/*/spec/`. event-header, salesforce-sync-label and related-objects-for-thread have no dedicated spec yet

## Tasks & Acceptance

**Execution:**
- [ ] all 68 files -- each legacy method rewritten by its pattern, and its bind line removed -- current lifecycles, same behaviour
- [ ] `scripts/check-removed-react-apis.mjs` -- legacy-lifecycle entry across src and internal_packages -- the guard
- [ ] specs -- prop-change specs for the 4 HOCs and the E/F sites, the unrelated-re-render case for one C setter, the check-script matcher (including that `componentWillUnmount` passes), and the direct-call spec updated -- proof

**Acceptance Criteria:**
- Given the repo, when `pnpm check:react` runs, then it exits 0, and it fails naming `file:line` if a `componentWill{Mount,ReceiveProps,Update}` is added
- Given the dev app on a seeded fixture account, when the main window starts and you switch folders, open a thread, reply, pop out a composer, open preferences and the calendar, then the log shows no React error and no legacy-lifecycle warning, and each surface renders as before

## Implementation Notes

- 2026-11-13 (from the implementer's report, recorded by the orchestrator): six lane commits, 6c3d47526..de6cab6a8.
  - New `src/components/shallow-equal.js`. Under React 19, a class with defaultProps gets a fresh props object on every update, so `prevProps === this.props` is never true. Checks compare by value or by the specific props.
  - `getDerivedStateFromProps` is used where the first render after a change must already be right: ListensToFluxStore, FluxContainer, InjectedComponent, ListTabular, Menu, MailImportantIcon, EmptyListState, the WeekView range, CollapsedParticipants, MessageItemContainer, both scroll tooltips, MailMergeBodyToken and SendRemindersComposerButton.
  - `getSnapshotBeforeUpdate` is used for OverlaidComponents and LazyRenderedList.
  - SwipeContainer, ScrollRegion and CategoryPicker clear their cached fields in render.
  - Stale reads fixed: the three named in the plan, plus EventHeader (re-read the old event) and ComposerView (tore down the new session).
  - Two crash bugs fixed on the path: MultiselectActionBar had lost its `Utils` import, and Webview never created `webviewRef`.
  - Intended changes under "local edits survive":
    - Spinner no longer restarts its show timer on a parent render.
    - TimePicker keeps typed text when the value is unchanged.
    - FixedPopover keeps a flipped direction.
- Found and filed as backlog issues, not caused by this story: #11 (Bluebird typed `.catch` on native promises, which throws DraftNotFoundError on closing a pristine popout), #12 (the thread-list scroll tooltip is missing its DateUtils import) and #13 (the fixture seed fails with "database table is locked" about half the time, at baseline too).

## Plan Change Log

## Review Triage Log

### Pass 1 (quick lens), 2026-11-13

Counts: high 0, medium 1, low 3, false 1.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | multiselect-list (E site) has no prop-change spec | low | patch | The frozen Always requires one for each E/F site. Add the spec. |
| 2 | SwipeContainer spec never changes a prop | low | patch | The cache clear moved into render and nothing tests it. Add a prop-change case. |
| 3 | AC 2 real-app run has no evidence | false | reject | Orchestrator run on de6cab6a8 with a seeded fixture. Inbox shows 3 rows, Sent 1, and Inbox 3 again after switching back. "Lunch on Thursday?" opens with 3 messages, and reply puts focus in the body. A popout composer renders. The Preferences sheet shows General, Accounts, Appearance and the other tabs. NylasCalendar mounted in the main window, re-rendered with a new prop and unmounted. The log has 0 `componentWill` lines and no React errors. |
| 4 | thread-list-scroll-tooltip `setupForProps` is dead, kept only by an old spec | low | patch | grep shows only spec callers, and that spec tests a path the component no longer takes. Delete the method and point the spec at `stateForProps`. |
| 5 | InjectedComponentSet renders one commit of the old location's components with the new props | medium | patch | Confirmed. The old cWRP swapped the components before render, and componentDidUpdate now lags a commit, against the frozen "no new flash". Use getDerivedStateFromProps keyed on location, as InjectedComponent does, and add a spec. |

Verification on b7fa4d6f9 (orchestrator, 2026-11-13): `check:react` exits 0, build exits 0, vitest 3885 pass across 199 files with none failed (4 known unhandled errors), lint shows 1 known error. All 4 patch findings fixed.

## Design Notes

Work in lanes and commit after each, so an interrupted run resumes cleanly. Go in this order: HOCs and containers, then lists and scroll, then text and contenteditable, then calendar, then composer and message-list, then the rest of the packages. Run that lane's specs after each.

The default C shape:

```js
componentDidUpdate(prevProps) {
  if (prevProps.items !== this.props.items) {
    this.setState(this._getStateFromProps(this.props));
  }
}
```

That costs one extra commit after a change. Where it would show a frame of stale content (list-tabular, collapsed-participants), use `getDerivedStateFromProps` instead, keeping the prev prop in state.

## Verification

**Commands:**
- `pnpm check:react` -- expected: exit 0
- `cd packages/client-app && node scripts/build-renderer.js` -- expected: exit 0
- `cd packages/client-app && npx vitest run` -- expected: no failed file and no fewer passing tests than baseline (3813; 4 known unhandled errors)
- `npx biome check .` -- expected: no new findings (1 known error)
- dev launch on a seeded fixture account (`--enable-logging`, `--remote-debugging-port`), then drive the AC 2 surfaces over CDP -- expected: no React errors and no `componentWill` warnings in the log; quit afterwards

- 2026-11-16, Josh signed off: the behaviour change is noted and accepted.
