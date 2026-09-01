import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const identityLink = fs.readFileSync(new URL("./worker-identity-link.ts", import.meta.url), "utf8");
const identityControls = fs.readFileSync(new URL("./worker-identity-controls.ts", import.meta.url), "utf8");
const sessionStore = fs.readFileSync(new URL("./worker-session-store.ts", import.meta.url), "utf8");

test("identity linking is authenticated, idempotent, and never merges owners", () => {
  assert.match(identityLink, /currentAuthenticatedWorker\(\)/, "linking another sign-in must require an authenticated StageWire worker");
  assert.match(identityLink, /workerIdentityForVerifiedSubject/, "linking must inspect the verified identity mapping first");
  assert.match(identityLink, /existing\.ownerKey === worker\.ownerKey/);
  assert.match(identityLink, /status:\s*"already-linked"/);
  assert.match(identityLink, /status:\s*"conflict"/, "an identity owned by another worker must be rejected instead of merging accounts");
  assert.match(identityLink, /ownerKey:\s*worker\.ownerKey/, "a new verified identity may only attach to the current authenticated owner");
  assert.match(identityLink, /code\s*===\s*"23505"/, "concurrent identity-link races must reconcile the unique mapping");
  assert.doesNotMatch(identityLink, /update\(workerIdentities\).*ownerKey/s, "identity linking must never reassign an existing mapping between workers");
});

test("identity unlinking can never remove the worker's last login", () => {
  assert.match(identityControls, /currentAuthenticatedWorker\(\)/, "identity controls must require an authenticated worker");
  assert.match(identityControls, /db\.transaction/, "last-login protection must be checked in the same transaction as unlinking");
  assert.match(identityControls, /\.for\("update"\)/, "identity changes must serialize on the worker profile row");
  assert.match(identityControls, /identities\.length <= 1/);
  assert.match(identityControls, /status:\s*"last-identity"/);
  assert.match(identityControls, /eq\(workerIdentities\.ownerKey, worker\.ownerKey\)/, "unlinking must stay scoped to the authenticated owner");
  assert.match(identityControls, /delete\(workerIdentities\)/);
  assert.doesNotMatch(identityControls, /delete\(workerIdentities\)\.where\(eq\(workerIdentities\.id, identityId\)\)/, "identity deletion must never be scoped by id alone");
});

test("linked-login listing does not expose provider subjects", () => {
  assert.match(identityControls, /provider:\s*workerIdentities\.provider/);
  assert.match(identityControls, /createdAt:\s*workerIdentities\.createdAt/);
  assert.doesNotMatch(identityControls, /subject:\s*workerIdentities\.subject/, "linked-login UI must not need raw external identity subjects");
});

test("sign out everywhere revokes only the current authenticated worker sessions", () => {
  assert.match(sessionStore, /revokeAllCurrentWorkerSessions/);
  assert.match(sessionStore, /currentAuthenticatedWorker\(\)/);
  assert.match(sessionStore, /eq\(workerSessions\.ownerKey, worker\.ownerKey\)/);
  assert.match(sessionStore, /isNull\(workerSessions\.revokedAt\)/);
  assert.doesNotMatch(sessionStore, /delete\(workerSessions\)/, "session history should be revoked rather than silently deleted");
});
