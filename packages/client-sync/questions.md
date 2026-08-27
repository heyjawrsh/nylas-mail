# Outside-package blocker

The root `pnpm-workspace.yaml` has invalid placeholder values under `allowBuilds`:

```yaml
allowBuilds:
  '@scarf/scarf': set this to true or false
  esbuild: set this to true or false
  sqlite3: set this to true or false
  unix-dgram: set this to true or false
```

pnpm 11 treats these strings as build-script denials, so the outer `pnpm install`
fails with `ERR_PNPM_IGNORED_BUILDS` before the client-sync suite can run. The
workspace owner needs to replace them with booleans (approve `esbuild`, `sqlite3`,
and `unix-dgram`; deny `@scarf/scarf`):

```yaml
allowBuilds:
  '@scarf/scarf': false
  esbuild: true
  sqlite3: true
  unix-dgram: true
```

This cannot be fixed within `packages/client-sync/**`; pnpm reads build approvals
from the workspace root configuration during a root install.
