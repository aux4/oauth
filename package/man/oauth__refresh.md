#### Description

The `refresh` command renews an access token from a refresh token, printing the
new tokens as JSON. It is a headless primitive intended to be wrapped by a token
broker: the broker holds the client secret and calls `refresh` so a thin client
that never sees the secret can keep a long-lived session alive after its access
token expires.

The command POSTs the token endpoint (form-encoded) with
`grant_type=refresh_token`, `refresh_token`, `client_id`, and (when present)
`client_secret`, then reads the new tokens from the JSON response.

The token endpoint URL is resolved with this precedence:

1. **Explicit flag** — `--tokenUrl`. Flags always win.
2. **User config** — a `config.yaml` passed via `--configFile`, keyed by provider
   name (`<provider>/tokenUrl`). Uses `aux4/config`.
3. **Bundled config** — only the `aux4` provider (URL from `sso.aux4.io`).

If, after resolution, `tokenUrl` is empty, the command fails with exit code 1 and
a message telling you to pass `--tokenUrl` or install a provider package. It also
fails (exit code 1) if the token endpoint returns a non-2xx status or no
`access_token`.

The output is a single JSON object on stdout:

```json
{
  "accessToken": "ya29...",
  "refreshToken": "1//0g...",
  "idToken": "",
  "expiresIn": 3599,
  "tokenType": "Bearer"
}
```

When the provider does not rotate the refresh token, `refreshToken` comes back
empty and the caller keeps the one it already has.

#### Usage

```bash
aux4 oauth refresh --provider <name> --clientId <id> [--clientSecret <secret>] \
  --refreshToken <token> [--tokenUrl <url>] [--configFile <path>]
```

--provider      Provider name (required)
--clientId      OAuth client ID (flag or env `OAUTH_CLIENT_ID`) (required)
--clientSecret  OAuth client secret (flag or env `OAUTH_CLIENT_SECRET`)
--refreshToken  The refresh token to exchange for a new access token (required)
--tokenUrl      Token endpoint URL (flag > user config > bundled config)
--configFile    Path to a user `config.yaml` with per-provider URLs

#### Example

```bash
aux4 oauth refresh --provider github \
  --tokenUrl https://github.com/login/oauth/access_token \
  --clientId abc123 --clientSecret s3cr3t \
  --refreshToken 1//0g...
```

```text
{"accessToken":"ya29...","refreshToken":"1//0g...","idToken":"","expiresIn":3599,"tokenType":"Bearer"}
```
