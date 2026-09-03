# aux4/oauth 0.1.4

## Added

- **`clientSecretIn` — HTTP Basic auth for the token endpoint.** `exchange` and
  `refresh` now accept `--clientSecretIn basic|body` (default `body`, resolved
  from flag → user config → bundled config). With `basic`, the client secret is
  sent via `Authorization: Basic base64(clientId:clientSecret)` and omitted from
  the form body — which **X/Twitter confidential clients require** (they return
  `unauthorized_client` for `client_secret_post`). Public clients (no secret) are
  unchanged: PKCE only, no auth header. Existing `body` behaviour is the default,
  so nothing changes for Google and other `client_secret_post` providers.
