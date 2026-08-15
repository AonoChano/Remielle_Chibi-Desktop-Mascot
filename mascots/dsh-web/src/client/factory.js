// Build entry: an ESM file whose only job is to hand the plugin object to the
// default export. rollup bundles every local module into the CJS output and
// keeps only `react` as an external require (the DSH shell seeds it).
import { plugin } from './plugin.js';

export default plugin;
