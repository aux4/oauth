"use strict";

/*
 * Tiny mock OAuth2 server used by oauth__exchange.test.md.
 *
 * It exposes a token endpoint and a userinfo endpoint so the `oauth exchange`
 * command can be tested end to end without a real identity provider. Zero
 * dependencies — Node built-in http only.
 *
 *   POST /token     validates the PKCE form fields, returns a fake access_token
 *   GET  /userinfo  requires Bearer mockaccess, returns a GitHub-style profile
 *                   (numeric `id`, `login`, `name`, `email`)
 */

const http = require("http");

const PORT = Number(process.env.MOCK_OAUTH_PORT || 8731);

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    if (req.method === "POST" && req.url === "/token") {
      const params = new URLSearchParams(body);
      if (
        params.get("grant_type") !== "authorization_code" ||
        params.get("code") !== "authcode123" ||
        params.get("code_verifier") !== "verifier456"
      ) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_request" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: "mockaccess", token_type: "bearer" }));
    } else if (req.method === "GET" && req.url === "/userinfo") {
      if ((req.headers["authorization"] || "") !== "Bearer mockaccess") {
        res.writeHead(401);
        res.end("unauthorized");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: 4242,
          login: "octocat",
          name: "The Octocat",
          email: "octo@example.com"
        })
      );
    } else {
      res.writeHead(404);
      res.end("not found");
    }
  });
});

server.listen(PORT, () => {
  process.stdout.write(`listening on ${PORT}\n`);
});
