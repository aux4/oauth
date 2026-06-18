#### Description

The `token` command prints a valid access token for a provider, automatically refreshing it via the stored refresh token if it has expired. It delegates to `aux4 curl oauth token`. Use it in scripts to inject a bearer token into requests.

The provider is identified by `--provider <name>`, the same label used at login (the token-file key). If no token has been stored for the provider, the command fails with an error telling you to run `oauth login` first.

#### Usage

```bash
aux4 oauth token --provider <name> [--tokenFile <path>]
```

--provider   Provider name / token-file key (required)
--tokenFile  Custom token file path (default: `.oauth/<provider>.json`)

#### Example

```bash
TOKEN=$(aux4 oauth token --provider aux4)
curl -H "Authorization: Bearer $TOKEN" https://api.aux4.io/me
```
