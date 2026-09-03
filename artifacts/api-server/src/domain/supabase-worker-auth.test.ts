import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./supabase-worker-auth.ts", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../routes/index.ts", import.meta.url), "utf8");

test("Supabase authentication fails closed unless both hosted settings are valid", () => {
  assert.match(source, /if \(!url \|\| !publishableKey\?\.trim\(\)\) return null/);
  assert.match(source, /url\.protocol !== "https:"/);
  assert.match(source, /url\.hostname\.endsWith\("\.supabase\.co"\)/);
  assert.match(source, /publishableKey\.trim\(\)\.length < 20/);
  assert.match(source, /return Boolean\(supabaseAuthConfig\(env\)\)/);
});

test("email sign-in sends a passwordless email and supports server-side token verification", () => {
  assert.match(source, /router\.post\("\/auth\/email\/start"/);
  assert.match(source, /router\.post\("\/auth\/email\/verify"/);
  assert.match(source, /\/otp/);
  assert.match(source, /create_user:\s*true/);
  assert.match(source, /\/verify/);
  assert.match(source, /verifiedUser\(config, accessToken\)/);
  assert.match(source, /\/user/);
  assert.match(source, /Authorization:\s*`Bearer \$\{accessToken\}`/);
  assert.match(source, /bootstrapWorkerAccountForIdentity/);
  assert.match(source, /createWorkerSessionForIdentity/);
  assert.match(source, /res\.cookie\(SESSION_COOKIE_NAME/);
  assert.doesNotMatch(source, /workerPassword|passwordHash|passwordSalt/i, "StageWire must not collect or store worker passwords");
});

test("configured authentication replaces preview identity for all worker data routes", () => {
  assert.match(routes, /if \(authConfig\)/);
  assert.match(routes, /createSupabaseEmailAuthRouter\(authConfig\)/);
  assert.match(routes, /createWorkerAuthRouter\(createSupabaseIdentityResolver\(authConfig\)\)/);
  assert.match(routes, /sessionWorkerMiddleware\(\)/);
  assert.match(routes, /else \{\s*router\.use\(workerIdentityRouter\)/s);
  assert.ok(
    routes.indexOf("router.use(sessionWorkerMiddleware())") < routes.indexOf("router.use(credentialRouter)"),
    "signed-in worker ownership must be established before private data routes",
  );
});
