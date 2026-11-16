---
title: 'The legacy map and port codemod exist'
type: 'feature'
ticket: '3'
created: '2026-11-16'
status: 'ready-for-dev'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-theme-and-style-system/tickets/epic-token-platform/epic-token-platform.md'
  - '{project-root}/_bmad-output/initiative-theme-and-style-system/architecture-theme-and-style-system/architecture-theme-and-style-system.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every port story (4–7) needs a single, agreed translation from the 137 legacy LESS variables to role tokens, and a tool that applies it faithfully. Without them, each story would spell the mapping its own way, and hand-porting 100 sheets would drift.

**Approach:**
- `src/appearance/legacy-map.json` is generated from DESIGN's LESS → role table plus a committed supplement holding the rest and Josh's decisions.
- A codemod compiles a LESS file with the real `less` compiler, with each legacy variable replaced by a placeholder injected where the `ui-variables` import sat. It then post-processes the CSS:
  - map substitution;
  - colour functions as relative colour syntax;
  - font sizes as type roles or scaled literals;
  - physical → logical properties;
  - reduced-motion companions.

  It prints a report of the sites it can't convert. Nothing is ported in this story.

## Boundaries & Constraints

**Always:**
- Josh's decisions (2026-11-16, recorded on #26):
  - Colour functions are emitted as CSS relative colour syntax (`hsl(from var(--role) h s calc(l - 10))`), which matches LESS exactly. `fade`, `fadeout` and `mix` stay `color-mix()`, which is exact.
  - The 34 variables with no role map to their Classic value, with `kind: "literal"` and a `note`.
  - Ambiguous or unmatched font sizes map to `calc(<px> * var(--text-scale))`. Exact matches use `var(--type-<role>-size)`.
  - The codemod writes no `@layer`; the loader owns layers. email-frame stays unlayered.
- Every map `css` references only roles in `src/appearance/theme-compiler/contract.js`, plus `--text-scale`. A spec asserts this.
- The codemod injects placeholders in place of the `ui-variables` import, never by appending, so `onboarding-reset.less`'s local redefinitions survive.
- Mixin imports compile as `(reference)`, so mixin rules aren't duplicated.
- Reduced motion: each rule with `transition` or `animation` gets a companion `@scope ([data-look]) to ([data-look]) { :scope[data-reduced-motion] <sel> { transition: none; animation: none; } }` (AD-1 flag-keyed form).
- `less` 3.13.1 is a pinned devDependency (49359aadd). The codemod is a dev script and never ships.
- Tests ship with the change. Commit locally on `modernize/current` with no attribution lines.

**Never:**
- Porting any real stylesheet, or changing what the app loads (stories 4–6).
- Adding contract roles.
- The layout LESS in ui-taiga, ui-darkside and ui-less-is-more.
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mapped colour | `color: @text-color;` | `color: var(--text-default);` | — |
| Colour function | `darken(@background-secondary, 10%)` | `hsl(from var(--surface-app) h s calc(l - 10))` | — |
| Fade | `fade(@black, 20%)` | `color-mix(in srgb, <css of @black> 20%, transparent)` | — |
| Literal variable | `background: @btn-emphasis-bg-color;` | `background: #5b90fb;` | listed in the report as a literal |
| Font size | `font-size: @font-size-small;` | `var(--type-<role>-size)` or `calc(13px * var(--text-scale))` | — |
| Physical property | `margin-left: 4px; text-align: left; float: right` | `margin-inline-start: 4px; text-align: start; float: inline-end` | — |
| Unconvertible | `left: 50%` with translate, a gradient direction | left unchanged | listed in the report with file:line |
| Motion | `.a { transition: opacity 0.2s }` | the rule plus its reduced-motion companion | — |
| Local override | `onboarding-reset.less` redefines `@text-color` | uses its local value, not the placeholder | — |
| All sheets | every static/ and package `.less` (excluding the three layout packages) | each compiles with zero errors | non-zero exit naming the file |

</frozen-after-approval>

## Code Map

All paths are under `packages/client-app`. The research digest is in the Ringer workdir as `research.md`:
- §1 has the 137-row table: variable, Classic light and dark values, uses, proposed kind/css, and the flagged rows.
- §2 has the font sizes.
- §3 has the feature counts.
- §4 has the prototype findings.
- `tok3/proto.cjs` is a working prototype of approach A.

- `src/appearance/legacy-map.source.json` (new): the supplement. It holds every entry DESIGN's table doesn't give, and the literal and scaled-literal decisions, each with a `note`.
- `scripts/build-legacy-map.mjs` (new): reads DESIGN's "LESS variable → role mapping" table rows plus the supplement, and writes `src/appearance/legacy-map.json`.
  - The output is sorted, with all 137 variables of `static/variables/ui-variables.less`.
  - Each entry is `{ kind: "colour"|"dimension"|"font"|"literal", css, note? }`.
  - It fails if any variable is missing or doubled.
- `src/appearance/legacy-map.json` (generated, committed).
- `scripts/port-less.mjs` (new): `node scripts/port-less.mjs <file.less>... [--out-dir dir] [--report report.json]`.
  - Compiles with `less` 3.13.1 and a plugin that turns colour functions on placeholders into relative colour syntax or `color-mix`, and leaves literal colour maths to LESS.
  - Sends font sizes through a fake unit.
  - Post-passes: map substitution, logical properties, motion companions.
  - Writes CSS and the report (literals used, unconvertible sites, `!important`, `floor` on font sizes).
  - Pure helpers live in `scripts/port-less/*.mjs` so specs can import them.
- Specs:
  - `spec/legacy-map.spec.js`: the map matches its generator, covers all 137 variables, references only contract roles, and has a note on every literal.
  - `spec/port-less.spec.js`: fixture LESS from a static/ sheet and from a package (under `spec/fixtures/port-less/`) gives the expected CSS, with each matrix row as a case.
  - `spec/port-less-all.spec.js` (or a script check): every static/ and package `.less` (excluding the three layout packages) compiles with zero errors.

## Tasks & Acceptance

**Execution:**
- [ ] map lane: the supplement, `build-legacy-map.mjs`, `legacy-map.json` and its spec
- [ ] codemod lane: `port-less.mjs` plus helpers, fixtures and specs. It uses the map.

**Acceptance Criteria:**
- Given the map, when the spec runs, then every `css` references only contract roles, and all 137 variables are present.
- Given the fixture LESS files from static/ and a package, when the codemod runs, then the output equals the expected CSS.
- Given every in-scope `.less`, when the codemod runs, then each compiles with zero errors and the report lists every unconvertible site.

## Verification

**Commands:**
- `cd packages/client-app && npx vitest run` -- expected: exit 0, no unhandled errors
- `node scripts/build-legacy-map.mjs --check` -- expected: no drift
- `node scripts/port-less.mjs <all in-scope .less> --out-dir /tmp/ported --report /tmp/report.json` -- expected: exit 0; the report reviewed
- Ticket extra check: port the three largest package sheets (`message-list.less`, `onboarding.less`, `composer.less`), load each in place of its LESS in a scratch build, and compare the thread-popout, onboarding and composer windows against the LESS build (computed-style diff or screenshot). Expected: no visible change beyond reported sites.
- `npx biome check .`, `pnpm check:react` -- expected: pass
