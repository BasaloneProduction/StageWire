import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../../../../lib/db/src/schema/stagewire.ts", import.meta.url), "utf8");
const routes = readFileSync(new URL("../routes/stagewire.ts", import.meta.url), "utf8");
const outbox = readFileSync(new URL("../../../stagewire/src/offline-outbox.ts", import.meta.url), "utf8");

test("offline additive workday actions carry duplicate-safe client keys", () => {
  assert.match(schema, /call_checklist_items_client_action_unique/);
  assert.match(schema, /call_notes_client_action_unique/);
  assert.match(schema, /call_expenses_client_action_unique/);
  assert.match(routes, /x-stagewire-action-id/);
  assert.match(routes, /eq\(callNotes\.clientActionId, actionId\)/);
  assert.match(routes, /eq\(callExpenses\.clientActionId, actionId\)/);
  assert.match(routes, /eq\(callChecklistItems\.clientActionId, actionId\)/);
});

test("the browser outbox is limited to active workday writes", () => {
  assert.match(outbox, /\/api\\\/calls\\\/\\d\+\\\//);
  assert.match(outbox, /arrive\|start\|notes\|expenses\|checklist/);
  assert.doesNotMatch(outbox, /finish\|correct/);
  assert.match(outbox, /authorization/);
  assert.match(outbox, /cookie/);
});

test("money and notes get a visible offline-safe response while timestamps remain unresolved", () => {
  assert.match(outbox, /\\\/notes\$/);
  assert.match(outbox, /\\\/expenses\$/);
  assert.match(outbox, /throw new OfflineQueuedError/);
  assert.match(outbox, /_stagewireQueued: true/);
});
