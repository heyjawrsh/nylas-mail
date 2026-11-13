---
title: 'Shared components drop findDOMNode and string refs'
type: 'refactor'
ticket: '3'
created: '2026-11-12'
status: done
baseline_revision: '25314241750bb38ae3388b7f7b279dea3a909c23'
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

**Problem:** React 19 removed `ReactDOM.findDOMNode` and string refs (`ref="x"` with `this.refs.x`), but about 38 files in `packages/client-app/src` still use them. Any of those components throws when it mounts or acts. Modal and FixedPopover now mount from the bundle (story 10) and then crash. Tab focus-shifting in a `TabGroupRegion` throws. Scroll regions, the tokenizing field, the calendar week view and the rest break the same way.

**Approach:** Replace every `findDOMNode` and string ref under `src/` with object or callback refs, keeping each component's behaviour. Where a parent asked `findDOMNode` for a child component's node, give that child an explicit way to hand over its DOM node. Extend the removed-API check so neither API can come back under `src/`.

## Boundaries & Constraints

**Always:**
- Behaviour stays the same: same DOM, same focus, scroll and measurement results, same public methods on each component.
- `css-transition-group-compat.jsx`'s remaining `findDOMNode` fallback goes too.
- Tests ship with the change: a spec per component group touched, covering the paths that used to call `findDOMNode`.
- Commit locally on `modernize/current` with no attribution lines, and never push. Refs heyjawrsh/nylas-mail#7.

**Never:**
- `internal_packages/` (stories 4–5), except where a `src/` component's new ref contract forces a one-line caller change.
- `componentWill*` rewrites (story 6).
- `src/regexp-utils.js` and `src/flux/stores/signature-store.js`: their matches are `href=` text, not refs.
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Modal opens | `Actions.openModal` from bundled code in the running app | Modal renders and its important element takes focus, with no React errors | — |
| Popover opens and closes | `Actions.openPopover`, then close | FixedPopover renders, positions and focuses, then unmounts cleanly, with no React errors | — |
| Tab in group | Tab inside a `TabGroupRegion` | focus moves to the next focusable node (`shiftFocus` works) | — |
| Child node lookup | a parent that used `findDOMNode(childRef)` | gets the same DOM node through the child's explicit node accessor | — |
| Removed API reintroduced | `findDOMNode`, `ref="…"` or `this.refs.` added under `packages/client-app/src` (specs excluded) | `pnpm check:react` exits non-zero naming `file:line` | — |

</frozen-after-approval>

## Code Map

- The 38 files under `packages/client-app/src`, largest first: `components/scroll-region.jsx` (17), `nylas-calendar/week-view.jsx` (16), `tokenizing-text-field.jsx` (7), `overlaid-components/overlaid-components.jsx` (7), `fixed-popover.jsx` (5), `decorators/has-tutorial-tip.jsx` (5), `contenteditable/link-editor.jsx` (5), `contenteditable/contenteditable.jsx` (5), `nylas-calendar/event-grid-background.jsx` (4), `multiselect-list.jsx` (4), and 1–3 each in webview, key-commands-region, editable-table, editable-list, `decorators/auto-focuses`, attachment-items, `searchable-components/searchable-component-maker`, outline-view-item, `nylas-calendar/{header-controls,event-participants-input,current-time-indicator,calendar-event,calendar-event-container}`, multiselect-dropdown, menu, lazy-rendered-list, injected-component, css-transition-group-compat, button-dropdown, time-picker, tab-group-region (`shiftFocus`), swipe-container, selectable-table, search-bar, scrollbar-ticks, resizable-region, modal (`_focusImportantElement`), empty-list-state. Re-run the grep to confirm: `grep -rnE 'findDOMNode|ref="|this\.refs\b' packages/client-app/src`
- Decorators (`has-tutorial-tip`, `auto-focuses`) wrap arbitrary components. They need the wrapped component's root node, so they use a ref on a wrapper element or a ref the wrapped component forwards
- `scripts/check-removed-react-apis.mjs:27` -- the `BANNED` list (label, regex, hint). Add `findDOMNode` and string-ref entries scoped to `packages/client-app/src` only. `internal_packages` joins in stories 4–5, so the entries take a path scope
- Story 2 context: `tab-group-region.jsx` provider plus `shiftFocus`. `spec/tab-group-context.spec.jsx` mocks `findDOMNode` for TimePicker, so remove that mock now
- `spec/` has existing specs for many of these (scroll-region, tokenizing-text-field, multiselect, modal-popover, sheet). Update their `findDOMNode` mocks rather than keeping them

