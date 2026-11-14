---
title: 'Linux packages run on Ubuntu 22.04'
type: 'bugfix'
ticket: '12'
created: '2026-11-14'
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
- [ ] `packages/client-app/scripts/check-glibc-floor.mjs`: the floor check -- the guard
- [ ] `packages/client-app/scripts/dist.mjs`: the Linux package check, and refusing on non-Linux hosts -- the local path
- [ ] `packages/client-app/scripts/dist-linux-docker.sh`: the Docker package build -- local `dist:linux`
- [ ] `packages/client-app/e2e/linux-deb-docker.sh`: the stock 22.04 install and harness -- the proof
- [ ] `.github/workflows/dist.yml`: the Linux job in the pinned container, from source -- CI
- [ ] specs:
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

## Verification

**Commands:**
- `pnpm check:react` and `pnpm check:public-build` -- expected: exit 0
- `npx biome check .` -- expected: no errors
- `cd packages/client-app && npx vitest run` -- expected: exit 0, no unhandled errors, ≥3932 passing
- `actionlint .github/workflows/*.yml` -- expected: exit 0
- `packages/client-app/scripts/dist-linux-docker.sh` -- expected: deb and AppImage built; glibc check passes
- `packages/client-app/e2e/linux-deb-docker.sh` -- expected: install succeeds; 18 passed
- `pnpm --filter nylas-mail build:e2e && pnpm --filter nylas-mail e2e` -- expected: 18 passed (mac unchanged, background mode)
