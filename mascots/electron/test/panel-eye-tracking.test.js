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
  const preload = read('preload.js');

  assert.match(panel, /invoke\('get-eye-tracking-enabled'\)/);
  assert.match(panel, /invoke\('set-eye-tracking-enabled', enabled\)/);
  assert.match(preload, /'get-eye-tracking-enabled'/);
  assert.match(preload, /'set-eye-tracking-enabled'/);
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
  const preload = read('preload.js');

  assert.match(panel, /invoke\('get-always-on-top'\)/);
  assert.match(panel, /invoke\('set-always-on-top', enabled\)/);
  assert.match(panel, /on\('always-on-top-changed'/);
  assert.match(preload, /'get-always-on-top'/);
  assert.match(preload, /'set-always-on-top'/);
  assert.match(preload, /'always-on-top-changed'/);
});

test('test mode still controls visibility, IPC, persistence, and restoration', () => {
  const panel = read('panel.js');

  assert.match(panel, /testControls\.style\.display = enabled \? 'block' : 'none'/);
  assert.match(panel, /send\('set-test-mode', enabled\)/);
  assert.match(panel, /testMode: AppState\.testMode/);
  assert.match(panel, /settings\.testMode[\s\S]*dispatchEvent\(new Event\('change'\)\)/);
});
