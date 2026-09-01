import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serviceWorker = fs.readFileSync(new URL("../../../stagewire/public/stagewire-sw.js", import.meta.url), "utf8");
const indexHtml = fs.readFileSync(new URL("../../../stagewire/index.html", import.meta.url), "utf8");
const robots = fs.readFileSync(new URL("../../../stagewire/public/robots.txt", import.meta.url), "utf8");
const rootPackage = JSON.parse(fs.readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"));

test("offline shell never intercepts StageWire API requests", () => {
  assert.match(serviceWorker, /url\.pathname\.includes\('\/api\/'\)/, "service worker must explicitly exclude API requests");
  assert.doesNotMatch(serviceWorker, /cache\.put\([^\n]*api/i, "service worker must never explicitly cache API data");
});

test("unauthenticated preview stays out of search engines", () => {
  assert.match(indexHtml, /name="robots" content="noindex, nofollow"/);
  assert.match(robots, /Disallow:\s*\//);
});

test("real database changes remain explicit and non-force by default", () => {
  assert.equal(rootPackage.scripts["db:prepare"], "pnpm --dir lib/db push");
  assert.doesNotMatch(rootPackage.scripts["db:prepare"], /force/);
});
