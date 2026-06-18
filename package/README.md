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
- `--scopes` — Comma-separated scopes (flag > user config > bundled).
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
- `--configFile` — Path to a user `config.yaml` with per-provider settings.

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

## Environment Variables

- `OAUTH_CLIENT_ID` — default for `--clientId`.
- `OAUTH_CLIENT_SECRET` — default for `--clientSecret`.
