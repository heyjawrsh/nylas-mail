---
title: 'Modals and kit components render from the bundle'
type: 'bugfix'
ticket: '10'
created: '2026-11-12'
status: 'built'
baseline_revision: 'f2f725e5ccf5a763b0d006f0ce6125ccbdecd070'
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

**Problem:** In the renderer bundle, every named import from `nylas-component-kit` is undefined: esbuild reports that `src/global/nylas-component-kit.js` "has no exports". So bundled code that renders a kit component (ModalStore's `Modal`, NylasEnv's `CodeSnippet`, 18 names across about 21 files) renders `undefined`, and opening any modal crashes. Two more bundled imports are also always undefined. `draft-editing-session.js` calls `ContactStore.isValidContact` through a namespace import, which throws when a draft's contacts are validated. `message-store.js` reads `ExtensionRegistryNS.default`.

**Approach:** Give the bundle a `nylas-component-kit` that esbuild can read lazily, sharing the one kit instance internal packages get. Fix the two non-kit imports. Make esbuild's `import-is-undefined` warning a build error, so this class of bug fails the build.

## Boundaries & Constraints

**Always:**
- Bundled code and internal packages get the same kit instance, so a component is loaded once.
- The kit stays lazy: a name's component is required only when first read (it avoids import cycles).
- Specs keep working: the Vitest path in `nylas-component-kit.js` (no eager instance under `VITEST`) must not regress.
- Tests ship with the change.
- Commit locally on `modernize/current` with no attribution lines, and never push. Refs heyjawrsh/nylas-mail#7.

**Never:**
- Rewriting the kit's registry or its component list.
- `findDOMNode`, string refs or lifecycles (stories 3–6).
- The work window (story 11).
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bundled kit import | `import { Modal } from "nylas-component-kit"` in a bundled src file | resolves to the real Modal component at use time | — |
| Shared instance | the bundle and an internal package both read `Modal` | the same component object | — |
| Modal opens | `Actions.openModal` from bundled ModalStore in the running app | the modal renders, with no React errors | — |
| Popover opens | `Actions.openPopover` in the running app | the popover renders, with no React errors | — |
| Contact validation | DraftEditingSession validates a contact | `ContactStore.isValidContact` runs (no TypeError) | — |
| Undefined import added | a bundled file imports a name its target doesn't export | `node scripts/build-renderer.js` exits non-zero, naming file and line | — |

</frozen-after-approval>

## Code Map

- `packages/client-app/src/global/nylas-component-kit.js:428-437` -- the file uses `import.meta`, so esbuild treats it as ESM with no exports; its `module.exports = kitInstance` (skipped under `VITEST`) never becomes an export in the bundle. It also sets `globalThis.NylasComponentKitClass`
- `packages/client-app/src/register-bundled-modules.js` -- `nylas-component-kit` provider makes `new globalThis.NylasComponentKitClass()` for unbundled requires. The bundle and packages must share one instance with this
- `packages/client-app/scripts/build-renderer.js` -- esbuild options; `alias` maps `nylas-component-kit` to `src/global/nylas-component-kit.js`. `logOverride` is unset
- Bundled importers (esbuild warnings): `src/flux/stores/modal-store.jsx` (Modal), `src/nylas-env.js` (CodeSnippet), `src/flux/stores/feature-usage-store.jsx`, `message-store.js`, `observable-list-data-source.js`, `draft-editing-session.js`, `src/components/{contenteditable/*,date-picker,dropdown-menu,empty-list-state,focus-container,multiselect-*,nylas-calendar/*,oauth-signin-page,participants-text-field,tokenizing-text-field}.jsx`
- `packages/client-app/src/flux/stores/draft-editing-session.js:13,244` -- `import * as ContactStore`; `contact-store.js:284` exports the instance as `default`
- `packages/client-app/src/flux/stores/message-store.js:18-19` -- `import * as ExtensionRegistryNS` and `.default ||`; `extension-registry.js` has named exports only
- Specs: `spec/nylas-component-kit-deep.spec.js` (real kit under Vitest), `spec/modal-popover.spec.jsx`

## Tasks & Acceptance

