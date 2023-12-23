const { Printer } = require("@aux4/engine");
const OAuthServer = require("../../lib/OAuthServer");

async function authorizeCommand(params) {
  const out = Printer.on(process.stdout);

  const accessToken = await params.accessToken;

  const clientId = await params.client_id;
  const clientSecret = await params.client_secret;
  const scope = (await params.scope) || undefined;

  const server = await OAuthServer.from(params);

  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    response_type: "code",
    scope
  };

  const response = await server.authorize(
    {
      method: "POST",
      query: {},
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: body
    },
    {}
  );

  out.println(JSON.stringify(response, null, 2));
}

module.exports = { authorizeCommand };
