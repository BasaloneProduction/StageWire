import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authRouter = fs.readFileSync(new URL("./worker-auth-router.ts", import.meta.url), "utf8");
const routeIndex = fs.readFileSync(new URL("../routes/index.ts", import.meta.url), "utf8");

test("auth router requires verified identity before sign-in or signup", () => {
  assert.match(authRouter, /createWorkerAuthRouter\(resolveVerifiedIdentity/);
  assert.match(authRouter, /verifiedIdentity\(resolveVerifiedIdentity, req\)/);
  assert.match(authRouter, /status\(401\)/);
  assert.match(authRouter, /createWorkerSessionForIdentity\(identity\.provider, identity\.subject\)/);
  assert.match(authRouter, /bootstrapWorkerAccountForIdentity\(identity\.provider, identity\.subject\)/);
  assert.doesNotMatch(authRouter, /ownerKey/, "auth endpoints must never accept or return a StageWire owner key");
});

test("auth router issues, checks, revokes, and clears only StageWire session cookies", () => {
  assert.match(authRouter, /res\.cookie\(SESSION_COOKIE_NAME/);
  assert.match(authRouter, /sessionCookieOptions\(process\.env\.NODE_ENV/);
  assert.match(authRouter, /principalForSessionToken\(token\)/);
  assert.match(authRouter, /revokeWorkerSession\(token\)/);
  assert.match(authRouter, /res\.clearCookie\(SESSION_COOKIE_NAME/);
  assert.match(authRouter, /clearSessionCookieOptions\(process\.env\.NODE_ENV\)/);
});

test("account security controls require a valid StageWire session", () => {
  assert.match(authRouter, /const requireSession = sessionWorkerMiddleware\(\)/);
  assert.match(authRouter, /router\.get\("\/auth\/identities", requireSession/);
  assert.match(authRouter, /router\.post\("\/auth\/identities\/link", requireSession/);
  assert.match(authRouter, /router\.delete\("\/auth\/identities\/:identityId", requireSession/);
  assert.match(authRouter, /router\.delete\("\/auth\/sessions", requireSession/);
  assert.match(authRouter, /listCurrentWorkerIdentities\(\)/);
  assert.match(authRouter, /linkVerifiedIdentityToCurrentWorker\(identity\.provider, identity\.subject\)/);
  assert.match(authRouter, /unlinkCurrentWorkerIdentity\(identityId\)/);
  assert.match(authRouter, /revokeAllCurrentWorkerSessions\(\)/);
  assert.match(authRouter, /status\(409\).*another StageWire worker account/s, "identity conflicts must not merge workers");
  assert.match(authRouter, /Keep at least one sign-in method linked/, "a worker must never unlink the final login method");
});

test("auth router stays unmounted until a real provider resolver exists", () => {
  assert.doesNotMatch(routeIndex, /worker-auth-router|createWorkerAuthRouter/, "preview routes must not expose the production auth router without a verified identity provider");
});
