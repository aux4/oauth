# aux4/oauth 0.1.6

## Added

- **Shared session store for the broker.** `oauth session park` / `oauth session poll`
  now persist parked authorization codes through the aux4 cloud-file-sync mint
  endpoint (`CLOUD_SYNC_URL` + `CLOUD_SYNC_TOKEN`) when those are present, so a
  multi-instance (Lambda-backed) broker shares one store: a code parked by the
  instance that handled the provider callback is visible to the instance that
  serves the poll. Falls back to a local file when the sync env is absent.
- Session objects live under `OAUTH_SESSION_PREFIX` (default `oauth-sessions`),
  a sibling of the platform's `state/` tree.

## Changed

- **Poll deletes expired records.** In addition to single-use deletion on a
  successful read, an expired record is now removed on poll (both the shared and
  local backends), so abandoned logins do not linger until the storage lifecycle
  rule sweeps them.

## Notes

- Session ids are validated (`[A-Za-z0-9_-]{16,200}`) before any path is built,
  and records are TTL-bounded (10 min); the parked code is useless without the
  PKCE verifier the CLI holds.
