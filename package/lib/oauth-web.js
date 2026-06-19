#!/usr/bin/env node
"use strict";

/*
 * Server-side primitives for the OAuth2 authorization-code-with-PKCE web flow.
 *
 * Zero dependencies — Node.js built-ins only:
 *   - crypto    PKCE (randomBytes + sha256), base64url
 *   - fetch     HTTP (Node 18+ global)
 *   - URLSearchParams / Buffer  encoding
 *
 * Provider configuration (authUrl, tokenUrl, userinfoUrl, scopes, field map)
 * is resolved declaratively in the package .aux4 and passed in as flags. This
 * file only does PKCE generation, HTTP, and field mapping.
 *
 * Subcommands:
 *   authorize-url --authUrl --clientId --redirectUri [--scopes] [--state]
 *       -> {"url","codeVerifier","state"}
 *   exchange --tokenUrl --userinfoUrl --clientId --clientSecret --code
 *            --codeVerifier --redirectUri --provider [--map <json>]
 *       -> principal JSON
 */

const crypto = require("crypto");

function base64url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = "";
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function requireArg(args, name, command) {
  const value = args[name];
  if (value === undefined || value === "") {
    fail(`Error: missing required --${name} for '${command}'`);
  }
  return value;
}

function fail(message) {
  process.stderr.write(message + "\n");
  process.exit(1);
}

function pkce() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );
  return { codeVerifier, codeChallenge };
}

function authorizeUrl(args) {
  const authUrl = requireArg(args, "authUrl", "authorize-url");
  const clientId = requireArg(args, "clientId", "authorize-url");
  const redirectUri = requireArg(args, "redirectUri", "authorize-url");
  const scopes = args.scopes || "";

  const { codeVerifier, codeChallenge } = pkce();
  const state =
    args.state && args.state !== ""
      ? args.state
      : base64url(crypto.randomBytes(16));

  const params = new URLSearchParams();
  params.set("response_type", "code");
  params.set("client_id", clientId);
  params.set("redirect_uri", redirectUri);
  if (scopes !== "") {
    params.set("scope", scopes);
  }
  params.set("state", state);
  params.set("code_challenge", codeChallenge);
  params.set("code_challenge_method", "S256");

  const separator = authUrl.includes("?") ? "&" : "?";
  const url = `${authUrl}${separator}${params.toString()}`;

  process.stdout.write(JSON.stringify({ url, codeVerifier, state }) + "\n");
}

async function exchange(args) {
  const tokenUrl = requireArg(args, "tokenUrl", "exchange");
  const userinfoUrl = requireArg(args, "userinfoUrl", "exchange");
  const clientId = requireArg(args, "clientId", "exchange");
  const clientSecret = args.clientSecret || "";
  const code = requireArg(args, "code", "exchange");
  const codeVerifier = requireArg(args, "codeVerifier", "exchange");
  const redirectUri = requireArg(args, "redirectUri", "exchange");
  const provider = args.provider || "";

  let map = {};
  if (args.map && args.map !== "") {
    try {
      map = JSON.parse(args.map);
    } catch (error) {
      fail(`Error: --map is not valid JSON: ${error.message}`);
    }
  }

  const tokenBody = new URLSearchParams();
  tokenBody.set("grant_type", "authorization_code");
  tokenBody.set("code", code);
  tokenBody.set("redirect_uri", redirectUri);
  tokenBody.set("client_id", clientId);
  if (clientSecret !== "") {
    tokenBody.set("client_secret", clientSecret);
  }
  tokenBody.set("code_verifier", codeVerifier);

  let tokenResponse;
  try {
    tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body: tokenBody.toString()
    });
  } catch (error) {
    fail(`Error: token request failed: ${error.message}`);
  }

  const tokenText = await tokenResponse.text();
  if (!tokenResponse.ok) {
    fail(`Error: token endpoint returned ${tokenResponse.status}: ${tokenText}`);
  }

  let tokenData;
  try {
    tokenData = JSON.parse(tokenText);
  } catch (error) {
    fail(`Error: token endpoint returned non-JSON response: ${tokenText}`);
  }

  const accessToken = tokenData.access_token;
  if (!accessToken) {
    fail(`Error: token endpoint did not return an access_token: ${tokenText}`);
  }

  let userinfoResponse;
  try {
    userinfoResponse = await fetch(userinfoUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });
  } catch (error) {
    fail(`Error: userinfo request failed: ${error.message}`);
  }

  const userinfoText = await userinfoResponse.text();
  if (!userinfoResponse.ok) {
    fail(
      `Error: userinfo endpoint returned ${userinfoResponse.status}: ${userinfoText}`
    );
  }

  let profile;
  try {
    profile = JSON.parse(userinfoText);
  } catch (error) {
    fail(`Error: userinfo endpoint returned non-JSON response: ${userinfoText}`);
  }

  const principal = applyMap(profile, map);
  if (provider !== "") {
    principal.provider = provider;
  }

  process.stdout.write(JSON.stringify(principal) + "\n");
}

/*
 * Build the principal from the userinfo profile.
 *
 * The field map renames source fields to canonical claim names, e.g. GitHub
 * returns `id` for the subject, so a map of {"id":"sub"} produces
 * principal.sub. Fields not named in the map are passed through unchanged, so
 * a standard OIDC provider (which already returns `sub`/`email`/`name`) needs
 * no map at all.
 */
function applyMap(profile, map) {
  const principal = {};
  const remappedSources = new Set(Object.keys(map));

  for (const [source, target] of Object.entries(map)) {
    if (profile[source] !== undefined) {
      principal[target] = profile[source];
    }
  }

  for (const [key, value] of Object.entries(profile)) {
    if (remappedSources.has(key)) {
      continue;
    }
    if (principal[key] === undefined) {
      principal[key] = value;
    }
  }

  return principal;
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const args = parseArgs(argv.slice(1));

  if (command === "authorize-url") {
    authorizeUrl(args);
  } else if (command === "exchange") {
    await exchange(args);
  } else {
    fail(`Error: unknown subcommand '${command || ""}'`);
  }
}

main().catch((error) => {
  fail(`Error: ${error.message}`);
});
