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

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {import('./behavior.js').Behavior} opts.behavior
 * @param {(errors: Record<string, string>) => void} [opts.onError]
 */
export function createPet({ canvas, behavior, onError }) {
  let skeleton = null;
  let animationState = null;
  const playbackIds = new WeakMap();
  let disposed = false;

  function flushCommands() {
    if (animationState === null) return;
    for (const cmd of behavior.takeCommands()) {
      if (cmd.type === 'play') {
        const entry = animationState.setAnimation(cmd.trackIndex, cmd.animationName, cmd.loop);
        playbackIds.set(entry, cmd.id);
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
      const scale = PET_SIZE / BASE_SIZE;
      skeleton.scaleX = scale;
      skeleton.scaleY = scale;

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
    webglConfig: { alpha: true, premultipliedAlpha: false },
  });

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      instance.dispose();
    },
  };
}
