import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

/**
 * Verifies the built bundle satisfies the DSH client-modules contract:
 *  - it is a classic script registering one entry via window.__ModuleLoader__;
 *  - the entry id equals the package name;
 *  - the factory requires only shell-seeded modules (react + ui-primitives —
 *    the bundle purity gate) and exports a Cordis plugin object { inject, apply }.
 */
const ALLOWED_EXTERNALS = ['react', '@deepseek-ai/dsh-client-ui-primitives'];
async function loadBundle() {
  const code = await readFile(new URL('../dist/client.js', import.meta.url), 'utf8');
  let captured = null;
  vm.runInNewContext(code, {
    window: { __ModuleLoader__: { load: (entry) => { captured = entry; } } },
  });
  return captured;
}

test('dist/client.js registers one entry through __ModuleLoader__', async () => {
  const entry = await loadBundle();
  assert.ok(entry, 'no entry was registered');
  assert.equal(entry.id, '@aonochano/remi-pet-dsh');
  assert.equal(typeof entry.factory, 'function');
});

test('factory requires only shell-seeded modules and exports { inject, apply }', async () => {
  const entry = await loadBundle();
  const required = [];
  const plugin = entry.factory((spec) => {
    required.push(spec);
    if (ALLOWED_EXTERNALS.includes(spec)) return {};
    throw new Error(`unexpected external require: ${spec}`);
  });
  assert.ok(required.includes('react'), 'react must be required');
  assert.ok(
    required.every((spec) => ALLOWED_EXTERNALS.includes(spec)),
    `unexpected externals: ${required.filter((s) => !ALLOWED_EXTERNALS.includes(s)).join(', ')}`,
  );
  assert.ok(Array.isArray(plugin.inject), 'plugin.inject must be an array');
  assert.ok(plugin.inject.includes('slots'), 'plugin must declare the slots service');
  assert.equal(typeof plugin.apply, 'function');
});
