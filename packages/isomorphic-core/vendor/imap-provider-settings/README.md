# imap-provider-settings (vendored)

Upstream `github:nylas/imap-provider-settings#e9913d1` was deleted from GitHub
and unpublished from npm (2023). This vendored copy preserves the dataset for
offline builds. Vendored 2026-08-27.

Provenance and local changes:

- Base: fork `enterstudio/imap-provider-settings@master` (2017-01-24 snapshot;
  the closest surviving copy — the pinned upstream commit `e9913d1` may have
  contained later changes that are no longer recoverable).
- Local patches (see git history):
  - restored canonical keys the code consumes: `gmail`, `office365` (2026
    endpoint values; `gmail.com` alias points at `gmail`);
  - removed all `smtp_custom_config.tls.ciphers` pins (`SSLv3`) — TLS policy
    now comes from `src/tls-utils.js` floors (TLS 1.2+).

License: upstream LICENSE kept alongside this file.
