#### Description

The `status` command shows the stored OAuth token status for a provider — whether a token exists, whether it is valid or expired, its scopes, expiry, and token file path. It delegates to `aux4 curl oauth status`. If no token has been stored for the provider, it reports that no token was found.

The provider is identified by `--provider <name>`, the same label used at login (the token-file key).

#### Usage

```bash
aux4 oauth status --provider <name> [--tokenFile <path>]
```

--provider   Provider name / token-file key (required)
--tokenFile  Custom token file path (default: `.oauth/<provider>.json`)

#### Example

```bash
aux4 oauth status --provider aux4
```

```text
No token found for provider "aux4"
```
