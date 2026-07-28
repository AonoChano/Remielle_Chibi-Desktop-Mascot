const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PetBehaviorController,
  STATES,
} = require('../pet-behavior');

function sequenceRandom(values) {
  let index = 0;
  return () => {
    assert.ok(index < values.length, 'random sequence exhausted');
    return values[index++];
  };
}

function createController(randomValues = [], logs = []) {
  const controller = new PetBehaviorController({
    random: sequenceRandom(randomValues),
    logger: record => logs.push(record),
    now: () => 1234,
  });
  controller.takeCommands();
  return controller;
}

function complete(controller, command, times = 1) {
  for (let i = 0; i < times; i += 1) {
    controller.animationCompleted({
      animationName: command.animationName,
      trackIndex: command.trackIndex,
      playbackId: command.playbackId,
    });
  }
}

test('starts in IDLE with looping animation a', () => {
  const controller = new PetBehaviorController({
    random: () => 0.99,
    logger: () => {},
  });

  assert.equal(controller.getSnapshot().state, STATES.IDLE);
  assert.deepEqual(controller.takeCommands(), [{
    type: 'play',
    animationName: 'a',
    trackIndex: 0,
    loop: true,
    playbackId: 1,
  }]);
});

test('IDLE draws for appreciation every ten completed loops', () => {
  const controller = createController([0.149, 0]);
  const idle = controller.getActivePlayback(0);

  complete(controller, idle, 9);
  assert.equal(controller.getSnapshot().state, STATES.IDLE);
  assert.equal(controller.getSnapshot().idleLoops, 9);

  complete(controller, idle);
  const [appreciation] = controller.takeCommands();
  assert.equal(controller.getSnapshot().state, STATES.IDLE_APPRECIATION);
  assert.equal(appreciation.animationName, 'c');
  assert.equal(controller.getSnapshot().targetLoops, 2);

  complete(controller, appreciation, 2);
  assert.equal(controller.getSnapshot().state, STATES.IDLE);
  assert.equal(controller.getSnapshot().idleLoops, 0);
});

test('IDLE probability boundary 0.15 does not enter appreciation', () => {
  const controller = createController([0.15]);
  const idle = controller.getActivePlayback(0);

  complete(controller, idle, 10);

  assert.equal(controller.getSnapshot().state, STATES.IDLE);
  assert.equal(controller.getSnapshot().idleLoops, 0);
  assert.deepEqual(controller.takeCommands(), []);
});

test('IDLE double click selects brush below 0.80 and resets idle loops', () => {
  const controller = createController([0.799]);
  const idle = controller.getActivePlayback(0);
  complete(controller, idle, 9);

  assert.equal(controller.doubleClick(), true);

  const [brush] = controller.takeCommands();
  assert.equal(brush.animationName, 'a_win');
  assert.equal(controller.getSnapshot().state, STATES.BRUSH_READY);
  assert.equal(controller.getSnapshot().idleLoops, 0);
});

test('IDLE double click selects one to two golden light loops at 0.80', () => {
  const controller = createController([0.80, 0.999999]);

  controller.doubleClick();

  const [light] = controller.takeCommands();
  assert.equal(controller.getSnapshot().state, STATES.GOLDEN_LIGHT);
  assert.equal(light.trackIndex, 1);
  assert.equal(light.animationName, 'light');
  assert.equal(controller.getSnapshot().targetLoops, 2);
  complete(controller, light, 2);
  assert.equal(controller.getSnapshot().state, STATES.IDLE);
});

test('brush checkpoints use 45/25/30 probabilities and pause during events', () => {
  const controller = createController([
    0.1, // IDLE -> brush
    0.449, 0, // 10s -> thinking, 2 loops
    0.05, // no frenzy
    0.45, 0, // 20s -> tearing up, 2 loops
    0.70, // 30s -> no event
  ]);
  controller.doubleClick();
  controller.takeCommands();

  controller.tick(10);
  const [thinking] = controller.takeCommands();
  assert.equal(controller.getSnapshot().state, STATES.THINKING);
  assert.equal(controller.getSnapshot().brushSeconds, 10);
  controller.tick(100);
  assert.equal(controller.getSnapshot().brushSeconds, 10);

  complete(controller, thinking, 2);
  controller.takeCommands();
  controller.tick(10);
  const [tearing] = controller.takeCommands();
  assert.equal(controller.getSnapshot().state, STATES.TEARING_UP);
  assert.equal(controller.getSnapshot().brushSeconds, 20);

  complete(controller, tearing, 2);
  controller.takeCommands();
  controller.tick(10);
  assert.equal(controller.getSnapshot().state, STATES.IDLE);
});

