class PetApp {
  constructor() {
    this.skeleton = null;
    this.animationState = null;
    this.canvas = null;
    this.pendingAnim = null;
    this.currentlyIgnoringMouse = false;
    this.lastMouseX = -1;
    this.lastMouseY = -1;
    this.mouseOnCharacter = true;
    this.gl = null;
    this.pixelReadBuffer = new Uint8Array(4);
    this.behavior = null;
    this.playbackIds = new WeakMap();
    this.testMode = false;
    this.testModeGate = new TestModePolicy.TestModeFeatureGate({
      logger: record => console.debug('[pet-behavior]', JSON.stringify(record)),
    });
    this.eyeTrackingEnabled = true;
    this.eyeTrackingSuspended = false;
    this.cursorSample = null;
    this.eyeOffset = { x: 0, y: 0 };
    this.eyeBones = [];
    this.warnedMissingEyeBones = false;
  }

  loadAssets(canvas) {
    canvas.assetManager.loadText("assets/remi.json");
    canvas.assetManager.loadTextureAtlas("assets/leimi.atlas");
  }

  initialize(canvas) {
    let assetManager = canvas.assetManager;
    var atlas = assetManager.require("assets/leimi.atlas");
    var atlasLoader = new spine.AtlasAttachmentLoader(atlas);
    var skeletonJson = new spine.SkeletonJson(atlasLoader);
    skeletonJson.scale = 1;
    var skeletonData = skeletonJson.readSkeletonData(assetManager.require("assets/remi.json"));
    this.skeleton = new spine.Skeleton(skeletonData);

    var animationStateData = new spine.AnimationStateData(skeletonData);
    this.animationState = new spine.AnimationState(animationStateData);
    this.animationState.addListener({
      complete: entry => this.handleAnimationComplete(entry),
    });

    this.canvas = canvas;
    this.centerSkeleton();
    this.setupEyeBones();
    this.behavior = new PetBehavior.PetBehaviorController();
    this.setupTestModeFeatures();
    this.flushBehaviorCommands();
    this.setupIPC();
    this.setupDrag();
    this.restoreSavedState();
  }

