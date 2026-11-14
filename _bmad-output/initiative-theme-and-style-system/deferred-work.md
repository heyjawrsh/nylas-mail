- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-the-app-launches-on-electron-45-and-react-19-plan.md`
  summary: Named imports from nylas-component-kit are undefined inside the renderer bundle, so Modal, CodeSnippet and other kit components imported by bundled src/ files render as undefined.
  evidence: Pre-existing (the old bundles used the same alias). Story 13.1 exposed it by building bundles from source. Opening any modal crashes. Must be fixed before stories 13.2–13.6 can verify in the real app.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-the-app-launches-on-electron-45-and-react-19-plan.md`
  summary: First launch spawns one esbuild child process per uncached internal-package file in each renderer (ESBUILD_WORKER_THREADS=0).
  evidence: By design, since Electron renderers can't use esbuild's worker threads. Precompiling internal packages at build time for packaged builds would remove the cold-start cost.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-the-app-launches-on-electron-45-and-react-19-plan.md`
  summary: Vitest reports 4 unhandled errors from stubs and fixtures (NetworkError, RetinaImg undefined path, getGlobal().isQuitting, TaskQueue dequeue) and exits 1 despite all tests passing.
  evidence: Seen on 2475f8569 with 3504/3504 passing. The getGlobal stub returns {} in both the old and new stubs.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-shared-components-drop-finddomnode-and-string-refs-plan.md`
  summary: HasTutorialTip wraps each tipped plugin button in a `display:contents` span, an extra DOM level against story 13.3's "same DOM" rule. Remove it once the 9 tipped internal_packages buttons have getDOMNode() (stories 13.4–13.5).
  evidence: Child combinators and `:first-child`/`:last-child` now see the span. No stylesheet was found that breaks on it.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-shared-components-drop-finddomnode-and-string-refs-plan.md`
  summary: css-transition-group-compat renders nothing when given more than one child, which SheetContainer can pass on deep sheet stacks and the activity sidebar does pass (Syncback plus Sync).
  evidence: Reported twice by the 13.3 implementer as an existing bug, left unchanged. Needs a repro in the real app with two sync activities, or a sheet stack deeper than one.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-shared-components-drop-finddomnode-and-string-refs-plan.md`
  summary: ListensToMovementKeys never creates its composedRef, so arrow-key forwarding does nothing.
  evidence: Existing bug the 13.3 implementer found, left unchanged.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-the-work-window-loads-and-sync-starts-plan.md`
  summary: No automated check covers client-sync's dependency resolution in the packaged layout, where it resolves only from app.asar/node_modules.
  evidence: The import spec resolves through packages/client-sync/node_modules (dev). A diverging dep version would land in node_modules/client-sync/node_modules, which the FileSet copy can't reach. Add to the 13.8 harness.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-the-work-window-loads-and-sync-starts-plan.md`
  summary: The `document.baseURI` pathname fallbacks in nylas-env.js:27, nylas-exports.js:30 and nylas-component-kit.js:56 don't decode %20, so they would break inside "Nylas Mail.app" if reached.
  evidence: The same bug was fixed in isomorphic-core load-models.js. These fallbacks weren't on the activation path.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-the-work-window-loads-and-sync-starts-plan.md`
  summary: app.asar carries an unused second copy of client-sync at node_modules/client-sync (215 files), and hapi-swagger 17 expects joi 17 while client-sync uses 18.
  evidence: Implementer follow-ups. The local API only starts with NYLAS_START_LOCAL_API=1, so the peer mismatch is a warning today.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-mail-packages-drop-finddomnode-and-string-refs-plan.md`
  summary: Main-window startup logs "TypeError: Cannot read properties of undefined (reading 'killed')" from BufferedProcess in src. No story owns it.
  evidence: Seen on the fixture launch on 4770026e8 and reported by the 13.4 implementer. Needs tracing to the BufferedProcess caller.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-remaining-packages-drop-finddomnode-and-string-refs-plan.md`
  summary: Two plugin backends are dead. keybase.io's `/_/api/1.0/user/autocomplete.json` returns 404 (keybase search finds nothing), and composer-translate's Yandex v1.5 key gets 403 "API key is invalid" (translate always shows its error dialog).
  evidence: Called from the dev app's renderer on 2026-11-13. Lookup and key.asc still return 200. Needs a replacement endpoint or provider, or removal of the feature.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-the-real-app-harness-gates-ci-plan.md`
  summary: The seed's PASSIVE checkpoint fallback (after TRUNCATE retries run out) may throw the same SQLITE_LOCKED it is meant to absorb, so the #13 flake could return under heavy load.
  evidence: maybe-false (medium if true). 28 seeds passed, all through TRUNCATE. To settle it, hold a lock past the ~1.5 s retry budget and see whether `wal_checkpoint(PASSIVE)` throws.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-refactor-sweep-plan.md`
  summary: Convert the 24 remaining pre-Electron-6 showMessageBox calls (#14). 9 index reads become showMessageBoxSync; 3 callbacks become .then(({response})); application.js:80/316/731 run in main before quit or relaunch and need Sync.
  evidence: Split from 13.9 to keep it to one goal (a clean gate). Every site is mechanical; the list comes from the 13.9 scoping pass at ac6a3807a.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-refactor-sweep-plan.md`
  summary: css-transition-group-compat renders null for more than one child (activity-sidebar.jsx:94/109, sheet-container). It needs one CSSTransition per keyed child.
  evidence: Split from 13.9. It predates the initiative (c9e7cd333, 2026-08-27). Fixing it needs a two-children spec plus an e2e repro with two sync activities.
- source_plan: `_bmad-output/initiative-theme-and-style-system/tickets/epic-platform-baseline/tickets/story-refactor-sweep-plan.md`
  summary: app.asar ships client-sync twice. The workspace dependency (client-app package.json:31) puts it in node_modules/client-sync, and the electron-builder.yml FileSet (:42-48) copies it again. Exclude node_modules/client-sync except its nested node_modules.
  evidence: Split from 13.9. Confirming it needs a test dist and `asar list`, plus the packaged e2e run, which is packaging work rather than cleanup.
