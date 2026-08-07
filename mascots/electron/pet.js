// --- Modules (loaded as globals via <script> tags before this file) ---
const { PetRenderer, BASE_SIZE, LIGHT_ANIMATION } = window.PetRenderer;
const { PetInput } = window.PetInput;

// PetApp is the host/orchestrator. It owns no Spine or DOM-input state itself;
// it wires together three collaborators:
//   - PetRenderer  : skeleton, animation, eye tracking, swirl, rendering
//   - PetInput     : drag, click-through, context menu, double-click
//   - PetBehavior  : the autonomous drawing state machine
// and drives the per-frame update/render cycle declared by spine.SpineCanvas.
class PetApp {
  constructor() {
    this.renderer = new PetRenderer();
    this.input = null;
    this.canvas = null;
    this.behavior = null;
    this.playbackIds = new WeakMap();
    this.testMode = false;
    this.testModeGate = new TestModePolicy.TestModeFeatureGate({
      logger: record => console.debug('[pet-behavior]', JSON.stringify(record)),
    });
    this.eyeTrackingEnabled = true;
    this.eyeTrackingSuspended = false;
    this.cursorSample = null;
  }

  loadAssets(canvas) {
    this.renderer.loadAssets(canvas);
  }

  error(canvas, errors) {
    this.renderer.error(canvas, errors);
  }

  initialize(canvas) {
    this.renderer.initialize(canvas, {
      onAnimationComplete: entry => this.handleAnimationComplete(entry),
    });
    this.canvas = canvas;

    this.behavior = new PetBehavior.PetBehaviorController();
    this.setupTestModeFeatures();
    this.flushBehaviorCommands();
    this.setupIPC();

    this.input = new PetInput({
      renderer: this.renderer,
      electronAPI: window.electronAPI,
      onDoubleClick: () => {
        if (!this.behavior || this.testModeGate.isEnabled()) return;
        this.behavior.doubleClick();
        this.flushBehaviorCommands();
      },
    });
    this.input.setup(document.getElementById('canvas'));

    this.restoreSavedState();
    window.addEventListener('resize', () => { this.input.invalidateRect(); });
  }

  restoreSavedState() {
    if (!window.electronAPI || !window.electronAPI.invoke) return;
    window.electronAPI.invoke('load-settings').then(settings => {
      if (!settings) return;

      this.applyTestMode(settings.testMode === true);
      if (this.testMode) {
        if (settings.currentAnimation && this.renderer.animationState) {
          this.renderer.animationState.setAnimation(0, settings.currentAnimation, true);
        }
        if (settings.lightEnabled && this.renderer.animationState) {
          this.renderer.animationState.setAnimation(1, LIGHT_ANIMATION, true);
        }
      }

      // Restore skeleton scale (directly, no IPC needed)
      const savedSize = settings.petSize || settings.size;
      if (savedSize && this.renderer.skeleton && Number.isFinite(savedSize)) {
        const scale = savedSize / BASE_SIZE;
        this.renderer.skeleton.scaleX = scale;
        this.renderer.skeleton.scaleY = scale;
      }
    }).catch(error => {
      console.warn('[pet] Failed to restore settings:', error.message);
    });

    window.electronAPI.invoke('get-eye-tracking-enabled').then(enabled => {
      this.eyeTrackingEnabled = enabled === true;
    }).catch(error => {
      console.warn('[pet] Failed to get eye tracking state:', error.message);
    });
  }

  setupTestModeFeatures() {
    this.testModeGate.register('automatic-behavior', {
      suspend: () => {
        this.behavior.setTestMode(true);
        this.flushBehaviorCommands();
      },
      resume: () => {
        this.behavior.setTestMode(false);
        this.flushBehaviorCommands();
      },
    });
    this.testModeGate.register('eye-tracking', {
      suspend: () => {
        this.eyeTrackingSuspended = true;
      },
      resume: () => {
        this.eyeTrackingSuspended = false;
      },
    });
  }

  applyTestMode(enabled) {
    const previous = this.testMode;
    try {
      this.testMode = this.testModeGate.setEnabled(enabled === true);
    } catch (error) {
      this.testMode = previous;
      console.error('[pet-behavior] Test mode transition failed:', error);
    }
  }

  setupIPC() {
    if (!window.electronAPI) return;

    window.electronAPI.on('play-animation', (animName) => {
      if (this.testMode && this.renderer.animationState) {
        this.renderer.animationState.setAnimation(0, animName, true);
      }
    });

    window.electronAPI.on('apply-scale', (scale) => {
      if (this.renderer.skeleton) {
        this.renderer.skeleton.scaleX = scale;
        this.renderer.skeleton.scaleY = scale;
      }
    });

    window.electronAPI.on('toggle-light', (enabled) => {
      if (!this.testMode || !this.renderer.animationState) return;
      if (enabled) {
        this.renderer.animationState.setAnimation(1, LIGHT_ANIMATION, true);
      } else {
        this.renderer.clearLightTrack();
      }
    });

    window.electronAPI.on('test-mode-changed', (enabled) => {
      this.applyTestMode(enabled);
    });

    window.electronAPI.on('cursor-position', sample => {
      if (sample && typeof sample === 'object') {
        this.cursorSample = sample;
      }
    });

    window.electronAPI.on('eye-tracking-changed', enabled => {
      this.eyeTrackingEnabled = enabled === true;
    });
  }

  handleAnimationComplete(entry) {
    if (!this.behavior || !entry || !entry.animation) return;
    const playbackId = this.playbackIds.get(entry);
    if (playbackId === undefined) return;
    this.behavior.animationCompleted({
      animationName: entry.animation.name,
      trackIndex: entry.trackIndex,
      playbackId,
    });
    this.flushBehaviorCommands();
  }

  flushBehaviorCommands() {
    if (!this.behavior || !this.renderer.animationState) return;
    const animationState = this.renderer.animationState;
    for (const command of this.behavior.takeCommands()) {
      if (command.type === 'play') {
        const entry = animationState.setAnimation(
          command.trackIndex,
          command.animationName,
          command.loop
        );
        this.playbackIds.set(entry, command.playbackId);
      } else if (command.type === 'clear-track') {
        animationState.clearTrack(command.trackIndex);
        if (command.trackIndex === 1) this.renderer.resetLightSlots();
      } else if (command.type === 'clear-tracks') {
        animationState.clearTracks();
        this.renderer.resetLightSlots();
      }
    }
  }

  update(canvas, delta) {
    if (this.behavior) {
      this.behavior.tick(delta);
      this.flushBehaviorCommands();
    }
    this.renderer.update(canvas, delta, {
      cursorSample: this.cursorSample,
      enabled: this.eyeTrackingEnabled && !this.eyeTrackingSuspended,
    });
  }

  render(canvas) {
    this.renderer.render(canvas);
    // Pixel-based click-through: check alpha at mouse position after render
    if (this.input) this.input.updateClickThrough();
  }
}

new spine.SpineCanvas(document.getElementById("canvas"), {
  webglConfig: { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true },
  app: new PetApp()
});
