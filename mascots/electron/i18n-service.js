'use strict';

const path = require('path');
const fs = require('fs');

function createI18nService(__dirname, settingsStore) {
  const localesDir = path.join(__dirname, 'locales');
  let currentLocale = settingsStore.load().locale || 'zh-CN';

  function scanLocales() {
    const locales = {};
    try {
      const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
          if (content._meta && content._meta.locale && content._meta.display_name) {
            locales[content._meta.locale] = content;
          }
        } catch (e) {
          console.warn(`[i18n] Skipping invalid locale file: ${file} - ${e.message}`);
        }
      }
    } catch (e) {
      console.warn(`[i18n] Could not scan locales directory: ${e.message}`);
    }
    return locales;
  }

  const cache = scanLocales();

  function getLocales() {
    const result = [];
    for (const [code, dict] of Object.entries(cache)) {
      result.push({ code, displayName: dict._meta.display_name });
    }
    return result;
  }

  function getDict(localeCode) {
    return cache[localeCode] || null;
  }

  function setLocale(localeCode) {
    if (!cache[localeCode]) return null;
    currentLocale = localeCode;
    settingsStore.save({ locale: localeCode });
    return cache[localeCode];
  }

  function getCurrentLocale() {
    return currentLocale;
  }

  return { getLocales, getDict, setLocale, getCurrentLocale, cache };
}

module.exports = { createI18nService };
