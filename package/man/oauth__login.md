#### Description

The `login` command runs the browser-based OAuth2 authorization-code flow (with PKCE) against a provider and stores the resulting token. It delegates the full flow to `aux4 curl oauth login`, which opens an authorization URL, listens on a local callback port, exchanges the code, and writes the token to `.oauth/<provider>.json`.

The provider is identified by `--provider <name>`, a free-form label that is also the token-file key. The engine has no built-in third-party provider list. Endpoint URLs, scopes, and credentials are resolved with this precedence:

1. **Explicit flag** wins.
2. Otherwise, the value is read from **user config** when `--configFile` is given, keyed by provider name (`<provider>/authUrl`, `<provider>/clientId`, etc.).
3. Otherwise, the **bundled config** is consulted.

The only bundled provider is `aux4` (URLs only — `authUrl`, `tokenUrl`, `userinfoUrl`, `scopes` for `sso.aux4.io`). For any other provider, pass `--authUrl` and `--tokenUrl` (or install a provider package). If, after resolution, `authUrl` or `tokenUrl` is empty, the command fails with exit code 1 and a message telling you to pass the URL flags or install a provider package.

The `--userinfoUrl` flag is resolved but reserved for the web-login flow; the CLI login flow does not require it.

#### Usage

```bash
aux4 oauth login --provider <name> [--authUrl <url>] [--tokenUrl <url>] \
  [--scopes <csv>] [--clientId <id>] [--clientSecret <secret>] \
  [--userinfoUrl <url>] [--callbackPort <port>] [--tokenFile <path>] \
  [--configFile <path>]
```

--provider      Provider name / token-file key (required). Use `aux4` for the bundled aux4 SSO URLs
--authUrl       Authorization endpoint URL (flag > user config > bundled config)
--tokenUrl      Token exchange endpoint URL (flag > user config > bundled config)
--userinfoUrl   Userinfo endpoint URL (resolved; reserved for the web-login flow)
--scopes        Comma-separated scopes (flag > user config > bundled config)
--clientId      OAuth client ID (flag, env `OAUTH_CLIENT_ID`, or user config)
--clientSecret  OAuth client secret (flag, env `OAUTH_CLIENT_SECRET`, or user config)
--callbackPort  Local callback server port (default: `9876`)
--tokenFile     Custom token file path (default: `.oauth/<provider>.json`)
--configFile    Path to a user `config.yaml` with per-provider settings

#### Example

Log in to the bundled aux4 provider — no URL flags needed, only your app credentials:

```bash
aux4 oauth login --provider aux4 --clientId abc --clientSecret xyz
```

Log in to any other provider by supplying its endpoints:

```bash
aux4 oauth login --provider acme \
  --authUrl https://acme.example/oauth/authorize \
  --tokenUrl https://acme.example/oauth/token \
  --scopes openid,email \
  --clientId abc --clientSecret xyz
```

```text
Open this URL in your browser to authorize:

https://acme.example/oauth/authorize?client_id=abc&...
```
