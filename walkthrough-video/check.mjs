// Runs the whole timeline without capturing, to report actions that start late (drift) or errors.
import { readFileSync } from 'node:fs';
import { serve, boot } from './lib.mjs';
const tl = JSON.parse(readFileSync('build/timeline.json', 'utf8'));
const { srv, url } = await serve();
const t = Date.now();
const { browser, page } = await boot(url, { actions: tl.actions, t0: Math.floor(tl.duration / (1000/30)) * (1000/30), clock: Date.now(), mouse: { x: 1180, y: 610 } });
console.log('end state', await page.evaluate(() => JSON.stringify(window.__peek())), (Date.now() - t) / 1000, 's');
await browser.close(); srv.close();
