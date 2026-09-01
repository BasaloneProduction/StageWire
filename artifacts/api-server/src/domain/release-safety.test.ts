import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTH_REQUIRED_MESSAGE, assertReleaseSafety } from './release-safety.ts';

test('development runtime is allowed while authentication is under construction', () => {
  assert.doesNotThrow(() => assertReleaseSafety('development'));
});

test('test runtime is allowed for CI', () => {
  assert.doesNotThrow(() => assertReleaseSafety('test'));
});

test('production runtime is blocked until worker authentication exists', () => {
  assert.throws(() => assertReleaseSafety('production'), { message: AUTH_REQUIRED_MESSAGE });
});

test('an unspecified runtime is blocked instead of accidentally becoming public', () => {
  assert.throws(() => assertReleaseSafety(undefined), { message: AUTH_REQUIRED_MESSAGE });
});
