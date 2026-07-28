// Global app state — reserved for future features
const AppState = {
  testMode: false,
  currentAnimation: 'a',
  lockedOutfit: 'A',
  // Reserved for future use
  animationQueue: [],
  triggerHandlers: {},
};

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

    // Unlock all
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
