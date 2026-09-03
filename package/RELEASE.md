# aux4/oauth 0.1.3

## Added

- **`oauth refresh`** — renew an access token from a refresh token, printing the
  new tokens as JSON. This is the primitive a token broker wraps: the broker holds
  the client secret and calls `refresh` so a thin client that never sees the secret
  can keep a long-lived session alive after its access token expires.

- **`oauth exchange --includeTokens true`** — in addition to the identity
  principal, return the access/refresh/id tokens (with the principal nested under
  `principal`). This makes `exchange` usable as a **token broker** exchange, not
  only an identity (web-login) exchange. Default behaviour is unchanged
  (`--includeTokens false` → principal only).

## Fixed

- Synced the `oauth token` test expectation to the current `aux4/curl` message
  ("Run oauth login or auth add first").
