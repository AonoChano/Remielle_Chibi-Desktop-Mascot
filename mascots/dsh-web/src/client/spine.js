/**
 * Spine renderer controller.
 *
 * Wraps spine.SpineCanvas with the same app-lifecycle pattern the Electron
 * pet uses (loadAssets -> initialize -> update/render). The atlas has no
 * `pma` tag, so the skeleton is ALWAYS drawn with premultipliedAlpha=false —
 * see .harness/pitfalls/spine-webgl-alpha-rendering.md.
 */
import * as spine from '@esotericsoftware/spine-webgl';

/** Absolute URLs under the node-half route (see lib/index.js). */
export const ASSET_URLS = Object.freeze({
  skeleton: '/remi-pet/assets/remi.json',
  atlas: '/remi-pet/assets/leimi.atlas',
});

/** Reference skeleton size used by the Electron pet window. */
export const BASE_SIZE = 420;
/** CSS size of the pet host on the page. */
export const PET_SIZE = 220;

/** Slots the 'light' overlay animation paints; reset when its track clears. */
const LIGHT_SLOT_NAMES = ['light_a', 'light_b'];

/** Pixel alpha below this value counts as transparent (click-through). */
const PIXEL_ALPHA_THRESHOLD = 10;

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {import('./behavior.js').Behavior} opts.behavior
 * @param {number} [opts.petSize] - CSS host size in px (skeleton scale = petSize / BASE_SIZE).
 * @param {(errors: Record<string, string>) => void} [opts.onError]
 */
export function createPet({ canvas, behavior, onError, petSize = PET_SIZE }) {
  let skeleton = null;
  let animationState = null;
  let size = petSize;
  const playbackIds = new WeakMap();
  let disposed = false;

  /** Spine keeps an attachment posed after its track clears — fade it out. */
  function resetLightSlots() {
    if (skeleton === null) return;
    for (const slotName of LIGHT_SLOT_NAMES) {
      const slot = skeleton.findSlot(slotName);
      if (slot !== null) slot.color.set(1, 1, 1, 0);
    }
  }

  /** Apply the current size as a uniform skeleton scale. */
  function applyScale() {
    if (skeleton === null) return;
    const scale = size / BASE_SIZE;
    skeleton.scaleX = scale;
    skeleton.scaleY = scale;
  }

  function flushCommands() {
    if (animationState === null) return;
    for (const cmd of behavior.takeCommands()) {
      if (cmd.type === 'play') {
        const entry = animationState.setAnimation(cmd.trackIndex, cmd.animationName, cmd.loop);
        playbackIds.set(entry, cmd.id);
      } else if (cmd.type === 'clear-track') {
        animationState.clearTrack(cmd.trackIndex);
        if (cmd.trackIndex === 1) resetLightSlots();
      } else if (cmd.type === 'clear-tracks') {
        animationState.clearTracks();
      }
    }
  }

  const app = {
    loadAssets(canvasInstance) {
      canvasInstance.assetManager.loadText(ASSET_URLS.skeleton);
      canvasInstance.assetManager.loadTextureAtlas(ASSET_URLS.atlas);
    },

    error(canvasInstance, errors) {
      if (onError) onError(errors || {});
    },

    initialize(canvasInstance) {
      const assetManager = canvasInstance.assetManager;
      const atlas = assetManager.require(ASSET_URLS.atlas);
      const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
      const skeletonJson = new spine.SkeletonJson(atlasLoader);
      skeletonJson.scale = 1;
      const skeletonData = skeletonJson.readSkeletonData(assetManager.require(ASSET_URLS.skeleton));

      skeleton = new spine.Skeleton(skeletonData);
      skeleton.setToSetupPose();
      skeleton.updateWorldTransform(spine.Physics.update);
      applyScale();

      const animationStateData = new spine.AnimationStateData(skeletonData);
      animationState = new spine.AnimationState(animationStateData);
      animationState.addListener({
        complete: (entry) => {
          if (!entry || !entry.animation) return;
          behavior.animationCompleted({
            animationName: entry.animation.name,
            trackIndex: entry.trackIndex,
            playbackId: playbackIds.get(entry),
          });
          flushCommands();
        },
      });
    },

    update(canvasInstance, delta) {
      if (animationState === null || skeleton === null) return;
      animationState.update(delta);
      animationState.apply(skeleton);
      skeleton.updateWorldTransform(spine.Physics.update);
      flushCommands();
    },

    render(canvasInstance) {
      const renderer = canvasInstance.renderer;
      renderer.resize(spine.ResizeMode.Expand);
      canvasInstance.clear(0, 0, 0, 0);
      renderer.begin();
      if (skeleton !== null) renderer.drawSkeleton(skeleton, false);
      renderer.end();
    },

    dispose() {
      disposed = true;
    },
  };

  const instance = new spine.SpineCanvas(canvas, {
    app,
    // preserveDrawingBuffer keeps the last frame readable so the click-through
    // pixel probe (isOpaqueAt) can read alpha between render frames.
    webglConfig: { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true },
  });

  const pixelBuffer = new Uint8Array(4);

  /**
   * Pixel-accurate click-through probe: whether the character has visible
   * pixels at a viewport CSS coordinate. Transparent areas report false so the
   * host can drop pointer-events and let clicks reach the page underneath.
   * @param {number} cssX - viewport CSS x of the cursor.
   * @param {number} cssY - viewport CSS y of the cursor.
   * @returns {boolean} true when the pixel alpha is above the threshold.
   */
  function isOpaqueAt(cssX, cssY) {
    if (skeleton === null) return true; // not loaded yet — keep it interactive
    const gl = instance.gl;
    const canvasEl = instance.htmlCanvas;
    if (gl === null || canvasEl === null) return true;
    const rect = canvasEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return true;
    const px = Math.round((cssX - rect.left) / rect.width * canvasEl.width);
    const py = Math.round((cssY - rect.top) / rect.height * canvasEl.height);
    if (px < 0 || px >= canvasEl.width || py < 0 || py >= canvasEl.height) return false;
    try {
      gl.readPixels(px, canvasEl.height - py - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
      return pixelBuffer[3] > PIXEL_ALPHA_THRESHOLD;
    } catch {
      return true; // read failed — assume interactive rather than dead
    }
  }

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      instance.dispose();
    },
    /** Live-resize the skeleton scale (the host CSS size is the view's job). */
    setSize(nextSize) {
      size = nextSize;
      applyScale();
    },
    isOpaqueAt,
  };
}
