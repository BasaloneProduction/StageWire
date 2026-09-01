import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/stagewire.ts", import.meta.url), "utf8");
const ownerHelpers = fs.readFileSync(new URL("./worker-owner.ts", import.meta.url), "utf8");
const identityMap = fs.readFileSync(new URL("./worker-identity-map.ts", import.meta.url), "utf8");
const accountBootstrap = fs.readFileSync(new URL("./worker-account.ts", import.meta.url), "utf8");
const authenticatedMiddleware = fs.readFileSync(new URL("./authenticated-worker-middleware.ts", import.meta.url), "utf8");
const workerIdentity = fs.readFileSync(new URL("../routes/worker-identity.ts", import.meta.url), "utf8");
const routeIndex = fs.readFileSync(new URL("../routes/index.ts", import.meta.url), "utf8");
const stagewireRoutes = fs.readFileSync(new URL("../routes/stagewire.ts", import.meta.url), "utf8");
const correctionRoutes = fs.readFileSync(new URL("../routes/corrections.ts", import.meta.url), "utf8");
const openCallRoutes = fs.readFileSync(new URL("../routes/open-call-edits.ts", import.meta.url), "utf8");

test("worker-backed tables keep explicit owner boundaries", () => {
  const ownerColumns = schema.match(/ownerKey:\s*text\("owner_key"\)/g) ?? [];
  assert.equal(ownerColumns.length, 3, "workerProfiles, workerIdentities, and calls must keep owner keys");
  assert.doesNotMatch(
    schema,
    /ownerKey:\s*text\("owner_key"\)\.notNull\(\)\.default\("preview-worker-v14"\)/,
    "database ownership must never silently fall back to the preview worker",
  );
  assert.match(schema, /worker_profiles_owner_key_unique/, "each owner must have one worker profile");
  assert.match(schema, /worker_identities_provider_subject_unique/, "one external identity must map to only one StageWire owner");
  assert.match(schema, /references\(\(\) => workerProfiles\.ownerKey/, "identity mappings must point to a real StageWire worker profile");
  assert.match(schema, /calls_owner_key_idx/, "owner-scoped call lookup must stay indexed");
});

test("authenticated identities resolve through the private StageWire owner map", () => {
  assert.match(identityMap, /workerIdentities\.provider/);
  assert.match(identityMap, /workerIdentities\.subject/);
  assert.match(identityMap, /workerIdentities\.ownerKey/);
  assert.match(identityMap, /kind:\s*"authenticated"/);
  assert.doesNotMatch(identityMap, /ownerKey:\s*cleanSubject/, "provider subjects must never become database owner keys directly");
});

test("new worker accounts bootstrap profile and identity atomically", () => {
  assert.match(accountBootstrap, /randomUUID\(\)/, "StageWire owner keys must be internal opaque identifiers");
  assert.match(accountBootstrap, /db\.transaction/, "profile and identity mapping must be created atomically");
  assert.match(accountBootstrap, /tx\.insert\(workerProfiles\)/);
  assert.match(accountBootstrap, /tx\.insert\(workerIdentities\)/);
  assert.match(accountBootstrap, /code\s*===\s*"23505"/, "concurrent signup races must reconcile unique identity mappings");
  assert.doesNotMatch(accountBootstrap, /ownerKey\s*=\s*cleanSubject/, "external identity subjects must never become owner keys");
});

test("real auth middleware accepts only a verified external identity", () => {
  assert.match(authenticatedMiddleware, /resolveVerifiedIdentity\(req\)/);
  assert.match(authenticatedMiddleware, /authenticatedPrincipalForIdentity/);
  assert.match(authenticatedMiddleware, /status\(401\)/, "missing verified login must be rejected");
  assert.match(authenticatedMiddleware, /status\(403\)/, "unlinked verified login must be rejected");
  assert.match(authenticatedMiddleware, /runWithWorkerPrincipal\(principal, next\)/);
  assert.doesNotMatch(authenticatedMiddleware, /ownerKey/, "clients must never supply a StageWire owner key to auth middleware");
});

test("owner predicates resolve identity from request context", () => {
  assert.match(ownerHelpers, /currentWorkerOwnerKey\(\)/);
  assert.doesNotMatch(ownerHelpers, /eq\(calls\.ownerKey, PREVIEW_OWNER_KEY\)/, "database predicates must not be permanently hard-coded to the preview worker");
  assert.match(workerIdentity, /runWithWorkerPrincipal/);
  assert.match(workerIdentity, /kind:\s*"preview"/, "preview middleware must be explicitly non-authenticated until auth replaces it");
});

test("preview seeding is isolated from normal request-owned writes", () => {
  assert.match(stagewireRoutes, /if \(currentWorkerPrincipal\(\)\.kind !== "preview"\) return;/, "demo seed data must never run for authenticated workers");
  assert.match(
    stagewireRoutes,
    /ownerKey:\s*currentWorkerOwnerKey\(\),\s*\n\s*venue:\s*input\.venue\.trim\(\)/,
    "new calls must inherit the current request owner",
  );
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
});
