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

test('writing -> idle: brush down, appreciate the work, then idle (no light on unlucky roll)', () => {
  const behavior = createBehavior({ random: () => 0.99, lightChance: 0.5 });
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.WRITING);
  behavior.takeCommands();
  behavior.drive(ACTIVITY.IDLE); // whole conversation flow ended
  let cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].type, 'play');
  assert.equal(cmds[0].trackIndex, 0);
  assert.equal(cmds[0].animationName, 'd_win');
  assert.equal(cmds[0].loop, false);
  assert.equal(behavior.state, STATES.FINISHING);

  behavior.animationCompleted({ animationName: 'd_win', trackIndex: 0, playbackId: cmds[0].id });
  cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].trackIndex, 0);
  assert.equal(cmds[0].animationName, 'c'); // appreciates the finished work
  assert.equal(behavior.state, STATES.REACTION);

  behavior.animationCompleted({ animationName: 'c', trackIndex: 0, playbackId: cmds[0].id });
  cmds = behavior.takeCommands();
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].animationName, 'a');
  assert.equal(behavior.state, STATES.IDLE);
});

test('writing -> idle: lucky roll overlays the golden light on track 1', () => {
  const behavior = createBehavior({ random: () => 0, lightChance: 0.5 });
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.WRITING);
  behavior.takeCommands();
  behavior.drive(ACTIVITY.IDLE);
  const cmds = behavior.takeCommands();
  assert.equal(cmds.length, 2);
  assert.equal(cmds[0].trackIndex, 0);
  assert.equal(cmds[0].animationName, 'd_win');
  assert.equal(cmds[1].trackIndex, 1);
  assert.equal(cmds[1].animationName, 'light');

  // The overlay finishes independently -> clear track.
  behavior.animationCompleted({ animationName: 'light', trackIndex: 1, playbackId: cmds[1].id });
  const overlay = behavior.takeCommands();
  assert.equal(overlay.length, 1);
  assert.deepEqual(overlay[0], { type: 'clear-track', trackIndex: 1 });
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

test('the light overlay never locks the main track', () => {
  const behavior = createBehavior({ random: () => 0, lightChance: 0.5 });
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.WRITING);
  behavior.takeCommands();
  behavior.drive(ACTIVITY.IDLE);
  const cmds = behavior.takeCommands();
  const finishId = cmds[0].id;
  const lightId = cmds[1].id;

  // The next turn starts while the arc is still running.
  behavior.drive(ACTIVITY.THINKING);
  assert.equal(behavior.takeCommands().length, 0); // let d_win finish
  behavior.animationCompleted({ animationName: 'd_win', trackIndex: 0, playbackId: finishId });
  let main = behavior.takeCommands();
  assert.equal(main.length, 1);
  assert.equal(main[0].animationName, 'c'); // appreciation runs first
  behavior.animationCompleted({ animationName: 'c', trackIndex: 0, playbackId: main[0].id });
  main = behavior.takeCommands();
  assert.equal(main.length, 1);
  assert.equal(main[0].trackIndex, 0);
  assert.equal(main[0].animationName, 'b');
  assert.equal(behavior.state, STATES.THINKING);

  // The overlay then finishes independently -> clear-track.
  behavior.animationCompleted({ animationName: 'light', trackIndex: 1, playbackId: lightId });
  const overlay = behavior.takeCommands();
  assert.equal(overlay.length, 1);
  assert.deepEqual(overlay[0], { type: 'clear-track', trackIndex: 1 });
});

test('a stale track-1 complete does not clear the current light', () => {
  const behavior = createBehavior({ random: () => 0, lightChance: 0.5 });
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.WRITING);
  behavior.takeCommands();
  behavior.drive(ACTIVITY.IDLE);
  const cmds = behavior.takeCommands();
  const lightId = cmds[1].id;
  behavior.animationCompleted({ animationName: 'light', trackIndex: 1, playbackId: lightId - 1 });
  assert.equal(behavior.takeCommands().length, 0);
});

test('lightChance can be a live getter (config-card friendly)', () => {
  let chance = 0;
  const behavior = createBehavior({ random: () => 0, lightChance: () => chance });
  behavior.start();
  behavior.takeCommands();
  behavior.drive(ACTIVITY.WRITING);
  behavior.takeCommands();
  behavior.drive(ACTIVITY.IDLE);
  const first = behavior.takeCommands();
  assert.equal(first.length, 1); // chance 0 -> brush-down only

  // Finish the arc, then raise the getter and celebrate again.
  behavior.animationCompleted({ animationName: 'd_win', trackIndex: 0, playbackId: first[0].id });
  const appreciateId = behavior.takeCommands()[0].id;
  behavior.animationCompleted({ animationName: 'c', trackIndex: 0, playbackId: appreciateId });
  behavior.takeCommands();
  chance = 1;
  behavior.drive(ACTIVITY.WRITING);
  behavior.takeCommands();
  behavior.drive(ACTIVITY.IDLE);
  const cmds = behavior.takeCommands();
  assert.equal(cmds.length, 2); // brush-down + golden light
  assert.equal(cmds[1].trackIndex, 1);
  assert.equal(cmds[1].animationName, 'light');
});
