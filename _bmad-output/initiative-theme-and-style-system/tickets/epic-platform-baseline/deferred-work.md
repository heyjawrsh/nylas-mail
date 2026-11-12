# Deferred work — epic-platform-baseline

Found while launching the app for story 1 (Electron 45 + React 19, onboarding
window). None of it is on the onboarding render path, so story 1 leaves it.

## React 19 (stories 2–6)

- `src/components/unsafe-component.jsx` still uses `ReactDOM.render` /
  `unmountComponentAtNode`; `InjectedComponent` renders through it.
- `css-transition-group-compat.jsx` now passes `nodeRef` when its child is a
  DOM element. A component child still makes react-transition-group call
  `findDOMNode`, which React 19 removed.
- The rest of the `findDOMNode`, string-ref, legacy-context and
  `componentWill*` inventory is untouched outside the onboarding path.
- esbuild warns at bundle time that named imports from `nylas-component-kit`
  are always `undefined` inside the bundle (the kit file is ESM-flagged by
  `import.meta`, so its `module.exports` assignment is invisible to esbuild).
  Bundled code that does `import { X } from "nylas-component-kit"` gets
  `undefined`. Unbundled packages are fine: they resolve the kit at runtime.

## Work window and sync (not on the onboarding path)

- `worker-ui` fails to activate: `$n.Rx` is `rxjs`, but the package expects
  rx-lite's `Rx.Observable.fromQuery`.
- `DatabaseStore` spawns `database-agent.js` from `path.dirname(__filename)`,
  which is `static/` inside the bundle, so the agent process can't start.
- `internal_packages/client-sync` is rejected as an INVALID PACKAGE (its
  `package.json` has no `engines.nylas`), so the sync engine never loads. The
  packaged copy also ships without client-sync's own dependencies.

## Platform (story 7 and later)

- `nylas://` URLs are blocked by CORS from `file://` pages under Electron 45
  (the scheme isn't registered as privileged), so the Nylas Pro fonts don't
  load and onboarding falls back to the system font.
- electron-builder writes `app-update.yml` into the app. Squirrel/auto-update
  is story 7.
- The renderer bundles are built without `NODE_ENV=production`, so the packaged
  app runs React's development build.
- In dev mode Bluebird can't switch long stack traces on (the bundled module
  graph creates promises first); it now logs a warning instead of crashing.

## Tooling

- client-app's coverage gate (60/45) was already red before this story
  (~51% lines); it stays red.
- The package is named `nylas-mail`, so `pnpm --filter client-app …` matches
  nothing. Use `pnpm --filter nylas-mail …` or `--filter ./packages/client-app`.
- `.nylas-smoke-home/config.json` (tracked) fails `biome check` formatting —
  pre-existing.
