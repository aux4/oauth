#### Description

The `logout` command removes the stored OAuth token for a provider, deleting its token file. It delegates to `aux4 curl oauth logout`. If no token has been stored for the provider, it reports that no token was found.

The provider is identified by `--provider <name>`, the same label used at login (the token-file key).

#### Usage

```bash
aux4 oauth logout --provider <name> [--tokenFile <path>]
```

--provider   Provider name / token-file key (required)
--tokenFile  Custom token file path (default: `.oauth/<provider>.json`)

#### Example

```bash
aux4 oauth logout --provider aux4
```

```text
No token found for provider "aux4"
```
