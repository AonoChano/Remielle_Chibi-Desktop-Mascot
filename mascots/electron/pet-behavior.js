(function initPetBehavior(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PetBehavior = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createPetBehavior() {
  'use strict';

  const STATES = Object.freeze({
    IDLE: 'IDLE',
    IDLE_APPRECIATION: 'IDLE_APPRECIATION',
    GOLDEN_LIGHT: 'GOLDEN_LIGHT',
    BRUSH_READY: 'BRUSH_READY',
    THINKING: 'THINKING',
    TEARING_UP: 'TEARING_UP',
    FRENZY_DRAWING: 'FRENZY_DRAWING',
    SIGNING_OFF: 'SIGNING_OFF',
    BRUSH_APPRECIATION: 'BRUSH_APPRECIATION',
    TEST_MODE: 'TEST_MODE',
  });

  function defaultNow() {
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now();
    }
    return Date.now();
  }

  function defaultLogger(record) {
    if (typeof console === 'undefined' || !console.debug) return;
    const fields = Object.entries(record)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(' ');
    console.debug(`[pet-behavior] ${fields}`);
  }

  class PetBehaviorController {
    constructor(options = {}) {
      this.random = options.random || Math.random;
      this.logger = options.logger || defaultLogger;
      this.now = options.now || defaultNow;
      this.commands = [];
      this.activePlaybacks = new Map();
      this.sequence = 0;
      this.playbackSequence = 0;
      this.state = null;
      this.idleLoops = 0;
      this.brushSeconds = 0;
      this.nextBrushThreshold = 10;
      this.completedLoops = 0;
      this.targetLoops = 0;
      this._enterIdle('startup');
    }

    takeCommands() {
      return this.commands.splice(0);
    }

    getSnapshot() {
      return {
        state: this.state,
        idleLoops: this.idleLoops,
        brushSeconds: this.brushSeconds,
        nextBrushThreshold: this.nextBrushThreshold,
        completedLoops: this.completedLoops,
        targetLoops: this.targetLoops,
      };
    }

    getActivePlayback(trackIndex) {
      const playback = this.activePlaybacks.get(trackIndex);
      return playback ? { ...playback } : null;
    }

    doubleClick() {
      if (this.state === STATES.IDLE) {
        const roll = this._roll();
        this.idleLoops = 0;
        if (roll < 0.80) {
          this._log('double-click', { accepted: true });
          this._log('lottery', {
            source: 'idle-double-click',
            roll,
            outcome: 'brush-ready',
          });
          this._enterBrush(true, 'idle-double-click');
        } else {
          const loops = this._randomInteger(1, 2);
          this._log('double-click', { accepted: true });
          this._log('lottery', {
            source: 'idle-double-click',
            roll,
            outcome: 'golden-light',
            loops,
          });
          this._enterFinite(STATES.GOLDEN_LIGHT, 'light', 1, loops, true, 'idle-double-click');
        }
        return true;
      }

      if (this.state === STATES.BRUSH_READY) {
        this._log('double-click', { accepted: true });
        this._enterFrenzy('brush-double-click');
        return true;
      }

      this._log('double-click', {
        accepted: false,
        reason: 'state-locked',
      });
      return false;
    }

    tick(deltaSeconds) {
      if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
        if (!Number.isFinite(deltaSeconds)) {
          this._log('invalid-delta', { deltaSeconds });
        }
        return;
      }
      if (this.state !== STATES.BRUSH_READY) return;

      let remaining = deltaSeconds;
      while (remaining > 0 && this.state === STATES.BRUSH_READY) {
        const untilThreshold = this.nextBrushThreshold - this.brushSeconds;
        if (remaining + Number.EPSILON < untilThreshold) {
          this.brushSeconds += remaining;
          return;
        }

        this.brushSeconds = this.nextBrushThreshold;
        remaining -= Math.max(0, untilThreshold);
        const threshold = this.nextBrushThreshold;
        this._log('timer-threshold', {
          threshold,
          brushSeconds: this.brushSeconds,
        });
        this.nextBrushThreshold += 10;
        this._handleBrushThreshold(threshold);

        if (this.state !== STATES.BRUSH_READY) {
          if (remaining > 0) {
            this._log('timer-remainder-discarded', {
              seconds: remaining,
              reason: 'state-changed',
            });
          }
          return;
        }
      }
    }

    animationCompleted(event) {
      if (!event || !Number.isInteger(event.trackIndex)) return false;
      const active = this.activePlaybacks.get(event.trackIndex);
      if (!active ||
          active.playbackId !== event.playbackId ||
          active.animationName !== event.animationName) {
        this._log('animation-completion-rejected', {
          animationName: event.animationName,
          trackIndex: event.trackIndex,
          playbackId: event.playbackId,
          reason: 'stale-or-mismatched',
        });
        return false;
      }

      this._log('animation-complete', {
        animationName: event.animationName,
        trackIndex: event.trackIndex,
        playbackId: event.playbackId,
      });

      switch (this.state) {
        case STATES.IDLE:
          if (event.trackIndex === 0 && event.animationName === 'a') {
            this._completeIdleLoop();
          }
          break;
        case STATES.IDLE_APPRECIATION:
          this._completeFinite(() => this._enterIdle('idle-appreciation-complete'));
          break;
        case STATES.GOLDEN_LIGHT:
          if (event.trackIndex === 1) {
            this._completeFinite(() => this._enterIdle('golden-light-complete'));
          }
          break;
        case STATES.THINKING:
          this._completeFinite(() => this._finishThinking());
          break;
        case STATES.TEARING_UP:
          this._completeFinite(() => this._resumeBrushOrIdle('tearing-up-complete'));
          break;
        case STATES.FRENZY_DRAWING:
          this._completeFinite(() => this._enterSigningOff());
          break;
        case STATES.SIGNING_OFF:
          this._completeFinite(() => this._finishSigningOff());
          break;
        case STATES.BRUSH_APPRECIATION:
          this._completeFinite(() => this._enterBrush(false, 'brush-appreciation-complete'));
          break;
        default:
          break;
      }
      return true;
    }

    setTestMode(enabled) {
      if (enabled) {
        if (this.state === STATES.TEST_MODE) return;
        const invalidatedPlaybackIds = Array.from(this.activePlaybacks.values())
          .map(playback => playback.playbackId);
        this.activePlaybacks.clear();
        this.commands.push({
          type: 'clear-tracks',
          trackIndexes: [0, 1],
        });
        this._transition(STATES.TEST_MODE, 'test-mode-enabled');
        this._log('test-mode', {
          enabled: true,
          invalidatedPlaybackIds,
        });
        return;
      }

      if (this.state !== STATES.TEST_MODE) return;
      this._log('test-mode', { enabled: false });
      this._enterIdle('test-mode-disabled');
    }

    _handleBrushThreshold(threshold) {
      const roll = this._roll();
      if (roll < 0.45) {
        const loops = this._randomInteger(2, 10);
        this._log('lottery', {
          source: 'brush-threshold',
          threshold,
          roll,
          outcome: 'thinking',
          loops,
        });
        this._enterFinite(STATES.THINKING, 'b', 0, loops, true, `brush-${threshold}s`);
      } else if (roll < 0.70) {
        const loops = this._randomInteger(2, 7);
        this._log('lottery', {
          source: 'brush-threshold',
          threshold,
          roll,
          outcome: 'tearing-up',
          loops,
        });
        this._enterFinite(STATES.TEARING_UP, 'e', 0, loops, true, `brush-${threshold}s`);
      } else {
        this._log('lottery', {
          source: 'brush-threshold',
          threshold,
          roll,
          outcome: 'none',
        });
        if (threshold >= 30) {
          this._enterIdle('brush-time-limit');
        }
      }
    }

    _completeIdleLoop() {
      this.idleLoops += 1;
      this._log('loop-progress', {
        animationName: 'a',
        completedLoops: this.idleLoops,
        targetLoops: 10,
      });
      if (this.idleLoops < 10) return;

      this.idleLoops = 0;
      const roll = this._roll();
      if (roll < 0.15) {
        const loops = this._randomInteger(2, 5);
        this._log('lottery', {
          source: 'idle-ten-loops',
          roll,
          outcome: 'appreciation',
          loops,
        });
        this._enterFinite(
          STATES.IDLE_APPRECIATION,
          'c',
          0,
          loops,
          true,
          'idle-lottery'
        );
      } else {
        this._log('lottery', {
          source: 'idle-ten-loops',
          roll,
          outcome: 'none',
        });
      }
    }

    _finishThinking() {
      const roll = this._roll();
      if (roll < 0.05) {
        this._log('lottery', {
          source: 'thinking-complete',
          roll,
          outcome: 'frenzy',
        });
        this._enterFrenzy('thinking-lottery');
      } else {
        this._log('lottery', {
          source: 'thinking-complete',
          roll,
          outcome: 'brush-ready',
        });
        this._resumeBrushOrIdle('thinking-complete');
      }
    }

    _finishSigningOff() {
      const roll = this._roll();
      if (roll < 0.12) {
        const loops = this._randomInteger(2, 5);
        this._log('lottery', {
          source: 'signing-off-complete',
          roll,
          outcome: 'appreciation',
          loops,
        });
        this._enterFinite(
          STATES.BRUSH_APPRECIATION,
          'c',
          0,
          loops,
          true,
          'signing-off-lottery'
        );
      } else {
        this._log('lottery', {
          source: 'signing-off-complete',
          roll,
          outcome: 'brush-ready',
        });
        this._enterBrush(false, 'signing-off-complete');
      }
    }

    _resumeBrushOrIdle(reason) {
      if (this.brushSeconds >= 30) {
        this._enterIdle('brush-time-limit-after-event');
      } else {
        this._enterBrush(false, reason);
      }
    }

    _enterIdle(reason) {
      if (this.activePlaybacks.has(1)) {
        this.activePlaybacks.delete(1);
        this.commands.push({ type: 'clear-track', trackIndex: 1 });
      }
      this.idleLoops = 0;
      this.brushSeconds = 0;
      this.nextBrushThreshold = 10;
      this.completedLoops = 0;
      this.targetLoops = 0;
      this._transition(STATES.IDLE, reason);
      this._play('a', 0, true);
    }

    _enterBrush(resetTimer, reason) {
      if (resetTimer) {
        this.brushSeconds = 0;
        this.nextBrushThreshold = 10;
      }
      this.completedLoops = 0;
      this.targetLoops = 0;
      this._transition(STATES.BRUSH_READY, reason);
      this._log('timer-resumed', {
        brushSeconds: this.brushSeconds,
        reason,
      });
      this._play('a_win', 0, true);
    }

    _enterFrenzy(reason) {
      this.brushSeconds = 0;
      this.nextBrushThreshold = 10;
      const loops = this._randomInteger(3, 13);
      this._log('timer-reset', {
        brushSeconds: 0,
        reason: 'frenzy',
      });
      this._log('lottery', {
        source: 'frenzy-loops',
        outcome: 'frenzy',
        loops,
      });
      this._enterFinite(STATES.FRENZY_DRAWING, 'd', 0, loops, true, reason);
    }

    _enterSigningOff() {
      this._enterFinite(STATES.SIGNING_OFF, 'd_win', 0, 1, false, 'frenzy-complete');
    }

    _enterFinite(state, animationName, trackIndex, loops, loop, reason) {
      this.completedLoops = 0;
      this.targetLoops = loops;
      this._transition(state, reason);
      if (state !== STATES.GOLDEN_LIGHT) {
        this._log('timer-paused', {
          brushSeconds: this.brushSeconds,
          reason: state,
        });
      }
      this._play(animationName, trackIndex, loop);
    }

    _completeFinite(onComplete) {
      this.completedLoops += 1;
      this._log('loop-progress', {
        completedLoops: this.completedLoops,
        targetLoops: this.targetLoops,
      });
      if (this.completedLoops >= this.targetLoops) {
        onComplete();
      }
    }

    _play(animationName, trackIndex, loop) {
      const playback = {
        type: 'play',
        animationName,
        trackIndex,
        loop,
        playbackId: ++this.playbackSequence,
      };
      this.activePlaybacks.set(trackIndex, {
        animationName,
        trackIndex,
        playbackId: playback.playbackId,
      });
      this.commands.push(playback);
      this._log('animation-start', {
        animationName,
        trackIndex,
        playbackId: playback.playbackId,
        loop,
      });
      return playback;
    }

    _transition(nextState, reason) {
      const previousState = this.state;
      this.state = nextState;
      this._log('state-transition', {
        from: previousState,
        to: nextState,
        reason,
      });
    }

    _roll() {
      const value = Number(this.random());
      if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new RangeError('random() must return a finite number in [0, 1)');
      }
      return value;
    }

    _randomInteger(min, max) {
      return min + Math.floor(this._roll() * (max - min + 1));
    }

    _log(event, fields = {}) {
      this.logger({
        seq: ++this.sequence,
        atMs: this.now(),
        event,
        state: this.state,
        ...fields,
      });
    }
  }

  return {
    PetBehaviorController,
    STATES,
  };
}));
