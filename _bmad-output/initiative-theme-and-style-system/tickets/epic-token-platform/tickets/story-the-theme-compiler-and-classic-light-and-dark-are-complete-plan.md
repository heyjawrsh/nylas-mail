---
title: 'The theme compiler and Classic light and dark are complete'
type: 'feature'
ticket: '2'
created: '2026-11-16'
status: 'ready-for-dev'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'medium'
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

**Problem:** The compiler from story 1 handles only colours and has no schema validation, no role contract and no gate. Classic defines one role. Nothing stops a built-in theme from shipping incomplete, and type and shadow roles have no path into CSS.

**Approach:** Complete `src/appearance/theme-compiler/` to AD-5, AD-6 and AD-31, and port Classic light and dark with every contract role:
- jsonc-parser for token lines;
- Ajv against the vendored DTCG 2025.10 schema plus the role contract;
- typed serialisation through culori;
- alias resolution;
- the report codes;
- missing-role fill;
- the build gate.

ThemeManager maps `ui-dark` to Classic dark the way `ui-light` already maps to Classic light. The compiled sheet ships in the asar through the existing renderer build.

## Boundaries & Constraints

**Always:**
- Josh's decisions (2026-11-16, #26):
  - A none shadow is written as one transparent, zero-offset, zero-blur shadow, and the compiler emits `none`.
  - Classic typography is ported from the legacy LESS, with families on the system stack (no Nylas-Pro, AD-17).
  - The fallback stacks:
    - sans: `system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans CJK SC", "Noto Sans Arabic", "Noto Sans Hebrew", sans-serif`
    - mono: `ui-monospace, "SF Mono", Menlo, Consolas, "Noto Sans Mono", monospace`
  - A named temporary allowance lets `classic` lack `light-hc` and `dark-hc` until story 12. It warns on every build.
