import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSettings,
  updateSettings,
  subscribeSettings,
} from '../src/client/settings.js';
import {
  DEFAULT_SIZE,
  DEFAULT_LIGHT_CHANCE,
  DEFAULT_ACTIVITY_ENABLED,
  SIZE_MIN,
  SIZE_MAX,
} from '../src/client/persist.js';

test('settings start at the documented defaults', () => {
  const settings = getSettings();
  assert.equal(settings.size, DEFAULT_SIZE);
  assert.equal(settings.lightChance, DEFAULT_LIGHT_CHANCE);
  assert.equal(settings.activityEnabled, DEFAULT_ACTIVITY_ENABLED);
  assert.ok(SIZE_MIN < SIZE_MAX);
});

test('updateSettings applies a patch and notifies subscribers', () => {
  const seen = [];
  const unsub = subscribeSettings((next) => seen.push(next));
  updateSettings({ size: 280, lightChance: 0.8 });
  assert.equal(getSettings().size, 280);
  assert.equal(getSettings().lightChance, 0.8);
  assert.equal(getSettings().activityEnabled, true); // untouched field survives
  assert.equal(seen.length, 1);
  unsub();
  updateSettings({ activityEnabled: false });
  assert.equal(seen.length, 1); // unsubscribed — no further notifications
});
