// test-browser/pwa.mjs — Browser-driven regression tests for the PWA
// features (service worker offline support, share-link freshness
// checking, the update banner, and the install button).
// Copyright (C) 2014 GUE — GPL v2.0
//
// These need a real Chromium and the `playwright` package, unlike the
// project's zero-dependency unit tests in test/ (which only use Node's
// built-in test runner and are auto-discovered by a bare `node --test`).
// So this file deliberately lives OUTSIDE test/ — a directory literally
// named `test` is auto-discovered by `node --test` regardless of the
// files' own naming convention, which would break the default test run
// for anyone who hasn't installed Playwright. Run these explicitly:
//
//   npm install                    # pulls in the `playwright` devDependency
//   npx playwright install chromium   # first time only, downloads the browser
//   node --test test-browser/*.mjs
//
// Set CHROMIUM_PATH to launch a preinstalled Chromium instead of the one
// Playwright downloads (e.g. when the two versions don't match).
//
// Each test spins up its own throwaway static file server (serving the
// repo root, like `python3 -m http.server` in the README) and its own
// isolated browser context, so tests don't share service-worker/cache
// state and can run in any order.

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

// Waits (up to 5s) for the current page to be under an active service
// worker's control — the state every scenario below needs before it can
// meaningfully test offline/cache/update behavior.
async function waitForController(page) {
  await page.evaluate(() => new Promise(resolve => {
    if (navigator.serviceWorker.controller) return resolve();
    navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
    setTimeout(resolve, 5000);
  }));
}

test('offline: fresh load, then offline reload, still renders fully (charts included)', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`);
    await waitForController(page);

    // Give the charts something to draw.
    page.once('dialog', d => d.accept());
    await page.click('#btn-load-demo');
    await page.waitForTimeout(300);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });

    assert.equal(await page.title(), 'Dellorto Jetting Calculator');

    const chartInstanceCount = await page.evaluate(() => Object.keys(globalThis.Chart?.instances ?? {}).length);
    assert.ok(chartInstanceCount >= 2, `expected both the needle and carb charts to be instantiated offline, got ${chartInstanceCount}`);

    const row1Needle = await page.evaluate(() => document.querySelector('[data-id="1"][data-field="needleType"]')?.value);
    assert.equal(row1Needle, 'K98', 'demo data (localStorage) should survive an offline reload');
  } finally {
    await context.close();
  }
});

test('share link online: navigation is network-first, not served from a poisoned stale cache entry', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`);
    await waitForController(page);

    const shareUrl = `${baseUrl}/index.html?v=1&c=VHSx&s1=K98-3-30-262-DP-53-175`;

    // Poison the cache with a stale marker for the EXACT share-link URL, as
    // if an earlier visit had wrongly cached it under a cache-first
    // strategy. Since navigations carrying share params are supposed to be
    // network-first, the live (fresh) page must win over this stale entry.
    await page.evaluate(async url => {
      const [cacheName] = await caches.keys();
      const cache = await caches.open(cacheName);
      await cache.put(url, new Response('<html><body>STALE_MARKER</body></html>', { headers: { 'Content-Type': 'text/html' } }));
    }, shareUrl);

    await page.goto(shareUrl, { waitUntil: 'load' });

    const bodyText = await page.evaluate(() => document.body.textContent);
    assert.ok(!bodyText.includes('STALE_MARKER'), 'network-first should prefer the live network response over the poisoned cache entry');
    assert.equal(await page.title(), 'Dellorto Jetting Calculator');

    // And the link's data actually made it through decodeShare().
    const row1Needle = await page.evaluate(() => document.querySelector('[data-id="1"][data-field="needleType"]')?.value);
    assert.equal(row1Needle, 'K98');
  } finally {
    await context.close();
  }
});

test('share link while offline: shows msg.shareOfflineStaleWarning alongside the normal import flow', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    // isShareLinkPossiblyStale() reads navigator.onLine directly (see
    // js/app.js) — mock that rather than context.setOffline(), which
    // doesn't reliably reach fetches issued from inside the service
    // worker's own execution context.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false });
    });

    await page.goto(`${baseUrl}/index.html?v=1&c=VHSx&s1=K98-3-30-262-DP-53-175`);
    await page.waitForTimeout(300);

    const notice = await page.evaluate(() => document.getElementById('app-notice')?.textContent);
    assert.match(notice ?? '', /newer needle database/i, `expected msg.shareOfflineStaleWarning in the notice, got: ${notice}`);

    // The import itself must still have gone through — the offline
    // warning is additive, not a rejection of the link.
    const row1Needle = await page.evaluate(() => document.querySelector('[data-id="1"][data-field="needleType"]')?.value);
    assert.equal(row1Needle, 'K98');

    const importBannerHidden = await page.evaluate(() => document.getElementById('import-banner')?.hidden);
    assert.equal(importBannerHidden, false, 'the normal import banner should still appear alongside the offline warning');
  } finally {
    await context.close();
  }
});

test('waiting service worker: update banner appears, "Update now" activates it and reloads', async () => {
  const swPath = path.join(REPO_ROOT, 'sw.js');
  const original = fs.readFileSync(swPath, 'utf8');
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/index.html`);
    await waitForController(page);

    const bumped = original.replace(/JETTINGCALC_CACHE_VERSION = '[^']*'/, "JETTINGCALC_CACHE_VERSION = 'v-test-update'");
    assert.notEqual(bumped, original, 'expected to find and replace JETTINGCALC_CACHE_VERSION in sw.js');
    fs.writeFileSync(swPath, bumped);

    await page.reload({ waitUntil: 'load' });

    const waitingAppeared = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      for (let i = 0; i < 40; i++) {
        await reg.update();
        if (reg.waiting) return true;
        await new Promise(r => setTimeout(r, 250));
      }
      return false;
    });
    assert.ok(waitingAppeared, 'expected a new worker in registration.waiting after the version bump (no auto-skipWaiting by design)');

    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.getElementById('update-banner')?.hidden), false);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 8000 }),
      page.click('#btn-update-now'),
    ]);

    const activeState = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state);
    assert.equal(activeState, 'activated');

    const cacheNames = await page.evaluate(() => caches.keys());
    assert.deepEqual(cacheNames, ['jettingcalc-v-test-update'], 'the old cache should have been replaced, not left alongside the new one');

    assert.equal(await page.evaluate(() => document.getElementById('update-banner')?.hidden), true, 'no update should be pending right after activating the latest version');
  } finally {
    fs.writeFileSync(swPath, original);
    await context.close();
  }
});

test('#btn-install stays hidden when display-mode: standalone is mocked true, even if beforeinstallprompt fires', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      const realMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = query => {
        if (query === '(display-mode: standalone)') {
          return {
            matches: true, media: query,
            addListener() {}, removeListener() {},
            addEventListener() {}, removeEventListener() {},
            dispatchEvent() { return true; },
          };
        }
        return realMatchMedia(query);
      };
    });

    await page.goto(`${baseUrl}/index.html`);
    await page.waitForTimeout(200);

    assert.equal(await page.evaluate(() => document.getElementById('btn-install')?.hidden), true);

    // Even a real 'beforeinstallprompt' firing must not reveal the button
    // once isAppInstalled() reports true.
    await page.evaluate(() => {
      const fakeEvent = new Event('beforeinstallprompt', { cancelable: true });
      fakeEvent.prompt = () => {};
      fakeEvent.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(fakeEvent);
    });
    await page.waitForTimeout(200);

    assert.equal(await page.evaluate(() => document.getElementById('btn-install')?.hidden), true);
  } finally {
    await context.close();
  }
});
