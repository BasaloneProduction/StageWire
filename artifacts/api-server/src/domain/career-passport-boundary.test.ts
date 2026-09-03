import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const spec = fs.readFileSync(new URL("../../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../routes/stagewire.ts", import.meta.url), "utf8");

function section(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Expected ${start} before ${end}`);
  return source.slice(from, to);
}

test("Career Passport schema is an explicit professional-data allowlist", () => {
  const passportSchema = section(spec, "    CareerPassport:\n", "    DashboardSummary:\n");
  for (const allowed of ["workerName", "primaryRole", "additionalRoles", "completedCallCount", "experience", "skills", "certifications", "privateByDefault"]) {
    assert.match(passportSchema, new RegExp(`\\b${allowed}:`));
  }
  for (const forbidden of ["phone", "email", "emergencyContact", "ownerKey", "session", "gross", "expense", "money", "workLife", "checkIn", "documents", "photos"]) {
    assert.doesNotMatch(passportSchema, new RegExp(`\\b${forbidden}:`, "i"), `${forbidden} must not become part of the Career Passport API schema`);
  }
});

test("private Passport route does not pull private contact fields into its response", () => {
  const passportRoute = section(routes, 'router.get("/passport"', "export default router;");
  assert.match(passportRoute, /GetPassportResponse\.parse\(data\)/, "runtime response must remain constrained by the generated Passport schema");
  assert.doesNotMatch(passportRoute, /profile\.(phone|email|emergencyContact|ownerKey)/, "private profile/contact fields must stay out of Passport construction");
});
