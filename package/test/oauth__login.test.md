# oauth login

The browser-based OAuth flow cannot run unattended, so these tests use an invalid
callback port (`99999`) to make the delegated `aux4 curl oauth login` print the
authorization URL it built (from resolved endpoints and scopes) and then fail fast.
The URL and the failure are written to stderr. This verifies that endpoints are
resolved with the correct precedence and that the delegation command is constructed
as expected, without completing an interactive login.

## explicit endpoint flags

### should build the authorize URL from the explicit flags and scopes

```execute
aux4 oauth login --provider acme --authUrl https://acme.example/oauth/authorize --tokenUrl https://acme.example/oauth/token --scopes openid,email --clientId ACMEID --clientSecret ACMESECRET --callbackPort 99999
```

```error:partial
https://acme.example/oauth/authorize?client_id=ACMEID**scope=openid%2Cemail**Error: could not listen on port 99999*?
```

## bundled aux4 provider

### should resolve the bundled sso.aux4.io URLs without any URL flags

```execute
aux4 oauth login --provider aux4 --clientId AUX4ID --clientSecret AUX4SECRET --callbackPort 99999
```

```error:partial
https://sso.aux4.io/authorize?client_id=AUX4ID**scope=openid%2Cemail%2Cprofile**Error: could not listen on port 99999*?
```

## user config resolution

```file:config.yaml
config:
  myco:
    authUrl: https://myco.example/authorize
    tokenUrl: https://myco.example/token
    scopes: openid,profile
    clientId: CONFIGID
    clientSecret: CONFIGSECRET
```

### should resolve endpoints and credentials from the user config file

```execute
aux4 oauth login --provider myco --configFile config.yaml --callbackPort 99999
```

```error:partial
https://myco.example/authorize?client_id=CONFIGID**scope=openid%2Cprofile**Error: could not listen on port 99999*?
```

### should let an explicit flag override the user config value

```execute
aux4 oauth login --provider myco --configFile config.yaml --authUrl https://override.example/authorize --callbackPort 99999
```

```error:partial
https://override.example/authorize?client_id=CONFIGID**Error: could not listen on port 99999*?
```

## scope override

### should use the overridden scopes instead of the bundled defaults

```execute
aux4 oauth login --provider aux4 --clientId AUX4ID --clientSecret AUX4SECRET --scopes openid --callbackPort 99999
```

```error:partial
https://sso.aux4.io/authorize?client_id=AUX4ID**scope=openid&**Error: could not listen on port 99999*?
```

## missing-URL error path

### should fail for an unknown provider with no URL flags

```execute
aux4 oauth login --provider notaprovider --clientId X --clientSecret Y
```

```error:partial
Error: no authUrl for provider 'notaprovider'; pass --authUrl/--tokenUrl or install a provider package
```

### should fail when only authUrl is given but tokenUrl is missing

```execute
aux4 oauth login --provider acme --authUrl https://acme.example/oauth/authorize --clientId X --clientSecret Y
```

```error:partial
Error: no tokenUrl for provider 'acme'; pass --authUrl/--tokenUrl or install a provider package
```
