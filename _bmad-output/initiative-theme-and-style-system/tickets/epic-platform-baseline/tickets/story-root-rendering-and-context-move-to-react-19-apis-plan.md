---
title: 'Root rendering and context move to React 19 APIs'
type: 'refactor'
ticket: '2'
created: '2026-11-12'
status: 'built'
baseline_revision: 'ae7dc9d2df640b4950e94d602ac3a6f398dc2135'
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

**Problem:** React 19 removed `ReactDOM.render`, `unmountComponentAtNode` and legacy context. `UnsafeComponent` still mounts injected plugin components with `ReactDOM.render`, which throws. `TabGroupRegion` still hands `parentTabGroup` to the date picker, time picker, composer header and markdown editor through `childContextTypes`/`contextTypes`, which React 19 ignores, so Tab focus-shifting from those fields breaks. Nothing stops these APIs coming back.

**Approach:** Move `UnsafeComponent` onto `createRoot`, keeping its injected-instance and `onComponentDidRender` behaviour. Move `parentTabGroup` onto a `createContext` the four consumers read. Add a removed-API check to CI that the later React 19 stories extend. (ModalStore, PopoverStore, `sheet` and `sheet-toolbar` already moved in story 1.)

## Boundaries & Constraints

**Always:**
- Behaviour stays the same. Tab from a date or time field still moves focus within the tab group, and a field outside any `TabGroupRegion` behaves as it does today.
- An injected component's DOM methods (`focus`, `blur`) and `onComponentDidRender` still work.
- Tests ship with the change.
- Commit locally on `modernize/current` with no attribution lines, and never push. Refs heyjawrsh/nylas-mail#7.

**Never:**
- `findDOMNode` or string-ref cleanup outside `UnsafeComponent` (stories 3–5).
- `componentWill*` rewrites (story 6).
- Changes to the `nylas-component-kit` bundle-import issue (story 10).
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Inject | `UnsafeComponent` with a class component | renders it inside the wrapper; `onComponentDidRender` called after commit; `focus()` reaches the injected instance | — |
| Re-render | props change | same root re-renders, with no second root | — |
| Unmount | parent removes `UnsafeComponent` | the injected root unmounts with no React "synchronously unmount while rendering" warning | — |
| Throwing plugin | injected component throws on render | dev: the exception panel; prod: an empty div; error reported | `NylasEnv.reportError` as today |
| Tab in group | date picker inside `TabGroupRegion`, Tab pressed | `parentTabGroup.shiftFocus(1)` runs | — |
| No group | date picker outside any `TabGroupRegion` | same as today (no provider means `parentTabGroup` is undefined) | — |
| Removed API added | a file under `src/` or `internal_packages/` (specs excluded) uses `ReactDOM.render`, `unmountComponentAtNode`, `contextTypes` or `childContextTypes` | the check exits non-zero, naming file and line | — |

</frozen-after-approval>

## Code Map

