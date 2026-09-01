import assert from "node:assert/strict";
import test from "node:test";
import { calls, workerProfiles } from "@workspace/db";
import { PREVIEW_OWNER_KEY, ownedCallWhere, ownedCallsWhere, ownedProfileWhere } from "./worker-owner.ts";

test("worker-backed tables keep an explicit owner key", () => {
  assert.ok(calls.ownerKey, "calls must keep an owner key before multi-worker auth is enabled");
  assert.ok(workerProfiles.ownerKey, "worker profiles must keep an owner key before multi-worker auth is enabled");
});

test("preview ownership helpers always produce database predicates", () => {
  assert.equal(PREVIEW_OWNER_KEY, "preview-worker-v14");
  assert.ok(ownedCallWhere(123));
  assert.ok(ownedCallsWhere());
  assert.ok(ownedProfileWhere());
});
