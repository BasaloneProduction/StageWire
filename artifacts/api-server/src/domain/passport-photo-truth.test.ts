import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const passport = fs.readFileSync(new URL("../../../stagewire/src/pages/career-passport-v14.tsx", import.meta.url), "utf8");

test("Career Passport prefers a stored worker photo and never fakes local-only availability", () => {
  assert.match(passport, /fetch\('\/api\/file-metadata\?kind=profile-photo'/);
  assert.match(passport, /record\.storageStatus === 'stored'/);
  assert.match(passport, /\/api\/file-metadata\/\$\{stored\.id\}\/content/);
  assert.match(passport, /const photo = storedPhotoUrl \|\| localPhoto/);
  assert.match(passport, /const photoAvailable = Boolean\(photo\)/);
  assert.match(passport, /const photoShared = share\.sharePhoto && photoAvailable/);
  assert.match(passport, /Photo unavailable/);
  assert.match(passport, /legacy local preview remains available only on the browser/i);
  assert.match(passport, /\{photoShared && <img/);
});
