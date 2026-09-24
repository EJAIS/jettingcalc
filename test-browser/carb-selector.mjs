// test-browser/carb-selector.mjs — Browser-driven layout tests for the
// carburetor type selector (#carb-type-selector): stacked layout in portrait
// (≤ 600px), unchanged single row on wider screens, enlarged tap area of the
// beta info icons, and translated attribute texts.
// Copyright (C) 2014 GUE — GPL v2.0
//
// Needs a real Chromium and the `playwright` package, so — like pwa.mjs,
// catalog.mjs and custom-needles.mjs — it lives outside test/ and is run
// explicitly:
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

// Fresh context + page per call; `storage` is written to localStorage
// before the app script runs. The language is switched via the toggle
// button (like a user would); `fn` receives the page.
async function withPage(lang, contextOptions, fn, storage = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', ...contextOptions });
  try {
    const page = await context.newPage();
    await page.addInitScript(entries => {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, storage);
    page.on('dialog', d => d.accept());
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForSelector('#setup-tbody tr');
    if (lang === 'de') await page.click('#btn-lang');
    assert.equal(await page.evaluate(() => document.documentElement.lang || 'en'), lang);
    await fn(page);
  } finally {
    await context.close();
  }
}

const PHBH_INFO = '[data-i18n-tooltip="carbType.phbhBetaDisclaimer"]';
const PHBL_INFO = '[data-i18n-tooltip="carbType.phblBetaDisclaimer"]';

// Bounding boxes of the selector's parts, plus its content box (inside
// border and padding) and a list of descendants sticking out of it.
function measure(page) {
  return page.evaluate(([phbhInfo, phblInfo]) => {
    const box = el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, cy: r.y + r.height / 2 };
    };
    const sel = document.getElementById('carb-type-selector');
    const option = value => sel.querySelector(`input[name="carbType"][value="${value}"]`).closest('label');
    const cs = getComputedStyle(sel);
    const outer = sel.getBoundingClientRect();
    const content = {
      left: outer.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
      right: outer.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight),
    };
    const overflowing = [...sel.querySelectorAll('*')]
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.left < outer.left - 0.5 || r.right > outer.right + 0.5);
      })
      .map(el => el.outerHTML.slice(0, 60));
    return {
      content,
      betaLabel: box(sel.querySelector('.beta-divider-label')),
      VHSx: box(option('VHSx')),
      PHBH: box(option('PHBH')),
      PHBL: box(option('PHBL')),
      infoPHBH: box(sel.querySelector(phbhInfo)),
      infoPHBL: box(sel.querySelector(phblInfo)),
      overflowing,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  }, [PHBH_INFO, PHBL_INFO]);
}

const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

function assertNoOverflow(m, where) {
  assert.ok(m.scrollWidth <= m.innerWidth, `${where}: page scrollWidth ${m.scrollWidth} > ${m.innerWidth}`);
  assert.deepEqual(m.overflowing, [], `${where}: elements stick out of #carb-type-selector`);
}

