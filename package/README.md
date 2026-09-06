# aux4/oauth

A provider-agnostic OAuth2 client engine for the command line. It runs the browser-based authorization-code-with-PKCE flow against **any** OAuth2 / OIDC provider, identified only by its endpoint URLs and your client credentials. The engine knows no third-party provider names — a provider is just a free-form `--provider` label that also becomes the key under which the token is stored.

The interactive CLI commands (`login`, `token`, `status`, `logout`) delegate the full flow, token storage, and refresh to [aux4/curl](https://hub.aux4.io/r/public/packages/aux4/curl), so there is no new credential handling there — only endpoint resolution.

For server-side web applications, two additional headless primitives — `authorize-url` and `exchange` — implement the authorization-code-with-PKCE flow as plain JSON-producing commands (no browser, no local callback server). They use the same endpoint resolution and are intended to be shelled out to by a web app's sign-in and callback handlers.

## Installation

```bash
aux4 aux4 pkger install aux4/oauth
```

This also installs the `aux4/curl` and `aux4/config` dependencies.

## Quick Start

Log in to the built-in `aux4` provider — you supply only your client credentials, and the package supplies the endpoint URLs:

```bash
aux4 oauth login --provider aux4 --clientId YOUR_CLIENT_ID --clientSecret YOUR_CLIENT_SECRET
```

Log in to any other provider by passing its endpoints:

```bash
aux4 oauth login --provider acme \
  --authUrl https://acme.example/oauth/authorize \
  --tokenUrl https://acme.example/oauth/token \
  --scopes openid,email \
  --clientId YOUR_CLIENT_ID --clientSecret YOUR_CLIENT_SECRET
```

After login, use the stored token in scripts:

```bash
TOKEN=$(aux4 oauth token --provider aux4)
curl -H "Authorization: Bearer $TOKEN" https://api.aux4.io/me
```

## Endpoint Resolution

Every login resolves endpoint URLs, scopes, and credentials with this precedence:

1. **Explicit flag** — `--authUrl`, `--tokenUrl`, `--userinfoUrl`, `--scopes`, `--clientId`, `--clientSecret`. Flags always win.
2. **User config** — a `config.yaml` passed via `--configFile`, keyed by provider name. Uses `aux4/config`.
3. **Bundled config** — endpoints shipped with the package (only the `aux4` provider; URLs only).

If, after resolution, `authUrl` or `tokenUrl` is empty, `login` fails with exit code 1 and a message telling you to pass the URL flags or install a provider package.

### Built-in `aux4` provider

The package bundles exactly one first-party provider, `aux4`, with the endpoints of its own identity provider:

| Field | Value |
|-------|-------|
| `authUrl` | `https://sso.aux4.io/authorize` |
| `tokenUrl` | `https://sso.aux4.io/token` |
| `userinfoUrl` | `https://sso.aux4.io/userinfo` |
| `scopes` | `openid,email,profile` |

It bundles **URLs only**. The `clientId` and `clientSecret` are per-app and always supplied by you — they are never bundled. For any provider name other than `aux4`, the bundled config has nothing, so you must pass `--authUrl`/`--tokenUrl` (or install a provider package, see below).

### User config

To avoid repeating endpoints, put per-provider settings in a `config.yaml` and pass it with `--configFile`. Keys are the provider name:

```yaml
config:
  acme:
    authUrl: https://acme.example/oauth/authorize
    tokenUrl: https://acme.example/oauth/token
    scopes: openid,email
    clientId: secret://1password/Work/acme/clientId
    clientSecret: secret://1password/Work/acme/clientSecret
```

```bash
aux4 oauth login --provider acme --configFile config.yaml
```

Explicit flags still override any value found in the config file.

**Note:** Never hardcode `clientId`/`clientSecret` in scripts. Pass them as flags, the `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` environment variables, or `secret://` references resolved from a configured secret provider.

### Third-party provider packages

Because the engine is provider-agnostic, third-party providers are not bundled. A community provider package supplies a thin wrapper that calls `aux4 oauth login` with that provider's endpoints, leaving the user to supply credentials. For example, a `community/oauth-google` package would depend on `aux4/oauth` and define a command like:

```bash
aux4 oauth login --provider google \
  --authUrl https://accounts.google.com/o/oauth2/v2/auth \
  --tokenUrl https://oauth2.googleapis.com/token \
  --scopes openid,email,profile \
  --clientId "$CLIENT_ID" --clientSecret "$CLIENT_SECRET"
```

No per-provider code lives in `aux4/oauth` — provider packages contribute only URLs.

## Commands

### oauth login

Authenticate with a provider and store the token in `.oauth/<provider>.json`. The provider's endpoints, scopes, and credentials are resolved as described in [Endpoint Resolution](#endpoint-resolution).

```bash
aux4 oauth login --provider acme --authUrl https://acme.example/oauth/authorize --tokenUrl https://acme.example/oauth/token --clientId abc --clientSecret xyz
```

Options:

- `--provider` — Provider name / token-file key (required).
- `--authUrl` — Authorization endpoint URL.
- `--tokenUrl` — Token exchange endpoint URL.
- `--userinfoUrl` — Userinfo endpoint URL (resolved; reserved for the web-login flow).
- `--scopes` — Comma-separated scopes.
- `--clientId` — OAuth client ID. Also read from `OAUTH_CLIENT_ID` or user config (including `secret://` references).
- `--clientSecret` — OAuth client secret. Also read from `OAUTH_CLIENT_SECRET` or user config (`secret://`).
- `--callbackPort` — Local callback server port (default: `9876`).
- `--tokenFile` — Custom token file path (default: `.oauth/<provider>.json`).
- `--configFile` — Path to a user `config.yaml` with per-provider settings.

### oauth token

Print a valid access token, refreshing it automatically if it has expired.

```bash
aux4 oauth token --provider aux4
```

### oauth status

Show the token status (valid/expired), scopes, expiry, and token file path.

```bash
aux4 oauth status --provider aux4
```

### oauth logout

Remove the stored token for the provider.

```bash
aux4 oauth logout --provider aux4
```

### oauth authorize-url

Build a PKCE authorization URL for the server-side web login flow. This is a headless primitive — it generates the PKCE values and prints a JSON object; it does not open a browser or run a local server. Resolve `authUrl` and `scopes` with the usual precedence (flag > user config > bundled).

```bash
aux4 oauth authorize-url --provider aux4 \
  --clientId YOUR_CLIENT_ID \
  --redirectUri https://app.example/auth/callback
```

Output:

```json
{
  "url": "https://sso.aux4.io/authorize?response_type=code&client_id=...&code_challenge=...&code_challenge_method=S256",
  "codeVerifier": "<base64url>",
  "state": "<state>"
}
```

The web application redirects the user's browser to `url` and stores `codeVerifier` and `state` (for example in a short-lived signed cookie) to use in the callback.

Options:

- `--provider` — Provider name / config key (required).
- `--clientId` — OAuth client ID (also `OAUTH_CLIENT_ID`) (required).
- `--redirectUri` — Redirect URI registered with the provider (required).
- `--scopes` — Scopes separated by commas and/or spaces. The emitted `scope` parameter is always space-delimited per RFC 6749 §3.3 (a comma-joined `scope` is rejected by providers such as Google); duplicates are removed (flag > user config > bundled).
- `--state` — Opaque state value (generated as base64url random if omitted).
- `--authUrl` — Authorization endpoint URL (flag > user config > bundled).
- `--configFile` — Path to a user `config.yaml` with per-provider settings.

### oauth exchange

Exchange the authorization code (returned to your redirect URI) for tokens and build a principal from the provider's userinfo endpoint. The provider's field `map` renames userinfo fields to canonical claim names (for example GitHub's numeric `id` → `sub`); unmapped fields pass through unchanged, so a standard OIDC provider needs no map.

```bash
aux4 oauth exchange --provider github \
  --tokenUrl https://github.com/login/oauth/access_token \
  --userinfoUrl https://api.github.com/user \
  --clientId YOUR_CLIENT_ID --clientSecret YOUR_CLIENT_SECRET \
  --code 4f9a2c... --codeVerifier IX1jAHuH... \
  --redirectUri https://app.example/auth/callback \
  --map '{"id":"sub","login":"username"}'
```

Output:

```json
{
  "sub": 4242,
  "username": "octocat",
  "name": "The Octocat",
  "email": "octo@example.com",
  "provider": "github"
}
```

**Note:** The profile is read from the userinfo endpoint. The `id_token` is not signature-verified against the provider's JWKS yet — JWKS / `id_token` verification is a planned hardening follow-up.

Options:

- `--provider` — Provider name, added to the principal (required).
- `--clientId` — OAuth client ID (also `OAUTH_CLIENT_ID`) (required).
- `--clientSecret` — OAuth client secret (also `OAUTH_CLIENT_SECRET`).
- `--code` — Authorization code returned to the redirect URI (required).
- `--codeVerifier` — PKCE code verifier produced by `authorize-url` (required).
- `--redirectUri` — Redirect URI used in the `authorize-url` step; must match (required).
- `--tokenUrl` — Token endpoint URL (flag > user config > bundled).
- `--userinfoUrl` — Userinfo endpoint URL (flag > user config > bundled).
- `--map` — JSON object mapping userinfo fields to principal claims.
- `--clientSecretIn` — Where the client secret is sent at the token endpoint: `basic` (HTTP Basic auth, required by e.g. X/Twitter confidential clients) or `body` (default). Resolved from flag, then user/bundled config.
- `--configFile` — Path to a user `config.yaml` with per-provider settings.
- `--includeTokens` — When `true`, also return the access/refresh/id tokens alongside the principal (see Token broker mode).

#### Token broker mode

By default `exchange` returns only the identity principal (the web-login shape). Pass `--includeTokens true` to also return the tokens, so a caller that holds no client secret — such as an OAuth broker exchanging on behalf of a thin CLI — can persist and later use or refresh them:

```json
{
  "accessToken": "ya29...",
  "refreshToken": "1//0g...",
  "idToken": "eyJ...",
  "expiresIn": 3599,
  "tokenType": "Bearer",
  "principal": {
    "sub": 4242,
    "email": "octo@example.com",
    "provider": "github"
  }
}
```

### oauth refresh

Renew an access token from a refresh token, printing the new tokens as JSON. This is the primitive a token broker wraps: the broker holds the client secret and calls `refresh` so a thin client that never sees the secret can keep a long-lived session alive.

```bash
aux4 oauth refresh --provider github \
  --tokenUrl https://github.com/login/oauth/access_token \
  --clientId YOUR_CLIENT_ID --clientSecret YOUR_CLIENT_SECRET \
  --refreshToken 1//0g...
```

Output:

```json
{
  "accessToken": "ya29...",
  "refreshToken": "1//0g...",
  "idToken": "",
  "expiresIn": 3599,
  "tokenType": "Bearer"
}
```

When the provider does not rotate the refresh token, `refreshToken` comes back empty and the caller keeps the one it already has.

Options:

- `--provider` — Provider name (required).
- `--clientId` — OAuth client ID (also `OAUTH_CLIENT_ID`) (required).
- `--clientSecret` — OAuth client secret (also `OAUTH_CLIENT_SECRET`).
- `--refreshToken` — The refresh token to exchange for a new access token (required).
- `--tokenUrl` — Token endpoint URL (flag > user config > bundled).
- `--clientSecretIn` — Where the client secret is sent: `basic` (HTTP Basic auth, e.g. X) or `body` (default). Resolved from flag, then user/bundled config.
- `--configFile` — Path to a user `config.yaml` with per-provider settings.

**Per-provider config.** A `config.yaml` can carry `clientSecretIn` per provider so callers don't repeat it:

```yaml
config:
  x:
    tokenUrl: https://api.x.com/2/oauth2/token
    userinfoUrl: https://api.x.com/2/users/me
    clientSecretIn: basic
```

### Web login flow

`authorize-url` and `exchange` together implement the two halves of a server-side OAuth2 web login:

1. On sign-in, the app calls `authorize-url`, redirects the browser to the returned `url`, and stashes `codeVerifier` and `state`.
2. On the callback, the app verifies the returned `state`, then calls `exchange` with the `code` and the stashed `codeVerifier` to get the principal.

Per-provider URLs and the field `map` can be stored once in a user `config.yaml` so the web app only passes credentials and the per-request values:

```yaml
config:
  github:
    authUrl: https://github.com/login/oauth/authorize
    tokenUrl: https://github.com/login/oauth/access_token
    userinfoUrl: https://api.github.com/user
    scopes: read:user,user:email
    map:
      id: sub
      login: username
```

### Session store (hosted-callback + poll)

The `session park` and `session poll` commands are the server-side primitives behind the broker's hosted-callback + poll login. A polling CLI picks a random session id; the hosted callback route `park`s the short-lived authorization **code** (never a token) under that id; the CLI `poll`s until the code is ready and completes the exchange itself with the PKCE verifier it alone holds.

- Records are **single-use** — a `ready` code is removed on the first successful read.
- Records are **TTL-bounded** — they expire after 10 minutes.
- The session id is used as a storage key and is strictly validated (`[A-Za-z0-9_-]`, 16–200 chars) to be path-traversal safe.
- The parked value is only ever a `code` or an `error`, never a token.

**Two backends, selected automatically:**

- **Shared store** — used when both `CLOUD_SYNC_URL` and `CLOUD_SYNC_TOKEN` are set (the platform's untrusted-VM S3 sync). The broker runs as a multi-instance Lambda, so a code parked on one instance must be visible to a poll on another. Each op mints a presigned URL from the control plane (`POST $CLOUD_SYNC_URL` with a Bearer token, body `{"operations":[{"method","path"}]}`) and then does the object PUT/GET/DELETE directly against the presigned URL. Objects live under `<OAUTH_SESSION_PREFIX>/<id>.json` (default prefix `oauth-sessions`).
- **Local files** — the fallback for off-cloud / local use when those env vars are absent. A per-session file under `--dir` (default `<tmpdir>/oauth-sessions`).

```bash
# On the hosted callback (parks the code for the waiting CLI):
aux4 oauth session park --id <sessionId> --code <authCode>

# From the polling CLI (returns pending until ready, then the code once):
aux4 oauth session poll --id <sessionId>
```

`park` prints `{"status":"parked"}` (and exits non-zero if the store write fails, so the callback route can report it). `poll` prints one of:

```json
{"status":"pending"}
{"status":"ready","code":"<authCode>"}
{"status":"error","error":"access_denied"}
{"status":"expired"}
```

A poll never fails on a transient store/network error — it degrades to `{"status":"pending"}` so the caller simply polls again.

## Environment Variables

- `OAUTH_CLIENT_ID` — default for `--clientId`.
- `OAUTH_CLIENT_SECRET` — default for `--clientSecret`.
- `CLOUD_SYNC_URL` — control-plane mint endpoint. When set together with `CLOUD_SYNC_TOKEN`, the session store uses the shared (cloud) backend instead of local files.
- `CLOUD_SYNC_TOKEN` — Bearer token for the mint call. Required (with `CLOUD_SYNC_URL`) to enable the shared session store.
- `OAUTH_SESSION_PREFIX` — relative-path prefix for shared session objects (default `oauth-sessions`).
