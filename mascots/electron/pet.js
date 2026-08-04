// --- Configuration constants ---
const BASE_SIZE = 420;                  // Reference window/pet size (px)
const SKELETON_PATH = 'assets/remi.json';
const ATLAS_PATH = 'assets/leimi.atlas';
const LIGHT_SLOT_NAMES = ['light_a', 'light_b'];
const LIGHT_ANIMATION = 'light';
const EYE_BONE_NAMES = ['眼_瞳孔_微动', '眼_瞳孔L_微动'];
const SWIRL_BONE_NAMES = ['D_眼珠晕_a', 'D_眼珠晕_b2'];
const SWIRL_ANIMATIONS = ['d', 'd_win'];
const SWIRL_SPEED = 240;                // 360° / 1.5s = 240°/s
const CLICK_THROUGH_RECHECK_FRAMES = 4;
const PIXEL_ALPHA_THRESHOLD = 10;

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
    this.swirlBones = [];
    this.swirlRotation = 0;
    this.swirlActive = false;
    this.clickThroughFrameCount = 0;
    this.lastCheckedMouseX = -1;
    this.lastCheckedMouseY = -1;
    this.cachedCanvasRect = null;
  }

  loadAssets(canvas) {
    canvas.assetManager.loadText(SKELETON_PATH);
    canvas.assetManager.loadTextureAtlas(ATLAS_PATH);
  }

  error(canvas, errors) {
    console.error('[pet] Asset loading failed:', errors);
  }

  initialize(canvas) {
    const assetManager = canvas.assetManager;
    const atlas = assetManager.require(ATLAS_PATH);
    const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
    const skeletonJson = new spine.SkeletonJson(atlasLoader);
    skeletonJson.scale = 1;
    const skeletonData = skeletonJson.readSkeletonData(assetManager.require(SKELETON_PATH));
    this.skeleton = new spine.Skeleton(skeletonData);

    const animationStateData = new spine.AnimationStateData(skeletonData);
    this.animationState = new spine.AnimationState(animationStateData);
    this.animationState.addListener({
      complete: entry => this.handleAnimationComplete(entry),
    });

    this.canvas = canvas;
    this.centerSkeleton();
    this.setupEyeBones();
    this.setupSwirlBones();
    this.behavior = new PetBehavior.PetBehaviorController();
    this.setupTestModeFeatures();
    this.flushBehaviorCommands();
    this.setupIPC();
    this.setupDrag();
    this.restoreSavedState();
    window.addEventListener('resize', () => { this.cachedCanvasRect = null; });
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
          this.animationState.setAnimation(1, LIGHT_ANIMATION, true);
        }
      }

      // Restore skeleton scale (directly, no IPC needed)
      const savedSize = settings.petSize || settings.size;
      if (savedSize && this.skeleton && Number.isFinite(savedSize)) {
        const scale = savedSize / BASE_SIZE;
        this.skeleton.scaleX = scale;
        this.skeleton.scaleY = scale;
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

    window.electronAPI.on('apply-scale', (scale) => {
      if (this.skeleton) {
        this.skeleton.scaleX = scale;
        this.skeleton.scaleY = scale;
      }
    });

    window.electronAPI.on('toggle-light', (enabled) => {
      if (!this.testMode || !this.animationState) return;
      if (enabled) {
        this.animationState.setAnimation(1, LIGHT_ANIMATION, true);
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
    for (const slotName of LIGHT_SLOT_NAMES) {
      const slot = this.skeleton.findSlot(slotName);
      if (slot) slot.color.set(1, 1, 1, 0);
    }
  }

  setupEyeBones() {
    if (!this.skeleton) return;
    this.eyeBones = EYE_BONE_NAMES.map(name => {
      const bone = this.skeleton.findBone(name);
      if (!bone) return null;
      return {
        bone,
        setupX: bone.data.x,
        setupY: bone.data.y,
      };
    }).filter(Boolean);

    if (this.eyeBones.length !== EYE_BONE_NAMES.length && !this.warnedMissingEyeBones) {
      this.warnedMissingEyeBones = true;
      console.warn('[eye-tracking] Required pupil bones are missing; tracking disabled.');
      this.eyeBones = [];
    }
  }

  setupSwirlBones() {
    if (!this.skeleton) return;
    // D_眼珠晕_a (left eye swirl) and D_眼珠晕_b2 (right eye swirl) are the
    // bones that carry the yellow 🌀 attachments shown during the "d" animation.
    // The skeleton has no rotation keyframes for them, so we spin them in code.
    this.swirlBones = SWIRL_BONE_NAMES.map(name => {
      const bone = this.skeleton.findBone(name);
      if (!bone) return null;
      return {
        bone,
        setupRotation: bone.data.rotation,
      };
    }).filter(Boolean);
  }

  updateSwirlEyes(delta) {
    if (this.swirlBones.length === 0) return;

    let active = false;
    if (this.animationState) {
      const entry = this.animationState.getCurrent(0);
      if (entry && entry.animation && SWIRL_ANIMATIONS.includes(entry.animation.name)) {
        active = true;
      }
    }

    if (active) {
      this.swirlRotation = (this.swirlRotation + SWIRL_SPEED * delta) % 360;
      for (const tracked of this.swirlBones) {
        tracked.bone.rotation = tracked.setupRotation + this.swirlRotation;
      }
    } else if (this.swirlActive) {
      // Reset to setup pose when leaving the swirl animation
      this.swirlRotation = 0;
      for (const tracked of this.swirlBones) {
        tracked.bone.rotation = tracked.setupRotation;
      }
    }
    this.swirlActive = active;
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
      const bone = tracked.bone;
      const parent = bone.parent;
      if (!parent) {
        bone.x = tracked.setupX + this.eyeOffset.x;
        bone.y = tracked.setupY + this.eyeOffset.y;
        continue;
      }
      // Transform world-space offset to local bone space using the parent's
      // world transform matrix (a, b, c, d). This corrects for the ~17° parent
      // rotation and 0.15 root scale, ensuring the pupil moves in the correct
      // screen direction at the intended pixel magnitude.
      const det = parent.a * parent.d - parent.b * parent.c;
      if (Math.abs(det) < 1e-10) {
        bone.x = tracked.setupX + this.eyeOffset.x;
        bone.y = tracked.setupY + this.eyeOffset.y;
        continue;
      }
      const invDet = 1 / det;
      const localX = (this.eyeOffset.x * parent.d - this.eyeOffset.y * parent.b) * invDet;
      const localY = (-this.eyeOffset.x * parent.c + this.eyeOffset.y * parent.a) * invDet;
      bone.x = tracked.setupX + localX;
      bone.y = tracked.setupY + localY;
    }
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

    const rect = this.cachedCanvasRect || canvasEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return true;

    // Convert CSS coordinates to drawing buffer coordinates
    const px = Math.round((cssX / rect.width) * canvasEl.width);
    const py = Math.round((cssY / rect.height) * canvasEl.height);

    if (px < 0 || px >= canvasEl.width || py < 0 || py >= canvasEl.height) {
      return false;
    }

    try {
      gl.readPixels(px, canvasEl.height - py - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelReadBuffer);
      return this.pixelReadBuffer[3] > PIXEL_ALPHA_THRESHOLD;
    } catch (e) {
      return true; // fallback: assume clickable
    }
  }

  updateClickThrough() {
    this.clickThroughFrameCount++;

    // Skip readPixels when mouse hasn't moved and we're within the re-check interval.
    // Periodic re-checks (every 4 frames) handle animation moving under a static cursor.
    const mouseUnchanged = this.lastMouseX === this.lastCheckedMouseX &&
                           this.lastMouseY === this.lastCheckedMouseY;
    if (mouseUnchanged && this.clickThroughFrameCount < CLICK_THROUGH_RECHECK_FRAMES) {
      return;
    }

    this.clickThroughFrameCount = 0;
    this.lastCheckedMouseX = this.lastMouseX;
    this.lastCheckedMouseY = this.lastMouseY;

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
      this.updateSwirlEyes(delta);
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
