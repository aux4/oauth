#!/usr/bin/env node

const { Engine } = require("@aux4/engine");
const { tokenCommand } = require("./command/TokenCommand");
const { authorizeCommand } = require("./command/AuthorizeCommand");
const { authenticateCommand } = require("./command/AuthenticateCommand");

process.title = "aux4-oauth";

const config = {
  profiles: [
    {
      name: "main",
      commands: [
        {
          name: "token",
          execute: tokenCommand,
          help: {
            text: "Get OAuth token",
            variables: [
              {
                name: "grant_type",
                text: "Grant type",
                default: "password"
              },
              {
                name: "client_id",
                text: "Client ID",
                default: "",
                hide: true
              },
              {
                name: "client_secret",
                text: "Client secret",
                default: "",
                hide: true
              },
              {
                name: "username",
                text: "Username",
                default: ""
              },
              {
                name: "password",
                text: "Password",
                default: "",
                hide: true
              },
              {
                name: "scope",
                text: "Scope",
                default: ""
              }
            ]
          }
        },
        {
          name: "authenticate",
          execute: authenticateCommand,
          help: {
            text: "Authenticate OAuth token",
            variables: [
              {
                name: "client_id",
                text: "Client ID",
                hide: true
              },
              {
                name: "client_secret",
                text: "Client secret",
                hide: true
              },
              {
                name: "scope",
                text: "Scope",
                default: ""
              },
              {
                name: "accessToken",
                text: "Access token",
                arg: true
              }
            ]
          }
        },
        {
          name: "authorize",
          execute: authorizeCommand,
          help: {
            text: "Authorize OAuth token",
            variables: [
              {
                name: "grant_type",
                text: "Grant type",
                default: "password"
              },
              {
                name: "client_id",
                text: "Client ID",
                hide: true
              },
              {
                name: "client_secret",
                text: "Client secret",
                hide: true
              },
              {
                name: "scope",
                text: "Scope",
                default: ""
              },
              {
                name: "accessToken",
                text: "Access token",
                arg: true
              }
            ]
          }
        }
      ]
    }
  ]
};

(async () => {
  const engine = new Engine({ aux4: config });

  const args = process.argv.splice(2);

  try {
    await engine.run(args);
  } catch (e) {
    console.error(e.message.red, e);
    process.exit(1);
  }
})();