test('30 second event wins, then exits IDLE after the event chain', () => {
  const controller = createController([
    0.1, // IDLE -> brush
    0.9, // 10s no event
    0.9, // 20s no event
    0.1, 0, // 30s thinking, 2 loops
    0.5, // no frenzy
  ]);
  controller.doubleClick();
  controller.takeCommands();

  controller.tick(35);
  const [thinking] = controller.takeCommands();
  assert.equal(controller.getSnapshot().state, STATES.THINKING);
  assert.equal(controller.getSnapshot().brushSeconds, 30);

  complete(controller, thinking, 2);
  const [idle] = controller.takeCommands();
  assert.equal(controller.getSnapshot().state, STATES.IDLE);
  assert.equal(idle.animationName, 'a');
});

test('a large tick discards time after the first triggered checkpoint', () => {
  const controller = createController([
    0.1, // IDLE -> brush
    0.9, // 10s no event
    0.1, 0, // 20s thinking
  ]);
  controller.doubleClick();
  controller.takeCommands();

  controller.tick(25);

  assert.equal(controller.getSnapshot().state, STATES.THINKING);
  assert.equal(controller.getSnapshot().brushSeconds, 20);
});

test('thinking can enter frenzy and reset brush seconds', () => {
  const controller = createController([
    0.1, // IDLE -> brush
    0.1, 0, // thinking, 2 loops
    0.049, 0, // frenzy, 3 loops
  ]);
  controller.doubleClick();
  controller.takeCommands();
  controller.tick(10);
  const [thinking] = controller.takeCommands();

  complete(controller, thinking, 2);

  const [drawing] = controller.takeCommands();
  assert.equal(controller.getSnapshot().state, STATES.FRENZY_DRAWING);
  assert.equal(controller.getSnapshot().brushSeconds, 0);
  assert.equal(controller.getSnapshot().targetLoops, 3);
  assert.equal(drawing.animationName, 'd');
});

test('brush double click runs frenzy, one signing-off, and optional appreciation', () => {
  const controller = createController([
    0.1, // IDLE -> brush
    0.999999, // frenzy 13 loops
    0.119, 0.999999, // appreciation, 5 loops
  ]);
  controller.doubleClick();
  controller.takeCommands();
  controller.tick(7);

  controller.doubleClick();
  const [drawing] = controller.takeCommands();
  assert.equal(controller.getSnapshot().targetLoops, 13);
  complete(controller, drawing, 13);

  const [signingOff] = controller.takeCommands();
  assert.equal(signingOff.animationName, 'd_win');
  assert.equal(signingOff.loop, false);
  complete(controller, signingOff);

  const [appreciation] = controller.takeCommands();
  assert.equal(controller.getSnapshot().state, STATES.BRUSH_APPRECIATION);
  assert.equal(controller.getSnapshot().targetLoops, 5);
  complete(controller, appreciation, 5);

  const [brush] = controller.takeCommands();
  assert.equal(controller.getSnapshot().state, STATES.BRUSH_READY);
  assert.equal(controller.getSnapshot().brushSeconds, 0);
  assert.equal(brush.animationName, 'a_win');
});

test('transient states ignore double click without queueing it', () => {
  const logs = [];
  const controller = createController([0.8, 0], logs);
  controller.doubleClick();
  controller.takeCommands();

  assert.equal(controller.doubleClick(), false);
  assert.deepEqual(controller.takeCommands(), []);
  assert.ok(logs.some(log => log.event === 'double-click' && log.accepted === false));
});

test('stale completion with an old playbackId cannot advance state', () => {
  const controller = createController([0.1, 0]);
  const oldIdle = controller.getActivePlayback(0);
  controller.doubleClick();
  controller.takeCommands();

  complete(controller, oldIdle, 10);

  assert.equal(controller.getSnapshot().state, STATES.BRUSH_READY);
  assert.deepEqual(controller.takeCommands(), []);
});

test('test mode invalidates playback, clears both tracks, and exits to IDLE', () => {
  const controller = createController([0.8, 0]);
  controller.doubleClick();
  const [light] = controller.takeCommands();

  controller.setTestMode(true);
  assert.equal(controller.getSnapshot().state, STATES.TEST_MODE);
  assert.deepEqual(controller.takeCommands(), [{
    type: 'clear-tracks',
    trackIndexes: [0, 1],
  }]);
  complete(controller, light);
  assert.deepEqual(controller.takeCommands(), []);

  controller.setTestMode(false);
  const [idle] = controller.takeCommands();
  assert.equal(controller.getSnapshot().state, STATES.IDLE);
  assert.equal(idle.animationName, 'a');
});

test('structured logs have monotonic sequence and expose timing decisions', () => {
  const logs = [];
  const controller = createController([0.1, 0.9], logs);
  controller.doubleClick();
  controller.takeCommands();
  controller.tick(10);

  assert.deepEqual(logs.map(log => log.seq), logs.map((_, index) => index + 1));
  assert.ok(logs.every(log => log.atMs === 1234));
  assert.ok(logs.some(log => log.event === 'state-transition'));
  assert.ok(logs.some(log => log.event === 'timer-threshold' && log.threshold === 10));
  assert.ok(logs.some(log => log.event === 'lottery' && log.outcome === 'none'));
});
