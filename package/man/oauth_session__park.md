#### Description

The `session park` command stores a short-lived OAuth authorization **code** (or an error) for a pending hosted-callback + poll login, keyed by a client-chosen session id. It is a server-side primitive: the hosted callback route calls it so a polling CLI can retrieve the code cross-device and complete the token exchange itself with the PKCE verifier it alone holds.

- **Codes only** — the parked value is a `code` or an `error`, never a token.
- **Single-use** — the record is removed on the first successful `session poll`.
- **TTL-bounded** — records expire after 10 minutes.
- **Path-traversal safe** — the session id is used as a storage key and is validated against `[A-Za-z0-9_-]{16,200}`.

The store has two backends, selected automatically:

- **Shared store** — used when both `CLOUD_SYNC_URL` and `CLOUD_SYNC_TOKEN` are set. Because the broker runs as a multi-instance Lambda, a code parked on one instance must be visible to a poll on another. The command mints a presigned `PUT` from the control plane (`POST $CLOUD_SYNC_URL` with `Authorization: Bearer $CLOUD_SYNC_TOKEN`, body `{"operations":[{"method":"PUT","path":"<prefix>/<id>.json"}]}`) and then PUTs the record directly to the presigned URL with no auth header. The path prefix defaults to `oauth-sessions` and can be overridden with `OAUTH_SESSION_PREFIX`.
- **Local files** — the fallback when the sync env is absent. Writes a per-session file under `--dir` (default `<tmpdir>/oauth-sessions`) with an atomic temp-and-rename.

On success it prints `{"status":"parked"}`. If the store write fails (shared or local), it exits non-zero so the callback route can report the failure.

#### Usage

```bash
aux4 oauth session park --id <sessionId> [--code <code>] [--error <error>] [--dir <path>]
```

--id     Session id chosen by the client (16–200 chars, `[A-Za-z0-9_-]`); used as a storage key so it is strictly validated (required)
--code   Authorization code to park
--error  Error to park instead of a code (e.g. `access_denied`)
--dir    Local session store directory, used only in local-file mode (default: `<tmpdir>/oauth-sessions`)

Either `--code` or `--error` must be provided.

#### Example

```bash
aux4 oauth session park --id 7f3c9a12b4e6d8f0a1c2 --code 4/0AeaYSHb...
```

```text
{"status":"parked"}
```