- `packages/client-app/src/components/unsafe-component.jsx:97-153` -- `renderInjected` uses `ReactDOM.render(element, node, onComponentDidRender)` and keeps the returned instance as `this.injected`; `unmountInjected` uses `unmountComponentAtNode`; `node` comes from `findDOMNode(this)` on its own wrapper `div` (render at :86). `_runInjectedDOMMethod` (:168) uses `this.injected`
- `packages/client-app/src/components/tab-group-region.jsx:19-23,76-78` -- `getChildContext` and `childContextTypes` give `{ parentTabGroup: this }`. Its `findDOMNode` in `shiftFocus` stays (story 3)
- Consumers that read `this.context.parentTabGroup`: `src/components/date-picker.jsx:17,58,72`, `src/components/time-picker.jsx:26,70`, `internal_packages/composer/lib/composer-header.jsx:41,89`, `internal_packages/composer-markdown/lib/markdown-editor.jsx:42,137`
- `packages/client-app/src/global/nylas-component-kit.js:168` -- the lazy `NylasComponentKit.load(name, () => require(...))` registry. Internal packages get the kit from here (unbundled), so a new export works for them
- Already done in story 1, don't redo: `src/flux/stores/modal-store.jsx`, `popover-store.jsx` (createRoot plus flushSync), `src/sheet.jsx`, `src/sheet-toolbar.jsx`, `src/sheet-depth-context.js`, `src/nylas-env.js` root
- Existing specs: `spec/modal-popover.spec.jsx` (Modal), `spec/sheet-toolbar.spec.jsx`, `spec/nylas-env-react-root.spec.js`
- `.github/workflows/test.yml` -- CI: install, `pnpm -r run test`, `pnpm lint`. Root `scripts/` holds only `link-workspaces.mjs`

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/tab-group-context.js` (new) -- `React.createContext({})`; TabGroupRegion provides `{ parentTabGroup: this }` -- one context object shared by provider and consumers
- [ ] `src/components/tab-group-region.jsx` -- drop `childContextTypes` and `getChildContext`, wrap children in the provider -- legacy context removed
- [ ] the four consumers -- `static contextType = TabGroupContext` in place of `contextTypes` (src files import it relatively; internal packages get it from `nylas-component-kit` as `TabGroupContext`) -- they keep reading `this.context.parentTabGroup`
- [ ] `src/global/nylas-component-kit.js` -- register `TabGroupContext` -- so internal packages can reach it
- [ ] `src/components/unsafe-component.jsx` -- a ref to its wrapper div in place of `findDOMNode(this)`; one `createRoot` per wrapper, created on mount and reused on update; the injected element gets a ref that sets `this.injected`; `onComponentDidRender` is called after the injected tree commits; the root unmounts deferred (`queueMicrotask`) so it never unmounts synchronously during the parent's commit -- React 19 rendering with the same behaviour
- [ ] `scripts/check-removed-react-apis.mjs` (repo root, new), root `package.json` `check:react`, `.github/workflows/test.yml` step -- scans `packages/client-app/src` and `internal_packages` (`.js`/`.jsx`, excluding `spec/`, `vendor/`, `node_modules`) against a list of banned patterns (`ReactDOM.render(`, `unmountComponentAtNode`, `contextTypes`, `childContextTypes`, `getChildContext`) and prints `file:line` -- the guard stories 3–6 extend by adding patterns
- [ ] `spec/unsafe-component.spec.jsx`, `spec/tab-group-context.spec.jsx` (new) -- cover the matrix rows: inject, re-render, unmount (no warning), throwing plugin, Tab in group, no group. Add a popover mount/unmount case to `spec/modal-popover.spec.jsx` if none exists

**Acceptance Criteria:**
- Given the repo after this change, when `pnpm check:react` runs, then it exits 0, and it exits non-zero naming `file:line` when one banned pattern is added to a source file
- Given the running app (onboarding, no account), when it launches, then no React errors appear in the console. When a date field inside a tab group gets Tab, the context reaches `shiftFocus`; focus actually moving needs `shiftFocus`'s own `findDOMNode` fix, which is story 3 (2026-11-12, orchestrator: implementer flagged the conflict with the frozen Never)

## Implementation Notes

## Plan Change Log

## Review Triage Log

### Pass 1 (quick lens), 2026-11-12

Counts: high 0, medium 4, low 3, false 0, maybe-false 0.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | InjectedErrorBoundary resets the error in the same commit that caught it, so it renders and reports twice | medium | patch | `componentDidUpdate` compares prevProps.children with new children on the failing update. Track the failed children instead. |
| 2 | Dev-mode catch path in `renderInjected` shows an empty div, not the exception panel | low | patch | The frozen matrix row says dev shows the panel. Direct correction. |
| 3 | `InjectedComponent._runInnerDOMMethod` throws when `injected` is null (failed plugin or function component) | medium | patch | Previously the prod fallback div was `injected`. Optional-chaining guard. |
| 4 | Kit-export identity spec compares the stub with itself | low | patch | The Vitest alias points at a stub that re-exports the module. Load the real registration. |
| 5 | Tab specs bypass the context; the time-picker context is set by hand | low | patch | TabGroupRegion handles Tab itself. Render consumers inside a real region. |
| 6 | Acceptance criterion 2 (onboarding launches with no React errors) has no recorded evidence | medium | patch | The implementer read the launch log only. The orchestrator launches and checks after patches. |
| 7 | `check-removed-react-apis` matches only literal `ReactDOM.render(` | medium | patch | Named imports, `require("react-dom").render` and `hydrate` slip through. Widen the patterns before stories 3–6 extend them. |

Verification on 69a513311 (orchestrator, 2026-11-12): `pnpm check:react` exits 0. vitest 3539 pass (4 known unhandled errors). Lint shows 1 known error. Dev launch with a fresh NYLAS_HOME, read over CDP: the onboarding window shows "Welcome to Nylas Mail / Get Started". The log has no React errors or removed-API warnings, only the known story-11 work-window errors (worker-ui `fromQuery`, `database-agent.js`). All 7 findings were patched.

## Design Notes

`root.render` inside `componentDidMount` or `componentDidUpdate` is fine, because it schedules. Avoid `flushSync` there, since React 19 warns about it in lifecycles. Fire `onComponentDidRender` from a tiny wrapper around the injected element that calls it in its own `componentDidMount`/`componentDidUpdate`. Unmounting a root inside another root's commit triggers React's sync-unmount warning, hence the deferral.

## Verification

**Commands:**
- `pnpm check:react` -- expected: exit 0
- `pnpm --filter nylas-mail exec vitest run spec/unsafe-component.spec.jsx spec/tab-group-context.spec.jsx spec/modal-popover.spec.jsx` -- expected: pass
- `pnpm --filter nylas-mail exec vitest run` -- expected: no new failures against baseline (3504 passing; 4 known unhandled errors from stubs)
- `pnpm lint` -- expected: no new findings (1 known error, `.nylas-smoke-home/config.json`)
- `pnpm --filter nylas-mail start` -- expected: onboarding renders with no React errors in the logged console; quit the app afterwards
