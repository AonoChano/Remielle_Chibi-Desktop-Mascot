// Global app state — reserved for future features
const AppState = {
  testMode: false,
  currentAnimation: 'a',
  lightEnabled: false,
  eyeTrackingEnabled: true,
  alwaysOnTop: true,
  animationQueue: [],
  triggerHandlers: {},
};

// --- i18n initialization ---
async function initI18n() {
  if (!window.electronAPI || !window.electronAPI.invoke) return;

  // Get available locales from main process
  const locales = await window.electronAPI.invoke('get-locales');
  const currentLocale = await window.electronAPI.invoke('get-current-locale');

  // Load each locale dict into I18n
  for (const { code } of locales) {
    const dict = await window.electronAPI.invoke('get-locale-dict', code);
    if (dict) I18n.register(code, dict);
  }

  // Set current locale
  I18n.setLocale(currentLocale);

  // Populate language select
  const localeSelect = document.getElementById('locale-select');
  for (const { code, displayName } of locales) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = displayName;
    if (code === currentLocale) opt.selected = true;
    localeSelect.appendChild(opt);
  }

  // Listen for locale changes from other windows
  window.electronAPI.on('locale-changed', (localeCode, dict) => {
    I18n.register(localeCode, dict);
    I18n.setLocale(localeCode);
    // Update select to reflect change
    localeSelect.value = localeCode;
  });
}

// --- Tab navigation ---
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    item.classList.add('active');
    const tabId = 'tab-' + item.dataset.tab;
    document.getElementById(tabId).classList.add('active');
  });
});

// --- Eye tracking toggle ---
const eyeTrackingToggle = document.getElementById('eye-tracking-toggle');

eyeTrackingToggle.addEventListener('change', async () => {
  if (!window.electronAPI || !window.electronAPI.invoke) return;
  const previous = AppState.eyeTrackingEnabled;
  const enabled = eyeTrackingToggle.checked;
  eyeTrackingToggle.disabled = true;
  try {
    const effective = await window.electronAPI.invoke('set-eye-tracking-enabled', enabled);
    AppState.eyeTrackingEnabled = effective === true;
    eyeTrackingToggle.checked = AppState.eyeTrackingEnabled;
  } catch (error) {
    AppState.eyeTrackingEnabled = previous;
    eyeTrackingToggle.checked = previous;
    console.warn('[eye-tracking] Failed to update setting:', error.message);
  } finally {
    eyeTrackingToggle.disabled = false;
  }
});

if (window.electronAPI) {
  window.electronAPI.on('eye-tracking-changed', enabled => {
    AppState.eyeTrackingEnabled = enabled === true;
    eyeTrackingToggle.checked = AppState.eyeTrackingEnabled;
  });
}

// --- Always-on-top toggle ---
const alwaysOnTopToggle = document.getElementById('always-on-top-toggle');

alwaysOnTopToggle.addEventListener('change', async () => {
  if (!window.electronAPI || !window.electronAPI.invoke) return;
  const previous = AppState.alwaysOnTop;
  const enabled = alwaysOnTopToggle.checked;
  alwaysOnTopToggle.disabled = true;
  try {
    const effective = await window.electronAPI.invoke('set-always-on-top', enabled);
    AppState.alwaysOnTop = effective === true;
    alwaysOnTopToggle.checked = AppState.alwaysOnTop;
  } catch (error) {
    AppState.alwaysOnTop = previous;
    alwaysOnTopToggle.checked = previous;
    console.warn('[always-on-top] Failed to update setting:', error.message);
  } finally {
    alwaysOnTopToggle.disabled = false;
  }
});

if (window.electronAPI) {
  window.electronAPI.on('always-on-top-changed', enabled => {
    AppState.alwaysOnTop = enabled === true;
    alwaysOnTopToggle.checked = AppState.alwaysOnTop;
  });
}

