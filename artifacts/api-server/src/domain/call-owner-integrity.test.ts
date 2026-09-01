import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/stagewire.ts", import.meta.url), "utf8");

test("calls belong to a real StageWire worker at the database layer", () => {
  assert.match(
    schema,
    /export const calls = pgTable\("calls", \{[\s\S]*?ownerKey:\s*text\("owner_key"\)\.notNull\(\)\.references\(\(\) => workerProfiles\.ownerKey, \{ onDelete: "cascade" \}\)/,
    "calls.owner_key must reference a real worker profile",
  );
  assert.match(schema, /calls_owner_key_idx/, "worker-scoped call lookups must remain indexed");
  assert.match(schema, /calls_owner_work_date_idx/, "worker/date call-board lookups must remain indexed");
});
