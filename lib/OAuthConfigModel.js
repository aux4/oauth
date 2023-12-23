class OAuthConfigModel {
  constructor(config, repository) {
    this.config = config;
    this.repository = repository;
  }

  async getClient(clientId) {
    return this.repository.getClient(clientId);
  }

  async getUser(username, password) {
    return this.repository.getUserByUsernameAndPassword(username, password);
  }

  async saveToken(token, client, user) {
    await this.repository.saveAccessToken({
      access_token: token.accessToken,
      authorization_code: token.authorizationCode,
      expires_at: token.accessTokenExpiresAt,
      scope: token.scope,
      client_id: client.id,
      user_id: user.id
    });

    if (token.refreshToken) {
      await this.repository.saveRefreshToken({
        refresh_token: token.refreshToken,
        authorization_code: token.authorizationCode,
        expires_at: token.refreshTokenExpiresAt,
        scope: token.scope,
        client_id: client.id,
        user_id: user.id
      });
    }

    const response = { ...token };
    response.scope = token.scope;
    response.client = {
      id: client.id
    };

    response.user = {
      id: user.id
    };

    return response;
  }

  async getAccessToken(accessToken) {
    const token = await this.repository.getAccessToken(accessToken);
    if (!token) return undefined;

    return {
      accessToken: token.access_token,
      authorizationCode: token.authorization_code,
      accessTokenExpiresAt: new Date(token.expires_at),
      scope: token.scope,
      client: {
        id: token.client_id
      },
      user: {
        id: token.user_id
      }
    };
  }

  async getRefreshToken(refreshToken) {
    const token = await this.repository.getRefreshToken(refreshToken);
    if (!token) return undefined;

    return {
      refreshToken: token.refresh_token,
      authorizationCode: token.authorization_code,
      refreshTokenExpiresAt: new Date(token.expires_at),
      scope: token.scope,
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

    await this.repository.revokeRefreshToken(token.refreshToken);

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

    await this.repository.saveAuthorizationCode(authorizationCode);

    return {
      authorizationCode: authorizationCode.authorization_code,
      expiresAt: authorizationCode.expires_at,
      redirectUri: authorizationCode.redirect_uri,
      scope: authorizationCode.scope,
      client: { id: authorizationCode.client_id },
      user: { id: authorizationCode.user_id }
    };
  }

  async getAuthorizationCode(code) {
    const authorizationCode = await this.repository.getAuthorizationCode(code);
    if (!authorizationCode) return undefined;

    return {
      authorizationCode: authorizationCode.authorization_code,
      expiresAt: new Date(authorizationCode.expires_at),
      redirectUri: authorizationCode.redirect_uri,
      scope: authorizationCode.scope,
      client: { id: authorizationCode.client_id },
      user: { id: authorizationCode.user_id }
    };
  }

  async revokeAuthorizationCode(code) {
    await this.repository.revokeAuthorizationCode(code.authorizationCode);

    return true;
  }

  async getUserFromClient(client) {
    const clientItem = await this.repository.getClient(client.id);
    if (!clientItem) return undefined;

    return {
      id: clientItem.user_id
    };
  }

  async validateScope(user, client, scope) {
    if (!scope) return false;

    const validScopes =
      typeof this.config.validScopes === "string" ? this.config.validScopes.split(" ") : this.config.validScopes || [];

    const requestScope = typeof scope === "string" ? scope.split(" ") : scope || [];
    return requestScope.filter(item => validScopes.includes(item)).join(" ");
  }

  async verifyScope(token, scope) {
    if (!scope || !token.scope) {
      return false;
    }
    return scope.every(requestedScope => token.scope.includes(requestedScope));
  }
}

module.exports = OAuthConfigModel;
