# aux4/oauth 0.1.5

## Added

- **Broker session store** for the hosted-callback + poll login flow:
  - `aux4 oauth session park --id <id> --code <code>|--error <err>` — park the result of an OAuth redirect for a pending login.
  - `aux4 oauth session poll --id <id>` — poll it; returns `{status: pending|ready|error|expired}` and the code when ready.

  It parks a short-lived authorization **code** (never a token), keyed by an unguessable session id, so a polling CLI can pick it up from any device. Single-use (removed on read), TTL-bounded (10 min), and the session id is strictly validated (`[A-Za-z0-9_-]{16,200}`) since it is used as a filename — path traversal is rejected.

## Notes

- Consumed by `aux4/oauth-app`'s `/{provider}/callback` + `/session/{id}` routes for the broker's device-friendly (no-loopback) login. The parked code is useless without the PKCE verifier, which stays on the client.
- Existing commands (`login`, `token`, `status`, `logout`, `authorize-url`, `exchange`, `refresh`) are unchanged.