**Execution:**
- [ ] `src/global/nylas-component-kit-bundle.cjs` (new) or the equivalent -- a CommonJS module the bundle aliases `nylas-component-kit` to, exporting the one shared kit instance (shared with `register-bundled-modules.js`), so esbuild emits property reads at use time -- bundled named imports resolve
- [ ] `scripts/build-renderer.js` -- point the alias at the shim and set `logOverride: { "import-is-undefined": "error" }` -- the build is the check
- [ ] `src/register-bundled-modules.js` -- its `nylas-component-kit` provider returns that same shared instance -- one kit per window
- [ ] `src/flux/stores/draft-editing-session.js`, `message-store.js` -- default import of ContactStore; import ExtensionRegistry's names directly -- no undefined imports
- [ ] specs -- one that builds the bundle (or runs esbuild on a fixture importing `nylas-component-kit`) and asserts no `import-is-undefined`; one for DraftEditingSession contact validation; keep `nylas-component-kit-deep` green

**Acceptance Criteria:**
- Given `node scripts/build-renderer.js`, when it runs on the tree, then it exits 0 with no `import-is-undefined` warning
- Given the dev app (onboarding, no account), when a modal and a popover are opened from bundled code (e.g. `Actions.openModal` and `Actions.openPopover` evaluated over CDP), then the real Modal and FixedPopover components mount (they then throw on `findDOMNode`, fixed in story 13.3, which now carries the 'render with no React errors' check)

## Implementation Notes

- 2026-11-12 (orchestrator, on Josh's go-ahead to proceed on recommendations): the matrix rows "Modal opens" and "Popover opens" can't pass inside this story's Never list. The real Modal and FixedPopover now mount and then throw on their own `findDOMNode` (Modal `_focusImportantElement`; FixedPopover `componentDidMount`, `focusElementWithTabIndex`, `componentWillUnmount`). Both rows moved to story 13.3's check in tickets.toml. This story is verified on kit resolution and mount.

## Plan Change Log

## Review Triage Log

### Pass 1 (quick lens), 2026-11-12

Counts: high 0, medium 3, low 1, false 0, maybe-false 0, rejected 1.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | The `import-is-undefined` error can't see kit names once the bundle aliases the kit to a CJS module | medium | patch | esbuild treats CJS exports as dynamic, so a misspelled or unregistered kit name still builds. Add a build-time name check against the kit's `load()` registrations. |
| 2 | The shim spec runs against a fake kit, so the real NYLAS_RENDERER_BUNDLE guard and the register-bundled-modules provider are untested | medium | patch | The plugin swaps in fake-kit.js. Add specs on the real guard and provider. |
| 3 | (orchestrator plus reviewer) `spec/message-store.spec.js` fails at load in the full run; the stale line-35 mock with the old shape is still there | medium | patch | Full vitest shows 1 failed file, 3531 tests. Remove the stale mock. |
| 4 | The plan's Verification still expects the modal and popover to render with no errors | low | reject | The fix is editing this build's plan. Implementation Notes and AC 2 already record the move to 13.3. |

Verification on 38959689b (orchestrator, 2026-11-12): the build exits 0, and a `Modl` probe fails it (per the implementer). Vitest 3547 pass across 179 files with no failed file (4 known unhandled errors). `check:react` exits 0. Lint shows 1 known error. Dev app over CDP, in all three windows: `require("nylas-component-kit")` gives the same object twice, and `Modal`, `FixedPopover` and `Menu` are functions. All 3 patch findings were fixed.

## Design Notes

A CJS module's named imports compile to `ns.Name` reads at the point of use, not at import time, which keeps the kit's lazy getters lazy. Check the shim doesn't create a second instance: both the bundle and `Module._resolveFilename` (register-bundled-modules) must hand out the same object.

## Verification

**Commands:**
- `cd packages/client-app && node scripts/build-renderer.js` -- expected: exit 0, no `import-is-undefined`
- `pnpm check:react` -- expected: exit 0
- `pnpm --filter nylas-mail exec vitest run` -- expected: no new failures against baseline (3539 passing; 4 known unhandled errors)
- `pnpm lint` -- expected: no new findings (1 known error)
- dev launch with a fresh NYLAS_HOME and `--remote-debugging-port`, then over CDP open a modal and a popover in the onboarding window -- expected: both render and the console has no React errors; quit afterwards
