const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AlwaysOnTopService,
  readAlwaysOnTopSetting,
} = require('../always-on-top-service');

function createFixture(options = {}) {
  const windowCalls = [];
  const persisted = [];
  const broadcasts = [];
  const window = {
    isDestroyed: () => false,
    setAlwaysOnTop: value => windowCalls.push(value),
  };
  const service = new AlwaysOnTopService({
    initialEnabled: options.initialEnabled ?? true,
    persistSetting: value => {
      persisted.push(value);
      if (options.persistError) throw options.persistError;
      if (options.persistResult === false) return false;
      return true;
    },
    broadcastSetting: value => broadcasts.push(value),
  });
  if (options.withWindow !== false) service.attachWindow(window);
  windowCalls.length = 0;
  return { service, window, windowCalls, persisted, broadcasts };
}

test('setting reader defaults to true for missing or invalid values', () => {
  assert.equal(readAlwaysOnTopSetting({}), true);
  assert.equal(readAlwaysOnTopSetting({ alwaysOnTop: 'false' }), true);
  assert.equal(readAlwaysOnTopSetting({ alwaysOnTop: false }), false);
});

test('successful setting applies window, persists, then broadcasts', () => {
  const events = [];
  const window = {
    isDestroyed: () => false,
    setAlwaysOnTop: value => events.push(['window', value]),
  };
  const service = new AlwaysOnTopService({
    initialEnabled: true,
    persistSetting: value => {
      events.push(['persist', value]);
      return true;
    },
    broadcastSetting: value => events.push(['broadcast', value]),
  });
  service.attachWindow(window);
  events.length = 0;

  assert.equal(service.setEnabled(false), false);
  assert.deepEqual(events, [
    ['window', false],
    ['persist', false],
    ['broadcast', false],
  ]);
  assert.equal(service.getEnabled(), false);
});

test('setting the confirmed value again is idempotent', () => {
  const fixture = createFixture();

  assert.equal(fixture.service.setEnabled(true), true);
  assert.deepEqual(fixture.windowCalls, []);
  assert.deepEqual(fixture.persisted, []);
  assert.deepEqual(fixture.broadcasts, []);
});

test('non-boolean values are rejected without side effects', () => {
  const fixture = createFixture();

  assert.throws(() => fixture.service.setEnabled(1), TypeError);
  assert.equal(fixture.service.getEnabled(), true);
  assert.deepEqual(fixture.windowCalls, []);
  assert.deepEqual(fixture.persisted, []);
});

test('window application failure does not persist or broadcast', () => {
  const fixture = createFixture({ withWindow: false });
  let shouldFail = false;
  fixture.service.attachWindow({
    isDestroyed: () => false,
    setAlwaysOnTop: () => {
      if (shouldFail) throw new Error('window failed');
    },
  });
  shouldFail = true;

  assert.throws(() => fixture.service.setEnabled(false), /window failed/);
  assert.equal(fixture.service.getEnabled(), true);
  assert.deepEqual(fixture.persisted, []);
  assert.deepEqual(fixture.broadcasts, []);
});

test('persistence failure rolls a live window back to the previous value', () => {
  const fixture = createFixture({ persistResult: false });

  assert.throws(() => fixture.service.setEnabled(false), /persist/i);
  assert.equal(fixture.service.getEnabled(), true);
  assert.deepEqual(fixture.windowCalls, [false, true]);
  assert.deepEqual(fixture.broadcasts, []);
});

test('setting persists and broadcasts when no pet window exists', () => {
  const fixture = createFixture({ withWindow: false });

  assert.equal(fixture.service.setEnabled(false), false);
  assert.deepEqual(fixture.persisted, [false]);
  assert.deepEqual(fixture.broadcasts, [false]);
});

test('attaching a recreated window applies the confirmed value', () => {
  const fixture = createFixture({ withWindow: false, initialEnabled: false });

  fixture.service.attachWindow(fixture.window);

  assert.deepEqual(fixture.windowCalls, [false]);
});

test('detached or destroyed windows are not mutated', () => {
  const fixture = createFixture({ withWindow: false });
  fixture.service.attachWindow({
    isDestroyed: () => true,
    setAlwaysOnTop: value => fixture.windowCalls.push(value),
  });

  fixture.service.setEnabled(false);

  assert.deepEqual(fixture.windowCalls, []);
  assert.deepEqual(fixture.persisted, [false]);
});
