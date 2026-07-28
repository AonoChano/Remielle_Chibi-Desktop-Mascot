// Browser shim: loads locale files directly for screenshot testing
// Simulates electronAPI.invoke by fetching JSON files

async function initBrowserShim() {
  const localeFiles = ['zh-CN', 'en-US'];
  const locales = {};

  for (const code of localeFiles) {
    try {
      const resp = await fetch(`locales/${code}.json`);
      locales[code] = await resp.json();
    } catch (e) {
      console.error(`Failed to load ${code}:`, e);
    }
  }

  window.__browserLocales = locales;
  window.__currentLocale = 'zh-CN';

  // Simulate electronAPI
  window.electronAPI = {
    send: (channel, ...args) => {
      if (channel === 'set-locale') {
        window.__currentLocale = args[0];
        const dict = window.__browserLocales[args[0]];
        // Simulate locale-changed broadcast
        if (dict) {
          I18n.register(args[0], dict);
          I18n.setLocale(args[0]);
          // Update locale-select
          const sel = document.getElementById('locale-select');
          if (sel) sel.value = args[0];
        }
      }
    },
    invoke: async (channel, ...args) => {
      if (channel === 'get-locales') {
        return Object.entries(window.__browserLocales).map(([code, dict]) => ({
          code, displayName: dict._meta.display_name
        }));
      }
      if (channel === 'get-locale-dict') {
        return window.__browserLocales[args[0]] || null;
      }
      if (channel === 'get-current-locale') {
        return window.__currentLocale;
      }
      return null;
    },
    on: (channel, callback) => {
      // No-op for browser testing
    }
  };
}
