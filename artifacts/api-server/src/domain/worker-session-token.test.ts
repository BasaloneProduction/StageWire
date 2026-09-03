import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSessionCookieOptions,
  createSessionToken,
  hashSessionToken,
  sessionCookieOptions,
} from "./worker-session-token.ts";

test("session tokens are random and only hashes are stable", () => {
  const first = createSessionToken();
  const second = createSessionToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.match(hashSessionToken(first), /^[a-f0-9]{64}$/);
  assert.equal(hashSessionToken(first), hashSessionToken(first));
  assert.notEqual(hashSessionToken(first), first);
});

test("blank session tokens are rejected", () => {
  assert.throws(() => hashSessionToken("   "), /cannot be blank/);
});

test("session cookies stay httpOnly, same-site strict, and production secure", () => {
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const production = sessionCookieOptions("production", expiresAt);
  assert.equal(production.httpOnly, true);
  assert.equal(production.sameSite, "strict");
  assert.equal(production.secure, true);
  assert.equal(production.path, "/");
  assert.equal(production.expires.toISOString(), expiresAt);

  const development = sessionCookieOptions("development", expiresAt);
  assert.equal(development.secure, false);
  const clear = clearSessionCookieOptions("production");
  assert.equal(clear.httpOnly, true);
  assert.equal(clear.sameSite, "strict");
  assert.equal(clear.secure, true);
});
