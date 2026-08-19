import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerWithFallback } from '../src/client/slotProbe.js';

test('uses the first attempt that registers', () => {
  const calls = [];
  const register = (options) => {
    calls.push(options);
    return 'ok';
  };
  const result = registerWithFallback(register, [{ key: 'a' }, { id: 'b' }]);
  assert.equal(result, 'ok');
  assert.equal(calls.length, 1);
});

test('falls back to the next attempt when the first throws', () => {
  const calls = [];
  const register = (options) => {
    calls.push(options);
    if (options.key !== undefined) throw new Error('keyed slot requires options.key');
    return 'ok-list';
  };
  const result = registerWithFallback(register, [{ key: 'a' }, { id: 'b' }]);
  assert.equal(result, 'ok-list');
  assert.equal(calls.length, 2);
});

test('throws the last error when every attempt fails', () => {
  const register = () => {
    throw new Error('nope');
  };
  assert.throws(() => registerWithFallback(register, [{ key: 'a' }, { id: 'b' }]), /nope/);
});
