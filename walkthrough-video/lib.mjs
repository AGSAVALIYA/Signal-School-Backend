// Shared helpers: static server + page boot.
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');


const require = createRequire(import.meta.url);
const ROOT = new URL('.', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

export function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).isDirectory()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }).end(readFileSync(p));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}` }));
  });
}

let DATA;
export function loadData() {
  if (!DATA) {
    DATA = {
      backend: JSON.parse(readFileSync(join(ROOT, 'data/backend.json'), 'utf8')),
      frontend: JSON.parse(readFileSync(join(ROOT, 'data/frontend.json'), 'utf8')),
    };
  }
  return DATA;
}

export async function boot(url, { actions, startRepo = 'backend', t0 = 0, clock, mouse }) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });
  page.on('console', (m) => (m.type() === 'warning' || m.type() === 'error') && console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`${url}/engine/index.html`);
  const icons = require('@iconify-json/material-icon-theme/icons.json');
  const { siApple } = require('simple-icons');
  const info = await page.evaluate((args) => window.__load(args), { icons, apple: siApple.path, data: loadData(), actions, startRepo, t0, clock, mouse });
  return { browser, page, info };
}
