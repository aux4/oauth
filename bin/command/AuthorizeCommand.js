const { Printer } = require("@aux4/engine");
const OAuthServer = require("../../lib/OAuthServer");
const OAuthConfigModel = require("../../lib/OAuthConfigModel");

async function authorizeCommand(params) {
  const out = Printer.on(process.stdout);

  const accessToken = await params.accessToken;

  const options = await params.options;
  const model = await params.model;
  const clientId = await params.client_id;
  const clientSecret = await params.client_secret;
  const scope = (await params.scope) || undefined;

  const server = new OAuthServer(options, new OAuthConfigModel(model));

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
