#### Description

The `session poll` command retrieves the authorization code parked for a pending hosted-callback + poll login, keyed by the session id the polling CLI chose. It is the counterpart to `session park`: the CLI polls until the code is ready, then completes the token exchange itself with the PKCE verifier it alone holds.

It prints a single JSON status object:

- `{"status":"pending"}` — nothing parked yet (poll again), or a transient store/network error (a poll never crashes or 500s the caller).
- `{"status":"ready","code":"<code>"}` — the code, returned exactly once.
- `{"status":"error","error":"<error>"}` — an error was parked instead of a code (e.g. `access_denied`).
- `{"status":"expired"}` — the record was older than the 10-minute TTL.

A `ready` code is **single-use** — it is deleted on read so it can never be replayed from the store. The session id is validated against `[A-Za-z0-9_-]{16,200}` and rejected otherwise (path-traversal safe).

The store has two backends, selected automatically:

- **Shared store** — used when both `CLOUD_SYNC_URL` and `CLOUD_SYNC_TOKEN` are set. Mints a presigned `GET` from the control plane (`POST $CLOUD_SYNC_URL` with `Authorization: Bearer $CLOUD_SYNC_TOKEN`, body `{"operations":[{"method":"GET","path":"<prefix>/<id>.json"}]}`) and fetches the record from the presigned URL with no auth header; a 404/403 is treated as `pending`. On a valid, unexpired record it mints a `DELETE` and removes the object before returning (single-use). The path prefix defaults to `oauth-sessions` and can be overridden with `OAUTH_SESSION_PREFIX`.
- **Local files** — the fallback when the sync env is absent. Reads and deletes a per-session file under `--dir` (default `<tmpdir>/oauth-sessions`).

#### Usage

```bash
aux4 oauth session poll --id <sessionId> [--dir <path>]
```

--id    Session id to poll (required)
--dir   Local session store directory, used only in local-file mode (default: `<tmpdir>/oauth-sessions`)

#### Example

```bash
aux4 oauth session poll --id 7f3c9a12b4e6d8f0a1c2
```

```text
{"status":"ready","code":"4/0AeaYSHb..."}
```
