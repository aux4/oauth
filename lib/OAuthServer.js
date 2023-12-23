const Oauth2Server = require("@node-oauth/oauth2-server");
const OAuthConfigModel = require("./OAuthConfigModel");
const OAuthRepository = require("./OauthRepository");

const Request = Oauth2Server.Request;
const Response = Oauth2Server.Response;

class OAuthServer {
  constructor(config, model) {
    this.server = new Oauth2Server({ ...config, model });
  }

  static async from(params) {
    const options = await params.options;
    const model = await params.model;

    return new OAuthServer(options, new OAuthConfigModel(model, new OAuthRepository(model)));
  }

  async token(req = {}, res = {}, options = {}) {
    const request = new Request(req);
    const response = new Response(res);
    const token = await this.server.token(request, response, options);
    console.log("response", response);
    return token;
  }

  async authenticate(req = {}, res = {}, options = {}) {
    const request = new Request(req);
    const response = new Response(res);
    return await this.server.authenticate(request, response, options);
  }

  async authorize(req = {}, res = {}, options = {}) {
    const request = new Request(req);
    const response = new Response(res);
    return await this.server.authorize(request, response, options);
  }
}

module.exports = OAuthServer;
