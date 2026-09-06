# oauth authorize-url

The `authorize-url` command is fully deterministic except for the random
`codeVerifier` and generated `state`. Tests assert the URL structure, that the
resolved `authUrl` and scopes are used, and — crucially — that
`base64url(sha256(codeVerifier))` equals the `code_challenge` carried in the URL
(proving PKCE S256 correctness). A small Node helper validates the PKCE binding.

## explicit endpoint flags

### should build a PKCE authorize URL from the explicit flags

```execute
aux4 oauth authorize-url --provider acme --authUrl https://acme.example/authorize --clientId ACMEID --redirectUri https://app.example/callback --scopes openid,email --state mystate123
```

```expect:partial
{"url":"https://acme.example/authorize?response_type=code&client_id=ACMEID&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&scope=openid+email&state=mystate123&code_challenge=**code_challenge_method=S256"**"state":"mystate123"}
```

### should generate a random state when none is supplied

```execute
aux4 oauth authorize-url --provider acme --authUrl https://acme.example/authorize --clientId ACMEID --redirectUri https://app.example/callback --scopes openid | node -e 'const s=require("fs").readFileSync(0,"utf8");const o=JSON.parse(s);console.log(o.state && o.state.length>0 ? "has-state" : "no-state");console.log(o.url.includes("state="+o.state) ? "url-has-state" : "url-missing-state")'
```

```expect
has-state
url-has-state
```

## PKCE correctness

### should produce a code_challenge equal to base64url(sha256(codeVerifier))

```execute
aux4 oauth authorize-url --provider acme --authUrl https://acme.example/authorize --clientId ACMEID --redirectUri https://app.example/callback --scopes openid,email | node -e '
const crypto = require("crypto");
const o = JSON.parse(require("fs").readFileSync(0, "utf8"));
const challengeInUrl = new URL(o.url).searchParams.get("code_challenge");
const b64url = b => Buffer.from(b).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const computed = b64url(crypto.createHash("sha256").update(o.codeVerifier).digest());
console.log(challengeInUrl === computed ? "pkce-match" : "pkce-mismatch");
'
```

```expect
pkce-match
```

### should set code_challenge_method to S256 and response_type to code

```execute
aux4 oauth authorize-url --provider acme --authUrl https://acme.example/authorize --clientId ACMEID --redirectUri https://app.example/callback --scopes openid | node -e '
const o = JSON.parse(require("fs").readFileSync(0, "utf8"));
const p = new URL(o.url).searchParams;
console.log(p.get("response_type"));
console.log(p.get("code_challenge_method"));
'
```

```expect
code
S256
```

## bundled aux4 provider

### should resolve the bundled sso.aux4.io authUrl and scopes without URL flags

```execute
aux4 oauth authorize-url --provider aux4 --clientId AUX4ID --redirectUri https://app.example/callback --state s1
```

```expect:partial
{"url":"https://sso.aux4.io/authorize?response_type=code&client_id=AUX4ID**scope=openid+email+profile**code_challenge_method=S256"**}
```

## user config resolution

```file:config.yaml
config:
  myco:
    authUrl: https://myco.example/authorize
    tokenUrl: https://myco.example/token
    scopes: openid,profile
```

### should resolve the authUrl and scopes from the user config file

```execute
aux4 oauth authorize-url --provider myco --configFile config.yaml --clientId MYCOID --redirectUri https://app.example/callback --state s2
```

```expect:partial
{"url":"https://myco.example/authorize?response_type=code&client_id=MYCOID**scope=openid+profile**}
```

### should let an explicit flag override the user config value

```execute
aux4 oauth authorize-url --provider myco --configFile config.yaml --authUrl https://override.example/authorize --clientId MYCOID --redirectUri https://app.example/callback --state s3
```

```expect:partial
{"url":"https://override.example/authorize?**}
```

## scope override

### should use the overridden scopes instead of the bundled defaults

```execute
aux4 oauth authorize-url --provider aux4 --clientId AUX4ID --redirectUri https://app.example/callback --scopes openid --state s4
```

```expect:partial
{"url":"https://sso.aux4.io/authorize?response_type=code&client_id=AUX4ID&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback&scope=openid&state=s4&**}
```

## scope delimiter normalization

The OAuth2 spec requires the `scope` parameter to be space-delimited, and Google
rejects a comma-joined value. The builder accepts scopes separated by commas
and/or whitespace and always emits a single-space-joined `scope` (URL-encoded as
`+`), de-duplicating repeated scopes.

### should normalize comma-separated scopes to a single space

```execute
aux4 oauth authorize-url --provider acme --authUrl https://acme.example/authorize --clientId ACMEID --redirectUri https://app.example/callback --scopes "https://www.googleapis.com/auth/drive,openid,email" --state s | node -e 'const o=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(new URL(o.url).searchParams.get("scope"))'
```

```expect
https://www.googleapis.com/auth/drive openid email
```

### should normalize space-separated scopes to the same result

```execute
aux4 oauth authorize-url --provider acme --authUrl https://acme.example/authorize --clientId ACMEID --redirectUri https://app.example/callback --scopes "https://www.googleapis.com/auth/drive openid email" --state s | node -e 'const o=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(new URL(o.url).searchParams.get("scope"))'
```

```expect
https://www.googleapis.com/auth/drive openid email
```

### should collapse mixed commas and whitespace and drop empty entries

```execute
aux4 oauth authorize-url --provider acme --authUrl https://acme.example/authorize --clientId ACMEID --redirectUri https://app.example/callback --scopes "openid, email ,profile" --state s | node -e 'const o=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(new URL(o.url).searchParams.get("scope"))'
```

```expect
openid email profile
```

### should de-duplicate repeated scopes preserving order

```execute
aux4 oauth authorize-url --provider acme --authUrl https://acme.example/authorize --clientId ACMEID --redirectUri https://app.example/callback --scopes "openid,email,openid" --state s | node -e 'const o=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(new URL(o.url).searchParams.get("scope"))'
```

```expect
openid email
```

## missing-URL error path

### should fail for an unknown provider with no authUrl

```execute
aux4 oauth authorize-url --provider notaprovider --clientId X --redirectUri https://app.example/callback
```

```error:partial
Error: no authUrl for provider 'notaprovider'; pass --authUrl or install a provider package
```
