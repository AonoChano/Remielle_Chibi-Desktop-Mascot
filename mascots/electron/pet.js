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

    window.electronAPI.on('apply-scale', (scale) => {
      if (this.skeleton) {
        this.skeleton.scaleX = scale;
        this.skeleton.scaleY = scale;
      }
    });

    window.electronAPI.on('toggle-light', (enabled) => {
      if (!this.animationState) return;
      if (enabled) {
        // Play light on track 1 as an overlay — does not interrupt track 0
        this.animationState.setAnimation(1, 'light', true);
      } else {
        // Clear track 1 — removes the light overlay
        this.animationState.clearTrack(1);
        // Reset light slots to invisible (setup pose color)
        if (this.skeleton) {
          var lightSlots = ['light_a', 'light_b'];
          for (var i = 0; i < lightSlots.length; i++) {
            var slot = this.skeleton.findSlot(lightSlots[i]);
            if (slot) {
              slot.color.set(1, 1, 1, 0);
            }
          }
        }
      }
    });
  }

  applyOutfit(prefix) {
    if (!this.skeleton) return;
    // Reset to setup pose first — clears ALL attachments from any previous outfit
    this.skeleton.setToSetupPose();

    if (!prefix) {
      // null = reset to default, nothing else to apply
      this.skeleton.updateWorldTransform(spine.Physics.update);
      return;
    }

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
