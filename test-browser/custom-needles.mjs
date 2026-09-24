// test-browser/custom-needles.mjs — Browser-driven tests for the one-time
// startup migration of stored custom needle lengths (migrateCustomNeedles()
// in js/needledb.js, wired up in js/app.js).
// Copyright (C) 2014 GUE — GPL v2.0
//
// Needs a real Chromium and the `playwright` package, so — like pwa.mjs and
// catalog.mjs — it lives outside test/ and is run explicitly:
//
//   npm install                       # pulls in the `playwright` devDependency
//   npx playwright install chromium   # first time only, downloads the browser
//   node --test test-browser/*.mjs
//
// Set CHROMIUM_PATH to launch a preinstalled Chromium instead of the one
// Playwright downloads (e.g. when the two versions don't match).
//
// Service workers are blocked: a cached app shell would only add
// nondeterminism here — offline behavior is pwa.mjs's job.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(REPO_ROOT, urlPath === '/' ? '/index.html' : urlPath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

let server, baseUrl, browser;

before(async () => {
  server = await startServer();
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});

after(async () => {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
});

async function withPage(fn) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    await fn(page);
  } finally {
    await context.close();
  }
}

async function openApp(page, hash = '') {
  await page.goto(`${baseUrl}/index.html${hash}`);
  await page.waitForSelector('#setup-tbody tr', { state: 'attached' });
}

// Two custom PHBH needles as saved by older versions: one with the outdated
// 68 mm, one from before the length field existed.
const STALE_NEEDLES = [
  { type: 'XT1', carbType: 'PHBH', A: 2.5, B: 1.8, C: 24, length: 68, clips: 4 },
  { type: 'XT2', carbType: 'PHBH', A: 2.5, B: 1.6, C: 24, clips: 4 },
];

const EXPECTED_NOTICE = {
  en: 'Corrected the total length of 2 custom needle(s): XT1 (PHBH): 68.0 → 55.0 mm, XT2 (PHBH): – → 55.0 mm. Idle positions for these needles have changed.',
  de: 'Gesamtlänge von 2 eigenen Nadel(n) korrigiert: XT1 (PHBH): 68.0 → 55.0 mm, XT2 (PHBH): – → 55.0 mm. Die Leerlaufpositionen dieser Nadeln haben sich geändert.',
};

// Seeds localStorage on a first load, then reloads so the migration runs
// against the stale data during startup.
async function openWithStaleNeedles(page, lang) {
  await openApp(page);
  await page.evaluate(({ needles, lang }) => {
    localStorage.setItem('dellorto_custom_needles', JSON.stringify(needles));
    localStorage.setItem('dellorto_lang', lang);
  }, { needles: STALE_NEEDLES, lang });
  await page.reload();
  await page.waitForSelector('#setup-tbody tr', { state: 'attached' });
}

const storedLengths = page => page.evaluate(() =>
  JSON.parse(localStorage.getItem('dellorto_custom_needles')).map(n => [n.type, n.length]));

for (const lang of ['en', 'de']) {
  test(`${lang}: stale PHBH custom needles are migrated once, with a translated notice`, async () => {
    await withPage(async page => {
      await openWithStaleNeedles(page, lang);

      assert.equal(await page.isVisible('#app-notice'), true, 'notice visible');
      const notice = (await page.textContent('#app-notice')).trim();
      assert.doesNotMatch(notice, /msg\.|\{\w+\}/, 'no raw key or placeholder');
      assert.equal(notice, EXPECTED_NOTICE[lang]);
      assert.deepEqual(await storedLengths(page), [['XT1', 55], ['XT2', 55]]);

      // Catalog (PHBH): both needles show the corrected length.
      await page.click('#tab-catalog');
      await page.click('[data-catalog-carb="PHBH"]');
      const lengthCol = await page.$$eval('#catalog-table thead th', ths =>
        ths.findIndex(th => th.querySelector('[data-catalog-sort="length"]')) + 1);
      assert.ok(lengthCol > 0, 'length column found');
      for (const type of ['XT1', 'XT2']) {
        const cell = await page.textContent(`#catalog-table tbody tr[data-type="${type}"] > :nth-child(${lengthCol})`);
        assert.equal(cell.trim(), '55.0', `${type} length in catalog`);
      }

      // A second start finds nothing to migrate.
      await page.reload();
      await page.waitForSelector('#setup-tbody tr', { state: 'attached' });
      assert.equal(await page.isVisible('#app-notice'), false, 'no notice after reload');
      assert.deepEqual(await storedLengths(page), [['XT1', 55], ['XT2', 55]]);
    });
  });
}
