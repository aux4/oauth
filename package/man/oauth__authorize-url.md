#### Description

The `authorize-url` command builds an OAuth2 authorization URL for the
server-side web login flow and generates the PKCE values needed to complete it
later. It is a headless primitive — it performs no browser interaction and starts
no local server. A web application calls it on the server, redirects the user's
browser to the returned `url`, and stashes the returned `codeVerifier` and
`state` to use in the matching `oauth exchange` call.

The command:

- Generates a PKCE `codeVerifier` (32 random bytes, base64url-encoded) and a
  `codeChallenge` of `base64url(sha256(codeVerifier))` using method `S256`.
- Generates an opaque `state` value if `--state` is not supplied.
- Builds the authorize URL with `response_type=code`, `client_id`,
  `redirect_uri`, `scope`, `state`, `code_challenge`, and
  `code_challenge_method=S256`.

The authorization endpoint URL and scopes are resolved with this precedence:

1. **Explicit flag** — `--authUrl`, `--scopes`. Flags always win.
2. **User config** — a `config.yaml` passed via `--configFile`, keyed by provider
   name (`<provider>/authUrl`, `<provider>/scopes`). Uses `aux4/config`.
3. **Bundled config** — only the `aux4` provider (URLs from `sso.aux4.io`).

If, after resolution, `authUrl` is empty, the command fails with exit code 1 and
a message telling you to pass `--authUrl` or install a provider package.

The output is a single JSON object on stdout:

```json
{
  "url": "https://provider/authorize?response_type=code&...",
  "codeVerifier": "<base64url>",
  "state": "<state>"
}
```

#### Usage

```bash
aux4 oauth authorize-url --provider <name> --clientId <id> --redirectUri <url> \
  [--scopes <csv>] [--state <value>] [--authUrl <url>] [--configFile <path>]
```

--provider     Provider name / config key (required). Use `aux4` for the bundled aux4 SSO URLs
--clientId     OAuth client ID (flag or env `OAUTH_CLIENT_ID`) (required)
--redirectUri  Redirect URI registered with the provider (required)
--scopes       Comma-separated scopes (flag > user config > bundled config)
--state        Opaque state value (generated as base64url random if omitted)
--authUrl      Authorization endpoint URL (flag > user config > bundled config)
--configFile   Path to a user `config.yaml` with per-provider URLs/scopes

#### Example

Build an authorize URL for the bundled `aux4` provider — only your client ID and
redirect URI are required:

```bash
aux4 oauth authorize-url --provider aux4 \
  --clientId abc123 \
  --redirectUri https://app.example/auth/callback
```

```text
{"url":"https://sso.aux4.io/authorize?response_type=code&client_id=abc123&redirect_uri=https%3A%2F%2Fapp.example%2Fauth%2Fcallback&scope=openid%2Cemail%2Cprofile&state=Yk3...&code_challenge=VNv40bf7...&code_challenge_method=S256","codeVerifier":"IX1jAHuH...","state":"Yk3..."}
```

Build an authorize URL for any other provider by supplying its endpoint:

```bash
aux4 oauth authorize-url --provider acme \
  --authUrl https://acme.example/oauth/authorize \
  --scopes openid,email \
  --clientId abc123 \
  --redirectUri https://app.example/auth/callback
```
