import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/stagewire.ts", import.meta.url), "utf8");
const ownerHelpers = fs.readFileSync(new URL("./worker-owner.ts", import.meta.url), "utf8");
const workerIdentity = fs.readFileSync(new URL("../routes/worker-identity.ts", import.meta.url), "utf8");
const routeIndex = fs.readFileSync(new URL("../routes/index.ts", import.meta.url), "utf8");
const stagewireRoutes = fs.readFileSync(new URL("../routes/stagewire.ts", import.meta.url), "utf8");
const correctionRoutes = fs.readFileSync(new URL("../routes/corrections.ts", import.meta.url), "utf8");
const openCallRoutes = fs.readFileSync(new URL("../routes/open-call-edits.ts", import.meta.url), "utf8");

test("worker-backed tables keep an explicit owner key", () => {
  const ownerColumns = schema.match(/ownerKey:\s*text\("owner_key"\)/g) ?? [];
  assert.equal(ownerColumns.length, 2, "workerProfiles and calls must both keep an owner key");
  assert.match(schema, /worker_profiles_owner_key_unique/, "each owner must have one worker profile");
  assert.match(schema, /calls_owner_key_idx/, "owner-scoped call lookup must stay indexed");
});

test("owner predicates resolve identity from request context", () => {
  assert.match(ownerHelpers, /currentWorkerOwnerKey\(\)/);
  assert.doesNotMatch(ownerHelpers, /eq\(calls\.ownerKey, PREVIEW_OWNER_KEY\)/, "database predicates must not be permanently hard-coded to the preview worker");
  assert.match(workerIdentity, /runWithWorkerOwner\(PREVIEW_OWNER_KEY, next\)/, "preview middleware is the one temporary identity source until auth replaces it");
});

test("worker identity and ownership gates run before every worker route", () => {
  const identity = routeIndex.indexOf("router.use(workerIdentityRouter)");
  const gate = routeIndex.indexOf("router.use(ownershipGateRouter)");
  const corrections = routeIndex.indexOf("router.use(correctionRouter)");
  const openCalls = routeIndex.indexOf("router.use(openCallEditRouter)");
  const stagewire = routeIndex.indexOf("router.use(stagewireRouter)");
  assert.ok(identity >= 0 && gate >= 0, "worker identity and ownership gate must remain mounted");
  assert.ok(identity < gate, "worker identity must be established before owner predicates run");
  assert.ok(gate < corrections && gate < openCalls && gate < stagewire, "ownership gate must run before worker call routers");
});

test("worker routes do not bypass the owner-scoped call helpers", () => {
  for (const [name, source] of [
    ["stagewire", stagewireRoutes],
    ["corrections", correctionRoutes],
    ["open-call-edits", openCallRoutes],
  ]) {
    assert.doesNotMatch(source, /where\(eq\(calls\.id,\s*id\)\)/, `${name} must not query or mutate a call by id without owner scope`);
  }
  assert.doesNotMatch(stagewireRoutes, /from\(calls\)\.orderBy/, "call lists must include an owner predicate before ordering");
  assert.doesNotMatch(stagewireRoutes, /from\(workerProfiles\)\.orderBy/, "profile reads must include an owner predicate before ordering");
  assert.match(stagewireRoutes, /ownerKey:\s*PREVIEW_OWNER_KEY/, "new preview calls must be stamped with their owner until auth supplies the request owner");
});
