const path = require("path");
const fs = require("fs");

class Repository {
  constructor(config, file) {
    this.repositoryFile = path.join(config.folder, file);

    const tokensFileContent = fs.existsSync(this.repositoryFile)
      ? fs.readFileSync(this.repositoryFile, { encoding: "utf-8" })
      : JSON.stringify({ data: {}, index: {} });

    this.content = JSON.parse(tokensFileContent);
  }

  async get(id) {
    return this.content.data[id];
  }

  async getByIndex(index) {
    const id = this.content.index[index];
    if (!id) return undefined;

    return this.content.data[id];
  }

  async save(data, id = data.id, index) {
    this.content.data[id] = data;

    if (index) {
      this.content.index[index] = id;
    }

    await this.flush();
  }

  async delete(id) {
    delete this.content.data[id];

    const index = Object.keys(this.content.index).find(key => this.content.index[key] === id);
    if (index) {
      delete this.content.index[index];
    }

    await this.flush();
  }

  async flush() {
    fs.writeFileSync(this.repositoryFile, JSON.stringify(this.content), { encoding: "utf-8" });
  }
}

module.exports = Repository;
