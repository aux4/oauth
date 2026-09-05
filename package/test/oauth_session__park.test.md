# oauth session park / poll

The `session park` and `session poll` commands back the broker's hosted-callback +
poll login flow. They store a short-lived authorization **code** (never a token),
single-use and TTL-bounded, keyed by a strictly validated session id.

Two backends are exercised here:

- **local files** — the default when the platform sync env is absent. A per-session
  file under a temp directory (`--dir`).
- **shared store** — used automatically when `CLOUD_SYNC_URL` and `CLOUD_SYNC_TOKEN`
  are set. It mints a presigned URL from the control plane and does the object op
  (PUT/GET/DELETE) directly against it. The shared tests stand up a tiny mock of the
  mint endpoint + object store (`mock-sync-server.js`) in a `beforeAll` hook.

## local store

### should park a code and return it once, then be pending (single-use)

```execute
aux4 oauth session park --id locallocal1234567 --code LOCALCODE --dir /tmp/oauth-sess-local-a && aux4 oauth session poll --id locallocal1234567 --dir /tmp/oauth-sess-local-a && aux4 oauth session poll --id locallocal1234567 --dir /tmp/oauth-sess-local-a
```

```expect
{"status":"parked"}
{"status":"ready","code":"LOCALCODE"}
{"status":"pending"}
```

### should return pending for an unknown session

```execute
aux4 oauth session poll --id neverparkedlocal01 --dir /tmp/oauth-sess-local-b
```

```expect
{"status":"pending"}
```

### should park an error and return it

```execute
aux4 oauth session park --id errlocal123456789 --error access_denied --dir /tmp/oauth-sess-local-c && aux4 oauth session poll --id errlocal123456789 --dir /tmp/oauth-sess-local-c
```

```expect
{"status":"parked"}
{"status":"error","error":"access_denied"}
```

### should reject an invalid session id

```execute
aux4 oauth session poll --id short --dir /tmp/oauth-sess-local-d
```

```error:partial
Error: invalid session id
```

## shared store

The mock control plane (`mock-sync-server.js`) listens on `localhost:8732`. Its
`/mint` endpoint requires `Authorization: Bearer TESTTOKEN` and returns presigned
URLs pointing back at its own in-memory object store; the object-store handler
rejects any request that carries an `Authorization` header, so a successful
round-trip proves the presigned op is sent WITHOUT auth. One already-expired record
is pre-seeded so the TTL branch can be asserted.

The mock also models S3's signed-header rule for object tagging: a park PUT mints a
URL that signs `x-amz-tagging=oauth-session=true`, and the object handler rejects
(403) a PUT whose `x-amz-tagging` header does not byte-match the signed value (or is
sent on an unsigned URL). So the shared-store park below succeeding proves oauth-web
sends the tag header that the mint signed — the lifecycle rule can then sweep orphans
tagged `oauth-session=true`.

```beforeAll
nohup node mock-sync-server.js >/dev/null 2>&1 &
sleep 1
```

```afterAll
pkill -f mock-sync-server.js
```

### should park via the shared store and return the code once (single-use)

```execute
CLOUD_SYNC_URL=http://localhost:8732/mint CLOUD_SYNC_TOKEN=TESTTOKEN aux4 oauth session park --id sharedsess12345678 --code SHAREDCODE && CLOUD_SYNC_URL=http://localhost:8732/mint CLOUD_SYNC_TOKEN=TESTTOKEN aux4 oauth session poll --id sharedsess12345678 && CLOUD_SYNC_URL=http://localhost:8732/mint CLOUD_SYNC_TOKEN=TESTTOKEN aux4 oauth session poll --id sharedsess12345678
```

```expect
{"status":"parked"}
{"status":"ready","code":"SHAREDCODE"}
{"status":"pending"}
```

### should return pending when the object is not found (404)

```execute
CLOUD_SYNC_URL=http://localhost:8732/mint CLOUD_SYNC_TOKEN=TESTTOKEN aux4 oauth session poll --id sharedneverparked1
```

```expect
{"status":"pending"}
```

### should return expired for a record past its TTL, then delete the orphan

The first poll reports `expired` AND removes the stale object so an abandoned login
does not linger; the second poll therefore finds nothing and reports `pending`.

```execute
CLOUD_SYNC_URL=http://localhost:8732/mint CLOUD_SYNC_TOKEN=TESTTOKEN aux4 oauth session poll --id expiredsessionaaaaaaaa && CLOUD_SYNC_URL=http://localhost:8732/mint CLOUD_SYNC_TOKEN=TESTTOKEN aux4 oauth session poll --id expiredsessionaaaaaaaa
```

```expect
{"status":"expired"}
{"status":"pending"}
```

### should park an error via the shared store and return it

```execute
CLOUD_SYNC_URL=http://localhost:8732/mint CLOUD_SYNC_TOKEN=TESTTOKEN aux4 oauth session park --id sharederr123456789 --error access_denied && CLOUD_SYNC_URL=http://localhost:8732/mint CLOUD_SYNC_TOKEN=TESTTOKEN aux4 oauth session poll --id sharederr123456789
```

```expect
{"status":"parked"}
{"status":"error","error":"access_denied"}
```

### should honor a custom OAUTH_SESSION_PREFIX

```execute
CLOUD_SYNC_URL=http://localhost:8732/mint CLOUD_SYNC_TOKEN=TESTTOKEN OAUTH_SESSION_PREFIX=custom-prefix aux4 oauth session park --id prefixsess1234567 --code PREFIXCODE && CLOUD_SYNC_URL=http://localhost:8732/mint CLOUD_SYNC_TOKEN=TESTTOKEN OAUTH_SESSION_PREFIX=custom-prefix aux4 oauth session poll --id prefixsess1234567
```

```expect
{"status":"parked"}
{"status":"ready","code":"PREFIXCODE"}
```

### should fail park with a non-zero exit when the mint call is unauthorized

The mint endpoint rejects a wrong Bearer token with 401, so the park surfaces an
error and a non-zero exit (which the callback route reports).

```execute
CLOUD_SYNC_URL=http://localhost:8732/mint CLOUD_SYNC_TOKEN=WRONGTOKEN aux4 oauth session park --id badtokensess123456 --code X
```

```error:partial
Error: failed to park session: mint failed: HTTP 401
```

### should return pending (never crash) when the mint endpoint is unreachable

```execute
CLOUD_SYNC_URL=http://localhost:8799/mint CLOUD_SYNC_TOKEN=TESTTOKEN aux4 oauth session poll --id unreachablesess123
```

```expect
{"status":"pending"}
```