  restoreSavedState() {
    if (!window.electronAPI || !window.electronAPI.invoke) return;
    window.electronAPI.invoke('load-settings').then(settings => {
      if (!settings) return;

      this.applyTestMode(settings.testMode === true);
      if (this.testMode) {
        if (settings.currentAnimation && this.animationState) {
          this.animationState.setAnimation(0, settings.currentAnimation, true);
        }
        if (settings.lightEnabled && this.animationState) {
          this.animationState.setAnimation(1, 'light', true);
        }
      }

      // Restore skeleton scale (directly, no IPC needed)
      // Panel saves `size`, main process saves `petSize` — use whichever is available
      var savedSize = settings.size || settings.petSize;
      if (savedSize && this.skeleton) {
        var scale = savedSize / 420;
        this.skeleton.scaleX = scale;
        this.skeleton.scaleY = scale;
      }
    });

    window.electronAPI.invoke('get-eye-tracking-enabled').then(enabled => {
      this.eyeTrackingEnabled = enabled === true;
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

  centerSkeleton() {
    if (!this.skeleton) return;
    this.skeleton.setToSetupPose();
    this.skeleton.updateWorldTransform(spine.Physics.update);
  }

  setupIPC() {
    if (!window.electronAPI) return;

    window.electronAPI.on('play-animation', (animName) => {
      if (this.testMode && this.animationState) {
        this.animationState.setAnimation(0, animName, true);
      }
    });

    window.electronAPI.on('set-expression', (expression) => {
      this.applyExpression(expression);
    });

    window.electronAPI.on('apply-scale', (scale) => {
      if (this.skeleton) {
        this.skeleton.scaleX = scale;
        this.skeleton.scaleY = scale;
      }
    });

    window.electronAPI.on('toggle-light', (enabled) => {
      if (!this.testMode || !this.animationState) return;
      if (enabled) {
        this.animationState.setAnimation(1, 'light', true);
      } else {
        this.clearLightTrack();
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
    if (!this.behavior || !this.animationState) return;
    for (const command of this.behavior.takeCommands()) {
      if (command.type === 'play') {
        const entry = this.animationState.setAnimation(
          command.trackIndex,
          command.animationName,
          command.loop
        );
        this.playbackIds.set(entry, command.playbackId);
      } else if (command.type === 'clear-track') {
        this.animationState.clearTrack(command.trackIndex);
        if (command.trackIndex === 1) this.resetLightSlots();
      } else if (command.type === 'clear-tracks') {
        this.animationState.clearTracks();
        this.resetLightSlots();
      }
    }
  }

  clearLightTrack() {
    if (this.animationState) this.animationState.clearTrack(1);
    this.resetLightSlots();
  }

  resetLightSlots() {
    if (!this.skeleton) return;
    for (const slotName of ['light_a', 'light_b']) {
      const slot = this.skeleton.findSlot(slotName);
      if (slot) slot.color.set(1, 1, 1, 0);
    }
  }

  setupEyeBones() {
    if (!this.skeleton) return;
    const names = ['眼_瞳孔_微动', '眼_瞳孔L_微动'];
    this.eyeBones = names.map(name => {
      const bone = this.skeleton.findBone(name);
      if (!bone) return null;
      return {
        bone,
        setupX: bone.data.x,
        setupY: bone.data.y,
      };
    }).filter(Boolean);

    if (this.eyeBones.length !== names.length && !this.warnedMissingEyeBones) {
      this.warnedMissingEyeBones = true;
      console.warn('[eye-tracking] Required pupil bones are missing; tracking disabled.');
      this.eyeBones = [];
    }
  }

  updateEyeTracking(delta) {
    if (this.eyeBones.length === 0) return;
    const target = EyeTracking.computeEyeTarget({
      ...(this.cursorSample || {}),
      enabled: this.eyeTrackingEnabled && !this.eyeTrackingSuspended,
      hasSample: this.cursorSample !== null,
    });
    this.eyeOffset = EyeTracking.smoothEyeOffset(this.eyeOffset, target, delta);
    for (const tracked of this.eyeBones) {
      tracked.bone.x = tracked.setupX + this.eyeOffset.x;
      tracked.bone.y = tracked.setupY + this.eyeOffset.y;
    }
  }

  applyExpression(expression) {
    console.log('expression', expression);
  }

  // --- Pixel-based click-through detection ---

  getGL() {
    if (this.gl) return this.gl;
    const canvasEl = document.getElementById('canvas');
    if (!canvasEl) return null;
    this.gl = canvasEl.getContext('webgl2') || canvasEl.getContext('webgl');
    return this.gl;
  }

  checkPixelAlpha(cssX, cssY) {
    const canvasEl = document.getElementById('canvas');
    const gl = this.getGL();
    if (!gl || !canvasEl) return true; // fallback: assume clickable

    const rect = canvasEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return true;

    // Convert CSS coordinates to drawing buffer coordinates
    const px = Math.round((cssX / rect.width) * canvasEl.width);
    const py = Math.round((cssY / rect.height) * canvasEl.height);

    if (px < 0 || px >= canvasEl.width || py < 0 || py >= canvasEl.height) {
      return false;
    }

    try {
      gl.readPixels(px, canvasEl.height - py - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelReadBuffer);
      return this.pixelReadBuffer[3] > 10;
    } catch (e) {
      return true; // fallback: assume clickable
    }
  }

  updateClickThrough() {
    if (this.lastMouseX < 0 || this.lastMouseY < 0) {
      this.mouseOnCharacter = false;
    } else {
      this.mouseOnCharacter = this.checkPixelAlpha(this.lastMouseX, this.lastMouseY);
    }

    const shouldIgnore = !this.mouseOnCharacter;
    if (shouldIgnore !== this.currentlyIgnoringMouse) {
      this.currentlyIgnoringMouse = shouldIgnore;
      if (window.electronAPI) {
        window.electronAPI.send('set-mouse-events', shouldIgnore);
      }
    }
  }

  // --- Drag ---

  setupDrag() {
    let isDragging = false;
    let startX = 0, startY = 0;
    const canvasEl = document.getElementById('canvas');
    const self = this;

    canvasEl.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isDragging = true;
        startX = e.screenX;
        startY = e.screenY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      const rect = canvasEl.getBoundingClientRect();
      self.lastMouseX = e.clientX - rect.left;
      self.lastMouseY = e.clientY - rect.top;

      if (!isDragging) return;

      const dx = e.screenX - startX;
      const dy = e.screenY - startY;
      if (window.electronAPI) {
        window.electronAPI.send('drag-pet', dx, dy);
      }
      startX = e.screenX;
      startY = e.screenY;
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    canvasEl.addEventListener('dblclick', e => {
      e.preventDefault();
      if (!this.behavior || this.testModeGate.isEnabled()) return;
      this.behavior.doubleClick();
      this.flushBehaviorCommands();
    });

    canvasEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (window.electronAPI) {
        window.electronAPI.send('open-panel');
      }
    });
  }

  update(canvas, delta) {
    if (this.behavior) {
      this.behavior.tick(delta);
      this.flushBehaviorCommands();
    }
    if (this.animationState) {
      this.animationState.update(delta);
      this.animationState.apply(this.skeleton);
    }
    if (this.skeleton) {
      this.updateEyeTracking(delta);
      this.skeleton.updateWorldTransform(spine.Physics.update);
    }
  }

  render(canvas) {
    let renderer = canvas.renderer;
    renderer.resize(spine.ResizeMode.Expand);
    canvas.clear(0, 0, 0, 0);
    renderer.begin();
    if (this.skeleton) {
      renderer.drawSkeleton(this.skeleton, false);
    }
    renderer.end();

    // Pixel-based click-through: check alpha at mouse position after render
    this.updateClickThrough();
  }
}

new spine.SpineCanvas(document.getElementById("canvas"), {
  webglConfig: { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true },
  app: new PetApp()
});