## Tasks & Acceptance

**Execution:**
- [ ] every listed file -- `findDOMNode(this)` becomes a ref on the component's root element, `findDOMNode(this.refs.x)` and `this.refs.x` become object refs, and child components a parent measured expose their root node explicitly (a `getDOMNode()`-style accessor or a forwarded ref) -- React 19-safe, same behaviour
- [ ] `scripts/check-removed-react-apis.mjs` -- add path-scoped `findDOMNode`, `ref="…"`/`ref='…'` and `this.refs` entries for `packages/client-app/src` -- the guard
- [ ] specs -- update the existing `findDOMNode` mocks, and add coverage for the matrix rows (modal focus, popover open/close, Tab moves focus, a child-node lookup) -- proof

**Acceptance Criteria:**
- Given the repo, when `pnpm check:react` runs, then it exits 0, and it fails naming `file:line` if `findDOMNode` or a string ref is added under `packages/client-app/src`
- Given the dev app (onboarding, fresh NYLAS_HOME), when a modal and a popover are opened and closed from bundled code over CDP, then both render and go, with no React errors in the console

## Implementation Notes

## Plan Change Log

## Review Triage Log

### Pass 1 (quick lens), 2026-11-13

Counts: high 0, medium 2, low 5, false 1.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | SearchableComponentMaker resolves a null node for MessageList (no getDOMNode), so the search store throws | medium | patch | MessageList is the only `extend` user. Add a one-line getDOMNode (an allowed caller change) and a spec. |
| 2 | Compat transition fallback animates a detached span, so the activity-sidebar fades are lost | low | patch | SyncActivity/SyncbackActivity and the compat group lack getDOMNode. Add accessors and a spec. |
| 3 | `entry.childRef` inline callback ref goes stale | low | reject | Latent: the only inline-ref caller (SheetContainer toolbar) keys by index. The fix adds ref-diffing logic. |
| 4 | HasTutorialTip adds a `display:contents` span, against the frozen "same DOM" | low | defer | No stylesheet found that breaks. Removing it needs getDOMNode on 9 internal_packages buttons, which is stories 13.4–13.5 work. |
| 5 | `AutoFocuses.isFocusable()` with no node throws | low | patch | Null guard, as `focusElementWithTabIndex` has. |
| 6 | Spec gaps: overlaid-components, link-editor, searchable maker, calendar refs | medium | patch | The frozen Always requires a spec per group touched. |
| 7 | AC 2 / CDP check has no recorded evidence | false | reject | Orchestrator run on 979ac239d: onboarding and work windows open and close a modal and a popover with no console errors (recorded below). |
| 8 | New path-scoped check entries untested | low | patch | Add a spec on the matcher. |

Orchestrator verification on 979ac239d: `check:react` exits 0, build exits 0, vitest 3581 pass with no failed file, lint shows 1 known error. CDP: modal and popover open and close in the onboarding and work windows with no errors.

Verification on add1f9ab0 (orchestrator, 2026-11-13): `check:react` exits 0, build exits 0, vitest 3618 pass across 184 files with none failed (4 known unhandled errors), lint shows 1 known error. CDP in all three windows: a modal and a popover open and close with no console errors, and onboarding shows "Welcome to Nylas Mail / Get Started". Five patch findings were fixed, one was deferred (the tutorial-tip span) and two were rejected.

## Design Notes

Work in lanes by area: the modal/popover/overlay group, the scroll region and lists, the text fields and contenteditable, then the calendar. Run the matching specs after each lane. The grep count is the progress meter.

## Verification

**Commands:**
- `pnpm check:react` -- expected: exit 0
- `cd packages/client-app && node scripts/build-renderer.js` -- expected: exit 0
- `pnpm --filter nylas-mail exec vitest run` -- expected: no failed file and no fewer passing tests than baseline (3547; 4 known unhandled errors)
- `pnpm lint` -- expected: no new findings (1 known error)
- dev launch with a fresh NYLAS_HOME and `--remote-debugging-port`, then open and close a modal and a popover over CDP -- expected: both render, with no React errors; quit afterwards
