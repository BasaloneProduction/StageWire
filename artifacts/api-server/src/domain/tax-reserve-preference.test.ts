import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/stagewire.ts", import.meta.url), "utf8");
const apiSpec = fs.readFileSync(new URL("../../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
const profileRoute = fs.readFileSync(new URL("../routes/stagewire.ts", import.meta.url), "utf8");
const demoApi = fs.readFileSync(new URL("../../../stagewire/src/demo-api.ts", import.meta.url), "utf8");
const money = fs.readFileSync(new URL("../../../stagewire/src/pages/money-center.tsx", import.meta.url), "utf8");
const receipt = fs.readFileSync(new URL("../../../stagewire/src/pages/work-receipt.tsx", import.meta.url), "utf8");

test("tax reserve preference is account-backed and bounded", () => {
  assert.match(schema, /taxReservePercent:\s*integer\("tax_reserve_percent"\)\.notNull\(\)\.default\(25\)/);
  assert.match(schema, /worker_profiles_tax_reserve_percent_check/);
  assert.match(schema, /taxReservePercent\}\s*between 0 and 100/);

  const reserveContractFields = apiSpec.match(/taxReservePercent:/g) ?? [];
  assert.ok(reserveContractFields.length >= 2, "worker profile and profile input must expose the reserve preference");
  assert.match(apiSpec, /taxReservePercent:[\s\S]{0,120}minimum:\s*0[\s\S]{0,80}maximum:\s*100/);

  assert.match(profileRoute, /taxReservePercent:\s*input\.taxReservePercent\s*\?\?\s*current\.taxReservePercent/);
  assert.match(demoApi, /taxReservePercent:\s*25/);
});

test("Money saves reserve preference through the worker profile", () => {
  assert.match(money, /useGetProfile/);
  assert.match(money, /useUpdateProfile/);
  assert.match(money, /reserveDraft\?\?worker\.taxReservePercent/);
  assert.match(money, /taxReservePercent:\s*reservePercent/);
  assert.match(money, /localStorage\.removeItem\(LEGACY_RESERVE_KEY\)/, "legacy browser value should be removed after account save");
  assert.doesNotMatch(money, /localStorage\.setItem\([^\n]*RESERVE/, "Money must not make browser storage the reserve source of truth again");
});

test("Call Receipt reads the same account reserve preference", () => {
  assert.match(receipt, /useGetProfile/);
  assert.match(receipt, /profile\.data\?\.taxReservePercent/);
  assert.match(receipt, /legacyReservePercent\(\)\s*\?\?\s*profile\.data\?\.taxReservePercent\s*\?\?\s*25/);
  assert.doesNotMatch(receipt, /localStorage\.setItem\([^\n]*RESERVE/);
});
