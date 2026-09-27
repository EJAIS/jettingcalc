// test-browser/header.mjs — Browser-driven layout test for the header
// controls (language, Load Demo, Reset, Dark Mode, Install App): on narrow
// screens they wrap onto further right-aligned rows instead of running off
// the left edge, where body { overflow-x: hidden } would hide them.
// Copyright (C) 2014 GUE — GPL v2.0
//
// Needs a real Chromium and the `playwright` package, so — like the other
// suites here — it lives outside test/ and is run explicitly:
//
//   npm install                       # pulls in the `playwright` devDependency
//   npx playwright install chromium   # first time and after every Playwright update
//   node --test test-browser/*.mjs
//
// Set CHROMIUM_PATH to launch a preinstalled Chromium instead of the one
// Playwright downloads (e.g. when the two versions don't match).
//
// Service workers are blocked: offline behavior is pwa.mjs's job.

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

// Fresh context + page per call, language set before the app script runs.
async function withPage(lang, viewport, fn) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport });
  try {
    const page = await context.newPage();
    await page.addInitScript(l => localStorage.setItem('dellorto_lang', l), lang);
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForSelector('#setup-tbody tr', { state: 'attached' });
    await fn(page);
  } finally {
    await context.close();
  }
}

// Every visible header control's box, plus the viewport width.
function measureControls(page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    buttons: [...document.querySelectorAll('header .header-controls button')]
      .filter(b => !b.hidden)
      .map(b => {
        const r = b.getBoundingClientRect();
        return { id: b.id, left: r.left, right: r.right, top: r.top };
      }),
  }));
}

// The install button only appears once the browser offers installation;
// unhiding it here gives the widest (worst) case.
const showInstallButton = page => page.evaluate(() => document.getElementById('btn-install').removeAttribute('hidden'));

for (const lang of ['en', 'de']) {
  for (const width of [320, 360]) {
    test(`${lang} ${width} px: every header control lies fully inside the viewport, with and without Install`, async () => {
      await withPage(lang, { width, height: 740 }, async page => {
        for (const install of [false, true]) {
          if (install) await showInstallButton(page);
          const m = await measureControls(page);
          assert.equal(m.buttons.length, install ? 5 : 4);
          for (const b of m.buttons) {
            const where = `${lang} ${width} px${install ? ' + Install' : ''}: #${b.id}`;
            assert.ok(b.left >= 0, `${where} starts at ${b.left}`);
            assert.ok(b.right <= m.innerWidth, `${where} ends at ${b.right} > ${m.innerWidth}`);
          }
        }
      });
    });
  }

  test(`${lang} 1280 px: header controls stay in one row (desktop unchanged)`, async () => {
    await withPage(lang, { width: 1280, height: 800 }, async page => {
      await showInstallButton(page);
      const { buttons } = await measureControls(page);
      assert.equal(new Set(buttons.map(b => Math.round(b.top))).size, 1, JSON.stringify(buttons));
    });
  });
}
