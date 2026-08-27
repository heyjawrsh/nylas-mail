# Modernization Log — `modernize/current`

Goal: revive the archived Nylas Mail monorepo on a current toolchain (Node LTS, pnpm workspaces, Vitest, Biome), current dependency majors, zero CoffeeScript, coverage-gated passing tests, and current mail/auth protocols. This file is the decision log and the only allowlist for `pnpm outdated` exceptions.

## Baseline (recorded 2026-08-27, from `master` @ a6ec21617)

| Fact | Value |
|---|---|
| Toolchain | Node 6.9.1 / npm 3.10.8 (engines), Babel 6, Grunt, lerna 2.0.0-beta.38 fork, pm2 2.4 |
| Runtime targets | Electron 1.4.15, React 15.4.2, hapi 16, sequelize 3.x (nylas forks), jasmine 2 |
| Source | ~1,090 files: 516 `.es6`, 300 `.jsx`, 154 `.coffee` (all CoffeeScript lives in client-app: 87 src + 96 internal_packages), 119 `.js` |
| Module style | 430 files ESM `import`, 80 files CJS `require` — Babel 6 transpiled on the fly via `babel-node` |
| Specs | client-app 220, client-sync 11, isomorphic-core 7, cloud-api 6, cloud-core 5, cloud-workers 4 |
| Forked/pinned deps | better-sqlite3 (bengotow#…), sqlite3 (tarball fork), sequelize (nylas fork), imap (jstejada fork), simplemde (jstejada fork), debug (emorikawa fork), windows-shortcuts (emorikawa fork), bunyan-prettystream (emorikawa fork), lerna (emorikawa fork) |
| CI | Travis + AppVeyor + AWS EB (.ebextensions), Docker image for cloud |
| Toolchain available | Node 26.3.0 (mise latest), pnpm 11.18.0 |

## Strategy

- pnpm workspaces (`packages/*`) replace lerna bootstrap; keep the `internal_packages/client-sync` symlink via a small postinstall.
- Tests: Vitest per package (jasmine-2 specs migrate mechanically: `jasmine.createSpy` → `vi.fn()`, `spyOn` → `vi.spyOn`, clock → `vi.useFakeTimers()`).
- Server runtime: `tsx` replaces `babel-node` (handles mixed ESM/CJS + extensionless imports, zero config).
- CoffeeScript/CJSX: one-shot mechanical compile to JS, then Biome format + manual repair of hot files.
- Dependency order follows the import graph: isomorphic-core → cloud-core → cloud-api/cloud-workers → client-sync → client-app.
- Protocols: `imap` fork → current IMAP lib (TLS 1.2+/1.3), nodemailer 2 → current major (SMTP + UTF-8/MIME), xoauth2 current (XOAUTH2 refresh), fixture-tested.

## Allowlist (entries allowed in `pnpm outdated`)

_None yet. Every entry needs: dep, reason, replacement candidates evaluated._

## Loop log

### Loop 1 — Baseline
- Created branch `modernize/current`.
- Inventoried manifests, spec counts, module styles, forked deps (table above).
- Toolchain audit: Node 26.3.0 + pnpm 11.18.0 via mise.
- Next: pnpm workspace scaffold; isomorphic-core first target.
