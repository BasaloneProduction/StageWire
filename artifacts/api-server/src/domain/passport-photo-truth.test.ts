import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const passport = fs.readFileSync(new URL("../../../stagewire/src/pages/career-passport-v14.tsx", import.meta.url), "utf8");

test("Career Passport does not pretend a local-only photo followed the account", () => {
  assert.match(passport, /const photoAvailable = Boolean\(photo\)/);
  assert.match(passport, /const photoShared = share\.sharePhoto && photoAvailable/);
  assert.match(passport, /Photo unavailable/);
  assert.match(passport, /this device does not have the photo/);
  assert.match(passport, /secure cross-device photo storage is wired/);
  assert.match(passport, /\{photoShared && <img/);
});
