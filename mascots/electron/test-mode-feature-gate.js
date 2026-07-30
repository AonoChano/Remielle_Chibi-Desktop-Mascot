(function initTestModeFeatureGate(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TestModePolicy = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createPolicy() {
  'use strict';

  class TestModeFeatureGate {
    constructor(options = {}) {
      this.enabled = options.initialEnabled === true;
      this.logger = typeof options.logger === 'function'
        ? options.logger
        : () => {};
      this.features = new Map();
    }

    isEnabled() {
      return this.enabled;
    }

    register(name, callbacks) {
      if (typeof name !== 'string' || name.length === 0) {
        throw new TypeError('test mode feature name is required');
      }
      if (this.features.has(name)) {
        throw new Error(`test mode feature already registered: ${name}`);
      }
      if (!callbacks ||
          typeof callbacks.suspend !== 'function' ||
          typeof callbacks.resume !== 'function') {
        throw new TypeError('test mode feature requires suspend and resume callbacks');
      }

      if (this.enabled) callbacks.suspend();
      this.features.set(name, callbacks);
      this._log('feature-registered', name, 'success');

      return () => {
        if (this.features.get(name) !== callbacks) return;
        this.features.delete(name);
        this._log('feature-unregistered', name, 'success');
      };
    }

    setEnabled(enabled) {
      if (typeof enabled !== 'boolean') {
        throw new TypeError('test mode state must be a boolean');
      }
      if (enabled === this.enabled) return this.enabled;

      const action = enabled ? 'suspend' : 'resume';
      const rollbackAction = enabled ? 'resume' : 'suspend';
      const completed = [];

      try {
        for (const [name, callbacks] of this.features) {
          callbacks[action]();
          completed.push([name, callbacks]);
          this._log('feature-transition', name, 'success', action);
        }
      } catch (error) {
        this._log('feature-transition', null, 'failed', action, error);
        for (const [name, callbacks] of completed.reverse()) {
          try {
            callbacks[rollbackAction]();
            this._log('feature-rollback', name, 'success', rollbackAction);
          } catch (rollbackError) {
            this._log(
              'feature-rollback',
              name,
              'failed',
              rollbackAction,
              rollbackError
            );
          }
        }
        throw error;
      }

      this.enabled = enabled;
      this._log('test-mode-transition', null, 'success', action);
      return this.enabled;
    }

    _log(event, feature, result, action, error) {
      this.logger({
        event,
        feature,
        action,
        result,
        enabled: this.enabled,
        error: error ? error.message : undefined,
      });
    }
  }

  return { TestModeFeatureGate };
}));
