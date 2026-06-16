# oauth token

## no stored token

### should report that no token is found and tell the user to log in

```execute
aux4 oauth token --provider aux4
```

```error:partial
Error: no token found for provider "aux4". Run oauth login first
```

### should delegate to the named provider's token file

```execute
aux4 oauth token --provider acme
```

```error:partial
Error: no token found for provider "acme". Run oauth login first
```
