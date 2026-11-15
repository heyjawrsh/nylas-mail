---
title: 'Linux packages run on Ubuntu 22.04'
type: 'bugfix'
ticket: '12'
created: '2026-11-14'
status: done
baseline_revision: 'b79f3ef97590130c6ce1397bdd351e94575dc2e8'
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

**Problem:** The Linux packages ship a prebuilt `sqlite3` binary that needs glibc 2.38. On Ubuntu 22.04, Debian 12 or anything older, the work window fails with `GLIBC_2.38 not found`, so sync never starts (#21). Nothing stops a Linux package from picking up a newer glibc floor again.

**Approach:** Build the Linux packages inside the pinned Ubuntu 22.04 `electronuserland/builder` image, with native modules compiled from source. This applies to the dist workflow's Linux job and the local `dist:linux` path. Add a check that fails a Linux package when any of its binaries needs a glibc newer than 2.35. Prove it by installing the built .deb on a stock Ubuntu 22.04 image and running the harness against it there.

## Boundaries & Constraints

**Always:**
- The floor is glibc 2.35 (Ubuntu 22.04 LTS, which also covers Debian 12). Josh delegated this decision, and it's recorded on #21.
- Use one pinned builder image digest everywhere, the same one `e2e/linux-docker.sh` uses. A spec fails if the copies drift.
- Local Linux builds use a clean `git archive HEAD` copy in Docker and never touch the host's `node_modules`.
- `dist:mac`, `dist:win`, `build:e2e` and the CI e2e job keep their current behaviour.
- Tests ship with the change.
- Commit locally on `modernize/current` with no attribution lines, and never push. Refs #21.

**Never:**
- Raising the floor, or documenting glibc 2.38 as the minimum.
- Snap, Flatpak, rpm, arm64 Linux, signing or auto-update.
- Pushing or triggering CI. The workflow is checked with actionlint, and a person runs it.
- The keybase hang (#23), #19 or #20.
- Editing ticket files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Package within the floor | every ELF file in `linux-unpacked` needs glibc 2.35 or older | the glibc check exits 0 | — |
| Package over the floor | one `.node` file needs `GLIBC_2.38` | the check exits non-zero, naming the file and version | — |
| Non-ELF files | `.js`, `.asar`, `.png` alongside binaries | they're skipped, not reported | — |
| `dist:linux` on macOS | `pnpm --filter nylas-mail dist:linux` on a mac host | it stops before building and points at the Docker script | exits non-zero |
| Stock 22.04 install | the built .deb on `ubuntu:22.04` | `apt-get install ./…deb` succeeds, the harness passes, and the work window shows no GLIBC error | — |

</frozen-after-approval>

## Code Map

- `packages/client-app/e2e/linux-docker.sh`: the pinned image digest and the `npm_config_build_from_source=true` pattern to reuse. It also has the runtime libraries apt list and the non-root `runuser` harness run. Leave its behaviour alone.
- `packages/client-app/scripts/dist.mjs`:
  - For `linux` without `--dir`, run the new glibc check on `dist/linux-unpacked` after the public-build check. A failure fails the run.
  - When the host isn't Linux, `dist:linux` exits 2 with a message naming `scripts/dist-linux-docker.sh`.
  - `host --dir` (build:e2e) doesn't run the check. CI e2e builds on ubuntu-latest with prebuilds, and that's fine for the harness.
- New `packages/client-app/scripts/check-glibc-floor.mjs <dir> [--max 2.35]`:
  - Walks `<dir>` and picks out ELF files by their `\x7fELF` magic.
  - Runs `objdump -T` on each, parses the `GLIBC_x.y` versions, and fails, naming the file and the highest version, when one is over the max.
  - Exports the parse and compare functions for the spec.
  - The builder image has `objdump` and `readelf`.
- New `packages/client-app/scripts/dist-linux-docker.sh`:
  - Copies `git archive HEAD` into the pinned image with `npm_config_build_from_source=true`.
  - Runs `corepack enable`, `pnpm install --no-frozen-lockfile`, then `pnpm --filter nylas-mail dist:linux`.
  - Copies the `.deb` and `.AppImage` back to `packages/client-app/dist/`.
- New `packages/client-app/e2e/linux-deb-docker.sh`, the stock-22.04 proof:
  - Stage 1, in the builder image on a fresh archive: `pnpm install` only, with build-from-source, for the harness's `node_modules`.
  - Stage 2, in `ubuntu:22.04` pinned by digest:
    - Install Node 24 and xvfb, then `apt-get install -y ./dist/nylas-mail_*_amd64.deb`, which pulls the deb's own dependencies.
    - Add the extra runtime libraries only if launch shows they're needed, and record which ones.
    - Run `node e2e/run.mjs` as a non-root user under xvfb, with `E2E_APP_PATH=/opt/Nylas Mail/nylas-mail` (confirm the path from the deb).
    - Pass the qemu flags from `linux-docker.sh` in `E2E_LAUNCH_ARGS`.
- `.github/workflows/dist.yml`:
  - Move Linux out of the matrix into its own job, `container:` the pinned image, with `npm_config_build_from_source: "true"` and corepack instead of the pnpm and setup-node actions.
  - Keep the artifact upload and `CSC_IDENTITY_AUTO_DISCOVERY`.
  - mac and win stay as they are.
- The harness already honours `E2E_APP_PATH` (`e2e/app.mjs:38`). No fuses are set in `electron-builder.yml`, so the packaged app keeps `EnableNodeCliInspectArguments`.
- The reference screenshot tests are skipped in check mode. The Linux axe baseline came from the builder image, so a stock image with other fonts may differ. If it does, record it in Implementation Notes; don't rewrite the baseline.

## Tasks & Acceptance

**Execution:**
- [x] `packages/client-app/scripts/check-glibc-floor.mjs`: the floor check -- the guard
- [x] `packages/client-app/scripts/dist.mjs`: the Linux package check, and refusing on non-Linux hosts -- the local path
- [x] `packages/client-app/scripts/dist-linux-docker.sh`: the Docker package build -- local `dist:linux`
- [x] `packages/client-app/e2e/linux-deb-docker.sh`: the stock 22.04 install and harness -- the proof
- [x] `.github/workflows/dist.yml`: the Linux job in the pinned container, from source -- CI
- [x] specs:
  - the parse and compare logic against captured `objdump -T` text (over, at and under the floor, plus a non-glibc symbol)
  - ELF detection skips non-ELF files
  - `dist.mjs` refuses `linux` on a non-Linux host
  - the image digest is the same in both shell scripts and `dist.yml` -- proof

**Acceptance Criteria:**
- Given a clean tree, when `scripts/dist-linux-docker.sh` runs, then a deb and an AppImage land in `dist/`, and the public-build and glibc checks both pass inside the container.
- Given that deb, when `e2e/linux-deb-docker.sh` runs, then it installs on stock Ubuntu 22.04 and the harness passes there.
- Given the repo, when `actionlint` checks both workflows, then it exits 0.

## Design Notes

The guard checks the built package, not the build host. A source build on a 24.04 runner can still pull in 2.38-and-later symbols (#21), so only the shipped binaries can tell. Running it on every Linux package build turns the floor into a rule CI enforces.

## Implementation Notes

- The deb installs to `/opt/Nylas Mail/nylas-mail`. The glibc check, run by hand on the shipped deb, passes on all 14 ELF files at glibc 2.35 or older.
- `objdump` reports a static binary in two ways ("no dynamic symbol table" and "not a dynamic object"). The check accepts both (c34079eee).
- The stock-22.04 run found that the deb didn't start: libgbm1 and libasound2 were missing from the default Depends. They're now in `deb.depends` (677331a9d). The proof script adds no libraries.
- The seed's top-level `import "electron"` downloaded the dev binary on every proof run, and one run hung for 40 minutes. It's lazy now (dad2e0176).
- **AC2 is partly met.** On stock 22.04 the harness passes 17 tests and fails 1: the default window's axe baseline, with color-contrast at 7 nodes against a baseline of 4. That baseline came from the builder image. Matching Playwright's nine font packages didn't change the count, so fonts aren't the cause. Per this plan, the baseline isn't rewritten. Josh to decide.
- One run hit `qemu-x86_64: QEMU internal SIGBUS` at launch (Docker x86 emulation on arm64). The rerun didn't.
- Found, not fixed: the x64 package ships `@esbuild/linux-arm64` (#25) and a musl better-sqlite3 prebuild.

## Review Triage Log

| # | Lens | Finding | Verdict | Route | Evidence |
|---|------|---------|---------|-------|----------|
| 1 | quick | `dist:linux` on macOS builds the renderer before refusing | medium | patch | `package.json:20`, where `predist:linux` runs `build-renderer.js` before `dist.mjs` gets to its host check; the spec calls `dist.mjs` directly, so it misses the pnpm path. |
| 2 | quick | stage 2 may lack libasound2 and libgbm1 | high | patch | The stock-22.04 run on 5f3b35a9b failed to launch: `libgbm.so.1: cannot open shared object file`. `ldd` on the installed binary finds libgbm.so.1 and libasound.so.2 missing. A product bug: the fix is `deb.depends` in electron-builder.yml, not extra libraries in the proof script. |
| 3 | quick | `DIST_DOCKER_IMAGE` lets a package build use any image | low | patch | `dist-linux-docker.sh:19`; shipped packages must come from the pinned digest, and the spec checks only the default. |

## Verification

**Commands:**
- `pnpm check:react` and `pnpm check:public-build` -- expected: exit 0
- `npx biome check .` -- expected: no errors
- `cd packages/client-app && npx vitest run` -- expected: exit 0, no unhandled errors, ≥3932 passing
- `actionlint .github/workflows/*.yml` -- expected: exit 0
- `packages/client-app/scripts/dist-linux-docker.sh` -- expected: deb and AppImage built; glibc check passes
- `packages/client-app/e2e/linux-deb-docker.sh` -- expected: install succeeds; 18 passed
- `pnpm --filter nylas-mail build:e2e && pnpm --filter nylas-mail e2e` -- expected: 18 passed (mac unchanged, background mode)

**Results** (on dad2e0176):
- `check:react`, `check:public-build`, Biome and actionlint: pass, with no new warnings (Biome has the same 37 as the baseline)
- Vitest: 3975 passed, no unhandled errors
- `dist-linux-docker.sh`: deb and AppImage built; public-build and glibc checks pass in the container (14 ELF files at 2.35 or older)
- `linux-deb-docker.sh`: installs on stock ubuntu:22.04 and the app starts; 17 passed and 1 failed (the default-window axe color-contrast count, 7 against 4; see Implementation Notes)
- Mac `build:e2e` plus `e2e`: 18 passed, 9 skipped, background mode
