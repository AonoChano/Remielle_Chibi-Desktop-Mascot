'use strict';

function readAlwaysOnTopSetting(settings) {
  return settings && typeof settings.alwaysOnTop === 'boolean'
    ? settings.alwaysOnTop
    : true;
}

class AlwaysOnTopService {
  constructor(options) {
    this.enabled = options.initialEnabled;
    this.persistSetting = options.persistSetting;
    this.broadcastSetting = options.broadcastSetting;
    this.window = null;
  }

  getEnabled() {
    return this.enabled;
  }

  attachWindow(window) {
    this.window = window;
    const liveWindow = this._getLiveWindow();
    if (liveWindow) {
      liveWindow.setAlwaysOnTop(this.enabled);
    }
  }

  detachWindow(window) {
    if (!window || this.window === window) {
      this.window = null;
    }
  }

  setEnabled(enabled) {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('always-on-top setting must be a boolean');
    }
    if (enabled === this.enabled) return this.enabled;

    const previous = this.enabled;
    const liveWindow = this._getLiveWindow();
    let windowChanged = false;

    if (liveWindow) {
      liveWindow.setAlwaysOnTop(enabled);
      windowChanged = true;
    }

    try {
      const persisted = this.persistSetting(enabled);
      if (persisted === false) {
        throw new Error('Failed to persist always-on-top setting');
      }
    } catch (error) {
      if (windowChanged) {
        try {
          liveWindow.setAlwaysOnTop(previous);
        } catch (rollbackError) {
          console.warn(
            '[always-on-top] Failed to roll back window state:',
            rollbackError.message
          );
        }
      }
      throw error;
    }

    this.enabled = enabled;
    this.broadcastSetting(enabled);
    return this.enabled;
  }

  _getLiveWindow() {
    if (!this.window || this.window.isDestroyed()) return null;
    return this.window;
  }
}

module.exports = {
  AlwaysOnTopService,
  readAlwaysOnTopSetting,
};
