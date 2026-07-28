// Global app state — reserved for future features
const AppState = {
  testMode: false,
  currentAnimation: 'a',
  lockedOutfit: 'A',
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

// --- Test mode toggle ---
const testToggle = document.getElementById('test-mode-toggle');
const testControls = document.getElementById('test-controls');

testToggle.addEventListener('change', () => {
  const enabled = testToggle.checked;
  AppState.testMode = enabled;
  testControls.style.display = enabled ? 'block' : 'none';
  document.body.classList.toggle('test-mode-active', enabled);
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
  });
});

// --- Outfit toggle buttons (lock/unlock) ---
document.querySelectorAll('.btn-outfit').forEach(btn => {
  btn.addEventListener('click', () => {
    const outfit = btn.dataset.outfit;
    const wasLocked = btn.classList.contains('locked');

    document.querySelectorAll('.btn-outfit').forEach(b => b.classList.remove('locked'));

    if (!wasLocked) {
      btn.classList.add('locked');
      AppState.lockedOutfit = outfit;
      if (window.electronAPI) {
        window.electronAPI.send('set-outfit', outfit);
      }
    } else {
      AppState.lockedOutfit = null;
      if (window.electronAPI) {
        window.electronAPI.send('set-outfit', 'A');
      }
    }
  });
});

// --- Size select ---
const sizeSelect = document.getElementById('size-select');
sizeSelect.addEventListener('change', () => {
  const size = parseInt(sizeSelect.value, 10);
  if (window.electronAPI) {
    window.electronAPI.send('set-size', size);
  }
});

// --- Locale select ---
document.getElementById('locale-select').addEventListener('change', (e) => {
  const localeCode = e.target.value;
  if (window.electronAPI) {
    window.electronAPI.send('set-locale', localeCode);
  }
});

// --- Initialize ---
initI18n();
