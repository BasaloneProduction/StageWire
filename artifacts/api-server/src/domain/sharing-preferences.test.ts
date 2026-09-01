import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/stagewire.ts", import.meta.url), "utf8");
const stagewireRoutes = fs.readFileSync(new URL("../routes/stagewire.ts", import.meta.url), "utf8");
const workerSetup = fs.readFileSync(new URL("../../../stagewire/src/pages/worker-setup.tsx", import.meta.url), "utf8");
const passport = fs.readFileSync(new URL("../../../stagewire/src/pages/career-passport-v14.tsx", import.meta.url), "utf8");
const demoApi = fs.readFileSync(new URL("../../../stagewire/src/demo-api.ts", import.meta.url), "utf8");

test("sharing preferences live on the worker profile with conservative defaults", () => {
  assert.match(schema, /sharePhoto:\s*boolean\("share_photo"\)\.notNull\(\)\.default\(false\)/);
  assert.match(schema, /shareHomeBase:\s*boolean\("share_home_base"\)\.notNull\(\)\.default\(false\)/);
  assert.match(schema, /shareSkills:\s*boolean\("share_skills"\)\.notNull\(\)\.default\(true\)/);
  assert.match(schema, /shareCertifications:\s*boolean\("share_certifications"\)\.notNull\(\)\.default\(true\)/);
});

test("profile saves preserve or update every sharing preference", () => {
  for (const field of ["sharePhoto", "shareHomeBase", "shareSkills", "shareCertifications"]) {
    assert.match(stagewireRoutes, new RegExp(`${field}: input\\.${field} \\?\\? current\\.${field}`));
    assert.match(workerSetup, new RegExp(`${field}: share\\.${field}`), `${field} must be sent with Worker Setup saves`);
  }
});

test("legacy browser settings are migration fallback, not the primary source", () => {
  assert.match(workerSetup, /LEGACY_SHARE_KEY/);
  assert.match(workerSetup, /localStorage\.removeItem\(LEGACY_SHARE_KEY\)/, "old browser settings should be removed after a successful profile save");
  assert.doesNotMatch(workerSetup, /localStorage\.setItem\(LEGACY_SHARE_KEY/, "new sharing changes must not be written back to browser-only storage");
  assert.match(passport, /legacySettings\(\) \?\? \{ sharePhoto: worker\.sharePhoto/);
  assert.doesNotMatch(passport, /function settings\(/, "Career Passport must not treat local storage as the permanent sharing source");
});

test("demo profile exposes the same sharing defaults as the real profile", () => {
  assert.match(demoApi, /sharePhoto:\s*false/);
  assert.match(demoApi, /shareHomeBase:\s*false/);
  assert.match(demoApi, /shareSkills:\s*true/);
  assert.match(demoApi, /shareCertifications:\s*true/);
});
