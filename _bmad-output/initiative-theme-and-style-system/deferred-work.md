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
