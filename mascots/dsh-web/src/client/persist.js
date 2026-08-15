/**
 * Tiny localStorage persistence for pet position, visibility, and settings.
 * All access is guarded so a blocked/quota-exceeded storage never breaks the
 * page.
 */

const KEY_POS = 'remi-pet.pos';
const KEY_HIDDEN = 'remi-pet.hidden';
const KEY_SIZE = 'remi-pet.size';
const KEY_LIGHT_CHANCE = 'remi-pet.lightChance';
const KEY_ACTIVITY_ENABLED = 'remi-pet.activityEnabled';

export const DEFAULT_SIZE = 220;
export const DEFAULT_LIGHT_CHANCE = 0.5;
export const DEFAULT_ACTIVITY_ENABLED = true;
export const SIZE_MIN = 120;
export const SIZE_MAX = 320;

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

/** Remove the saved position (pet returns to its default corner). */
export function clearPos() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(KEY_POS);
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

/** Pet host CSS size in px (clamped to [SIZE_MIN, SIZE_MAX]). */
export function loadSize() {
  const s = storage();
  if (!s) return DEFAULT_SIZE;
  try {
    const raw = Number(s.getItem(KEY_SIZE));
    if (Number.isFinite(raw) && raw >= SIZE_MIN && raw <= SIZE_MAX) return raw;
  } catch {
    /* corrupted value — fall back to default */
  }
  return DEFAULT_SIZE;
}

export function saveSize(size) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY_SIZE, String(Math.min(SIZE_MAX, Math.max(SIZE_MIN, size))));
  } catch {
    /* ignore */
  }
}

/** Golden-light overlay probability in [0, 1]. */
export function loadLightChance() {
  const s = storage();
  if (!s) return DEFAULT_LIGHT_CHANCE;
  try {
    const raw = Number(s.getItem(KEY_LIGHT_CHANCE));
    if (Number.isFinite(raw) && raw >= 0 && raw <= 1) return raw;
  } catch {
    /* corrupted value — fall back to default */
  }
  return DEFAULT_LIGHT_CHANCE;
}

export function saveLightChance(chance) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY_LIGHT_CHANCE, String(Math.min(1, Math.max(0, chance))));
  } catch {
    /* ignore */
  }
}

/** Whether the pet animates with the agent state (thinking/writing/waiting). */
export function loadActivityEnabled() {
  const s = storage();
  if (!s) return DEFAULT_ACTIVITY_ENABLED;
  const raw = s.getItem(KEY_ACTIVITY_ENABLED);
  if (raw === null) return DEFAULT_ACTIVITY_ENABLED;
  return raw === '1';
}

export function saveActivityEnabled(enabled) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY_ACTIVITY_ENABLED, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}
