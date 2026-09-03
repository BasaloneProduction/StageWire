import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const guard = fs.readFileSync(new URL("./same-origin-write.ts", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.ts", import.meta.url), "utf8");

test("same-origin guard protects every API write before routes", () => {
  assert.match(guard, /SAFE_METHODS = new Set\(\["GET", "HEAD", "OPTIONS"\]\)/);
  assert.match(guard, /fetchSite === "cross-site"/);
  assert.match(guard, /new URL\(origin\)\.host\.toLowerCase\(\)/);
  assert.match(guard, /originHost !== host/);
  assert.match(guard, /status\(403\)/);
  assert.match(guard, /STAGEWIRE_PUBLIC_ORIGIN/, "deployments need an explicit public-origin override when host routing requires it");
  assert.doesNotMatch(guard, /x-forwarded-host/i, "browser write trust must not come from a client-spoofable forwarded-host header");

  const guardMount = app.indexOf('app.use("/api", sameOriginWriteGuard())');
  const routeMount = app.indexOf('app.use("/api", router)');
  assert.ok(guardMount >= 0 && routeMount >= 0 && guardMount < routeMount, "same-origin guard must run before all API routes");
});
