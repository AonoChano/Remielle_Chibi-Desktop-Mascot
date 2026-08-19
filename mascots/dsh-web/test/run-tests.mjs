/**
 * Minimal in-process test runner.
 *
 * `node --test` spawns one child process per file, which the DSH sandbox
 * denies (EPERM on piped stdio). Importing the suites directly runs them in
 * this process; node:test prints TAP and reports failures on the exit code.
 */
import './behavior.test.js';
import './activity.test.js';
import './settings.test.js';
import './slotProbe.test.js';
import './bundle.test.js';
import './route.test.js';
