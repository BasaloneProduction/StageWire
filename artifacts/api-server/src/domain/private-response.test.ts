import assert from "node:assert/strict";
import test from "node:test";
import { stripPrivateResponseFields } from "./private-response.ts";

test("owner keys never leave StageWire API JSON", () => {
  const result = stripPrivateResponseFields({
    id: 1,
    ownerKey: "worker-secret",
    nested: { ownerKey: "nested-secret", showName: "Load In" },
    calls: [{ id: 2, ownerKey: "other-secret", role: "Pusher" }],
  });

  assert.deepEqual(result, {
    id: 1,
    nested: { showName: "Load In" },
    calls: [{ id: 2, role: "Pusher" }],
  });
});

test("normal worker data survives response scrubbing", () => {
  const input = { showName: "Festival", hours: 8.5, privateByDefault: true, note: null };
  assert.deepEqual(stripPrivateResponseFields(input), input);
});
