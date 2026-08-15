/**
 * Package styles. The bundle cannot load a stylesheet file, so the CSS is a
 * plain string injected once into <head> with a refcount (the overlay view and
 * the toggle both mount it; the tag is removed when the last one unmounts).
 */

const CSS = [
  '.remi-pet-host{position:fixed;width:220px;height:220px;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none}',
  '.remi-pet-host.remi-pet-dragging{cursor:grabbing}',
  '.remi-pet-host canvas{display:block;width:100%;height:100%}',
  '.remi-pet-host .remi-pet-error{position:absolute;inset:0;display:grid;place-items:center;color:#8b8b8b;font-size:12px;line-height:1.5;text-align:center;padding:8px}',
  '.remi-pet-toggle{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 10px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#666);font:inherit;font-size:13px;line-height:1;cursor:pointer;white-space:nowrap}',
  '.remi-pet-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));color:var(--dsw-alias-label-primary,#333)}',
].join('\n');

let count = 0;
let tag = null;

export function mountCss() {
  count += 1;
  if (tag === null && typeof document !== 'undefined') {
    tag = document.createElement('style');
    tag.setAttribute('data-plugin', 'remi-pet-dsh');
    tag.setAttribute('data-plugin-css', 'remi-pet-dsh/main');
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }
  return () => {
    count -= 1;
    if (count === 0 && tag !== null) {
      tag.remove();
      tag = null;
    }
  };
}