for (const lang of ['en', 'de']) {
  test(`${lang}: 412×915 portrait — beta heading above PHBH | PHBL, info icons beside their option, VHSx full width`, async () => {
    await withPage(lang, { viewport: { width: 412, height: 915 } }, async page => {
      const m = await measure(page);
      const where = `${lang} 412`;

      // Heading on its own row above both options
      assert.ok(m.betaLabel.bottom <= m.PHBH.y && m.betaLabel.bottom <= m.PHBL.y, `${where}: beta heading not above the options`);
      // PHBH and PHBL side by side in one row
      assert.ok(near(m.PHBH.y, m.PHBL.y), `${where}: PHBH y ${m.PHBH.y} vs PHBL y ${m.PHBL.y}`);
      assert.ok(m.PHBL.x >= m.PHBH.right, `${where}: PHBL does not start right of PHBH`);
      // Each info icon right of its option, vertically centred in the same row
      for (const [opt, info] of [['PHBH', 'infoPHBH'], ['PHBL', 'infoPHBL']]) {
        assert.ok(m[info].x >= m[opt].right, `${where}: ${info} not right of ${opt}`);
        assert.ok(near(m[info].cy, m[opt].cy), `${where}: ${info} not in the row of ${opt}`);
      }
      assert.ok(m.infoPHBH.right <= m.PHBL.x, `${where}: PHBH info overlaps PHBL`);
      // VHSx spans the selector's content box; touch targets ≥ 44px
      assert.ok(near(m.VHSx.x, m.content.left, 1) && near(m.VHSx.right, m.content.right, 1),
        `${where}: VHSx ${m.VHSx.x}–${m.VHSx.right} vs content ${m.content.left}–${m.content.right}`);
      for (const opt of ['VHSx', 'PHBH', 'PHBL']) assert.ok(m[opt].h >= 44, `${where}: ${opt} height ${m[opt].h} < 44`);
      assertNoOverflow(m, where);
    });
  });

  test(`${lang}: 320×640 — no horizontal overflow`, async () => {
    await withPage(lang, { viewport: { width: 320, height: 640 } }, async page => {
      const m = await measure(page);
      assertNoOverflow(m, `${lang} 320`);
      assert.ok(near(m.PHBH.y, m.PHBL.y), `${lang} 320: PHBH and PHBL not in one row`);
    });
  });

  for (const [width, height] of [[915, 412], [1280, 800]]) {
    test(`${lang}: ${width}×${height} — VHSx, PHBH and PHBL in one row as before`, async () => {
      await withPage(lang, { viewport: { width, height } }, async page => {
        const m = await measure(page);
        const where = `${lang} ${width}`;
        assert.ok(near(m.VHSx.cy, m.PHBH.cy) && near(m.PHBH.cy, m.PHBL.cy), `${where}: options not in one row`);
        assert.ok(near(m.betaLabel.cy, m.PHBH.cy), `${where}: beta label not inline with the options`);
        assert.ok(m.VHSx.right < m.PHBH.x && m.PHBH.right < m.infoPHBH.x && m.infoPHBH.right < m.PHBL.x
          && m.PHBL.right < m.infoPHBL.x, `${where}: unexpected order VHSx, PHBH, ⓘ, PHBL, ⓘ`);
        assertNoOverflow(m, where);
      });
    });
  }

  test(`${lang}: tapping 15px right of the PHBH ⓘ opens its tooltip; the options keep their own taps`, async () => {
    await withPage(lang, { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true }, async page => {
      const info = await page.locator(PHBH_INFO).boundingBox();
      const [x, y] = [info.x + info.width / 2 + 15, info.y + info.height / 2];
      // Hit test first: Chromium's touch adjustment may snap a tap to a
      // nearby target anyway, so the tap alone doesn't prove the hit area.
      assert.equal(await page.evaluate(([x, y, sel]) => !!document.elementFromPoint(x, y)?.closest(sel), [x, y, PHBH_INFO]),
        true, 'point 15px right of the icon centre belongs to the icon');
      await page.touchscreen.tap(x, y);
      const expected = await page.getAttribute(PHBH_INFO, 'data-tooltip');
      assert.ok(expected.includes('PHBH'), 'PHBH tooltip text rendered');
      assert.equal(await page.evaluate(() => {
        const tip = document.querySelector('.tooltip-box');
        return tip.hidden ? null : tip.textContent;
      }), expected, 'tooltip opened by a tap beside the icon');

      // The hit area ends in the grid gap: PHBL's left edge still selects PHBL.
      const phbl = await page.locator('input[name="carbType"][value="PHBL"]').evaluate(el => {
        const r = el.closest('label').getBoundingClientRect();
        return { x: r.x, cy: r.y + r.height / 2 };
      });
      await page.touchscreen.tap(phbl.x + 2, phbl.cy);
      assert.equal(await page.isChecked('input[name="carbType"][value="PHBL"]'), true, 'tap on PHBL edge selects PHBL');
    });
  });

  test(`${lang}: desktop — the ⓘ hit area never covers the neighbouring options, hover still opens the tooltip`, async () => {
    await withPage(lang, { viewport: { width: 1280, height: 800 } }, async page => {
      const opts = await page.evaluate(() => ['PHBH', 'PHBL'].map(v => {
        const r = document.querySelector(`input[name="carbType"][value="${v}"]`).closest('label').getBoundingClientRect();
        return { v, left: r.left, right: r.right, cy: r.y + r.height / 2 };
      }));
      // Right edge of PHBH (left of its ⓘ) and left edge of PHBL (right of the PHBH ⓘ).
      for (const [x, y, v] of [[opts[0].right - 2, opts[0].cy, 'PHBH'], [opts[1].left + 2, opts[1].cy, 'PHBL']]) {
        const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).closest('label')?.querySelector('input')?.value, [x, y]);
        assert.equal(hit, v, `point (${x}, ${y}) should hit the ${v} option`);
      }
      // Mouse hover still opens the tooltip (hover listens to pointerover).
      await page.hover(PHBH_INFO);
      assert.equal(await page.evaluate(() => !document.querySelector('.tooltip-box').hidden), true, 'hover opens the tooltip');
    });
  });

  test(`${lang}: no raw i18n keys in selector and custom needle list attributes`, async () => {
    const RAW_KEY = /\b(view|catalog|svg|carbType|col|btn)\.[a-zA-Z.]+/;
    const customNeedles = JSON.stringify([{ type: 'K98-MOD', carbType: 'VHSx', A: 2.5, B: 1.6, C: 40, length: 73.5, clips: 4 }]);
    await withPage(lang, { viewport: { width: 412, height: 915 } }, async page => {
      // The list sits in a collapsed section; attached is enough for attributes.
      await page.waitForSelector('#cn-list .btn-delete-needle', { state: 'attached' });
      const strings = await page.evaluate(() => {
        const out = [];
        for (const root of [document.getElementById('carb-type-selector'), document.getElementById('cn-list')]) {
          out.push(root.innerText);
          for (const el of [root, ...root.querySelectorAll('*')]) {
            for (const attr of ['title', 'aria-label', 'placeholder', 'data-tooltip']) {
              const value = el.getAttribute(attr);
              if (value) out.push(`${attr}=${value}`);
            }
          }
        }
        return out;
      });
      const offenders = strings.filter(s => RAW_KEY.test(s)).map(s => s.match(RAW_KEY)[0]);
      assert.deepEqual([...new Set(offenders)], [], `${lang}: raw keys found`);

      const EXPECTED = {
        en: { phbh: 'PHBH beta notes', del: 'Delete K98-MOD' },
        de: { phbh: 'Hinweise zur PHBH-Beta', del: 'K98-MOD löschen' },
      }[lang];
      assert.equal(await page.getAttribute(PHBH_INFO, 'aria-label'), EXPECTED.phbh);
      assert.equal(await page.getAttribute('#cn-list .btn-delete-needle', 'aria-label'), EXPECTED.del);
      assert.equal(await page.getAttribute('#cn-list .btn-delete-needle', 'title'), EXPECTED.del);
    }, { dellorto_custom_needles: customNeedles });
  });
}

