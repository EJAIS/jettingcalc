// test-browser/catalog.mjs — Browser-driven regression tests for the
// needle catalog view (tabs + history, i18n of the rendered UI, isolation
// from the calculator state, filters, search focus, sticky first column).
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0
//
// Needs a real Chromium and the `playwright` package, so — like pwa.mjs —
// it lives outside test/ and is run explicitly:
//
//   npm install                       # pulls in the `playwright` devDependency
//   npx playwright install chromium   # first time only, downloads the browser
//   node --test test-browser/*.mjs
//
// Set CHROMIUM_PATH to launch a preinstalled Chromium instead of the one
// Playwright downloads (e.g. when the two versions don't match).
//
// Each test spins up its own isolated browser context on a shared throwaway
// static file server (serving the repo root). Service workers are blocked
// here: these tests are about the catalog UI, and a cached app shell would
// only add nondeterminism — offline behavior is pwa.mjs's job.

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

// Fresh context + page per test; `fn` receives the page.
async function withPage(fn, contextOptions = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', ...contextOptions });
  try {
    const page = await context.newPage();
    await fn(page);
  } finally {
    await context.close();
  }
}

async function openApp(page, hash = '') {
  await page.goto(`${baseUrl}/index.html${hash}`);
  // 'attached', not visible: with '#needles' the calculator is hidden.
  await page.waitForSelector('#setup-tbody tr', { state: 'attached' });
}

async function loadDemo(page) {
  page.once('dialog', d => d.accept());
  await page.click('#btn-load-demo');
}

const isVisible = (page, selector) => page.isVisible(selector);
const catalogTypes = page => page.$$eval('#catalog-table tbody tr', trs => trs.map(tr => tr.dataset.type));

test('catalog tab sets #needles, back returns to the calculator, direct #needles opens the catalog', async () => {
  await withPage(async page => {
    await openApp(page);
    assert.equal(await isVisible(page, '#view-calc'), true);
    assert.equal(await isVisible(page, '#view-needles'), false);

    // 1. Tab click → hash + panels
    await page.click('#tab-catalog');
    assert.equal(await page.evaluate(() => location.hash), '#needles');
    assert.equal(await isVisible(page, '#view-needles'), true);
    assert.equal(await isVisible(page, '#view-calc'), false);
    assert.equal(await page.getAttribute('#tab-catalog', 'aria-selected'), 'true');
    assert.equal(await page.getAttribute('#tab-calc', 'aria-selected'), 'false');
    assert.ok((await catalogTypes(page)).length > 0, 'catalog rows rendered');

    // 2. history.back() → calculator, empty hash
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => !document.getElementById('view-calc').hidden);
    assert.equal(await page.evaluate(() => location.hash), '');
    assert.equal(await isVisible(page, '#view-needles'), false);
    assert.equal(await page.getAttribute('#tab-calc', 'aria-selected'), 'true');
  });

  // 3. Direct load with #needles
  await withPage(async page => {
    await openApp(page, '#needles');
    assert.equal(await isVisible(page, '#view-needles'), true);
    assert.equal(await isVisible(page, '#view-calc'), false);
    assert.equal(await page.getAttribute('#tab-catalog', 'aria-selected'), 'true');
    assert.ok((await catalogTypes(page)).length > 0);
  });
});

test('arrow keys move between the view tabs', async () => {
  await withPage(async page => {
    await openApp(page);
    await page.focus('#tab-calc');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-catalog');
    assert.equal(await isVisible(page, '#view-needles'), true);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-calc');
    assert.equal(await isVisible(page, '#view-calc'), true);
  });
});

