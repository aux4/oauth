# oauth exchange

The `exchange` command exchanges an authorization code for tokens and builds a
principal from the userinfo endpoint, applying the provider's field map. These
tests stand up a tiny local Node mock OAuth server (token + userinfo endpoints)
in a `beforeAll` hook and assert that the principal is built correctly and that
the field map is applied (a GitHub-style `id` → `sub` remap). Error paths for
missing resolved URLs are tested without a server.

## token exchange against a mock server

The mock OAuth server (`mock-oauth-server.js`, shipped alongside this test) is
started in `beforeAll` and stopped in `afterAll`. It serves a token endpoint and
a GitHub-style userinfo endpoint on `localhost:8731`.

```beforeAll
nohup node mock-oauth-server.js >/dev/null 2>&1 &
sleep 1
```

```afterAll
pkill -f mock-oauth-server.js
```

### should exchange the code and build a principal applying the field map (id to sub)

```execute
aux4 oauth exchange --provider github --tokenUrl http://localhost:8731/token --userinfoUrl http://localhost:8731/userinfo --clientId CID --clientSecret CSECRET --code authcode123 --codeVerifier verifier456 --redirectUri https://app.example/callback --map '{"id":"sub","login":"username"}'
```

```expect:json
{
  "sub": 4242,
  "username": "octocat",
  "name": "The Octocat",
  "email": "octo@example.com",
  "provider": "github"
}
```

### should pass profile fields through unchanged when no map is given

```execute
aux4 oauth exchange --provider plain --tokenUrl http://localhost:8731/token --userinfoUrl http://localhost:8731/userinfo --clientId CID --clientSecret CSECRET --code authcode123 --codeVerifier verifier456 --redirectUri https://app.example/callback
```

```expect:json
{
  "id": 4242,
  "login": "octocat",
  "name": "The Octocat",
  "email": "octo@example.com",
  "provider": "plain"
}
```

### should resolve the tokenUrl, userinfoUrl, and field map from the user config

```file:config.yaml
config:
  github:
    tokenUrl: http://localhost:8731/token
    userinfoUrl: http://localhost:8731/userinfo
    map:
      id: sub
      login: username
```

```execute
aux4 oauth exchange --provider github --configFile config.yaml --clientId CID --clientSecret CSECRET --code authcode123 --codeVerifier verifier456 --redirectUri https://app.example/callback
```

```expect:json
{
  "sub": 4242,
  "username": "octocat",
  "name": "The Octocat",
  "email": "octo@example.com",
  "provider": "github"
}
```

### should fail when the token endpoint rejects the code

```execute
aux4 oauth exchange --provider github --tokenUrl http://localhost:8731/token --userinfoUrl http://localhost:8731/userinfo --clientId CID --clientSecret CSECRET --code wrongcode --codeVerifier verifier456 --redirectUri https://app.example/callback
```

```error:partial
Error: token endpoint returned 400*?
```

## missing-URL error paths

### should fail for an unknown provider with no tokenUrl

```execute
aux4 oauth exchange --provider notaprovider --clientId X --code C --codeVerifier V --redirectUri https://app.example/callback
```

```error:partial
Error: no tokenUrl for provider 'notaprovider'; pass --tokenUrl or install a provider package
```

### should fail when tokenUrl resolves but userinfoUrl is missing

```execute
aux4 oauth exchange --provider acme --tokenUrl https://acme.example/token --clientId X --code C --codeVerifier V --redirectUri https://app.example/callback
```

```error:partial
Error: no userinfoUrl for provider 'acme'; pass --userinfoUrl or install a provider package
```
