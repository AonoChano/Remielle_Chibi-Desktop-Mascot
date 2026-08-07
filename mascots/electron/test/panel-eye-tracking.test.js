const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const electronRoot = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(electronRoot, file), 'utf8');
}

test('Mascot page includes an accessible eye tracking switch before test mode', () => {
  const html = read('panel.html');
  const eyeIndex = html.indexOf('id="eye-tracking-toggle"');
  const testIndex = html.indexOf('id="test-mode-toggle"');

  assert.ok(eyeIndex > 0);
  assert.ok(testIndex > eyeIndex);
  assert.match(html, /role="switch"/);
  assert.match(html, /aria-labelledby="eye-tracking-label"/);
});

test('test mode reuses the same flat row and capsule switch structure', () => {
  const html = read('panel.html');

  assert.match(
    html,
    /<div class="feature-row test-mode-row">[\s\S]*id="test-mode-label"[\s\S]*class="toggle-switch"[\s\S]*id="test-mode-toggle"[\s\S]*role="switch"[\s\S]*aria-labelledby="test-mode-label"/
  );
  assert.doesNotMatch(
    html,
    /<div class="setting-row">[\s\S]{0,180}id="test-mode-toggle"/
  );
});

test('eye tracking setting row is transparent and switch has focus styling', () => {
  const css = read('panel.css');

  assert.match(css, /\.feature-row\s*\{[^}]*background:\s*transparent/s);
  assert.match(css, /\.feature-row\s*\{[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.toggle-switch input:focus-visible \+ \.toggle-track/s);
  assert.match(css, /\.toggle-switch input:checked \+ \.toggle-track/s);
});

test('Chinese and English labels use the confirmed names', () => {
  const zh = JSON.parse(read('locales/zh-CN.json'));
  const en = JSON.parse(read('locales/en-US.json'));

  assert.equal(zh.nav.main, '桌宠');
  assert.equal(en.nav.main, 'Mascot');
  assert.equal(zh.features.eyeTracking, '眼神鼠标追踪');
  assert.equal(en.features.eyeTracking, 'Eye Tracking');
  assert.equal(zh.anim.finished, '画完欣赏');
  assert.equal(en.anim.finished, 'Admire Drawing');
});

test('panel uses acknowledged eye tracking setting IPC', () => {
  const panel = read('panel.js');
  const channels = read('ipc-channels.js');

  assert.match(panel, /invoke\('get-eye-tracking-enabled'\)/);
  assert.match(panel, /invoke\('set-eye-tracking-enabled', enabled\)/);
  assert.match(channels, /'get-eye-tracking-enabled'/);
  assert.match(channels, /'set-eye-tracking-enabled'/);
});

test('settings page uses flat accessible rows and a real always-on-top switch', () => {
  const html = read('panel.html');

  assert.match(html, /class="settings-list"/);
  assert.equal((html.match(/class="settings-control-row/g) || []).length, 4);
  assert.match(html, /<label[^>]*for="size-select"[^>]*data-i18n="settings\.size"/);
  assert.match(html, /<label[^>]*for="locale-select"[^>]*data-i18n="settings\.language"/);
  assert.match(html, /id="always-on-top-toggle"[^>]*role="switch"/);
  assert.match(html, /class="setting-status"[^>]*data-i18n="settings\.autoStartHint"/);
});

test('settings list has measurable compact layout and no card styling', () => {
  const css = read('panel.css');

  assert.match(css, /\.settings-control-row\s*\{[^}]*min-height:\s*64px/s);
  assert.match(css, /\.settings-control-row\s*\{[^}]*border-bottom:\s*1px solid rgba\(123, 107, 94, 0\.12\)/s);
  assert.match(css, /\.setting-control select\s*\{[^}]*width:\s*clamp\(140px, 30vw, 220px\)/s);
});

test('panel uses acknowledged always-on-top IPC with rollback handling', () => {
  const panel = read('panel.js');
  const channels = read('ipc-channels.js');

  assert.match(panel, /invoke\('get-always-on-top'\)/);
  assert.match(panel, /invoke\('set-always-on-top', enabled\)/);
  assert.match(panel, /on\('always-on-top-changed'/);
  assert.match(channels, /'get-always-on-top'/);
  assert.match(channels, /'set-always-on-top'/);
  assert.match(channels, /'always-on-top-changed'/);
});

test('test mode uses acknowledged IPC, controls visibility, and restores effective state', () => {
  const panel = read('panel.js');
  const channels = read('ipc-channels.js');

  assert.match(panel, /testControls\.style\.display = enabled \? 'block' : 'none'/);
  assert.match(panel, /invoke\('get-test-mode'\)/);
  assert.match(panel, /invoke\('set-test-mode', requested\)/);
  assert.match(panel, /renderTestMode\(testMode === true\)/);
  assert.doesNotMatch(panel, /testMode:\s*AppState\.testMode/);
  assert.match(channels, /'get-test-mode'/);
  assert.match(channels, /'set-test-mode'/);
});

test('test mode suspension is declared by feature and applied generically', () => {
  const html = read('panel.html');
  const panel = read('panel.js');
  const css = read('panel.css');

  assert.match(
    html,
    /class="feature-row eye-tracking-row"[^>]*data-test-mode-policy="suspend"[^>]*data-test-mode-feature="eye-tracking"/
  );
  assert.doesNotMatch(
    html,
    /class="feature-row test-mode-row"[^>]*data-test-mode-policy/
  );
  assert.match(panel, /querySelectorAll\('\[data-test-mode-policy="suspend"\]'\)/);
  assert.match(panel, /region\.inert = enabled/);
  assert.match(panel, /region\.setAttribute\('aria-disabled', String\(enabled\)\)/);
  assert.match(panel, /region\.classList\.toggle\('is-test-suspended', enabled\)/);
  assert.match(css, /\[data-test-mode-policy="suspend"\]\.is-test-suspended/);
});

test('pet runtime gates behavior and eye tracking with the shared test mode policy', () => {
  const html = read('pet.html');
  const pet = read('pet.js');

  assert.ok(html.indexOf('test-mode-feature-gate.js') < html.indexOf('pet.js'));
  assert.match(pet, /register\('automatic-behavior'/);
  assert.match(pet, /register\('eye-tracking'/);
  assert.match(
    pet,
    /enabled:\s*this\.eyeTrackingEnabled\s*&&\s*!this\.eyeTrackingSuspended/
  );
});

test('main process owns test mode persistence and pauses cursor sampling first', () => {
  const main = read('main.js');

  assert.match(main, /initialSuspended:\s*testModeEnabled/);
  assert.match(main, /ipcMain\.handle\('get-test-mode'/);
  assert.match(main, /ipcMain\.handle\('set-test-mode'/);
  assert.match(
    main,
    /eyeTrackingService\.setSuspended\(enabled\)[\s\S]*saveSettings\(\{ testMode: enabled \}, \{ throwOnError: true \}\)/
  );
  assert.match(
    main,
    /catch \(error\) \{[\s\S]*eyeTrackingService\.setSuspended\(previous\)[\s\S]*throw error/
  );
});

test('mascot page exposes an acknowledged reset-position command', () => {
  const html = read('panel.html');
  const panel = read('panel.js');
  const channels = read('ipc-channels.js');
  const main = read('main.js');
  const zh = JSON.parse(read('locales/zh-CN.json'));
  const en = JSON.parse(read('locales/en-US.json'));

  assert.match(html, /id="reset-pet-position"[^>]*data-i18n="features\.resetPosition"/);
  assert.match(panel, /invoke\('reset-pet-position'\)/);
  assert.match(channels, /'reset-pet-position'/);
  assert.match(main, /ipcMain\.handle\('reset-pet-position'/);
  assert.equal(zh.features.resetPosition, '重置至屏幕中央');
  assert.equal(en.features.resetPosition, 'Center Mascot');
});

test('pet size persistence reads BrowserWindow bounds as an object', () => {
  const main = read('main.js');

  assert.match(main, /const \{ width \} = petWindow\.getBounds\(\)/);
  assert.doesNotMatch(main, /const \[w\] = petWindow\.getBounds\(\)/);
});
