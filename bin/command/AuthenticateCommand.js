const { Printer } = require("@aux4/engine");
const OAuthServer = require("../../lib/OAuthServer");
const OAuthConfigModel = require("../../lib/OAuthConfigModel");

async function authenticateCommand(params) {
  const out = Printer.on(process.stdout);

  const accessToken = await params.accessToken;

  const options = await params.options;
  const model = await params.model;
  const scope = (await params.scope) || undefined;

  const server = new OAuthServer(options, new OAuthConfigModel(model));

  const response = await server.authenticate(
    {
      method: "POST",
      query: {},
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    {},
    { scope: scope.split(" ") }
  );

  out.println(JSON.stringify(response, null, 2));
}

module.exports = { authenticateCommand };
