import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/stagewire.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../routes/crew-kit.ts", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../routes/index.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../../../stagewire/src/pages/crew-kit.tsx", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../../../stagewire/src/main.tsx", import.meta.url), "utf8");

test("Crew Kit state belongs to the worker record", () => {
  assert.match(schema, /workerCrewKitState = pgTable\("worker_crew_kit_state"/);
  assert.match(schema, /ownerKey: text\("owner_key"\)\.primaryKey\(\)\.references\(\(\) => workerProfiles\.ownerKey/);
  assert.match(route, /currentWorkerOwnerKey\(\)/);
  assert.match(route, /router\.get\("\/crew-kit-state"/);
  assert.match(route, /router\.put\("\/crew-kit-state"/);
  assert.match(route, /eq\(workerCrewKitState\.ownerKey, ownerKey\)/);
  assert.match(route, /target: workerCrewKitState\.ownerKey/);
  assert.match(routes, /router\.use\(crewKitRouter\)/);
});

test("Crew Kit UI uses server state and keeps browser data migration-only", () => {
  assert.match(page, /useGetCrewKitState/);
  assert.match(page, /useUpdateCrewKitState/);
  assert.match(page, /stagewire-crew-kit-v14/);
  assert.match(page, /stagewire-crew-kit-custom-v14/);
  assert.match(page, /Move browser kit/);
  assert.match(page, /localStorage\.removeItem\(LEGACY_READY_KEY\)/);
  assert.doesNotMatch(page, /localStorage\.setItem\(LEGACY_READY_KEY/);
  assert.doesNotMatch(page, /localStorage\.setItem\(LEGACY_CUSTOM_KEY/);
  assert.match(page, /onError: \(\) => queryClient\.setQueryData\(getGetCrewKitStateQueryKey\(\), previous\)/);
  assert.match(page, /Pusher:/, "Pusher must remain its own Crew Kit role");
  assert.match(main, /installDemoCrewKitApi\(\)/);
});
