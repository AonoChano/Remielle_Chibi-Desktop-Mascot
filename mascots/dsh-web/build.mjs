/**
 * Build the browser-half bundle for the DSH client module loader.
 *
 * Pipeline:
 *   1. rollup bundles src/client/factory.js -> CJS
 *      (only `react` and `@deepseek-ai/dsh-client-ui-primitives` stay
 *       external — the shell seeds both; every other bare specifier would be
 *       rejected by the shell's bundle purity gate at runtime).
 *   2. Wrap the factory body in the classic-script registration:
 *      window.__ModuleLoader__.load({ id, factory }) — the exact shape the
 *      @deepseek-ai/dsh-client-modules loader materializes.
 *   3. Prepend the Spine runtime license notice (redistribution requirement)
 *      and write dist/client.js.
 */
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('./package.json', root), 'utf8'));

await mkdir(new URL('./dist/', root), { recursive: true });

const bundle = await rollup({
  input: fileURLToPath(new URL('./src/client/factory.js', root)),
  plugins: [nodeResolve()],
  external: ['react', '@deepseek-ai/dsh-client-ui-primitives'],
});
const { output } = await bundle.generate({
  format: 'cjs',
  exports: 'default',
  compact: true,
  generatedCode: 'es2015',
});
await bundle.close();
const body = output[0].code.trim();

let licenseLines = [];
try {
  licenseLines = (await readFile(new URL('./node_modules/@esotericsoftware/spine-webgl/LICENSE', root), 'utf8'))
    .split('\n')
    .map((line) => ` * ${line}`)
    .filter((line) => line.trim() !== '*');
} catch {
  // license file missing — the bundle still builds
}

const client = [
  '/**',
  ' * remi-pet-dsh client bundle — built by build.mjs, do not edit.',
  ...(licenseLines.length > 0 ? [' *', ...licenseLines] : []),
  ' */',
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(pkg.name)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  body,
  '\t\treturn module.exports;',
  '\t}',
  '});',
  '',
].join('\n');

await writeFile(new URL('./dist/client.js', root), client);
console.log(`[remi-pet-dsh] built dist/client.js (${client.length} bytes)`);
