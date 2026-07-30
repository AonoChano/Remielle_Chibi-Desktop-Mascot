'use strict';

class EyeTrackingService {
  constructor(options) {
    this.enabled = options.initialEnabled;
    this.suspended = options.initialSuspended === true;
    this.getCursorPoint = options.getCursorPoint;
    this.getPetBounds = options.getPetBounds;
    this.sendCursor = options.sendCursor;
    this.saveSetting = options.saveSetting;
    this.broadcastSetting = options.broadcastSetting;
    this.setIntervalFn = options.setIntervalFn || setInterval;
    this.clearIntervalFn = options.clearIntervalFn || clearInterval;
    this.intervalMilliseconds = options.intervalMilliseconds || (1000 / 30);
    this.petAvailable = false;
    this.intervalHandle = null;
    this.destroyed = false;
  }

  getEnabled() {
    return this.enabled;
  }

  isSuspended() {
    return this.suspended;
  }

  setSuspended(suspended) {
    if (typeof suspended !== 'boolean') {
      throw new TypeError('eye tracking suspension must be a boolean');
    }
    if (this.destroyed || suspended === this.suspended) {
      return this.suspended;
    }
    this.suspended = suspended;
    this._syncSampler();
    return this.suspended;
  }

  setEnabled(enabled) {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('eye tracking setting must be a boolean');
    }
    if (this.destroyed) return this.enabled;
    if (enabled === this.enabled) {
      this._syncSampler();
      return this.enabled;
    }

    this.enabled = enabled;
    this.saveSetting(enabled);
    this.broadcastSetting(enabled);
    this._syncSampler();
    return this.enabled;
  }

  setPetAvailable(available) {
    if (this.destroyed) return;
    this.petAvailable = available === true;
    this._syncSampler();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this._stopSampler();
  }

  _syncSampler() {
    if (this.enabled && !this.suspended && this.petAvailable && !this.destroyed) {
      this._startSampler();
    } else {
      this._stopSampler();
    }
  }

  _startSampler() {
    if (this.intervalHandle !== null) return;
    this.intervalHandle = this.setIntervalFn(
      () => this._sample(),
      this.intervalMilliseconds
    );
  }

  _stopSampler() {
    if (this.intervalHandle === null) return;
    this.clearIntervalFn(this.intervalHandle);
    this.intervalHandle = null;
  }

  _sample() {
    if (this.destroyed || this.suspended || !this.enabled || !this.petAvailable) return;

    const cursor = this.getCursorPoint();
    const bounds = this.getPetBounds();
    if (!this._isPoint(cursor) || !this._isBounds(bounds)) return;

    this.sendCursor({
      cursorX: cursor.x,
      cursorY: cursor.y,
      centerX: bounds.x + bounds.width / 2,
      centerY: bounds.y + bounds.height / 2,
      width: bounds.width,
      height: bounds.height,
    });
  }

  _isPoint(point) {
    return point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y);
  }

  _isBounds(bounds) {
    return bounds &&
      Number.isFinite(bounds.x) &&
      Number.isFinite(bounds.y) &&
      Number.isFinite(bounds.width) &&
      Number.isFinite(bounds.height) &&
      bounds.width > 0 &&
      bounds.height > 0;
  }
}

module.exports = { EyeTrackingService };