test('no raw i18n key in catalog or tab texts/attributes, in EN and DE', async () => {
  const RAW_KEY = /\b(view|catalog)\.[a-zA-Z.]+/;
  await withPage(async page => {
    await openApp(page, '#needles');
    await loadDemo(page); // usedBy dots + titles
    // A custom needle adds the "custom" badge.
    await page.evaluate(() => localStorage.setItem('dellorto_custom_needles',
      JSON.stringify([{ type: 'K99', carbType: 'VHSx', A: 2.5, B: 1.6, C: 40, clips: 3 }])));
    await page.reload();
    await page.waitForSelector('#catalog-table tbody tr');

    const collect = () => page.evaluate(() => {
      const roots = [document.getElementById('view-tabs'), document.getElementById('view-needles')];
      const out = [];
      for (const root of roots) {
        out.push(root.innerText);
        for (const el of [root, ...root.querySelectorAll('*')]) {
          for (const attr of ['title', 'aria-label', 'placeholder']) {
            const value = el.getAttribute(attr);
            if (value) out.push(`${attr}=${value}`);
          }
        }
      }
      return out;
    });

    for (const lang of ['en', 'de']) {
      if (lang === 'de') await page.click('#btn-lang');
      assert.equal(await page.evaluate(() => document.documentElement.lang || 'en'), lang);
      // VHSx: dots + custom badge; PHBH: unverified clip-count tooltips.
      for (const ct of ['VHSx', 'PHBH']) {
        await page.click(`[data-catalog-carb="${ct}"]`);
        const strings = await collect();
        const offenders = strings.filter(s => RAW_KEY.test(s)).map(s => s.match(RAW_KEY)[0]);
        assert.deepEqual([...new Set(offenders)], [], `${lang}/${ct}: raw keys found`);
      }
    }
    // Sanity: the DE UI actually switched.
    assert.equal(await page.textContent('#tab-catalog'), 'Nadelkatalog');
  });
});

test('switching the catalog to PHBL leaves the calculator carb type and setups untouched', async () => {
  await withPage(async page => {
    await openApp(page);
    await loadDemo(page);
    const readState = () => page.evaluate(() => ({
      carbType: localStorage.getItem('dellorto_carb_type'),
      setups: localStorage.getItem('dellorto_setups'),
      radio: document.querySelector('input[name="carbType"]:checked')?.value,
    }));
    const before = await readState();
    assert.equal(before.radio, 'VHSx');

    await page.click('#tab-catalog');
    await page.click('[data-catalog-carb="PHBL"]');
    assert.equal(await page.getAttribute('[data-catalog-carb="PHBL"]', 'aria-pressed'), 'true');
    const types = await catalogTypes(page);
    assert.ok(types.length > 0 && types.every(ty => ty.startsWith('D')), 'catalog shows PHBL (D) needles');

    assert.deepEqual(await readState(), before);
    await page.click('#tab-calc');
    assert.equal(await page.evaluate(() => document.querySelector('input[name="carbType"]:checked')?.value), 'VHSx');
    assert.deepEqual(await readState(), before);
  });
});

test('demo setups: K98 has three dots, "My setups only" leaves exactly one row', async () => {
  await withPage(async page => {
    await openApp(page, '#needles');
    await loadDemo(page); // re-renders the visible catalog via updateUI()
    const dots = await page.$$eval('#catalog-table tr[data-type="K98"] .catalog-dot', els => els.length);
    assert.equal(dots, 3);

    await page.click('[data-catalog-used]');
    assert.equal(await page.getAttribute('[data-catalog-used]', 'aria-pressed'), 'true');
    assert.deepEqual(await catalogTypes(page), ['K98']);
    assert.equal(await isVisible(page, '#catalog-empty'), false);
  });
});

test('search " k 98 " finds K98 and keeps focus in the search box', async () => {
  await withPage(async page => {
    await openApp(page, '#needles');
    await page.click('#catalog-search');
    await page.keyboard.type(' k 98 ');
    assert.deepEqual(await catalogTypes(page), ['K98']);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'catalog-search');

    await page.keyboard.type('zzz');
    assert.deepEqual(await catalogTypes(page), []);
    assert.equal(await isVisible(page, '#catalog-empty'), true);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'catalog-search');
  });
});

test('390×844: the first column stays at the left edge while #catalog-scroll scrolls horizontally', async () => {
  await withPage(async page => {
    await openApp(page, '#needles');
    const firstCell = '#catalog-table tbody tr:first-child > .catalog-name';
    const secondCell = '#catalog-table tbody tr:first-child > td:nth-child(2)';
    const x0 = (await page.locator(firstCell).boundingBox()).x;
    const second0 = (await page.locator(secondCell).boundingBox()).x;

    const scrollLeft = await page.evaluate(() => {
      const el = document.getElementById('catalog-scroll');
      el.scrollLeft = 200;
      return el.scrollLeft;
    });
    assert.ok(scrollLeft > 0, 'table must be horizontally scrollable at this width');

    const x1 = (await page.locator(firstCell).boundingBox()).x;
    const second1 = (await page.locator(secondCell).boundingBox()).x;
    assert.ok(Math.abs(x1 - x0) < 0.5, `first column moved from ${x0} to ${x1}`);
    assert.ok(second1 < second0, 'other columns scroll');

    // No horizontal page overflow on the phone layout.
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  }, { viewport: { width: 390, height: 844 } });
});
