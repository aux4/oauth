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
const fs = require("fs");
const path = require("path");
const os = require("os");

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

// Decide how the confidential client authenticates at the token endpoint.
// clientSecretIn "basic" → HTTP Basic auth (client_secret_basic), which some
// providers require (e.g. X/Twitter confidential clients); anything else → the
// secret goes in the form body (client_secret_post, the common default). A public
// client (no secret) uses neither and relies on PKCE alone. Returns the header to
// merge and whether the body should carry client_secret.
function clientAuth(clientId, clientSecret, clientSecretIn) {
  if (clientSecret !== "" && clientSecretIn === "basic") {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    return { header: { Authorization: `Basic ${basic}` }, bodySecret: false };
  }
  return { header: {}, bodySecret: clientSecret !== "" };
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

  const auth = clientAuth(clientId, clientSecret, args.clientSecretIn);

  const tokenBody = new URLSearchParams();
  tokenBody.set("grant_type", "authorization_code");
  tokenBody.set("code", code);
  tokenBody.set("redirect_uri", redirectUri);
  tokenBody.set("client_id", clientId);
  if (auth.bodySecret) {
    tokenBody.set("client_secret", clientSecret);
  }
  tokenBody.set("code_verifier", codeVerifier);

  let tokenResponse;
  try {
    tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        ...auth.header
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

  if (args.includeTokens === "true") {
    // Token-broker mode: return the tokens themselves alongside the identity, so
    // a caller that holds no client secret (the OAuth broker's HTTP client) can
    // persist and later use/refresh them. Without this flag the command stays an
    // identity-only exchange (the web-login shape).
    const output = {
      accessToken,
      refreshToken: tokenData.refresh_token || "",
      idToken: tokenData.id_token || "",
      expiresIn: typeof tokenData.expires_in === "number" ? tokenData.expires_in : undefined,
      tokenType: tokenData.token_type || "Bearer",
      principal
    };
    process.stdout.write(JSON.stringify(output) + "\n");
    return;
  }

  process.stdout.write(JSON.stringify(principal) + "\n");
}

/*
 * Renew an access token from a refresh token. Used by the broker's refresh
 * route: the broker holds the client secret and calls this so a thin client
 * that never sees the secret can keep a long-lived session alive.
 */
async function refresh(args) {
  const tokenUrl = requireArg(args, "tokenUrl", "refresh");
  const clientId = requireArg(args, "clientId", "refresh");
  const clientSecret = args.clientSecret || "";
  const refreshToken = requireArg(args, "refreshToken", "refresh");

  const auth = clientAuth(clientId, clientSecret, args.clientSecretIn);

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  body.set("client_id", clientId);
  if (auth.bodySecret) {
    body.set("client_secret", clientSecret);
  }

  let response;
  try {
    response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        ...auth.header
      },
      body: body.toString()
    });
  } catch (error) {
    fail(`Error: refresh request failed: ${error.message}`);
  }

  const text = await response.text();
  if (!response.ok) {
    fail(`Error: token endpoint returned ${response.status}: ${text}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    fail(`Error: token endpoint returned non-JSON response: ${text}`);
  }

  if (data.error) {
    fail(`Error: refresh failed: ${data.error}${data.error_description ? ` (${data.error_description})` : ""}`);
  }
  if (!data.access_token) {
    fail(`Error: token endpoint did not return an access_token: ${text}`);
  }

  // A provider may or may not rotate the refresh token; when it does not, the
  // response's refreshToken is empty and the caller keeps the one it has.
  const output = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || "",
    idToken: data.id_token || "",
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
    tokenType: data.token_type || "Bearer"
  };
  process.stdout.write(JSON.stringify(output) + "\n");
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

// --- OAuth broker session store (hosted-callback + poll) ---
//
// The hosted-callback flow parks the short-lived authorization CODE (never a
// token) in a per-session record so a polling CLI can pick it up cross-device. The
// session id is chosen by the CLI and used as a storage key, so it MUST be validated
// to prevent path traversal. Entries are single-use (deleted on first read) and
// TTL-bounded; the parked code is useless without the PKCE verifier the CLI holds.
//
// Two backends:
//   - SHARED (default when running on the platform): the broker is a multi-instance
//     Lambda, so a code parked on instance A must be visible to a poll on instance B.
//     When CLOUD_SYNC_URL and CLOUD_SYNC_TOKEN are both set we back the store with the
//     untrusted-VM S3 sync: mint a presigned URL from the control plane, then do the
//     object op directly against it (see sharedPark/sharedPoll). This is enabled
//     automatically — those env vars are present on api machines too (only the
//     automatic state-sync is disabled there, minting still works).
//   - LOCAL (off-cloud / local dev): the original per-file store under <tmpdir>. Used
//     whenever the sync env vars are absent, with byte-identical behavior to before.
//
// Env vars consumed:
//   CLOUD_SYNC_URL        control-plane mint endpoint (POST); presence toggles SHARED
//   CLOUD_SYNC_TOKEN      Bearer token for the mint call; presence toggles SHARED
//   OAUTH_SESSION_PREFIX  relative-path prefix for session objects (default
//                         "oauth-sessions"). NOTE: the control plane scopes minted
//                         paths to the VM's own S3 folder and may restrict which
//                         prefixes are allowed outside the default `state` tree —
//                         this needs validation against the live mint endpoint.
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_ID_RE = /^[A-Za-z0-9_-]{16,200}$/;

// SHARED store is used when the platform's sync env is present; otherwise LOCAL files.
function sharedStoreEnabled() {
  return Boolean(process.env.CLOUD_SYNC_URL) && Boolean(process.env.CLOUD_SYNC_TOKEN);
}

// Relative object path for a session, under the configurable prefix. The id is
// validated by safeSessionId before this is called, so it is path-traversal safe.
function sessionRelPath(id) {
  const prefix = process.env.OAUTH_SESSION_PREFIX || "oauth-sessions";
  return `${prefix}/${id}.json`;
}

// Ask the control plane to sign a batch of operations. Mirrors the cloud-file-sync
// mint contract: POST { operations:[{method,path}] } with a Bearer token, get back
// { urls:[{method,path,url}] }. Returns a Map "METHOD <path>" -> presigned url. The
// actual object op is then run against the url with NO Authorization header (the
// presigned url is self-authenticating; sending auth can make S3 reject it).
async function mintSyncUrls(operations) {
  const res = await fetch(process.env.CLOUD_SYNC_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CLOUD_SYNC_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ operations })
  });
  if (!res.ok) {
    throw new Error(`mint failed: HTTP ${res.status}`);
  }
  const parsed = JSON.parse(await res.text());
  const map = new Map();
  for (const entry of parsed.urls || []) {
    map.set(`${entry.method} ${entry.path}`, entry.url);
  }
  return map;
}

// SHARED park: mint a PUT and write the record to the presigned url. Throws on any
// failure so the caller (sessionPark) can surface a non-zero exit to the callback route.
async function sharedPark(id, record) {
  const rel = sessionRelPath(id);
  const urls = await mintSyncUrls([{ method: "PUT", path: rel }]);
  const url = urls.get(`PUT ${rel}`);
  if (!url) {
    throw new Error("mint did not return a PUT url");
  }
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record)
  });
  if (!res.ok) {
    throw new Error(`park PUT failed: HTTP ${res.status}`);
  }
}

// SHARED poll: mint a GET, fetch the record; 404/403/missing -> pending. On a valid,
// unexpired record, mint a DELETE and remove it (single-use) before returning. Any
// mint/HTTP failure degrades to `pending` so a poll never crashes or 500s the caller.
// Best-effort removal of a shared (S3-via-mint) session object. Swallows every
// error so a poll never crashes on a delete failure — callers treat it as fire.
async function deleteShared(rel) {
  try {
    const delUrls = await mintSyncUrls([{ method: "DELETE", path: rel }]);
    const delUrl = delUrls.get(`DELETE ${rel}`);
    if (delUrl) {
      await fetch(delUrl, { method: "DELETE" });
    }
  } catch {
    // ignore
  }
}

async function sharedPoll(id) {
  const rel = sessionRelPath(id);
  let getUrls;
  try {
    getUrls = await mintSyncUrls([{ method: "GET", path: rel }]);
  } catch {
    return { status: "pending" };
  }
  const getUrl = getUrls.get(`GET ${rel}`);
  if (!getUrl) {
    return { status: "pending" };
  }
  let res;
  try {
    res = await fetch(getUrl, { method: "GET" });
  } catch {
    return { status: "pending" };
  }
  // Not-yet-parked (404) or a not-found key surfaced as forbidden (403) -> still pending.
  if (res.status === 404 || res.status === 403 || !res.ok) {
    return { status: "pending" };
  }
  let record;
  try {
    record = JSON.parse(await res.text());
  } catch {
    return { status: "pending" };
  }
  if (!record.ts || Date.now() - record.ts > SESSION_TTL_MS) {
    // Expired: remove the orphan so an abandoned login does not linger until the
    // control-plane lifecycle rule sweeps it. Best-effort — a failed delete is
    // harmless (the record is TTL-bounded and the lifecycle rule is the backstop).
    await deleteShared(rel);
    return { status: "expired" };
  }
  // Single-use: delete before returning so the code can never be replayed. Best-effort
  // — a failed delete still returns the code (the record is TTL-bounded regardless).
  await deleteShared(rel);
  if (record.error) {
    return { status: "error", error: record.error };
  }
  return { status: "ready", code: record.code };
}

function sessionDir(args) {
  return args.dir && args.dir !== "" ? args.dir : path.join(os.tmpdir(), "oauth-sessions");
}

function safeSessionId(id) {
  if (!id || !SESSION_ID_RE.test(id)) {
    fail("Error: invalid session id");
  }
  return id;
}

function sessionFile(args) {
  return path.join(sessionDir(args), safeSessionId(args.id) + ".json");
}

// Best-effort removal of expired session files so abandoned logins don't pile up.
function pruneSessions(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  const now = Date.now();
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const file = path.join(dir, name);
      if (now - fs.statSync(file).mtimeMs > SESSION_TTL_MS) fs.unlinkSync(file);
    } catch {
      // ignore individual failures
    }
  }
}

async function sessionPark(args) {
  const id = safeSessionId(args.id);
  const record =
    args.error && args.error !== ""
      ? { error: args.error, ts: Date.now() }
      : { code: args.code || "", ts: Date.now() };
  if (!record.error && record.code === "") {
    fail("Error: no code or error to park");
  }

  if (sharedStoreEnabled()) {
    // A park failure must surface a non-zero exit so the callback route reports it.
    try {
      await sharedPark(id, record);
    } catch (error) {
      fail(`Error: failed to park session: ${error.message}`);
    }
    process.stdout.write(JSON.stringify({ status: "parked" }) + "\n");
    return;
  }

  const dir = sessionDir(args);
  const file = sessionFile(args);
  fs.mkdirSync(dir, { recursive: true });
  pruneSessions(dir);
  // Atomic write (temp + rename) so a concurrent poll never reads a half-written file.
  const tmp = file + "." + crypto.randomBytes(6).toString("hex") + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(record), { mode: 0o600 });
  fs.renameSync(tmp, file);
  process.stdout.write(JSON.stringify({ status: "parked" }) + "\n");
}

async function sessionPoll(args) {
  if (sharedStoreEnabled()) {
    const id = safeSessionId(args.id);
    let result;
    try {
      result = await sharedPoll(id);
    } catch {
      // Belt-and-suspenders: a poll must never crash or 500 the caller.
      result = { status: "pending" };
    }
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }

  const file = sessionFile(args);
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    process.stdout.write(JSON.stringify({ status: "pending" }) + "\n");
    return;
  }
  // Single-use: delete immediately so a code can never be replayed from the store.
  try {
    fs.unlinkSync(file);
  } catch {
    // ignore
  }
  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    process.stdout.write(JSON.stringify({ status: "pending" }) + "\n");
    return;
  }
  if (!record.ts || Date.now() - record.ts > SESSION_TTL_MS) {
    process.stdout.write(JSON.stringify({ status: "expired" }) + "\n");
    return;
  }
  if (record.error) {
    process.stdout.write(JSON.stringify({ status: "error", error: record.error }) + "\n");
    return;
  }
  process.stdout.write(JSON.stringify({ status: "ready", code: record.code }) + "\n");
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const args = parseArgs(argv.slice(1));

  if (command === "authorize-url") {
    authorizeUrl(args);
  } else if (command === "exchange") {
    await exchange(args);
  } else if (command === "refresh") {
    await refresh(args);
  } else if (command === "session-park") {
    await sessionPark(args);
  } else if (command === "session-poll") {
    await sessionPoll(args);
  } else {
    fail(`Error: unknown subcommand '${command || ""}'`);
  }
}

main().catch((error) => {
  fail(`Error: ${error.message}`);
});
