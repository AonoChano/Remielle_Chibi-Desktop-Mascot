import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolveAssetPath } from '../lib/index.js';

test('resolves a real asset under /remi-pet/assets/', () => {
  const file = resolveAssetPath('/remi-pet/assets/remi.json');
  assert.ok(file, 'expected a resolved path');
  assert.ok(file.endsWith(`${'assets'}${'/'}remi.json`) || file.endsWith(`${'assets'}${'\\'}remi.json`));
  assert.ok(existsSync(file), 'resolved file must exist');
});

test('rejects traversal and prefix escapes', () => {
  assert.equal(resolveAssetPath('/remi-pet/assets/../../package.json'), null);
  assert.equal(resolveAssetPath('/remi-pet/assets/%2e%2e/package.json'), null);
  assert.equal(resolveAssetPath('/remi-pet/../package.json'), null);
  assert.equal(resolveAssetPath('/remi-pet'), null);
  assert.equal(resolveAssetPath('/remi-pet/'), null);
});

test('rejects backslash tricks and empty paths', () => {
  assert.equal(resolveAssetPath('/remi-pet/assets\\..\\package.json'), null);
  assert.equal(resolveAssetPath(''), null);
});
