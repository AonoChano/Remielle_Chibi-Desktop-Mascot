const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeEyeTarget,
  smoothEyeOffset,
} = require('../eye-tracking');

function almostEqual(actual, expected, epsilon = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

test('cursor at pet center produces zero eye offset', () => {
  assert.deepEqual(computeEyeTarget({
    cursorX: 300,
    cursorY: 200,
    centerX: 300,
    centerY: 200,
    width: 420,
    height: 420,
  }), { x: 0, y: 0 });
});

test('normalization reaches exact horizontal and vertical limits', () => {
  assert.deepEqual(computeEyeTarget({
    cursorX: 300 + 420 * 1.5,
    cursorY: 200,
    centerX: 300,
    centerY: 200,
    width: 420,
    height: 300,
  }), { x: 24, y: 0 });

  assert.deepEqual(computeEyeTarget({
    cursorX: 300,
    cursorY: 200 - 300 * 1.5,
    centerX: 300,
    centerY: 200,
    width: 420,
    height: 300,
  }), { x: 0, y: 16 });
});

test('screen Y is inverted for Spine coordinates', () => {
  const below = computeEyeTarget({
    cursorX: 300,
    cursorY: 350,
    centerX: 300,
    centerY: 200,
    width: 420,
    height: 300,
  });

  assert.ok(below.y < 0);
});

test('diagonal values are clamped to a unit circle before axis scaling', () => {
  const target = computeEyeTarget({
    cursorX: 300 + 420 * 3,
    cursorY: 200 - 300 * 3,
    centerX: 300,
    centerY: 200,
    width: 420,
    height: 300,
  });

  almostEqual(target.x, 24 / Math.sqrt(2));
  almostEqual(target.y, 16 / Math.sqrt(2));
});

test('non-square windows normalize each axis independently', () => {
  const target = computeEyeTarget({
    cursorX: 100 + 600 * 0.75,
    cursorY: 100 - 200 * 0.75,
    centerX: 100,
    centerY: 100,
    width: 600,
    height: 200,
  });

  assert.deepEqual(target, { x: 12, y: 8 });
});

test('disabled, missing, or invalid samples return to center', () => {
  const valid = {
    cursorX: 500,
    cursorY: 100,
    centerX: 300,
    centerY: 200,
    width: 420,
    height: 420,
  };

  assert.deepEqual(computeEyeTarget({ ...valid, enabled: false }), { x: 0, y: 0 });
  assert.deepEqual(computeEyeTarget({ ...valid, hasSample: false }), { x: 0, y: 0 });
  assert.deepEqual(computeEyeTarget({ ...valid, width: 0 }), { x: 0, y: 0 });
  assert.deepEqual(computeEyeTarget({ ...valid, cursorX: NaN }), { x: 0, y: 0 });
});

test('exponential smoothing is frame-rate independent', () => {
  const target = { x: 24, y: -16 };
  const oneFrame = smoothEyeOffset({ x: 0, y: 0 }, target, 0.08);
  const halfFrame = smoothEyeOffset({ x: 0, y: 0 }, target, 0.04);
  const twoFrames = smoothEyeOffset(halfFrame, target, 0.04);

  almostEqual(oneFrame.x, 12);
  almostEqual(oneFrame.y, -8);
  almostEqual(twoFrames.x, oneFrame.x);
  almostEqual(twoFrames.y, oneFrame.y);
});

test('smoothing clamps long renderer gaps to 0.25 seconds', () => {
  const current = { x: 0, y: 0 };
  const target = { x: 24, y: 16 };

  assert.deepEqual(
    smoothEyeOffset(current, target, 100),
    smoothEyeOffset(current, target, 0.25)
  );
});

test('smoothing sanitizes invalid offsets and invalid delta', () => {
  assert.deepEqual(
    smoothEyeOffset({ x: NaN, y: Infinity }, { x: 10, y: -10 }, 0),
    { x: 0, y: 0 }
  );
  assert.deepEqual(
    smoothEyeOffset({ x: 5, y: -5 }, { x: NaN, y: Infinity }, 0.08),
    { x: 2.5, y: -2.5 }
  );
  assert.deepEqual(
    smoothEyeOffset({ x: 5, y: -5 }, { x: 10, y: 10 }, NaN),
    { x: 5, y: -5 }
  );
});
