/**
 * Host-activity store: derives the pet's activity from the DSH sessions feed
 * and notifies the pet view. This is the "deep workspace integration" — the
 * pet animates with the agent instead of standing idle.
 */
import { ACTIVITY } from './behavior.js';

let activity = ACTIVITY.IDLE;
const listeners = new Set();

export function getActivity() {
  return activity;
}

export function setActivity(next) {
  if (next === activity) return;
  activity = next;
  for (const fn of [...listeners]) fn(activity);
}

export function subscribeActivity(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Derive the pet activity from the sessions list snapshot and the current
 * session's ConversationSnapshot.
 *
 * Priority: pending interaction (waiting) > streaming FORMAL text (writing) >
 * running work / reasoning-only streaming (thinking) > idle.
 *
 * @param {object|null} list - SessionListState (`ctx.sessions.list.getSnapshot()`).
 * @param {object|null} conv - ConversationSnapshot (`sessions.binding(current).session.getSnapshot()`).
 * @returns {string} one of ACTIVITY.*
 */
export function computeActivity(list, conv) {
  if (!list || typeof list !== 'object') return ACTIVITY.IDLE;
  const current = list.current;
  if (current === undefined || current === null) return ACTIVITY.IDLE;
  const row = list.byId == null ? undefined : list.byId[current];

  // 1. Pending interactions (approval / question / plan review) — waiting.
  const pending = (conv != null && Array.isArray(conv.pending) && conv.pending.length > 0)
    || (row != null && row.pendingInteraction !== undefined);
  if (pending) return ACTIVITY.WAITING;

  // 2. Streaming assistant output.
  if (conv != null && conv.partial != null) {
    const blocks = Array.isArray(conv.partial.blocks) ? conv.partial.blocks : [];
    // Formal text is "writing"; reasoning/tool-call streaming is still thinking.
    if (blocks.some((block) => block != null && block.kind === 'text')) return ACTIVITY.WRITING;
    return ACTIVITY.THINKING;
  }

  // 3. Running work — thinking.
  if (conv != null && typeof conv === 'object') {
    if (Array.isArray(conv.runningCalls) && conv.runningCalls.length > 0) return ACTIVITY.THINKING;
    if (conv.running === true) return ACTIVITY.THINKING;
  }
  if (row != null && row.running === true) return ACTIVITY.THINKING;
  const jobs = list.jobsBySession == null ? undefined : list.jobsBySession[current];
  if (Array.isArray(jobs) && jobs.length > 0) return ACTIVITY.THINKING;

  return ACTIVITY.IDLE;
}
