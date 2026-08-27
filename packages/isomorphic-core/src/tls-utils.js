// TLS policy for all mail connections.
//
// 2026 modernization: the old options pinned `SSLv23_method` plus a pile of
// secureOptions flags. Node's TLS stack now does the right thing by default;
// the only floor we enforce is a minimum of TLS 1.2 (TLS 1.3 negotiated
// automatically when the server supports it).
//
// SECURE_TLS_OPTIONS is the default: certificates are verified.
// INSECURE_TLS_OPTIONS exists ONLY for providers with self-signed
// certificates, and must be an explicit opt-in (imap_allow_insecure_ssl).

export const SECURE_TLS_OPTIONS = {
  minVersion: 'TLSv1.2',
  rejectUnauthorized: true,
}

export const INSECURE_TLS_OPTIONS = {
  minVersion: 'TLSv1.2',
  rejectUnauthorized: false,
}
