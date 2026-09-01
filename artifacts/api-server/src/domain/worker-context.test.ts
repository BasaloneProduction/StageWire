import assert from "node:assert/strict";
import test from "node:test";
import { currentWorkerOwnerKey, runWithWorkerOwner } from "./worker-context.ts";

test("worker identity is unavailable outside a request context", () => {
  assert.throws(() => currentWorkerOwnerKey(), /identity is missing/);
});

test("worker identity survives async work inside one request", async () => {
  const owner = await runWithWorkerOwner("worker-a", async () => {
    await Promise.resolve();
    return currentWorkerOwnerKey();
  });
  assert.equal(owner, "worker-a");
});

test("parallel worker contexts stay isolated", async () => {
  const [a, b] = await Promise.all([
    runWithWorkerOwner("worker-a", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return currentWorkerOwnerKey();
    }),
    runWithWorkerOwner("worker-b", async () => {
      await Promise.resolve();
      return currentWorkerOwnerKey();
    }),
  ]);
  assert.deepEqual([a, b], ["worker-a", "worker-b"]);
});

test("blank worker identities are rejected", () => {
  assert.throws(() => runWithWorkerOwner("   ", () => undefined), /cannot be blank/);
});
