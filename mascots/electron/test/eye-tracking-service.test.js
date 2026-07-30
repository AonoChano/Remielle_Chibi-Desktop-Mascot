const test = require('node:test');
const assert = require('node:assert/strict');

const { EyeTrackingService } = require('../eye-tracking-service');

function createFixture(initialEnabled = true, initialSuspended = false) {
  const intervals = [];
  const cleared = [];
  const sent = [];
  const saved = [];
  const broadcasts = [];
  const service = new EyeTrackingService({
    initialEnabled,
    initialSuspended,
    getCursorPoint: () => ({ x: 900, y: 500 }),
    getPetBounds: () => ({ x: 100, y: 200, width: 420, height: 320 }),
    sendCursor: sample => sent.push(sample),
    saveSetting: value => saved.push(value),
    broadcastSetting: value => broadcasts.push(value),
    setIntervalFn: (callback, milliseconds) => {
      const handle = { callback, milliseconds, id: intervals.length + 1 };
      intervals.push(handle);
      return handle;
    },
    clearIntervalFn: handle => cleared.push(handle),
  });
  return { service, intervals, cleared, sent, saved, broadcasts };
}

test('starts one 30 Hz sampler when an enabled pet becomes available', () => {
  const fixture = createFixture(true);
  assert.equal(fixture.intervals.length, 0);

  fixture.service.setPetAvailable(true);
  fixture.service.setPetAvailable(true);

  assert.equal(fixture.intervals.length, 1);
  assert.equal(fixture.intervals[0].milliseconds, 1000 / 30);
});

test('sampler sends cursor and pet center data', () => {
  const fixture = createFixture(true);
  fixture.service.setPetAvailable(true);

  fixture.intervals[0].callback();

  assert.deepEqual(fixture.sent, [{
    cursorX: 900,
    cursorY: 500,
    centerX: 310,
    centerY: 360,
    width: 420,
    height: 320,
  }]);
});

test('setting is idempotent and only changed values persist and broadcast', () => {
  const fixture = createFixture(true);
  fixture.service.setPetAvailable(true);

  assert.equal(fixture.service.setEnabled(true), true);
  assert.deepEqual(fixture.saved, []);
  assert.equal(fixture.intervals.length, 1);

  assert.equal(fixture.service.setEnabled(false), false);
  assert.deepEqual(fixture.saved, [false]);
  assert.deepEqual(fixture.broadcasts, [false]);
  assert.deepEqual(fixture.cleared, [fixture.intervals[0]]);

  fixture.service.setEnabled(false);
  assert.deepEqual(fixture.saved, [false]);
  assert.deepEqual(fixture.broadcasts, [false]);
});

test('invalid setting payload is rejected without changing state', () => {
  const fixture = createFixture(true);

  assert.throws(() => fixture.service.setEnabled('false'), TypeError);
  assert.equal(fixture.service.getEnabled(), true);
  assert.deepEqual(fixture.saved, []);
});

test('pet destruction stops sampling and recreation starts a fresh sampler', () => {
  const fixture = createFixture(true);
  fixture.service.setPetAvailable(true);
  const first = fixture.intervals[0];

  fixture.service.setPetAvailable(false);
  fixture.service.setPetAvailable(true);

  assert.deepEqual(fixture.cleared, [first]);
  assert.equal(fixture.intervals.length, 2);
});

test('disabled startup waits until enabled and service destruction blocks sends', () => {
  const fixture = createFixture(false);
  fixture.service.setPetAvailable(true);
  assert.equal(fixture.intervals.length, 0);

  fixture.service.setEnabled(true);
  const active = fixture.intervals[0];
  fixture.service.destroy();
  active.callback();

  assert.deepEqual(fixture.cleared, [active]);
  assert.deepEqual(fixture.sent, []);
});

test('test suspension stops sampling without changing the desired setting', () => {
  const fixture = createFixture(true);
  fixture.service.setPetAvailable(true);
  const active = fixture.intervals[0];

  assert.equal(fixture.service.setSuspended(true), true);
  active.callback();

  assert.equal(fixture.service.getEnabled(), true);
  assert.equal(fixture.service.isSuspended(), true);
  assert.deepEqual(fixture.cleared, [active]);
  assert.deepEqual(fixture.sent, []);
  assert.deepEqual(fixture.saved, []);

  fixture.service.setSuspended(false);
  assert.equal(fixture.service.isSuspended(), false);
  assert.equal(fixture.intervals.length, 2);
});

test('persisted test mode prevents sampling during startup', () => {
  const fixture = createFixture(true, true);

  fixture.service.setPetAvailable(true);
  assert.equal(fixture.intervals.length, 0);

  fixture.service.setSuspended(false);
  assert.equal(fixture.intervals.length, 1);
});

test('missing or invalid Electron data is skipped safely', () => {
  const sent = [];
  let cursor = null;
  let bounds = null;
  let callback;
  const service = new EyeTrackingService({
    initialEnabled: true,
    getCursorPoint: () => cursor,
    getPetBounds: () => bounds,
    sendCursor: sample => sent.push(sample),
    saveSetting: () => {},
    broadcastSetting: () => {},
    setIntervalFn: cb => {
      callback = cb;
      return 1;
    },
    clearIntervalFn: () => {},
  });
  service.setPetAvailable(true);

  callback();
  cursor = { x: NaN, y: 1 };
  bounds = { x: 0, y: 0, width: 420, height: 420 };
  callback();
  cursor = { x: 1, y: 1 };
  bounds.width = 0;
  callback();

  assert.deepEqual(sent, []);
});
