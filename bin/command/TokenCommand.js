const { Printer } = require("@aux4/engine");
const OAuthServer = require("../../lib/OAuthServer");

async function tokenCommand(params) {
  const out = Printer.on(process.stdout);

  const grantType = await params.grant_type;
  const clientId = await params.client_id;
  const clientSecret = await params.client_secret;
  const username = await params.username;
  const password = await params.password;
  const authorizationCode = await params.authorization_code;
  const refreshToken = await params.refresh_token;
  const redirectUri = await params.redirect_uri;
  const scope = (await params.scope) || undefined;

  const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const server = await OAuthServer.from(params);

  const body = {
    grant_type: grantType,
    redirect_uri: redirectUri,
    scope
  };

  if (grantType === "password") {
    body.username = username;
    body.password = password;
  } else if (grantType === "authorization_code") {
    body.code = authorizationCode;
  } else if (grantType === "client_credentials") {
    body.client_id = clientId;
    body.client_secret = clientSecret;
  } else if (grantType === "refresh_token") {
    body.refresh_token = refreshToken;
  }

  const response = await server.token(
    {
      method: "POST",
      query: {},
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": JSON.stringify(body).length
      },
      body: body
    },
    {}
  );

  out.println(JSON.stringify(response, null, 2));
}

module.exports = { tokenCommand };