// --- Test mode toggle ---
const testToggle = document.getElementById('test-mode-toggle');
const testControls = document.getElementById('test-controls');

testToggle.addEventListener('change', () => {
  const enabled = testToggle.checked;
  AppState.testMode = enabled;
  testControls.style.display = enabled ? 'block' : 'none';
  document.body.classList.toggle('test-mode-active', enabled);
  if (window.electronAPI) {
    window.electronAPI.send('set-test-mode', enabled);
  }
  saveSettings();
});

// --- Animation buttons ---
document.querySelectorAll('.btn-anim').forEach(btn => {
  btn.addEventListener('click', () => {
    const anim = btn.dataset.anim;
    AppState.currentAnimation = anim;
    document.querySelectorAll('.btn-anim').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (window.electronAPI) {
      window.electronAPI.send('play-animation', anim);
    }
    saveSettings();
  });
});

// --- Golden Light toggle (independent overlay, not an animation) ---
const lightToggle = document.getElementById('light-toggle');
lightToggle.addEventListener('change', () => {
  AppState.lightEnabled = lightToggle.checked;
  if (window.electronAPI) {
    window.electronAPI.send('toggle-light', lightToggle.checked);
  }
  saveSettings();
});

// --- Size select ---
const sizeSelect = document.getElementById('size-select');
sizeSelect.addEventListener('change', () => {
  const size = parseInt(sizeSelect.value, 10);
  if (window.electronAPI) {
    window.electronAPI.send('set-size', size);
  }
  saveSettings();
});

// --- Locale select ---
document.getElementById('locale-select').addEventListener('change', (e) => {
  const localeCode = e.target.value;
  if (window.electronAPI) {
    window.electronAPI.send('set-locale', localeCode);
  }
});

// --- External links (open in default browser) ---
document.querySelectorAll('[data-external]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.electronAPI) {
      window.electronAPI.invoke('open-external', el.dataset.external);
    }
  });
});

// --- Settings persistence ---
async function loadAndApplySettings() {
  if (!window.electronAPI || !window.electronAPI.invoke) return;

  const [settings, eyeTrackingEnabled, alwaysOnTop] = await Promise.all([
    window.electronAPI.invoke('load-settings'),
    window.electronAPI.invoke('get-eye-tracking-enabled'),
    window.electronAPI.invoke('get-always-on-top'),
  ]);
  if (!settings) return;

  AppState.eyeTrackingEnabled = eyeTrackingEnabled === true;
  eyeTrackingToggle.checked = AppState.eyeTrackingEnabled;
  AppState.alwaysOnTop = alwaysOnTop === true;
  alwaysOnTopToggle.checked = AppState.alwaysOnTop;

  // Restore size
  if (settings.size) {
    const sel = document.getElementById('size-select');
    if (sel && sel.querySelector(`option[value="${settings.size}"]`)) {
      sel.value = settings.size;
    }
  }

  // Restore test mode
  if (settings.testMode) {
    document.getElementById('test-mode-toggle').checked = true;
    document.getElementById('test-mode-toggle').dispatchEvent(new Event('change'));
  }

  // Restore light
  if (settings.lightEnabled) {
    document.getElementById('light-toggle').checked = true;
    document.getElementById('light-toggle').dispatchEvent(new Event('change'));
  }

  // Restore animation
  if (settings.currentAnimation) {
    const btn = document.querySelector(`.btn-anim[data-anim="${settings.currentAnimation}"]`);
    if (btn) btn.click();
  }
}

function saveSettings() {
  if (!window.electronAPI || !window.electronAPI.invoke) return;

  window.electronAPI.invoke('save-settings', {
    size: parseInt(document.getElementById('size-select').value, 10),
    locale: document.getElementById('locale-select').value,
    testMode: AppState.testMode,
    lightEnabled: AppState.lightEnabled,
    currentAnimation: AppState.currentAnimation,
  });
}

// --- Initialize ---
initI18n().then(() => loadAndApplySettings());
