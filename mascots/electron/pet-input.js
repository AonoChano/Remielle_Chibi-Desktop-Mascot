(function initPetInput(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PetInput = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createPetInput() {
  'use strict';

  const CLICK_THROUGH_RECHECK_FRAMES = 4;

  // Owns all pointer interaction with the pet window: dragging the mascot,
  // pixel-based click-through (letting clicks pass through transparent areas),
  // double-click (delegated to the host's behavior controller) and the
  // right-click context menu (opens the settings panel).
  //
  // The host calls `updateClickThrough()` once per frame after rendering, and
  // `invalidateRect()` on window resize. Hit testing is delegated to the
  // renderer's `checkPixelAlpha()`, which reads the WebGL framebuffer.
  class PetInput {
    constructor(options = {}) {
      this.renderer = options.renderer;
      this.electronAPI = options.electronAPI || (typeof window !== 'undefined' ? window.electronAPI : null);
      this.onDoubleClick = options.onDoubleClick || null;

      this.currentlyIgnoringMouse = false;
      this.lastMouseX = -1;
      this.lastMouseY = -1;
      this.mouseOnCharacter = true;
      this.clickThroughFrameCount = 0;
      this.lastCheckedMouseX = -1;
      this.lastCheckedMouseY = -1;
    }

    setup(canvasEl) {
      let isDragging = false;
      let startX = 0;
      let startY = 0;

      canvasEl.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          isDragging = true;
          startX = e.screenX;
          startY = e.screenY;
        }
      });

      window.addEventListener('mousemove', (e) => {
        const rect = canvasEl.getBoundingClientRect();
        this.lastMouseX = e.clientX - rect.left;
        this.lastMouseY = e.clientY - rect.top;

        if (!isDragging) return;

        const dx = e.screenX - startX;
        const dy = e.screenY - startY;
        if (this.electronAPI) {
          this.electronAPI.send('drag-pet', dx, dy);
        }
        startX = e.screenX;
        startY = e.screenY;
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
      });

      canvasEl.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (this.onDoubleClick) this.onDoubleClick();
      });

      canvasEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.electronAPI) {
          this.electronAPI.send('open-panel');
        }
      });
    }

    // Called every frame by the host after render(). Toggles mouse-event
    // forwarding through the renderer's framebuffer so clicks on transparent
    // pixels fall through to the desktop.
    updateClickThrough() {
      this.clickThroughFrameCount++;

      // Skip readPixels when mouse hasn't moved and we're within the re-check
      // interval. Periodic re-checks handle animation moving under a static
      // cursor.
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
      } else if (this.renderer) {
        this.mouseOnCharacter = this.renderer.checkPixelAlpha(this.lastMouseX, this.lastMouseY);
      }

      const shouldIgnore = !this.mouseOnCharacter;
      if (shouldIgnore !== this.currentlyIgnoringMouse) {
        this.currentlyIgnoringMouse = shouldIgnore;
        if (this.electronAPI) {
          this.electronAPI.send('set-mouse-events', shouldIgnore);
        }
      }
    }

    invalidateRect() {
      if (this.renderer) this.renderer.cachedCanvasRect = null;
    }
  }

  return { PetInput };
}));
