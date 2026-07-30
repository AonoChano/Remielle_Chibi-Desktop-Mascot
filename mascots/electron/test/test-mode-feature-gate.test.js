const test = require('node:test');
const assert = require('node:assert/strict');

const { TestModeFeatureGate } = require('../test-mode-feature-gate');

test('test mode gate suspends and resumes registered features once', () => {
  const events = [];
  const gate = new TestModeFeatureGate();
  gate.register('eye-tracking', {
    suspend: () => events.push('suspend'),
    resume: () => events.push('resume'),
  });

  assert.equal(gate.setEnabled(true), true);
  assert.equal(gate.setEnabled(true), true);
  assert.equal(gate.setEnabled(false), false);

  assert.deepEqual(events, ['suspend', 'resume']);
});

test('features registered while test mode is active suspend immediately', () => {
  const events = [];
  const gate = new TestModeFeatureGate();
  gate.setEnabled(true);

  const unregister = gate.register('late-feature', {
    suspend: () => events.push('suspend'),
    resume: () => events.push('resume'),
  });
  unregister();
  gate.setEnabled(false);

  assert.deepEqual(events, ['suspend']);
});

test('failed transition rolls back processed features and effective state', () => {
  const events = [];
  const gate = new TestModeFeatureGate();
  gate.register('first', {
    suspend: () => events.push('first-suspend'),
    resume: () => events.push('first-resume'),
  });
  gate.register('broken', {
    suspend: () => {
      events.push('broken-suspend');
      throw new Error('cannot suspend');
    },
    resume: () => events.push('broken-resume'),
  });

  assert.throws(() => gate.setEnabled(true), /cannot suspend/);
  assert.equal(gate.isEnabled(), false);
  assert.deepEqual(events, [
    'first-suspend',
    'broken-suspend',
    'first-resume',
  ]);
});

test('duplicate registration and failed active registration are rejected', () => {
  const gate = new TestModeFeatureGate();
  gate.register('eye-tracking', { suspend() {}, resume() {} });
  assert.throws(
    () => gate.register('eye-tracking', { suspend() {}, resume() {} }),
    /already registered/
  );

  gate.setEnabled(true);
  assert.throws(
    () => gate.register('broken', {
      suspend() { throw new Error('late failure'); },
      resume() {},
    }),
    /late failure/
  );
});
