/**
 * Robust slot registration for third-party plugins.
 *
 * DSH slot protocols have changed between releases — `settings.plugin.item`
 * flipped from a list slot (registered by `id`) to a keyed slot (registered
 * by `key`) in 0.1.0-rc.7. This helper tries each option shape in order and
 * uses the first that registers; a future protocol change degrades to "that
 * seat is skipped" instead of throwing through the plugin fiber (which would
 * block the whole page boot).
 *
 * @param {(options: object) => unknown} register - `slots.register` bound to
 *   one slot name; called once per attempt.
 * @param {object[]} attempts - option shapes in preference order.
 * @returns {unknown} the first successful registration's return value.
 * @throws {Error} the last attempt's error when every attempt fails.
 */
export function registerWithFallback(register, attempts) {
  let lastError = null;
  for (const options of attempts) {
    try {
      return register(options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('all slot registration attempts failed');
}