- Colour `hex` is six digits, and alpha travels in `alpha` (the schema decides). Alpha below 1 is emitted as `#rrggbbaa`.
- Every value is type-checked by the compiler against its resolved `$type`, because the schema doesn't check types inherited from a group. EXPERIENCE's drift loses to the spine (#26).
- The compiler stays pure (text in, `{css, report}` out) and deterministic. It loads the vendored schema with a JSON `require`, never over the network.
- Report entries are `{code, level, path, line, message}`. Codes: `parse`, `schema`, `forbidden-value`, `invalid-id`, `alias-cycle`, `too-large`, plus warning kinds for unknown tokens and failing standard-contrast pairs.
- Classic values are exactly DESIGN's Classic light and dark columns. D values are written literally, as the hexes DESIGN gives.
- Tests ship with the change. Commit locally on `modernize/current` with no attribution lines.

**Never:**
- The `-hc` variants (story 12), derivation for third-party files, ThemeLibrary, `duplicate-id`/`reserved-id`/`missing-file` (load-time), the legacy map, or porting LESS rules.
- Radius or spacing tokens: those are style tokens (AD-9).
- Changing standard-contrast values to pass AA.
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Classic compiles | `classic.tokens.json` (light and dark, every role) | CSS for both variants with every contract role. Only standard-pair warnings and the hc-allowance warning are reported | — |
| Malformed JSON | text with a bad comma | `parse` error with its line | build exits 1 |
| Schema failure | a token shape the DTCG schema rejects | `schema` error with the token's line | build exits 1 |
| Forbidden value | `url(`, `var(`, `;` or `}` in a value, or an unparseable colour | `forbidden-value` with its line | build exits 1 |
| Alias cycle | `{a}` → `{b}` → `{a}` | `alias-cycle` with its line | build exits 1 |
| Too large | file over 256KB | `too-large` | build exits 1 |
| Built-in missing a role | Classic without `text-faint` | gate failure naming the role and variant | build exits 1 |
| Third-party missing a role | an input passed as non-built-in, missing roles | filled from Classic, listed in `report.filledRoles` | — |
| None shadow | transparent zero shadow | `--shadow-accent: none` | — |
| Type size | `{value:14,unit:"px"}` | `calc(14px * var(--text-scale))` | — |

</frozen-after-approval>

## Code Map

All paths are under `packages/client-app`.

- `src/appearance/theme-compiler/index.js` (extend), with helpers in that folder:
  - **Parsing:** `jsonc-parser` `parseTree` gives a path → offset → line map. A parse error becomes `parse` with its line.
  - **Validation:** Ajv 8 + ajv-formats on `vendor/dtcg-2025.10-format.json` (already committed). Each Ajv error maps to the line of its instance path.
  - **Role contract:** a new `contract.js` holds the role list:
    - 48 colour roles;
    - `shadow-card`, `shadow-soft` and `shadow-accent`;
    - 19 type roles × `family`, `size`, `weight`, `line-height`, `letter-spacing`.

    Each entry has its `$type`. Role names come from the research digest at `scratchpad/tok2-research.md` §1 and DESIGN › Role tokens and Typography.
  - **Aliases:** resolves `{a.b}` aliases, reporting `alias-cycle`.
  - **Serialising (AD-31):**
    - colour via culori, to `#rrggbb` or `#rrggbbaa`;
    - dimension, px/rem only (type sizes `calc(<px> * var(--text-scale))`);
    - fontFamily as escaped strings plus the fallback stack;
    - fontWeight as a number, with named weights mapped by the DTCG table;
    - number: line height unitless, letter spacing `<n>em`;
    - shadow as `box-shadow` parts, comma-joined, with the transparent zero shadow emitted as `none`.
  - **Blacklist:** anything else is `forbidden-value`.
  - **Exports:** `compileTheme(text, {builtIn, classicTokens})` and a pure `gate(report, theme)`.
  - **Built-ins:** missing roles fail.
  - **Others:** missing roles are filled from `classicTokens` and listed.
  - **Contrast:** the gate evaluates contrast pairs (research digest §4) with culori `wcagContrast`. A failing standard pair is a warning, and the label pair `text-strong` on `surface-panel` under 4.5 is an error.
- `scripts/build-themes.mjs`:
  - compiles built-ins with `builtIn: true` and runs the gate;
  - holds `HC_ALLOWANCE = { classic: "story 12" }`, printing a warning for each allowed missing group;
  - writes nothing for a theme with errors.
- `static/themes/classic.tokens.json`:
  - every role for `light` and `dark`, with DESIGN's Classic values (§1a and §1b of the digest);
  - shadows in DTCG form (the none shadow as a transparent zero shadow);
  - typography from `static/variables/ui-variables.less` and the stylesheets that style each element today. Each type token's `$description` names its LESS source.
- `src/theme-manager.js`: `ui-dark` → `data-theme="classic" data-variant="dark"`, `ui-light` → light, any other theme → none, as today.
- Specs:
  - a compiler spec for every error code with its line, typed serialisation for each type, alias resolution, fill, the gate (a built-in missing a role, the label pair, standard pairs as warnings, the allowance), determinism and Classic compiling clean;
  - a build-themes spec for the allowance warning and no write on error;
  - theme-manager covering the dark mapping.
- e2e `look-runtime.spec.mjs`: also check a type role (`--type-body-reading-size` is a `calc(`) and a shadow role on `<html>`.

## Tasks & Acceptance

**Execution:**
- [ ] compiler lane: `theme-compiler/*` (parse, schema, contract, aliases, serialise, fill, gate), `build-themes.mjs`, and specs
- [ ] tokens lane: the complete `classic.tokens.json` (light and dark), the ThemeManager dark mapping and its spec, and the look-runtime type and shadow checks

**Acceptance Criteria:**
- Given each error kind, when compiled, then the report carries its code and the token's line, and the build exits 1.
- Given `classic.tokens.json`, when built, then both variants emit every contract role, and the gate passes with only standard-pair and hc-allowance warnings.
- Given a built-in missing a role, when built, then the gate fails naming it.
- Given the packaged app, when it starts on `ui-light`, then the compiled Classic light sheet supplies `--surface-app`, a type role and a shadow role. On `ui-dark` it supplies Classic dark.

## Verification

**Commands:**
- `pnpm check:react`, `pnpm check:public-build`, `npx biome check .` -- expected: pass, 37 warnings baseline
- `cd packages/client-app && npx vitest run` -- expected: exit 0, no unhandled errors (cold cache too)
- `node scripts/build-themes.mjs` -- expected: classic.css with both variants; the hc-allowance warning
- `pnpm --filter nylas-mail build:e2e && pnpm --filter nylas-mail e2e` -- expected: all pass, background mode
- `packages/client-app/e2e/linux-docker.sh` -- expected: pass. Don't commit while it runs (it copies `axe-baseline.json` back)
- push, then CI green
