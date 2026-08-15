/**
 * Pure animation-behavior state machine for the pet.
 *
 * Framework-free and DOM-free so it runs in plain Node tests. It consumes
 * click events, animation-complete events and a host "activity" feed, and
 * produces "play" commands that the renderer flushes into the Spine
 * AnimationState.
 *
 * Activity (driven by the DSH session state, see activityStore.js):
 *   - idle     -> idle loop 'a'
 *   - thinking -> thinking loop 'b'   (agent reasoning / tool calls / jobs)
 *   - writing  -> drawing loop 'd'    (assistant streaming output)
 *   - waiting  -> pleading loop 'e'   (approval / question pending)
 *
 * Finishing arc: when the agent's whole conversation flow ends (writing ->
 * idle), the pet puts the brush down ('d_win'), then APPRECIATES the work
 * ('c'), then returns to the activity loop. With `lightChance` probability it
 * additionally overlays the golden-light clip 'light' on a SEPARATE track (1)
 * over that arc — the character keeps moving underneath; clearing the overlay
 * resets the light slot colors (see spine.js).
 *
 * Command shape: { type: 'play', id, trackIndex, animationName, loop } and
 * { type: 'clear-track', trackIndex }.
 * Every play command carries a monotonic id; the renderer maps the created
 * AnimationState entry back to that id, and `animationCompleted` ignores
 * completes from entries that were already superseded (stale callbacks).
 */

export const STATES = Object.freeze({
  IDLE: 'idle',
  REACTION: 'reaction',
  DRAWING: 'drawing',
  THINKING: 'thinking',
  WRITING: 'writing',
  WAITING: 'waiting',
  FINISHING: 'finishing',
});

export const ACTIVITY = Object.freeze({
  IDLE: 'idle',
  THINKING: 'thinking',
  WRITING: 'writing',
  WAITING: 'waiting',
});

export function createBehavior(options = {}) {
  const idle = options.idle ?? 'a';
  const single = options.single ?? 'e';
  const draw = options.draw ?? 'd';
  const drawDone = options.drawDone ?? 'd_win';
  const appreciate = options.appreciate ?? 'c';
  const thinking = options.thinking ?? 'b';
  const writing = options.writing ?? 'd';
  const waiting = options.waiting ?? 'e';
  const light = options.light ?? 'light';
  const idleBeforeAppreciate = options.idleBeforeAppreciate ?? 12;
  const lightChance = options.lightChance ?? 0.5;
  const random = options.random ?? Math.random;

  let state = STATES.IDLE;
  let activity = ACTIVITY.IDLE;
  let idleLoops = 0;
  let seq = 0;
  let commands = [];
  const activePlayback = new Map(); // trackIndex -> latest command id

  function play(trackIndex, animationName, loop) {
    seq += 1;
    activePlayback.set(trackIndex, seq);
    commands.push({ type: 'play', id: seq, trackIndex, animationName, loop });
  }

  function playIdle() {
    play(0, idle, true);
  }

  /** Switch to the loop the given activity asks for (idle keeps IDLE state). */
  function playActivityFor(next) {
    if (next === ACTIVITY.IDLE) {
      state = STATES.IDLE;
      playIdle();
      return;
    }
    if (next === ACTIVITY.THINKING) {
      state = STATES.THINKING;
      play(0, thinking, true);
      return;
    }
    if (next === ACTIVITY.WRITING) {
      state = STATES.WRITING;
      play(0, writing, true);
      return;
    }
    if (next === ACTIVITY.WAITING) {
      state = STATES.WAITING;
      play(0, waiting, true);
    }
  }

  /** Turn end: brush down on track 0, then appreciate; light overlay with `lightChance`. */
  function celebrate() {
    state = STATES.FINISHING;
    play(0, drawDone, false);
    if (random() < lightChance) play(1, light, false);
  }

  function takeCommands() {
    const out = commands;
    commands = [];
    return out;
  }

  /** Queue the initial idle loop (safe to call again — supersedes). */
  function start() {
    if (state === STATES.IDLE && activity === ACTIVITY.IDLE) playIdle();
  }

  /** Cute reaction: plays once, then returns to the activity loop. */
  function singleClick() {
    if (state !== STATES.IDLE) return;
    state = STATES.REACTION;
    play(0, single, false);
  }

  /** User drawing sequence: draw -> drawDone -> activity loop. */
  function doubleClick() {
    if (state === STATES.DRAWING) return;
    state = STATES.DRAWING;
    play(0, draw, false);
  }

  /**
   * Switch the host activity. Activity-loop switches take effect immediately;
   * a reaction/drawing/celebration already in progress is allowed to finish —
   * its completion handler re-checks the current activity. Writing -> idle is
   * the masterpiece moment and enters the celebration arc instead of idling.
   */
  function drive(next) {
    if (next !== ACTIVITY.IDLE && next !== ACTIVITY.THINKING && next !== ACTIVITY.WRITING && next !== ACTIVITY.WAITING) return;
    if (next === activity) return;
    activity = next;
    if (state === STATES.IDLE || state === STATES.THINKING || state === STATES.WRITING || state === STATES.WAITING) {
      if (state === STATES.WRITING && next === ACTIVITY.IDLE) {
        celebrate();
        return;
      }
      playActivityFor(next);
    }
  }

  function animationCompleted(entry) {
    const track = entry == null ? undefined : entry.trackIndex;
    const name = entry == null ? undefined : entry.animationName;
    const id = entry == null ? undefined : entry.playbackId;
    if (id === undefined) return;
    if (activePlayback.get(track) !== id) return; // stale complete from a replaced entry

    // Overlay track: the golden light finishes -> clear it (resets its slots).
    if (track === 1) {
      if (name === light) commands.push({ type: 'clear-track', trackIndex: 1 });
      return;
    }
    if (track !== 0) return;

    if (state === STATES.IDLE && name === idle) {
      idleLoops += 1;
      if (idleLoops >= idleBeforeAppreciate) {
        idleLoops = 0;
        state = STATES.REACTION;
        play(0, appreciate, false);
      }
    } else if (state === STATES.REACTION && (name === single || name === appreciate)) {
      state = STATES.IDLE;
      playActivityFor(activity);
    } else if (state === STATES.DRAWING) {
      if (name === draw) {
        play(0, drawDone, false);
      } else if (name === drawDone) {
        state = STATES.IDLE;
        playActivityFor(activity);
      }
    } else if (state === STATES.FINISHING && name === drawDone) {
      // Brush down -> appreciate the finished work, then the activity loop.
      state = STATES.REACTION;
      play(0, appreciate, false);
    }
    // THINKING/WRITING/WAITING loops complete forever — nothing to do.
  }

  function reset() {
    state = STATES.IDLE;
    activity = ACTIVITY.IDLE;
    idleLoops = 0;
    activePlayback.clear();
    commands = [];
    seq = 0;
  }

  return {
    get state() {
      return state;
    },
    get activity() {
      return activity;
    },
    start,
    singleClick,
    doubleClick,
    drive,
    animationCompleted,
    takeCommands,
    reset,
  };
}
