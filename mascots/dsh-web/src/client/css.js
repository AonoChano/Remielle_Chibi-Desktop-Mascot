/**
 * Package styles. The bundle cannot load a stylesheet file, so the CSS is a
 * plain string injected once into <head> with a refcount (the overlay view and
 * the toggle both mount it; the tag is removed when the last one unmounts).
 */

const CSS = [
  // The host size is set inline (configurable) — the class only fixes behavior.
  '.remi-pet-host{position:fixed;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none}',
  '.remi-pet-host.remi-pet-dragging{cursor:grabbing}',
  '.remi-pet-host canvas{display:block;width:100%;height:100%}',
  '.remi-pet-host .remi-pet-error{position:absolute;inset:0;display:grid;place-items:center;color:#8b8b8b;font-size:12px;line-height:1.5;text-align:center;padding:8px}',
  '.remi-pet-toggle{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 10px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#666);font:inherit;font-size:13px;line-height:1;cursor:pointer;white-space:nowrap}',
  '.remi-pet-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));color:var(--dsw-alias-label-primary,#333)}',
  // Plugin-configuration card (Settings -> Plugins -> 插件配置) — collapsible
  // card matching the shipped cards: header button + in-place body.
  '.remi-pet-config-card{list-style:none;border:1px solid var(--dsw-alias-border-l1,#e8e8e8);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#fff);transition:border-color .16s,background .16s}',
  '.remi-pet-config-card:hover{border-color:var(--dsw-alias-label-dimmed,#bbb)}',
  '.remi-pet-config-card.remi-pet-config-open{background:var(--dsw-alias-bg-layer-2,#fafafa);border-color:var(--dsw-alias-label-dimmed,#bbb)}',
  '.remi-pet-config-head{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:transparent;border:none;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}',
  '.remi-pet-config-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4f8cff);outline-offset:-2px}',
  '.remi-pet-config-head-text{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}',
  '.remi-pet-config-name{color:var(--dsw-alias-label-primary,#333);font-size:15px;font-weight:600;line-height:1.4}',
  '.remi-pet-config-desc{color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:1.4}',
  '.remi-pet-config-chevron{color:var(--dsw-alias-label-secondary,#888);transition:transform .16s}',
  '.remi-pet-config-chevron.remi-pet-config-closed{transform:rotate(-90deg)}',
  '.remi-pet-config-body{padding:2px 16px 12px}',
  '.remi-pet-config-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--dsw-alias-border-l2,#ececec)}',
  '.remi-pet-config-row:last-child{border-bottom:none}',
  '.remi-pet-config-label{display:inline-flex;align-items:center;color:var(--dsw-alias-label-primary,#333)}',
  '.remi-pet-config-info{color:var(--dsw-alias-label-tertiary,#999);cursor:help;font-size:11px;margin-left:5px}',
  '.remi-pet-config-value{color:var(--dsw-alias-label-secondary,#888);font-variant-numeric:tabular-nums;min-width:44px;text-align:right}',
  '.remi-pet-config-control{display:flex;align-items:center;gap:8px}',
  '.remi-pet-config input[type=range]{accent-color:var(--dsw-alias-brand-primary,#4f8cff);width:120px}',
  '.remi-pet-config-btn{background:transparent;border:1px solid var(--dsw-alias-border-l2,#d9d9d9);border-radius:8px;padding:5px 12px;color:var(--dsw-alias-label-primary,#333);font:inherit;font-size:12px;cursor:pointer}',
  '.remi-pet-config-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}',
  '.remi-pet-config-check{accent-color:var(--dsw-alias-brand-primary,#4f8cff)}',
].join('\n');

let count = 0;
let tag = null;

export function mountCss() {
  count += 1;
  if (tag === null && typeof document !== 'undefined') {
    tag = document.createElement('style');
    tag.setAttribute('data-plugin', '@aonochano/remi-pet-dsh');
    tag.setAttribute('data-plugin-css', '@aonochano/remi-pet-dsh/main');
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
