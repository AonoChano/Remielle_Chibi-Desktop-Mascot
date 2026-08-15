import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBehavior, STATES, ACTIVITY } from '../src/client/behavior.js';

test('starts idle and start() queues the idle loop', () => {
  const behavior = createBehavior();
  assert.equal(behavior.state, STATES.IDLE);
  behavior.start();
  const cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.deepEqual(cmds[0], { type: 'play', id: 1, trackIndex: 0, animationName: 'a', loop: true });
});

test('single click plays the cute reaction once, then returns to idle', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.singleClick();
  let cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'e');
  assert.equal(cmds[0].loop, false);
  const id = cmds[0].id;
  behavior.animationCompleted({ animationName: 'e', trackIndex: 0, playbackId: id });
  cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'a');
  assert.equal(cmds[0].loop, true);
});

test('double click plays draw -> drawDone -> idle', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.doubleClick();
  let cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'd');
  const drawId = cmds[0].id;
  behavior.animationCompleted({ animationName: 'd', trackIndex: 0, playbackId: drawId });
  cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'd_win');
  const doneId = cmds[0].id;
  behavior.animationCompleted({ animationName: 'd_win', trackIndex: 0, playbackId: doneId });
  cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'a');
});

test('clicks are ignored while a reaction is playing', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.singleClick();
  behavior.singleClick(); // ignored — not idle
  const cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
});

test('stale completes from superseded entries are ignored', () => {
  const behavior = createBehavior();
  behavior.start();
  const idleId = behavior.takeCommands()[0].id;
  behavior.doubleClick();
  behavior.takeCommands();
  // A complete from the superseded idle entry must not advance the machine.
  behavior.animationCompleted({ animationName: 'a', trackIndex: 0, playbackId: idleId });
  assert.equal(behavior.takeCommands().length, 0);
});

test('appreciation after N idle loops, then back to idle', () => {
  const behavior = createBehavior({ idleBeforeAppreciate: 2 });
  behavior.start();
  const idleId = behavior.takeCommands()[0].id;
  behavior.animationCompleted({ animationName: 'a', trackIndex: 0, playbackId: idleId });
  assert.equal(behavior.takeCommands().length, 0);
  behavior.animationCompleted({ animationName: 'a', trackIndex: 0, playbackId: idleId });
  let cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'c');
  const appreciateId = cmds[0].id;
  behavior.animationCompleted({ animationName: 'c', trackIndex: 0, playbackId: appreciateId });
  cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'a');
});

// --- host-activity drive ---

test('drive(thinking) switches to the thinking loop, drive(idle) returns', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.THINKING);
  let cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'b');
  assert.equal(cmds[0].loop, true);
  assert.equal(behavior.state, STATES.THINKING);
  behavior.drive(ACTIVITY.IDLE);
  cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'a');
  assert.equal(behavior.state, STATES.IDLE);
});

test('drive(thinking) while idle is a no-op when activity already matches', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.IDLE); // same activity — nothing queued
  assert.equal(behavior.takeCommands().length, 0);
});

test('a reaction finishes into the current activity instead of idle', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.singleClick();
  const reactionId = behavior.takeCommands()[0].id;
  behavior.drive(ACTIVITY.THINKING); // agent started working mid-reaction
  assert.equal(behavior.takeCommands().length, 0); // let the reaction finish
  behavior.animationCompleted({ animationName: 'e', trackIndex: 0, playbackId: reactionId });
  const cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'b');
  assert.equal(cmds[0].loop, true);
});

test('drawing completes into the waiting loop when activity is waiting', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.doubleClick();
  const drawId = behavior.takeCommands()[0].id;
  behavior.drive(ACTIVITY.WAITING);
  behavior.animationCompleted({ animationName: 'd', trackIndex: 0, playbackId: drawId });
  const doneId = behavior.takeCommands()[0].id;
  behavior.animationCompleted({ animationName: 'd_win', trackIndex: 0, playbackId: doneId });
  const cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'e');
  assert.equal(cmds[0].loop, true);
  assert.equal(behavior.state, STATES.WAITING);
});

test('thinking/waiting loop completes are ignored', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.THINKING);
  const thinkingId = behavior.takeCommands()[0].id;
  behavior.animationCompleted({ animationName: 'b', trackIndex: 0, playbackId: thinkingId });
  behavior.animationCompleted({ animationName: 'b', trackIndex: 0, playbackId: thinkingId });
  assert.equal(behavior.takeCommands().length, 0);
});

test('while thinking: single click ignored, double click still draws', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.THINKING);
  behavior.takeCommands();
  behavior.singleClick();
  assert.equal(behavior.takeCommands().length, 0);
  behavior.doubleClick();
  const cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'd');
});

// --- writing -> celebration arc ---

test('writing uses the drawing loop while streaming', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.WRITING);
  const cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'd');
  assert.equal(cmds[0].loop, true);
  assert.equal(behavior.state, STATES.WRITING);
});

test('writing -> idle plays d_win then light then idle', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.WRITING);
  behavior.takeCommands();
  behavior.drive(ACTIVITY.IDLE); // masterpiece moment
  let cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'd_win');
  assert.equal(cmds[0].loop, false);
  assert.equal(behavior.state, STATES.FINISHING);
  const finishId = cmds[0].id;
  behavior.animationCompleted({ animationName: 'd_win', trackIndex: 0, playbackId: finishId });
  cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'light');
  assert.equal(cmds[0].loop, false);
  assert.equal(behavior.state, STATES.CELEBRATING);
  const lightId = cmds[0].id;
  behavior.animationCompleted({ animationName: 'light', trackIndex: 0, playbackId: lightId });
  cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'a');
  assert.equal(behavior.state, STATES.IDLE);
});

test('thinking -> idle returns directly without celebration', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.THINKING);
  behavior.takeCommands();
  behavior.drive(ACTIVITY.IDLE);
  const cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'a');
  assert.equal(behavior.state, STATES.IDLE);
});

test('a new activity interrupts the celebration at its end', () => {
  const behavior = createBehavior();
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.WRITING);
  behavior.takeCommands();
  behavior.drive(ACTIVITY.IDLE);
  const finishId = behavior.takeCommands()[0].id;
  behavior.animationCompleted({ animationName: 'd_win', trackIndex: 0, playbackId: finishId });
  const lightId = behavior.takeCommands()[0].id;
  behavior.drive(ACTIVITY.THINKING); // next turn started mid-celebration — let light finish
  assert.equal(behavior.takeCommands().length, 0);
  behavior.animationCompleted({ animationName: 'light', trackIndex: 0, playbackId: lightId });
  const cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'b');
  assert.equal(behavior.state, STATES.THINKING);
});
