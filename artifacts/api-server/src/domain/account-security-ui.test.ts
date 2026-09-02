import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../../../stagewire/src/pages/account-security.tsx", import.meta.url), "utf8");
const setup = fs.readFileSync(new URL("../../../stagewire/src/pages/worker-setup.tsx", import.meta.url), "utf8");
const authRouter = fs.readFileSync(new URL("./worker-auth-router.ts", import.meta.url), "utf8");
const readinessRoute = fs.readFileSync(new URL("../routes/auth-readiness.ts", import.meta.url), "utf8");
const routeIndex = fs.readFileSync(new URL("../routes/index.ts", import.meta.url), "utf8");

test("Worker Setup exposes account security without adding a separate setup maze", () => {
  assert.match(setup, /AccountSecurityPanel/);
  assert.match(setup, /<AccountSecurityPanel \/>/);
  assert.match(page, /id="account-security"/);
  assert.match(page, /Account &amp; security/);
});

test("account security UI uses only authenticated session endpoints", () => {
  assert.match(page, /['"]\/api\/auth\/readiness['"]/);
  assert.match(page, /['"]\/api\/auth\/session['"]/);
  assert.match(page, /['"]\/api\/auth\/identities['"]/);
  assert.match(page, /`\/api\/auth\/identities\/\$\{identity\.id\}`/);
  assert.match(page, /['"]\/api\/auth\/sessions['"]/);
  assert.match(page, /credentials:\s*['"]same-origin['"]/);
  assert.doesNotMatch(page, /ownerKey|owner_key/, "frontend account controls must never send or display an internal owner ID");
});

test("preview reports account readiness without pretending records are portable", () => {
  assert.match(readinessRoute, /router\.get\("\/auth\/readiness"/);
  assert.match(readinessRoute, /signInAvailable:\s*false/);
  assert.match(readinessRoute, /recordsFollowSignIn:\s*false/);
  assert.match(readinessRoute, /provider:\s*null/);
  assert.match(routeIndex, /router\.use\(authReadinessRouter\)/);
  assert.ok(
    routeIndex.indexOf("router.use(authReadinessRouter)") < routeIndex.indexOf("router.use(workerIdentityRouter)"),
    "readiness must be available before preview worker identity is assigned",
  );
  assert.match(page, /This is not a portable worker account yet/);
  assert.match(page, /Use sample information only/);
  assert.match(page, /Verified sign-in service/);
  assert.match(page, /Not connected/);
});

test("preview stays honest and the UI cannot remove the final login", () => {
  assert.match(page, /StageWire will not fake a login/);
  assert.match(page, /identities\.length <= 1/);
  assert.match(page, /This is your only login method/);
  assert.match(authRouter, /Keep at least one sign-in method linked/);
});

test("sign out everywhere is explicit and server-scoped", () => {
  assert.match(page, /Sign out every StageWire session on every device\?/);
  assert.match(page, /signOut\(true\)/);
  assert.match(authRouter, /revokeAllCurrentWorkerSessions\(\)/);
  assert.match(authRouter, /clearSessionCookie\(res\)/);
});
