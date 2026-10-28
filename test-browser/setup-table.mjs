// test-browser/setup-table.mjs — Browser-driven layout test for the setup
// table: all input columns first, then the calculated results (Max HD,
// Cutaway) under their own tinted group header, inputs framed as fields,
// and on phones a name column that stays put while the table scrolls.
// Copyright (C) 2014 GUE — GPL v2.0
//
// Needs a real Chromium and the `playwright` package, so — like the other
// suites here — it lives outside test/ and is run explicitly:
//
//   npm install                       # pulls in the `playwright` devDependency
//   npx playwright install chromium   # first time and after every Playwright update
//   node --test test-browser/*.mjs
//
// Each Playwright version expects its own Chromium build, so run the install
// step again after every Playwright update. Alternatively, set CHROMIUM_PATH
// to launch a preinstalled Chromium or Chrome — for environments that can't
// download the browser.
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
// Fresh context + page per call with the demo setups loaded.
async function withDemo(lang, viewport, fn) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport });
  try {
    const page = await context.newPage();
    page.on('dialog', d => d.accept());
    await page.addInitScript(l => localStorage.setItem('dellorto_lang', l), lang);
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForSelector('#setup-tbody tr', { state: 'attached' });
    await page.click('#btn-load-demo');
    await fn(page);
  } finally {
    await context.close();
  }
}

const INPUT_FIELDS = ['name', 'needleType', 'clipPos', 'carbSize', 'jetType', 'needleJet', 'nd', 'hd'];

test('inputs first, then Max HD and Cutaway under their own group header, then the actions', async () => {
  for (const [lang, groups] of [['en', ['Inputs', 'Results (calculated)']], ['de', ['Eingaben', 'Ergebnisse (berechnet)']]]) {
    await withDemo(lang, { width: 1280, height: 800 }, async page => {
      const layout = await page.evaluate(() => {
        const row = document.querySelector('#setup-tbody tr');
        const cells = [...row.children];
        return {
          fields: cells.map(td => td.querySelector('[data-field]')?.dataset.field
            ?? (td.classList.contains('maxhd-cell') ? 'maxHD'
              : td.classList.contains('cutaway-col-cell') ? 'cutaway'
              : td.classList.contains('row-actions') ? 'actions' : '?')),
          groups: [...document.querySelectorAll('.setup-table .col-group-row th')]
            .map(th => ({ text: th.textContent.trim(), span: th.colSpan })),
          headCount: document.querySelectorAll('.setup-table thead tr:last-child th').length,
        };
      });
      assert.deepEqual(layout.fields, [...INPUT_FIELDS, 'maxHD', 'cutaway', 'actions']);
      assert.deepEqual(layout.groups, [{ text: groups[0], span: 8 }, { text: groups[1], span: 2 }]);
      assert.equal(layout.headCount, layout.fields.length, 'one header per column');
    });
  }
});

test('result cells are tinted with a separator; inputs are framed fields, also without hover', async () => {
  await withDemo('en', { width: 1280, height: 800 }, async page => {
    const style = await page.evaluate(() => {
      const row = document.querySelector('#setup-tbody tr');
      const css = el => getComputedStyle(el);
      const maxHd = row.querySelector('.maxhd-cell');
      const needle = row.querySelector('[data-field="needleType"]').closest('td');
      return {
        resultBg: css(maxHd).backgroundColor,
        inputCellBg: css(needle).backgroundColor,
        separator: css(maxHd).borderLeftWidth,
        maxHdColor: css(maxHd).color,
        textColor: css(document.body).color,
        inputBorders: [...row.querySelectorAll('.cell-input')].map(i => css(i).borderTopColor),
      };
    });
    assert.notEqual(style.resultBg, style.inputCellBg, 'result columns tinted');
    assert.equal(style.separator, '2px');
    assert.equal(style.maxHdColor, style.textColor, 'Max HD in the neutral text colour, not red');
    assert.ok(style.inputBorders.length === INPUT_FIELDS.length
      && style.inputBorders.every(c => c !== 'rgba(0, 0, 0, 0)'), `input borders: ${style.inputBorders}`);
  });
});

test('390 px: the name column stays at the left edge while the table scrolls; no page overflow', async () => {
  await withDemo('de', { width: 390, height: 844 }, async page => {
    const nameCell = '#setup-tbody tr:first-child > .name-col';
    const x0 = (await page.locator(nameCell).boundingBox()).x;
    const scrolled = await page.evaluate(() => {
      const el = document.querySelector('.setup-table').closest('.table-wrapper');
      el.scrollLeft = el.scrollWidth;
      return el.scrollLeft;
    });
    assert.ok(scrolled > 0, 'table scrolls sideways at this width');
    assert.ok(Math.abs((await page.locator(nameCell).boundingBox()).x - x0) < 0.5, 'name column moved');
    // The full demo name is readable, and the results are in view at the end.
    assert.equal(await page.evaluate(() => {
      const i = document.querySelector('#setup-tbody tr:first-child [data-field="name"]');
      return i.scrollWidth <= i.clientWidth;
    }), true, '"#1 Demo-1" fits the name field');
    const box = await page.locator('#setup-tbody tr:first-child .maxhd-cell').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390, 'Max HD in view after scrolling');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
});
