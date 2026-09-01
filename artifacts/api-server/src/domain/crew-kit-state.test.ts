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

test("finished or missing call prep marks are pruned without deleting personal role items", () => {
  assert.match(route, /pruneFinishedCallMarks/);
  assert.match(route, /eq\(calls\.ownerKey, ownerKey\)/, "mark cleanup must only inspect the current worker's calls");
  assert.match(route, /call\.status !== "finished"/);
  assert.match(route, /\^call-\(\\d\+\):/);
  assert.match(route, /if \(!mark\.startsWith\("call-"\)\) return true/, "general role ready marks must not be pruned as finished calls");
  assert.match(route, /return readyMarks\.length === state\.readyMarks\.length \? state : \{ \.\.\.state, readyMarks \}/, "cleanup must preserve custom items");
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
