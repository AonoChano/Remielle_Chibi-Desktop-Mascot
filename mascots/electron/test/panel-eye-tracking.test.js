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
