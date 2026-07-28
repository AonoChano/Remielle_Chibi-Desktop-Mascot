/**
 * i18n.js — Lightweight internationalization engine
 * Zero dependencies. Fallback chain: current → en-US → zh-CN → key
 */
const I18n = {
  dicts: {},      // { localeCode: dict }
  current: 'zh-CN',
  fallbackChain: ['en-US', 'zh-CN'],

  /**
   * Register a locale dictionary
   */
  register(localeCode, dict) {
    if (dict && dict._meta && dict._meta.locale) {
      this.dicts[localeCode] = dict;
    }
  },

  /**
   * Set current locale and re-scan DOM
   */
  setLocale(localeCode) {
    if (this.dicts[localeCode]) {
      this.current = localeCode;
    } else {
      // Fallback to first available or zh-CN
      const available = Object.keys(this.dicts);
      this.current = available.includes('zh-CN') ? 'zh-CN' : available[0] || 'zh-CN';
    }
    this.scan();
    return this.current;
  },

  /**
   * Translate a key with dot notation (e.g. 'anim.drawing')
   */
  t(key) {
    // Try current language
    let result = this._lookup(this.dicts[this.current], key);
    if (result !== undefined) return result;

    // Try fallback chain
    for (const fallback of this.fallbackChain) {
      result = this._lookup(this.dicts[fallback], key);
      if (result !== undefined) return result;
    }

    // Return key as last resort
    return key;
  },

  /**
   * Internal: lookup a dot-notation key in a dict
   */
  _lookup(dict, key) {
    if (!dict) return undefined;
    return key.split('.').reduce((obj, k) => {
      return (obj && typeof obj === 'object') ? obj[k] : undefined;
    }, dict);
  },

  /**
   * Get list of available locales with display names
   */
  getAvailableLocales() {
    const result = [];
    for (const [code, dict] of Object.entries(this.dicts)) {
      result.push({
        code: code,
        displayName: dict._meta ? dict._meta.display_name : code
      });
    }
    return result;
  },

  /**
   * Scan DOM for [data-i18n] elements and update text content
   */
  scan() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (key) {
        el.textContent = this.t(key);
      }
    });

    // Also scan for [data-i18n-ph] for placeholders
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.dataset.i18nPh;
      if (key) {
        el.placeholder = this.t(key);
      }
    });
  }
};

// Export for both module and global contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = I18n;
}
if (typeof window !== 'undefined') {
  window.I18n = I18n;
}
