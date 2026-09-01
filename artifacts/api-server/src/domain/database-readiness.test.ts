import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const health = fs.readFileSync(new URL("../routes/health.ts", import.meta.url), "utf8");

test("health readiness touches current account-era schema", () => {
  assert.match(health, /calls\.ownerKey/, "call ownership must be part of readiness");
  assert.match(health, /workerProfiles\.sharePhoto/);
  assert.match(health, /workerProfiles\.shareHomeBase/);
  assert.match(health, /workerProfiles\.shareSkills/);
  assert.match(health, /workerProfiles\.shareCertifications/);
  assert.match(health, /workerProfiles\.taxReservePercent/);
  assert.match(health, /workerCredentials\.id/, "credential storage must be part of readiness");
  assert.match(health, /status:\s*"database-unready"/, "stale or unreachable databases must fail readiness");
});
