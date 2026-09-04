"use strict";

/*
 * Tiny mock of the platform's untrusted-VM S3 sync control plane + object store,
 * used by oauth_session__park.test.md / oauth_session__poll.test.md to exercise the
 * SHARED session store in oauth-web.js without a real cloud. Zero dependencies —
 * Node built-in http only.
 *
 *   POST /mint          the control-plane mint endpoint (CLOUD_SYNC_URL). Requires
 *                       `Authorization: Bearer TESTTOKEN`; otherwise 401 (this is
 *                       how the test asserts the mint request carries the token).
 *                       Body: {"operations":[{"method":"PUT|GET|DELETE","path":"<rel>"}]}
 *                       -> {"urls":[{"method","path","url":"http://.../s3/<rel>"}]}
 *                       Each operation MUST have a method and path, else 400.
 *   PUT/GET/DELETE /s3/<rel>   the "presigned" object store. Presigned URLs are
 *                       self-authenticating, so this handler REJECTS (403) any request
 *                       that carries an Authorization header — proving oauth-web.js does
 *                       not attach auth to the object op. State is in-memory.
 *
 * On startup it pre-seeds one already-expired record so the poll test can assert the
 * TTL/expired branch (the record's ts is set far in the past).
 */

const http = require("http");

const PORT = Number(process.env.MOCK_SYNC_PORT || 8732);
const TOKEN = process.env.MOCK_SYNC_TOKEN || "TESTTOKEN";
const ORIGIN = `http://localhost:${PORT}`;

// In-memory object store keyed by relative path.
const store = new Map();

// Pre-seed an already-expired session so poll returns {status:"expired"}.
store.set("oauth-sessions/expiredsessionaaaaaaaa.json", JSON.stringify({ code: "STALE", ts: 1 }));

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  const body = await readBody(req);

  if (req.method === "POST" && req.url === "/mint") {
    if ((req.headers["authorization"] || "") !== `Bearer ${TOKEN}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_json" }));
      return;
    }
    const operations = Array.isArray(parsed.operations) ? parsed.operations : null;
    if (!operations) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "missing_operations" }));
      return;
    }
    const urls = [];
    for (const op of operations) {
      if (!op || !op.method || !op.path) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "bad_operation" }));
        return;
      }
      urls.push({ method: op.method, path: op.path, url: `${ORIGIN}/s3/${op.path}` });
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ urls }));
    return;
  }

  if (req.url.startsWith("/s3/")) {
    // Presigned URLs are self-authenticating; an Authorization header must NOT be sent.
    if (req.headers["authorization"]) {
      res.writeHead(403);
      res.end("presigned url must not carry Authorization");
      return;
    }
    const key = decodeURIComponent(req.url.slice("/s3/".length));
    if (req.method === "PUT") {
      store.set(key, body);
      res.writeHead(200);
      res.end("ok");
      return;
    }
    if (req.method === "GET") {
      if (!store.has(key)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(store.get(key));
      return;
    }
    if (req.method === "DELETE") {
      store.delete(key);
      res.writeHead(204);
      res.end();
      return;
    }
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  process.stdout.write(`listening on ${PORT}\n`);
});