// A stored language applies on the first load, <html lang> included —
// without touching the language button.
test('stored dellorto_lang = de: <html lang> is "de" right after the first load', async () => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('dellorto_lang', 'de'));
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForSelector('#setup-tbody tr');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'de');
    assert.equal(await page.textContent('#btn-lang'), 'EN', 'UI is German (button offers EN)');
    assert.equal(await page.getAttribute('#setup-tbody tr input[data-field="name"]', 'title'), 'Setup-Name');
  } finally {
    await context.close();
  }
});

// Tooltip anchors that are real buttons (row actions) keep acting on the
// first tap: the touch fix for the info icons must not swallow their click.
test('touch: tapping a row action button runs it instead of opening its tooltip', async () => {
  await withPage('en', { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true }, async page => {
    await page.click('#btn-load-demo');
    const btn = page.locator('#setup-tbody [data-action="duplicate-row"]').first();
    await btn.scrollIntoViewIfNeeded();
    await btn.evaluate(el => el.addEventListener('click', () => { window.__actionClicked = true; }));
    const b = await btn.boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    assert.equal(await page.evaluate(() => window.__actionClicked === true), true, 'button click reached the button');
    assert.equal(await page.evaluate(() => document.querySelector('.tooltip-box').hidden), true, 'no tooltip left open');
  });
});
