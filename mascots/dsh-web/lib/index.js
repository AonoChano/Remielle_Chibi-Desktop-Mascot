/**
 * remi-pet-dsh — node half.
 *
 * A plain Cordis plugin that owns nothing except the HTTP route serving the
 * Spine assets (skeleton JSON / atlas / texture) to the browser half. The
 * browser half ships as a built bundle through `exports["./client"]` and is
 * discovered by @deepseek-ai/dsh-client-modules via the `dsh.client`
 * declaration in package.json.
 *
 * The route prefix is `/remi-pet` (webserver match order is exact > longest
 * prefix > fallback; `/plugins` is already owned by client-modules, so this
 * prefix never collides). A request like `/remi-pet/assets/remi.json` is
 * stripped of the prefix and resolved against the PACKAGE ROOT, then checked
 * to land inside `assets/` — resolving it against the assets dir itself would
 * double the `assets` segment (assets/assets/remi.json → 404).
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_DIR = resolve(PKG_ROOT, 'assets');

const MIME = Object.freeze({
  '.json': 'application/json; charset=utf-8',
  '.atlas': 'text/plain; charset=utf-8',
  '.png': 'image/png',
});

/**
 * Map a request pathname to a file inside ASSET_DIR.
 * @param {string} pathname - decoded request pathname (e.g. `/remi-pet/assets/remi.json`).
 * @returns {string|null} absolute file path, or null when outside the assets dir.
 */
export function resolveAssetPath(pathname) {
  const rel = decodeURIComponent(pathname).replace(/^\/remi-pet\/?/, '');
  if (!rel || rel.includes('..') || rel.includes('\\')) return null;
  const file = resolve(PKG_ROOT, rel);
  if (file !== ASSET_DIR && !file.startsWith(ASSET_DIR + sep)) return null;
  return file;
}

export default {
  inject: ['webServer'],
  apply(ctx) {
    const webServer = ctx.get('webServer');
    if (webServer === undefined) return;
    ctx.effect(() => webServer.register({
      kind: 'prefix',
      path: '/remi-pet',
      handler: async (req, res) => {
        let file = null;
        try {
          file = resolveAssetPath(new URL(req.url ?? '/', 'http://x').pathname);
        } catch {
          res.writeHead(400);
          res.end();
          return;
        }
        if (file === null) {
          res.writeHead(403);
          res.end();
          return;
        }
        try {
          const body = await readFile(file);
          const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
          res.writeHead(200, {
            'content-type': MIME[ext] ?? 'application/octet-stream',
            'cache-control': 'no-cache',
          });
          res.end(body);
        } catch (error) {
          if (error && error.code === 'ENOENT') {
            res.writeHead(404);
            res.end();
            return;
          }
          res.writeHead(500);
          res.end();
        }
      },
    }), 'remi-pet: asset route');
  },
};
