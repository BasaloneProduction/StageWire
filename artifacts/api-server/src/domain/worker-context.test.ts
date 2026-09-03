import assert from "node:assert/strict";
import test from "node:test";
import {
  currentAuthenticatedWorker,
  currentWorkerOwnerKey,
  currentWorkerPrincipal,
  runWithWorkerPrincipal,
} from "./worker-context.ts";

test("worker identity is unavailable outside a request context", () => {
  assert.throws(() => currentWorkerOwnerKey(), /identity is missing/);
});

test("preview identity survives async work but is never authenticated", async () => {
  await runWithWorkerPrincipal({ kind: "preview", ownerKey: "preview-worker", subject: null }, async () => {
    await Promise.resolve();
    assert.equal(currentWorkerOwnerKey(), "preview-worker");
    assert.equal(currentWorkerPrincipal().kind, "preview");
    assert.throws(() => currentAuthenticatedWorker(), /authentication is required/);
  });
});

test("authenticated identity preserves its stable subject", async () => {
  const principal = await runWithWorkerPrincipal(
    { kind: "authenticated", ownerKey: "worker-a", subject: "provider-user-123" },
    async () => {
      await Promise.resolve();
      return currentAuthenticatedWorker();
    },
  );
  assert.deepEqual(principal, {
    kind: "authenticated",
    ownerKey: "worker-a",
    subject: "provider-user-123",
  });
});

test("parallel worker principals stay isolated", async () => {
  const [a, b] = await Promise.all([
    runWithWorkerPrincipal(
      { kind: "authenticated", ownerKey: "worker-a", subject: "subject-a" },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return currentWorkerPrincipal();
      },
    ),
    runWithWorkerPrincipal(
      { kind: "authenticated", ownerKey: "worker-b", subject: "subject-b" },
      async () => {
        await Promise.resolve();
        return currentWorkerPrincipal();
      },
    ),
  ]);
  assert.deepEqual([a.ownerKey, b.ownerKey], ["worker-a", "worker-b"]);
  assert.deepEqual([a.subject, b.subject], ["subject-a", "subject-b"]);
});

test("blank worker identities and authenticated subjects are rejected", () => {
  assert.throws(
    () => runWithWorkerPrincipal({ kind: "preview", ownerKey: "   ", subject: null }, () => undefined),
    /identity cannot be blank/,
  );
  assert.throws(
    () => runWithWorkerPrincipal({ kind: "authenticated", ownerKey: "worker-a", subject: "   " }, () => undefined),
    /subject cannot be blank/,
  );
});
