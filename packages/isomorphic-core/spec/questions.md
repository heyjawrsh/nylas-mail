# Production questions found while hardening tests

- `convertSmtpError` calls `SMTPConnectionEndedError(err)` without `new` for
  `"connection closed"` / `"socket closed"` errors. Because it is an ES class,
  that path throws `TypeError` instead of returning an SMTP error. Should this
  be `return new SMTPConnectionEndedError(err)` (while preserving `err.code`)?
- `IMAPBox.closeBox({expunge})` accepts an `expunge` option but does not use it;
  both values call `imap.mailboxClose()` identically. Is that intentional after
  the imapflow migration?
- `trimTo` evaluates `window || global` directly. In a Node environment where
  `window` is undeclared this throws `ReferenceError`; should it use
  `typeof window !== "undefined"` as `env-helpers` does?
- The root `pnpm-workspace.yaml` has `allowBuilds` entries whose values are the
  placeholder string `set this to true or false`, so pnpm refuses the required
  `esbuild` and `sqlite3` build scripts before the test suite starts. This must
  be corrected outside the spec-only ownership boundary (for example, approve
  those packages with boolean `true` values using the pnpm version's supported
  configuration).
