#### Description

The `oauth` command group is a provider-agnostic OAuth2 client engine. It performs the browser-based authorization-code-with-PKCE flow against **any** OAuth2 / OIDC provider, identified only by its endpoint URLs and your client credentials. The engine knows no third-party provider names — a provider is just a free-form `--provider` label (which also becomes the key under which the token is stored).

The actual flow, token storage, and refresh are delegated to `aux4 curl oauth`, so this package adds no new credential storage or crypto. It is a thin front door that resolves a provider's endpoints and shells out to curl.

Endpoint and credential values are resolved with this precedence:

1. **Explicit flag** — `--authUrl`, `--tokenUrl`, `--userinfoUrl`, `--scopes`, `--clientId`, `--clientSecret`
2. **User config** — a `config.yaml` passed via `--configFile`, keyed by provider name (uses `aux4/config`)
3. **Bundled config** — endpoints shipped with the package

The package bundles exactly one first-party provider, `aux4`, with the URLs of its own identity provider (`sso.aux4.io`). It bundles **URLs only** — the `clientId`/`clientSecret` are always supplied by you. For any other provider name, the bundled config has nothing, so you must pass `--authUrl`/`--tokenUrl` (or install a `community/oauth-<name>` package that supplies them).

Available subcommands:

- `login` — Authenticate with a provider and store the token
- `token` — Print a valid access token, refreshing if expired
- `status` — Show the stored token status
- `logout` — Remove the stored token

#### Usage

```bash
aux4 oauth <subcommand> --provider <name> [options]
```

#### Example

```bash
aux4 oauth login --provider aux4 --clientId abc --clientSecret xyz
```
