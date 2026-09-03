import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const middleware = fs.readFileSync(new URL("./session-worker-middleware.ts", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.ts", import.meta.url), "utf8");

test("session identity comes only from the StageWire session cookie", () => {
  assert.match(middleware, /req\.cookies\?\.\[SESSION_COOKIE_NAME\]/);
  assert.match(middleware, /principalForSessionToken\(token\)/);
  assert.match(middleware, /runWithWorkerPrincipal\(principal, next\)/);
  assert.match(middleware, /status\(401\)/);
  assert.doesNotMatch(middleware, /req\.headers|req\.query|req\.body/, "session identity must never come from client identity fields");
  assert.doesNotMatch(middleware, /ownerKey/, "session middleware must not accept a client owner key");
});

test("cookie parsing runs before StageWire API routes", () => {
  const parser = app.indexOf("app.use(cookieParser())");
  const routes = app.indexOf('app.use("/api", router)');
  assert.ok(parser >= 0 && routes >= 0 && parser < routes, "cookies must be parsed before session-backed routes run");
});
