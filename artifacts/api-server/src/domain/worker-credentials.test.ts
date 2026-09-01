import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const routes = fs.readFileSync(new URL("../routes/credentials.ts", import.meta.url), "utf8");
const routeIndex = fs.readFileSync(new URL("../routes/index.ts", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/stagewire.ts", import.meta.url), "utf8");

test("credential routes inherit request worker identity before access", () => {
  const identity = routeIndex.indexOf("router.use(workerIdentityRouter)");
  const credentials = routeIndex.indexOf("router.use(credentialRouter)");
  assert.ok(identity >= 0 && credentials >= 0 && identity < credentials, "worker identity must exist before credential routes run");
});

test("credential CRUD remains worker scoped", () => {
  assert.match(routes, /currentWorkerOwnerKey\(\)/);
  assert.match(routes, /eq\(workerCredentials\.ownerKey, ownerKey\)/, "credential lists must filter by owner");
  assert.match(routes, /and\(eq\(workerCredentials\.id, id\), eq\(workerCredentials\.ownerKey, currentWorkerOwnerKey\(\)\)\)/, "single credential mutations must filter by id and owner");
  assert.match(routes, /ownerKey,\s*\n\s*name,/, "new credentials must inherit the request owner");
  assert.doesNotMatch(routes, /where\(eq\(workerCredentials\.id, credentialId\)\)/, "credential mutation must never be id-only");
});

test("credential status truth comes from current/planned plus the saved date", () => {
  assert.match(schema, /worker_credentials_status_check/);
  assert.match(schema, /in \('current', 'planned'\)/);
  assert.doesNotMatch(schema, /in \('current', 'expiring', 'expired', 'planned'\)/, "expiring and expired are derived states, not worker-entered claims");
  assert.match(routes, /toISOString\(\)\.slice\(0, 10\)/, "expiration is stored as a date-only value");
});
