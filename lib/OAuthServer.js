const Oauth2Server = require("@node-oauth/oauth2-server");

const Request = Oauth2Server.Request;
const Response = Oauth2Server.Response;

class OAuthServer {
  constructor(config, model) {
    this.server = new Oauth2Server({ ...config, model });
  }

  async token(req = {}, res = {}, options = {}) {
    const request = new Request(req);
    const response = new Response(res);
    return await this.server.token(request, response, options);
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
