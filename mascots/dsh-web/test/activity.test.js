import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY } from '../src/client/behavior.js';
import { computeActivity } from '../src/client/activityStore.js';

const list = (overrides = {}) => ({
  ids: ['s1'],
  byId: { s1: { running: false } },
  current: 's1',
  jobsBySession: {},
  ...overrides,
});

const conv = (overrides = {}) => ({
  running: false,
  partial: null,
  runningCalls: [],
  pending: [],
  ...overrides,
});

test('missing or empty snapshots are idle', () => {
  assert.equal(computeActivity(undefined, undefined), ACTIVITY.IDLE);
  assert.equal(computeActivity(null, null), ACTIVITY.IDLE);
  assert.equal(computeActivity({}, null), ACTIVITY.IDLE);
  assert.equal(computeActivity(list({ current: undefined }), null), ACTIVITY.IDLE);
});

test('pending interaction wins over everything', () => {
  const state = list({ byId: { s1: { running: true, pendingInteraction: 'approval' } } });
  assert.equal(computeActivity(state, conv({ partial: {} })), ACTIVITY.WAITING);
  assert.equal(computeActivity(state, conv({ pending: [{ kind: 'approval' }] })), ACTIVITY.WAITING);
});

test('streaming formal text is writing', () => {
  const state = list();
  assert.equal(
    computeActivity(state, conv({ partial: { blocks: [{ kind: 'text', text: 'hi' }] }, running: true })),
    ACTIVITY.WRITING,
  );
});

test('reasoning-only streaming is thinking', () => {
  const state = list();
  assert.equal(
    computeActivity(state, conv({ partial: { blocks: [{ kind: 'reasoning', text: 'let me think' }] } })),
    ACTIVITY.THINKING,
  );
});

test('tool-call streaming without text is thinking', () => {
  const state = list();
  assert.equal(
    computeActivity(
      state,
      conv({ partial: { blocks: [{ kind: 'tool-call', callId: 'c1', name: 'read', argsRaw: '{}' }] } }),
    ),
    ACTIVITY.THINKING,
  );
});

test('running tool calls are thinking', () => {
  const state = list();
  assert.equal(
    computeActivity(state, conv({ runningCalls: [{ callId: 'c1' }], running: false })),
    ACTIVITY.THINKING,
  );
});

test('running session is thinking', () => {
  assert.equal(computeActivity(list({ byId: { s1: { running: true } } }), conv()), ACTIVITY.THINKING);
  assert.equal(computeActivity(list(), conv({ running: true })), ACTIVITY.THINKING);
});

test('background jobs imply thinking even when not running', () => {
  const state = list({
    byId: { s1: { running: false } },
    jobsBySession: { s1: [{ id: 'job-1' }] },
  });
  assert.equal(computeActivity(state, conv()), ACTIVITY.THINKING);
});

test('settled session is idle', () => {
  assert.equal(computeActivity(list(), conv()), ACTIVITY.IDLE);
});
