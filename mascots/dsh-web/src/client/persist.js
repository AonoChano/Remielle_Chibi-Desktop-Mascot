/**
 * Tiny localStorage persistence for pet position and visibility.
 * All access is guarded so a blocked/quota-exceeded storage never breaks the
 * page.
 */

const KEY_POS = 'remi-pet.pos';
const KEY_HIDDEN = 'remi-pet.hidden';

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** @returns {{x:number,y:number}|null} saved left/top in CSS px, or null. */
export function loadPos() {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY_POS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.x === 'number' && typeof parsed.y === 'number' &&
      Number.isFinite(parsed.x) && Number.isFinite(parsed.y)
    ) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    /* corrupted value — treat as unset */
  }
  return null;
}

export function savePos(pos) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY_POS, JSON.stringify({ x: pos.x, y: pos.y }));
  } catch {
    /* ignore */
  }
}

export function loadHidden() {
  const s = storage();
  if (!s) return false;
  return s.getItem(KEY_HIDDEN) === '1';
}

export function saveHidden(hidden) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY_HIDDEN, hidden ? '1' : '0');
  } catch {
    /* ignore */
  }
}
