const { Printer } = require("@aux4/engine");
const OAuthServer = require("../../lib/OAuthServer");

async function authenticateCommand(params) {
  const out = Printer.on(process.stdout);

  const accessToken = await params.accessToken;

  const scope = (await params.scope) || undefined;

  const server = await OAuthServer.from(params);

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
