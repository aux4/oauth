# oauth refresh

The `refresh` command renews an access token from a refresh token, printing the
new tokens as JSON. It is the primitive the OAuth broker's refresh route wraps:
the broker holds the client secret and calls this so a thin client that never
sees the secret can keep a long-lived session alive. These tests use the same
tiny local Node mock OAuth server, whose token endpoint honours the
`refresh_token` grant.

## refresh against a mock server

```beforeAll
nohup node mock-oauth-server.js >/dev/null 2>&1 &
sleep 1
```

```afterAll
pkill -f mock-oauth-server.js
```

### should exchange the refresh token for a new access token

```execute
aux4 oauth refresh --provider github --tokenUrl http://localhost:8731/token --clientId CID --clientSecret CSECRET --refreshToken mockrefresh
```

```expect:json
{
  "accessToken": "mockaccess2",
  "refreshToken": "mockrefresh2",
  "idToken": "",
  "expiresIn": 3600,
  "tokenType": "bearer"
}
```

### should fail when the refresh token is rejected

```execute
aux4 oauth refresh --provider github --tokenUrl http://localhost:8731/token --clientId CID --clientSecret CSECRET --refreshToken wrongtoken
```

```error:partial
Error: token endpoint returned 400*?
```

## missing-URL error path

### should fail for an unknown provider with no tokenUrl

```execute
aux4 oauth refresh --provider notaprovider --clientId X --refreshToken R
```

```error:partial
Error: no tokenUrl for provider 'notaprovider'; pass --tokenUrl or install a provider package
```
