# oauth status

## no stored token

### should report that no token is found for the provider

```execute
aux4 oauth status --provider aux4
```

```error:partial
No token found for provider "aux4"
```

### should delegate to the named provider's token file

```execute
aux4 oauth status --provider acme
```

```error:partial
No token found for provider "acme"
```
