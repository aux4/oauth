#### Description

The `exchange` command completes the server-side web login flow. Given the
authorization `code` returned to your redirect URI and the `codeVerifier`
produced by `oauth authorize-url`, it exchanges the code for tokens and builds a
principal from the provider's userinfo endpoint. It is a headless primitive
intended to be called by a web application's callback handler.

The command:

1. POSTs the token endpoint (form-encoded) with `grant_type=authorization_code`,
   `code`, `redirect_uri`, `client_id`, `client_secret`, and `code_verifier`, and
   reads the `access_token` from the JSON response.
2. GETs the userinfo endpoint with `Authorization: Bearer <access_token>` to
   retrieve the user's profile.
3. Applies the provider's field `map` to rename userinfo fields to canonical
   claim names (for example GitHub returns a numeric `id`, so a map of
   `{"id":"sub"}` produces `sub`). Fields not named in the map are passed through
   unchanged, so a standard OIDC provider that already returns `sub`/`email`/
   `name` needs no map. The provider name is added as `provider`.

The token endpoint URL, userinfo endpoint URL, and field map are resolved with
this precedence:

1. **Explicit flag** — `--tokenUrl`, `--userinfoUrl`, `--map`. Flags always win.
2. **User config** — a `config.yaml` passed via `--configFile`, keyed by provider
   name (`<provider>/tokenUrl`, `<provider>/userinfoUrl`, `<provider>/map`). Uses
   `aux4/config`.
3. **Bundled config** — only the `aux4` provider (URLs from `sso.aux4.io`).

If, after resolution, `tokenUrl` or `userinfoUrl` is empty, the command fails
with exit code 1 and a message telling you to pass the URL flag or install a
provider package. It also fails (exit code 1) if the token endpoint returns a
non-2xx status, returns no `access_token`, or the userinfo request fails.

**Note:** The profile is taken from the userinfo endpoint. The `id_token` (when
returned) is **not** signature-verified against the provider's JWKS in this
phase. Adding JWKS / `id_token` verification is a planned hardening follow-up.

The output is the principal as a single JSON object on stdout:

```json
{
  "sub": "123",
  "email": "user@example.com",
  "name": "User Name",
  "provider": "acme"
}
```

#### Usage

```bash
aux4 oauth exchange --provider <name> --clientId <id> --clientSecret <secret> \
  --code <code> --codeVerifier <verifier> --redirectUri <url> \
  [--tokenUrl <url>] [--userinfoUrl <url>] [--map <json>] [--configFile <path>]
```

--provider     Provider name (also added to the principal) (required)
--clientId     OAuth client ID (flag or env `OAUTH_CLIENT_ID`) (required)
--clientSecret OAuth client secret (flag or env `OAUTH_CLIENT_SECRET`)
--code         Authorization code returned to the redirect URI (required)
--codeVerifier PKCE code verifier produced by `authorize-url` (required)
--redirectUri  Redirect URI used in the `authorize-url` step; must match (required)
--tokenUrl     Token endpoint URL (flag > user config > bundled config)
--userinfoUrl  Userinfo endpoint URL (flag > user config > bundled config)
--map          JSON object mapping userinfo fields to principal claims, e.g. `{"id":"sub"}`
--configFile   Path to a user `config.yaml` with per-provider URLs and field map

#### Example

Exchange a code for a principal against a provider with a GitHub-style userinfo
shape (numeric `id`), remapping `id` to `sub`:

```bash
aux4 oauth exchange --provider github \
  --tokenUrl https://github.com/login/oauth/access_token \
  --userinfoUrl https://api.github.com/user \
  --clientId abc123 --clientSecret s3cr3t \
  --code 4f9a2c... --codeVerifier IX1jAHuH... \
  --redirectUri https://app.example/auth/callback \
  --map '{"id":"sub","login":"username"}'
```

```text
{"sub":4242,"username":"octocat","name":"The Octocat","email":"octo@example.com","provider":"github"}
```
