const Repository = require("./Repository");
const path = require("path");
const fs = require("fs");

class OAuthRepository {
  constructor(config) {
    if (!config.folder) {
      config.folder = path.join(".", ".aux4-oauth");
    }

    if (!fs.existsSync(config.folder)) {
      fs.mkdirSync(config.folder, { recursive: true });
    }

    this.clientRepository = new Repository(config, "clients.json");
    this.userRepository = new Repository(config, "users.json");
    this.accessTokenRepository = new Repository(config, "accessTokens.json");
    this.refreshTokenRepository = new Repository(config, "refreshTokens.json");
    this.authorizationCodeRepository = new Repository(config, "authorizationCodes.json");
  }

  async saveClient(client) {
    await this.clientRepository.save(client);
  }

  async getClient(clientId) {
    return this.clientRepository.get(clientId);
  }

  async saveUser(user) {
    await this.userRepository.save(user, user.id, user.username);
  }

  async getUser(userId) {
    return this.userRepository.get(userId);
  }

  async getUserByUsernameAndPassword(username, password) {
    const user = await this.userRepository.getByIndex(username);
    if (!user) return undefined;

    if (user.password !== password) return undefined;
    return user;
  }

  async saveAccessToken(token) {
    await this.accessTokenRepository.save(token, token.access_token);
  }

  async getAccessToken(accessToken) {
    return this.accessTokenRepository.get(accessToken);
  }

  async saveRefreshToken(token) {
    await this.refreshTokenRepository.save(token, token.refresh_token);
  }

  async getRefreshToken(refreshToken) {
    return this.refreshTokenRepository.get(refreshToken);
  }

  async revokeRefreshToken(refreshToken) {
    await this.refreshTokenRepository.delete(refreshToken);
  }

  async saveAuthorizationCode(code) {
    await this.authorizationCodeRepository.save(code, code.authorization_code);
  }

  async getAuthorizationCode(authorizationCode) {
    return this.authorizationCodeRepository.get(authorizationCode);
  }

  async revokeAuthorizationCode(authorizationCode) {
    await this.authorizationCodeRepository.delete(authorizationCode);
  }
}

module.exports = OAuthRepository;
