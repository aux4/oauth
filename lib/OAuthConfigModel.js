const fs = require("fs");
const path = require("path");
const Repository = require("./Repository");

class OAuthConfigModel {
  constructor(config) {
    if (!config.folder) {
      config.folder = path.join(".", ".aux4-oauth");
    }
    this.config = config;

    if (!fs.existsSync(config.folder)) {
      fs.mkdirSync(config.folder, { recursive: true });
    }

    this.clientRepository = new Repository(config, "clients.json");
    this.userRepository = new Repository(config, "users.json");
    this.accessTokenRepository = new Repository(config, "accessTokens.json");
    this.refreshTokenRepository = new Repository(config, "refreshTokens.json");
    this.authorizationCodeRepository = new Repository(config, "authorizationCodes.json");

    // TODO: remove those items
    Promise.all(
      (config.clients || []).map(async client => {
        await this.clientRepository.save(client);
      })
    );

    Promise.all(
      (config.users || []).map(async user => {
        await this.userRepository.save(user, user.id, user.username);
      })
    );
  }

  async getClient(clientId) {
    return this.clientRepository.get(clientId);
  }

  async getUser(username, password) {
    const user = await this.userRepository.getByIndex(username);
    if (!user) return undefined;

    if (user.password !== password) return undefined;
    return user;
  }

  async saveToken(token, client, user) {
    await this.accessTokenRepository.save(
      {
        access_token: token.accessToken,
        expires_at: token.accessTokenExpiresAt,
        scope: token.scope,
        client_id: client.id,
        user_id: user.id
      },
      token.accessToken
    );

    if (token.refreshToken) {
      await this.refreshTokenRepository.save(
        {
          refresh_token: token.refreshToken,
          expires_at: token.refreshTokenExpiresAt,
          scope: token.scope,
          client_id: client.id,
          user_id: user.id
        },
        token.refreshToken
      );
    }

    const response = { ...token };
    response.scope = token.scope.split(" ");
    response.client = {
      id: client.id
    };

    response.user = {
      id: user.id
    };

    return response;
  }

  async getAccessToken(accessToken) {
    const token = await this.accessTokenRepository.get(accessToken);
    if (!token) return undefined;

    return {
      accessToken: token.access_token,
      accessTokenExpiresAt: new Date(token.expires_at),
      scope: token.scope.split(" "),
      client: {
        id: token.client_id
      },
      user: {
        id: token.user_id
      }
    };
  }

  async getRefreshToken(refreshToken) {
    const token = await this.refreshTokenRepository.get(refreshToken);
    if (!token) return undefined;

    return {
      refreshToken: token.refresh_token,
      refreshTokenExpiresAt: new Date(token.expires_at),
      scope: token.scope.split(" "),
      client: {
        id: token.client_id
      },
      user: {
        id: token.user_id
      }
    };
  }

  async revokeToken(token) {
    if (!token.refreshToken) return;

    await this.refreshTokenRepository.delete(token.refreshToken);

    return true;
  }

  async saveAuthorizationCode(code, client, user) {
    const authorizationCode = {
      authorization_code: code.authorizationCode,
      expires_at: code.expiresAt,
      redirect_uri: code.redirectUri,
      scope: code.scope,
      client_id: client.id,
      user_id: user.id
    };

    await this.authorizationCodeRepository.save(authorizationCode, authorizationCode.authorization_code);

    return {
      authorizationCode: authorizationCode.authorization_code,
      expiresAt: authorizationCode.expires_at,
      redirectUri: authorizationCode.redirect_uri,
      scope: authorizationCode.scope.split(" "),
      client: { id: authorizationCode.client_id },
      user: { id: authorizationCode.user_id }
    };
  }

  async getAuthorizationCode(code) {
    const authorizationCode = await this.authorizationCodeRepository.get(code);
    if (!authorizationCode) return undefined;

    return {
      authorizationCode: authorizationCode.authorization_code,
      expiresAt: authorizationCode.expires_at,
      redirectUri: authorizationCode.redirect_uri,
      scope: authorizationCode.scope.split(" "),
      client: { id: authorizationCode.client_id },
      user: { id: authorizationCode.user_id }
    };
  }

  async revokeAuthorizationCode(code) {
    await this.authorizationCodeRepository.delete(code.authorizationCode);
  }

  async getUserFromClient(client) {
    const clientItem = await this.clientRepository.get(client.id);
    if (!clientItem) return undefined;

    return {
      id: clientItem.user_id
    };
  }

  async validateScope(user, client, scope) {
    const validScopes =
      typeof this.config.validScopes === "string" ? this.config.validScopes.split(" ") : this.config.validScopes || [];
    return scope.filter(item => validScopes.includes(item)).join(" ");
  }

  async verifyScope(token, scope) {
    if (!token.scope) {
      return false;
    }
    return scope.every(requestedScope => token.scope.includes(requestedScope));
  }
}

module.exports = OAuthConfigModel;
