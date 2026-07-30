const test = require('node:test');
const assert = require('node:assert/strict');

const { centerWindowInWorkArea } = require('../window-positioning');

test('centers a mascot inside an offset display work area', () => {
  assert.deepEqual(
    centerWindowInWorkArea(
      { width: 420, height: 420 },
      { x: 1920, y: 40, width: 1920, height: 1040 }
    ),
    { x: 2670, y: 350 }
  );
});

test('keeps an oversized mascot anchored to the work area origin', () => {
  assert.deepEqual(
    centerWindowInWorkArea(
      { width: 900, height: 700 },
      { x: -800, y: 0, width: 800, height: 600 }
    ),
    { x: -800, y: 0 }
  );
});
