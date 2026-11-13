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
