'use strict';

function centerWindowInWorkArea(windowBounds, workArea) {
  const values = [
    windowBounds && windowBounds.width,
    windowBounds && windowBounds.height,
    workArea && workArea.x,
    workArea && workArea.y,
    workArea && workArea.width,
    workArea && workArea.height,
  ];
  if (!values.every(Number.isFinite) ||
      windowBounds.width <= 0 ||
      windowBounds.height <= 0 ||
      workArea.width <= 0 ||
      workArea.height <= 0) {
    throw new TypeError('valid window bounds and work area are required');
  }

  const availableWidth = Math.max(0, workArea.width - windowBounds.width);
  const availableHeight = Math.max(0, workArea.height - windowBounds.height);
  return {
    x: workArea.x + Math.round(availableWidth / 2),
    y: workArea.y + Math.round(availableHeight / 2),
  };
}

module.exports = { centerWindowInWorkArea };
