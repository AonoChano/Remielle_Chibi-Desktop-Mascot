(function initPetRenderer(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PetRenderer = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createPetRenderer() {
  'use strict';

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
  const PIXEL_ALPHA_THRESHOLD = 10;

  // Owns every Spine concern: skeleton, animation state, eye tracking,
  // swirl-eye rotation, light slots, pixel-based hit detection, and the
  // update/render cycle. The host (PetApp) drives behavior, IPC, test mode,
  // and input, delegating all rendering to this class.
  class PetRenderer {
    constructor() {
      this.skeleton = null;
      this.animationState = null;
      this.gl = null;
      this.pixelReadBuffer = new Uint8Array(4);
      this.eyeBones = [];
      this.warnedMissingEyeBones = false;
      this.swirlBones = [];
      this.swirlRotation = 0;
      this.swirlActive = false;
      this.cachedCanvasRect = null;
      this.eyeOffset = { x: 0, y: 0 };
    }

    loadAssets(canvas) {
      canvas.assetManager.loadText(SKELETON_PATH);
      canvas.assetManager.loadTextureAtlas(ATLAS_PATH);
    }

    error(canvas, errors) {
      console.error('[pet] Asset loading failed:', errors);
    }

    // `options.onAnimationComplete` is invoked when any track finishes, so the
    // host can forward the event to its behavior controller.
    initialize(canvas, options = {}) {
      const assetManager = canvas.assetManager;
      const atlas = assetManager.require(ATLAS_PATH);
      const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
      const skeletonJson = new spine.SkeletonJson(atlasLoader);
      skeletonJson.scale = 1;
      const skeletonData = skeletonJson.readSkeletonData(assetManager.require(SKELETON_PATH));
      this.skeleton = new spine.Skeleton(skeletonData);

      const animationStateData = new spine.AnimationStateData(skeletonData);
      this.animationState = new spine.AnimationState(animationStateData);
      if (typeof options.onAnimationComplete === 'function') {
        this.animationState.addListener({
          complete: options.onAnimationComplete,
        });
      }

      this.centerSkeleton();
      this.setupEyeBones();
      this.setupSwirlBones();
    }

    centerSkeleton() {
      if (!this.skeleton) return;
      this.skeleton.setToSetupPose();
      this.skeleton.updateWorldTransform(spine.Physics.update);
    }

    // --- Light slot management ---

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

    // --- Eye tracking ---

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

    // `state` = { cursorSample, enabled }. Must run after animationState.apply()
    // (so animation values are the base) and before updateWorldTransform()
    // (so the pupil override is baked into world transforms).
    updateEyeTracking(delta, state) {
      if (this.eyeBones.length === 0) return;
      const target = EyeTracking.computeEyeTarget({
        ...(state.cursorSample || {}),
        enabled: state.enabled === true,
        hasSample: state.cursorSample != null,
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

    // --- Swirl eye rotation ---

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

    // --- Spine update & render ---

    // `eyeTrackingState` = { cursorSample, enabled }. The host computes
    // `enabled` from its eyeTrackingEnabled && !eyeTrackingSuspended flags.
    update(canvas, delta, eyeTrackingState) {
      if (this.animationState) {
        this.animationState.update(delta);
        this.animationState.apply(this.skeleton);
      }
      if (this.skeleton) {
        this.updateEyeTracking(delta, eyeTrackingState);
        this.updateSwirlEyes(delta);
        this.skeleton.updateWorldTransform(spine.Physics.update);
      }
    }

    render(canvas) {
      const renderer = canvas.renderer;
      renderer.resize(spine.ResizeMode.Expand);
      canvas.clear(0, 0, 0, 0);
      renderer.begin();
      if (this.skeleton) {
        renderer.drawSkeleton(this.skeleton, false);
      }
      renderer.end();
    }
  }

  return { PetRenderer, BASE_SIZE, LIGHT_ANIMATION };
}));
