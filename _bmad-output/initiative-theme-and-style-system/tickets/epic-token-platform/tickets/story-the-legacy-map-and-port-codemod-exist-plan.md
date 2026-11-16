---
title: 'The legacy map and port codemod exist'
type: 'feature'
ticket: '3'
created: '2026-11-16'
status: built
baseline_revision: '7b4d6326f2bcd1424f09e2fb9505c2dea806db32'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
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

## Review Triage Log

Quick lens, 2026-11-16, on the diff since `7b4d6326f`.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | No durable check that every in-scope sheet compiles (AC3) | medium | patch | Only the two fixture specs ship; the all-sheets proof lived in a scratch probe. Adds `spec/port-less-all.spec.js` over every static/ and package `.less` but the layout three. |
| 2 | Inset `left`/`right` stay physical and unreported; asymmetric radius shorthands unreported | medium | patch | AD-9: a physical `left`/`right` in ported CSS fails `pnpm lint`. `logicalDeclaration` only reports `left: 50%` centring. |
| 3 | Any file named `ui-variables.less` is replaced by placeholders | medium | patch | `plugin.mjs` matches by basename, so ui-dark's and ui-ubuntu's `.sheet-toolbar` rules vanish with exit 0. |
| 4 | The root `static/index.less` imports buttons and mixins as `(reference)` | high | patch | Verified: the ported `index.css` drops 49 selectors that plain LESS emits, including all 35 `.btn` rules and `.item-count-box` (used in `outline-view-item.jsx`). |
| 5a | `@standard-shadow`/`@btn-shadow` are `literal` with a role css | low | reject | No kind in the plan's enum fits a shadow; the cost is 6 extra report rows. |
| 5b | Eight no-role font families and weights are `font`, not `literal` | low | patch | Josh's rule makes no-role variables literals; their uses are missing from `report.literals`. Direct correction in the supplement. |
| 6 | `@input-font-size` should be ambiguous | false | reject | The size is shared by seven roles, but the variable's name names one role (`input`, research §2); 0 uses. |
| 7 | CLI requires `--out-dir`/`--report`; the plan shows them optional | low | reject | A missing flag is a loud usage error; optional flags need invented defaults. |
| 8 | Every `translate` is reported, including `translateY` and `translate3d(0,0,0)` | low | patch | Noise in a report the port stories read; a direct regex correction. |
| 9 | Font-size fake units miscompute under `+`/`-`/`round()` | low | reject | No such expression in any in-scope sheet (all arithmetic is `* factor`); a guard adds branches. |

## Verification Results

2026-11-16, on `822b3c5f6`:
- `npx vitest run`: 217 files, 4280 tests pass, no unhandled errors. `spec/port-less-all.spec.js` compiles every static/ and package `.less` except the layout three.
- `node scripts/build-legacy-map.mjs --check`: no drift. Biome: 0 errors. `pnpm check:react`: pass.
- Codemod on the 94 sheets the port stories own: 0 errors. The report is the work list for stories 4–6.
- Extra check: `message-list.less`, `onboarding.less` and `composer.less` were ported and loaded in place of their LESS in a scratch build. A computed-style dump of every element in the composer, thread-popout and onboarding windows was diffed against the LESS build; two LESS runs diff to zero, so the dump is deterministic.
  - Boxes: no element moved or resized in any window. Onboarding: no differences.
  - Same rendering, new spelling: `text-align`/`float` compute as `start`/`end`/`inline-*`; relative colour syntax serialises as `color(srgb …)` within 0.5/255 of the LESS value; a faded gradient starts from transparent black instead of transparent `#fcfcfc` (gradients blend with premultiplied alpha, so it renders the same).
  - One real change, as designed: `@text-color-subtle`/`-very-subtle` were translucent (`rgba(35,31,32,.8/.5)`); their roles `text-secondary`/`text-faint` are solid composites on white (`#4f4c4d`, `#918f90`). Identical on white; slightly different on tinted surfaces. Stories 4–5 should budget for it (research §1, double-application hazard).
