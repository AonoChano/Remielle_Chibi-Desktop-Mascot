class PetApp {
  constructor() {
    this.skeleton = null;
    this.animationState = null;
    this.canvas = null;
    this.pendingAnim = null;
  }

  loadAssets(canvas) {
    canvas.assetManager.loadText("../../spine/remeille-chibi/remeille-chibi.json");
    canvas.assetManager.loadTextureAtlas("../../spine/remeille-chibi/remeille-chibi.atlas");
  }

  initialize(canvas) {
    let assetManager = canvas.assetManager;
    var atlas = assetManager.require("../../spine/remeille-chibi/remeille-chibi.atlas");
    var atlasLoader = new spine.AtlasAttachmentLoader(atlas);
    var skeletonJson = new spine.SkeletonJson(atlasLoader);
    skeletonJson.scale = 1;
    var skeletonData = skeletonJson.readSkeletonData(assetManager.require("../../spine/remeille-chibi/remeille-chibi.json"));
    this.skeleton = new spine.Skeleton(skeletonData);

    var animationStateData = new spine.AnimationStateData(skeletonData);
    this.animationState = new spine.AnimationState(animationStateData);
    this.animationState.setAnimation(0, "a", true);

    this.canvas = canvas;
    this.setupIPC();
    this.setupDrag();
    this.centerSkeleton();
  }

  centerSkeleton() {
    if (!this.skeleton) return;
    this.skeleton.setToSetupPose();
    this.skeleton.updateWorldTransform(spine.Physics.update);
  }

  setupIPC() {
    if (!window.electronAPI) return;

    window.electronAPI.on('play-animation', (animName) => {
      if (this.animationState) {
        this.animationState.setAnimation(0, animName, true);
      }
    });

    window.electronAPI.on('set-outfit', (prefix) => {
      this.applyOutfit(prefix);
    });

    window.electronAPI.on('set-expression', (expression) => {
      this.applyExpression(expression);
    });
  }

  applyOutfit(prefix) {
    if (!this.skeleton) return;
    var slots = this.skeleton.slots;
    var skin = this.skeleton.data.defaultSkin;
    if (!skin) return;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var data = slot.data;
      var attachmentsForSlot = skin.attachments[data.index];
      if (!attachmentsForSlot) continue;
      var names = Object.keys(attachmentsForSlot);
      var target = names.find(n => n.startsWith(prefix + '_'));
      if (target) {
        this.skeleton.setAttachment(data.name, target);
      }
    }
    this.skeleton.updateWorldTransform(spine.Physics.update);
  }

  applyExpression(expression) {
    console.log('expression', expression);
  }

  setupDrag() {
    let isDragging = false;
    let startX = 0, startY = 0;
    const canvasEl = document.getElementById('canvas');

    canvasEl.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isDragging = true;
        startX = e.screenX;
        startY = e.screenY;
      }
    });

    window.addEventListener('mousemove', (e) => {
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

    canvasEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (window.electronAPI) {
        window.electronAPI.send('open-panel');
      }
    });
  }

  update(canvas, delta) {
    if (this.animationState) {
      this.animationState.update(delta);
      this.animationState.apply(this.skeleton);
    }
    if (this.skeleton) {
      this.skeleton.updateWorldTransform(spine.Physics.update);
    }
  }

  render(canvas) {
    let renderer = canvas.renderer;
    renderer.resize(spine.ResizeMode.Expand);
    canvas.clear(0, 0, 0, 0);
    renderer.begin();
    if (this.skeleton) {
      renderer.drawSkeleton(this.skeleton, true);
    }
    renderer.end();
  }
}

new spine.SpineCanvas(document.getElementById("canvas"), {
  app: new PetApp()
});
