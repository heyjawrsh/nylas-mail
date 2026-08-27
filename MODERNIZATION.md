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

### Loop 2 — Workspace scaffold (commit 88f96aefd)
- Root manifest: pnpm 11 workspaces (`packages/*`), engines `>=24`, MIT, scripts test/lint/format; devDeps vitest 4.1.11 / tsx 4.23.12 / biome 2.5.10; root `.babelrc` deleted; lerna-era postinstall replaced by `scripts/link-workspaces.mjs` (client-sync → internal_packages symlink).
- Biome wired at root (`biome.json`); `pnpm lint` exit-0 arrives with the migrations (legacy code still trips it).
- Toolchain audit: Node 26.3.0 + pnpm 11.18.0 via mise; branch `modernize/current` cut from master.

### Round 1 — Ringer swarm (run `nylas-mail-modernize`)
- Engine: codex GPT-5.6 Sol per scoreboard (proven code-fix, 42 tasks / 86% pass; user unavailable → standing "educated guesses" instruction). HUD at http://127.0.0.1:8700.
- Lanes: `isomorphic-core-convert` (pilot: vitest+joi17+sequelize6+nodemailer7, .es6→.js) and `coffee-migrate-message-list` (19 files, decaffeinate one-shot + esbuild parse gate). Gates: lint clean, baseline 2/2 correctly-fail, prove-fail 2/2 proved.
- Dep decisions: drop atob/btoa/promise-props/promise.prototype.finally (native); joi→17, sequelize→6, nodemailer→7, rx-lite→rxjs 7 if imported.
- **Protocol port design (my lane, next round)**: keep IMAPConnection/IMAPBox public API frozen, reimplement on `imapflow`; TLS floors `minVersion: TLSv1.2` + `rejectUnauthorized: true` by default (the old "insecure by default" backcompat branch dies; explicit opt-in only); XOAUTH2 keeps xoauth2 generator feeding imapflow `accessToken`; fixture/mocked tests only (no live servers).
- Allowlist (pre-declared): `imap-provider-settings` (provider dataset, no registry equivalent — vendor later); `imap` fork pending my imapflow port (temporary).
