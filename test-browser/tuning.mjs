// test-browser/tuning.mjs — Browser-driven regression tests for the fine
// tuning view (tab + history, reference loading, ± steps and their
// suggestion cards, jet steps, step back / reset, applying to a setup slot
// incl. undo, i18n without losing state, carb type reset, mobile layout).
// Copyright (C) 2014 GUE — GPL v2.0
//
// Needs a real Chromium and the `playwright` package, so — like
// catalog.mjs — it lives outside test/ and is run explicitly:
//
//   npm install                       # pulls in the `playwright` devDependency
//   npx playwright install chromium   # first time only, downloads the browser
//   node --test test-browser/*.mjs
//
// Set CHROMIUM_PATH to launch a preinstalled Chromium instead of the one
// Playwright downloads (e.g. when the two versions don't match).
//
// The expected needles come from the regression values in
// test/tuning.test.mjs (reference K27 C3 / 34 / DQ 264 / ND 50 / HD 128).
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

// Fresh context + page per test; `fn` receives the page.
async function withPage(fn, contextOptions = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', ...contextOptions });
  try {
    const page = await context.newPage();
    page.on('dialog', d => d.accept());
    await fn(page);
  } finally {
    await context.close();
  }
}

const MOBILE = { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true };

async function openApp(page, hash = '') {
  await page.goto(`${baseUrl}/index.html${hash}`);
  // 'attached', not visible: with '#tuning' the calculator is hidden.
  await page.waitForSelector('#setup-tbody tr', { state: 'attached' });
}

// Enters a setup into a calculator row the way a user would.
async function createSetup(page, rowId, { needleType, clipPos, carbSize = 34, jetType = 'DQ', needleJet = 264, nd = 50, hd = 128 }) {
  const row = field => `tr[data-row-id="${rowId}"] [data-field="${field}"]`;
  await page.selectOption(row('needleType'), needleType);
  await page.selectOption(row('clipPos'), String(clipPos));
  await page.selectOption(row('carbSize'), String(carbSize));
  await page.selectOption(row('jetType'), jetType);
  await page.selectOption(row('needleJet'), String(needleJet));
  for (const [field, value] of [['nd', nd], ['hd', hd]]) {
    await page.fill(row(field), String(value));
    await page.press(row(field), 'Tab'); // number inputs commit on change
  }
}

// The reference setup K27 C3 / 34 / DQ 264 / ND 50 / HD 128 in row 1.
const createK27Setup = page => createSetup(page, 1, { needleType: 'K27', clipPos: 3 });

// Calculator with the K27 setup → fine tuning tab → K27 loaded as reference.
async function openTuningWithK27(page, { tap = false } = {}) {
  await openApp(page);
  await createK27Setup(page);
  const press = selector => (tap ? page.tap(selector) : page.click(selector));
  await press('#tab-tuning');
  await press('[data-tuning-source="1"]');
  await page.waitForSelector('#tuning-status:not([hidden])');
  return press;
}

const isVisible = (page, selector) => page.isVisible(selector);
const status = page => page.textContent('#tuning-status');
const cardTitles = page => page.$$eval('.tuning-sugg-pick', els => els.map(el => el.textContent.trim()));
const flowText = (page, rangeKey) => page.textContent(`tr[data-range="${rangeKey}"] .tuning-flow`);
const storedSetups = page => page.evaluate(() => JSON.parse(localStorage.getItem('dellorto_setups')));
const noHorizontalOverflow = page => page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth);

// ── Routing ──────────────────────────────────────────────────────────────────

test('direct #tuning opens the tab; tab switches and history.back follow the hash', async () => {
  await withPage(async page => {
    await openApp(page, '#tuning');
    assert.equal(await isVisible(page, '#view-tuning'), true);
    assert.equal(await isVisible(page, '#view-calc'), false);
    assert.equal(await page.getAttribute('#tab-tuning', 'aria-selected'), 'true');
    assert.equal(await isVisible(page, '#tuning-empty'), true);
  });

  await withPage(async page => {
    await openApp(page);
    await page.click('#tab-tuning');
    assert.equal(await page.evaluate(() => location.hash), '#tuning');
    assert.equal(await isVisible(page, '#view-tuning'), true);

    await page.click('#tab-catalog');
    assert.equal(await page.evaluate(() => location.hash), '#needles');

    await page.evaluate(() => history.back());
    await page.waitForFunction(() => !document.getElementById('view-tuning').hidden);
    assert.equal(await page.evaluate(() => location.hash), '#tuning');
    assert.equal(await page.getAttribute('#tab-tuning', 'aria-selected'), 'true');

    await page.evaluate(() => history.back());
    await page.waitForFunction(() => !document.getElementById('view-calc').hidden);
    assert.equal(await page.evaluate(() => location.hash), '');
    assert.equal(await isVisible(page, '#view-tuning'), false);
  });
});

// ── Steps, suggestion cards, undo ───────────────────────────────────────────

test('+ in 1/8–1/4 → K96 C5 with three cards; + in 3/4–1 disabled with a visible reason', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    assert.match(await status(page), /^K27 C3 → K27 C3/);
    assert.equal(await page.locator('.tuning-sugg').count(), 0, 'no cards before a needle step');

    await page.click('[data-tuning-step="1:1"]');
    assert.match(await status(page), /K27 C3 → K96 C5/);
    assert.deepEqual(await cardTitles(page), ['K96 · Clip 5', 'U7 · Clip 3', 'K97 · Clip 3']);
    const u7Tags = await page.$$eval('.tuning-sugg:nth-child(2) .tuning-tag', els => els.map(el => el.textContent));
    assert.ok(u7Tags.includes('series change'), `U7 tags: ${u7Tags}`);
    assert.equal(await page.getAttribute('.tuning-sugg:nth-child(1) .tuning-sugg-pick', 'aria-pressed'), 'true');

    assert.equal(await page.isDisabled('[data-tuning-step="4:1"]'), true);
    assert.equal(await isVisible(page, 'tr[data-range="r4"] .tuning-reason'), true);
    assert.match(await page.textContent('tr[data-range="r4"] .tuning-reason'), /HD-limited/);
  });
});

test('switching cards adds no undo step; step back and reset', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    await page.click('[data-tuning-step="1:1"]');
    await page.click('.tuning-sugg:nth-child(3)'); // anywhere on the card picks it
    assert.match(await status(page), /K27 C3 → K97 C3/);
    assert.equal(await page.getAttribute('.tuning-sugg:nth-child(3) .tuning-sugg-pick', 'aria-pressed'), 'true');

    // One step back returns to the reference — the card switch was not a step.
    await page.click('[data-tuning-action="undo"]');
    assert.match(await status(page), /^K27 C3 → K27 C3/);
    assert.equal(await page.isDisabled('[data-tuning-action="undo"]'), true);
    assert.equal(await page.locator('.tuning-sugg').count(), 0, 'cards hidden after step back');

    await page.click('[data-tuning-step="1:1"]');
    await page.click('[data-tuning-step="1:1"]');
    assert.match(await status(page), /K27 C3 → K97 C3/);
    assert.deepEqual((await cardTitles(page)).slice(0, 2), ['K97 · Clip 3', 'K27 · Clip 4']);
    assert.match(await page.textContent('.tuning-sugg:nth-child(2) .tuning-sugg-also'), /K33 · Clip 4/);

    await page.click('[data-tuning-action="reset"]');
    assert.match(await status(page), /^K27 C3 → K27 C3/);
    assert.equal(await page.isDisabled('[data-tuning-action="undo"]'), true);
    assert.equal(await page.isDisabled('[data-tuning-action="reset"]'), true);
  });
});

test('HD + changes the deltas in 3/4–1 and hides the cards', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    await page.click('[data-tuning-step="1:1"]');
    assert.equal(await flowText(page, 'r4'), '0.0 %');
    assert.ok(await page.getAttribute('tr[data-jet="hd"]', 'class').then(c => c.includes('is-lever')),
      'HD row highlighted while ranges are HD-limited');

    await page.click('[data-tuning-jet="hd:1"]');
    assert.equal(await flowText(page, 'r4'), '+1.6 %');
    assert.match(await status(page), /HD 129/);
    assert.equal(await page.locator('.tuning-sugg').count(), 0);
    assert.equal(await page.isDisabled('[data-tuning-action="undo"]'), false);
  });
});

test('keyboard: Enter steps, focus stays; at the limit focus moves to the row label, never the other direction', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    await page.focus('[data-tuning-step="1:1"]');
    await page.keyboard.press('Enter');
    assert.match(await status(page), /K96 C5/);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.tuningStep), '1:1');

    // DQ needle jet sizes end at 274: two presses beyond it change nothing.
    await page.focus('[data-tuning-jet="needleJet:1"]');
    for (let i = 0; i < 12; i++) await page.keyboard.press('Enter');
    assert.match(await status(page), /DQ 274/);
    assert.equal(await page.isDisabled('[data-tuning-jet="needleJet:1"]'), true);
    assert.equal(await page.evaluate(() =>
      document.activeElement.matches('tr[data-jet="needleJet"] th[scope="row"]')), true);
  });
});

test('reference picker: opening the manual form keeps the slot reference; tapping the loaded chip changes nothing', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    await page.click('[data-tuning-step="1:1"]');

    await page.click('[data-tuning-source="1"]'); // already loaded, unchanged slot
    assert.match(await status(page), /K27 C3 → K96 C5/, 'steps kept');
    assert.equal(await page.isDisabled('[data-tuning-action="undo"]'), false);

    await page.click('[data-tuning-source="manual"]');
    assert.equal(await isVisible(page, '#tuning-manual'), true);
    assert.equal(await page.getAttribute('[data-tuning-source="manual"]', 'aria-expanded'), 'true');
    assert.equal(await page.getAttribute('[data-tuning-source="1"]', 'aria-pressed'), 'true');
    assert.equal(await page.isDisabled('[data-tuning-action="applyRef"]'), false,
      'overwrite still offered — the reference is still slot 1');
    assert.match(await status(page), /K27 C3 → K96 C5/);
  });
});

test('loading another reference asks first only when steps would be lost; cancel keeps, confirm loads', async () => {
  await withPage(async page => {
    await openApp(page);
    await createK27Setup(page);
    await createSetup(page, 2, { needleType: 'K96', clipPos: 5 });
    await page.click('#tab-tuning');

    // Handled here instead of withPage's auto-accept.
    page.removeAllListeners('dialog');
    const dialogs = [];
    let answer = true;
    page.on('dialog', d => { dialogs.push(d.message()); answer ? d.accept() : d.dismiss(); });

    // No steps yet: switching the reference needs no confirmation.
    await page.click('[data-tuning-source="1"]');
    await page.click('[data-tuning-source="2"]');
    await page.click('[data-tuning-source="1"]');
    assert.deepEqual(dialogs, []);
    assert.match(await status(page), /^K27 C3 → K27 C3/);

    await page.click('[data-tuning-step="1:1"]');
    const before = await status(page);

    answer = false;
    await page.click('[data-tuning-source="2"]');
    assert.deepEqual(dialogs, ['Load "#2" as the new reference? The tuning steps taken so far are discarded.']);
    assert.equal(await status(page), before, 'cancel keeps the session');
    assert.equal(await page.getAttribute('[data-tuning-source="1"]', 'aria-pressed'), 'true');
    assert.equal(await page.isDisabled('[data-tuning-action="undo"]'), false);

    answer = true;
    await page.click('[data-tuning-source="2"]');
    assert.equal(dialogs.length, 2);
    assert.match(await status(page), /^K96 C5 → K96 C5/, 'confirm loads the new reference');
    assert.equal(await page.getAttribute('[data-tuning-source="2"]', 'aria-pressed'), 'true');
    assert.equal(await page.isDisabled('[data-tuning-action="undo"]'), true);
  });
});

test('manual reference: one click on Load right after typing the last number', async () => {
  await withPage(async page => {
    await openApp(page, '#tuning');
    await page.click('[data-tuning-source="manual"]');
    const field = name => `[data-tuning-field="${name}"]`;
    await page.selectOption(field('needleType'), 'K27');
    await page.selectOption(field('clipPos'), '3');
    await page.selectOption(field('carbSize'), '34');
    await page.selectOption(field('jetType'), 'DQ');
    await page.selectOption(field('needleJet'), '264');
    await page.fill(field('nd'), '50');
    await page.fill(field('hd'), '128'); // still focused: no change event yet
    assert.equal(await page.isDisabled('[data-tuning-action="loadManual"]'), false, 'enabled while typing');
    await page.click('[data-tuning-action="loadManual"]');
    assert.match(await status(page), /^K27 C3 → K27 C3/);
    assert.equal(await page.getAttribute('[data-tuning-source="manual"]', 'aria-pressed'), 'true');
    assert.equal(await page.isDisabled('[data-tuning-action="applyRef"]'), true, 'no slot to overwrite');
  });
});

test('deleting a custom needle drops stale suggestion cards; deleting the current one resets with a notice', async () => {
  // Ranks first for "richer in 1/8–1/4" from K27 C3 (as A1 C4).
  const custom = [{ type: 'A1', carbType: 'VHSx', A: 2.5, B: 1.8, C: 42.5, clips: 4, length: 73.5 }];
  const deleteA1 = page => page.evaluate(() => document.querySelector('.btn-delete-needle[data-type="A1"]').click());
  for (const adoptOther of [true, false]) {
    await withPage(async page => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(c => localStorage.setItem('dellorto_custom_needles', c), JSON.stringify(custom));
      await openTuningWithK27(page);
      await page.click('[data-tuning-step="1:1"]');
      assert.deepEqual((await cardTitles(page))[0], 'A1 · Clip 4');
      assert.ok((await page.$$eval('.tuning-sugg:nth-child(1) .tuning-tag', els => els.map(el => el.textContent))).includes('Custom'));
      if (adoptOther) await page.click('.tuning-sugg:nth-child(2)'); // K96 C5

      await page.click('#tab-calc');
      await deleteA1(page);
      await page.click('#tab-tuning');
      assert.deepEqual(errors, []);
      if (adoptOther) {
        assert.equal(await page.locator('.tuning-sugg').count(), 0, 'stale cards dropped');
        assert.match(await status(page), /K27 C3 → K96 C5/, 'session kept');
      } else {
        assert.equal(await isVisible(page, '#tuning-empty'), true, 'current needle gone → reset');
        assert.equal(await isVisible(page, '#app-notice'), true);
      }
    });
  }
});

test('a jet at its limit shows the reason as text', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    for (let i = 0; i < 10; i++) await page.click('[data-tuning-jet="needleJet:1"]'); // DQ 264 → 274
    assert.equal(await page.isDisabled('[data-tuning-jet="needleJet:1"]'), true);
    assert.match(await page.textContent('tr[data-jet="needleJet"] + tr .tuning-jet-hint'), /largest value reached/);
    assert.ok(await page.getAttribute('tr[data-jet="needleJet"] td:has([data-tuning-jet="needleJet:1"])', 'data-tooltip'));
  });
});

// ── Apply to a setup slot ────────────────────────────────────────────────────

test('apply to a free slot, then overwrite the reference slot and undo it', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    assert.equal(await page.isDisabled('[data-tuning-action="applyFree"]'), true, 'nothing to apply yet');

    await page.click('[data-tuning-step="1:1"]');
    await page.click('[data-tuning-action="applyFree"]');
    let setups = await storedSetups(page);
    assert.deepEqual(
      { name: setups[1].name, needleType: setups[1].needleType, clipPos: setups[1].clipPos, hd: setups[1].hd },
      { name: 'K96 C5', needleType: 'K96', clipPos: 5, hd: 128 });
    assert.equal(setups[0].needleType, 'K27', 'reference slot untouched');
    assert.match(await page.textContent('#tuning-apply-text'), /K96 C5/);
    assert.equal(await isVisible(page, '#btn-tuning-apply-undo'), false, 'no undo for a free slot');

    await page.click('[data-tuning-action="applyRef"]');
    setups = await storedSetups(page);
    assert.equal(setups[0].needleType, 'K96');
    assert.equal(setups[0].clipPos, 5);
    assert.equal(setups[0].name, '#1', 'overwritten slot keeps its name');
    assert.match(await status(page), /^K96 C5 → K96 C5/, 'tuning restarted with the written setup');
    assert.equal(await isVisible(page, '#btn-tuning-apply-undo'), true);

    await page.click('#btn-tuning-apply-undo');
    setups = await storedSetups(page);
    assert.equal(setups[0].needleType, 'K27');
    assert.equal(setups[0].clipPos, 3);
    assert.match(await status(page), /^K27 C3 → K96 C5/, 'tuning session restored');
    assert.equal(await isVisible(page, '#tuning-apply-banner'), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('dellorto_carb_type')), null,
      'applying never writes the carb type');

    await page.click('[data-tuning-action="applyFree"]');
    await page.click('#btn-tuning-view-calc');
    assert.equal(await isVisible(page, '#view-calc'), true);
  });
});

test('apply messages appear in the tab: in view on a phone, errors included, gone on the next reference load', async () => {
  // Visible = inside the viewport and not covered by the sticky tab bar /
  // status line: the element at its centre belongs to the message field.
  const messageVisible = page => page.evaluate(() => {
    const box = document.getElementById('tuning-apply-banner');
    if (box.hidden) return false;
    const r = box.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) return false;
    return box.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });

  await withPage(async page => {
    const tap = await openTuningWithK27(page, { tap: true });
    await tap('[data-tuning-step="1:1"]');
    await tap('[data-tuning-action="applyFree"]');
    assert.equal(await messageVisible(page), true, '360 px: message after "save to free slot" is in view');
    assert.match(await page.textContent('#tuning-apply-text'), /K96 C5/);

    // Overwriting restarts the session (cards disappear, content above
    // shrinks) — the message must still be in view.
    await tap('[data-tuning-step="1:1"]');
    await tap('[data-tuning-action="applyRef"]');
    assert.equal(await messageVisible(page), true, '360 px: message after "overwrite" is in view');
    assert.equal(await isVisible(page, '#btn-tuning-apply-undo'), true);
    assert.equal(await isVisible(page, '#app-notice'), false, 'nothing via showNotice()');
  }, MOBILE);

  await withPage(async page => {
    // Loading a reference clears the message.
    await openApp(page);
    await createK27Setup(page);
    await createSetup(page, 2, { needleType: 'K96', clipPos: 5 });
    await page.click('#tab-tuning');
    await page.click('[data-tuning-source="1"]');
    await page.click('[data-tuning-step="1:1"]');
    await page.click('[data-tuning-action="applyFree"]');
    assert.equal(await isVisible(page, '#tuning-apply-banner'), true);
    await page.click('[data-tuning-source="2"]'); // confirm auto-accepted
    assert.equal(await isVisible(page, '#tuning-apply-banner'), false);
  });
});

test('a validation error when applying shows in the message field, not via showNotice()', async () => {
  const custom = [{ type: 'A1', carbType: 'VHSx', A: 2.5, B: 1.8, C: 42.5, clips: 4, length: 73.5 }];
  await withPage(async page => {
    await page.addInitScript(c => { if (!sessionStorage.seeded) { localStorage.setItem('dellorto_custom_needles', c); sessionStorage.seeded = '1'; } },
      JSON.stringify(custom));
    await openTuningWithK27(page);
    await page.click('[data-tuning-step="1:1"]');
    assert.match(await status(page), /K27 C3 → A1 C4/);
    // Another tab deletes A1 behind this one's back: the next apply finds
    // the needle gone.
    await page.evaluate(() => localStorage.setItem('dellorto_custom_needles', '[]'));
    await page.click('[data-tuning-action="applyFree"]');

    assert.equal(await isVisible(page, '#tuning-apply-banner'), true);
    assert.equal(await page.textContent('#tuning-apply-text'), 'Not saved: invalid value for Needle.');
    assert.equal(await isVisible(page, '#btn-tuning-view-calc'), false);
    assert.equal(await isVisible(page, '#btn-tuning-apply-undo'), false);
    assert.equal(await isVisible(page, '#app-notice'), false);
    assert.equal((await storedSetups(page)).filter(s => s.needleType).length, 1, 'nothing written');

    await page.click('#btn-tuning-apply-close');
    assert.equal(await isVisible(page, '#tuning-apply-banner'), false);
  });
});

// ── i18n, carb type, mobile ──────────────────────────────────────────────────

test('language switch keeps the tuning state, cards and apply banner', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    await page.click('[data-tuning-step="1:1"]');
    await page.click('[data-tuning-action="applyFree"]'); // keeps the session and its cards
    const before = await status(page);

    await page.click('#btn-lang');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'de');
    assert.equal(await status(page), before);
    assert.equal(await page.locator('.tuning-sugg').count(), 3);
    assert.match(await page.textContent('tr[data-range="r1"] .tuning-range-label'), /Gas/);
    assert.equal(await isVisible(page, '#tuning-apply-banner'), true, 'banner survives the language switch');
    assert.match(await page.textContent('#tuning-apply-text'), /übernommen/);
    assert.equal(await page.isDisabled('[data-tuning-action="undo"]'), false);

    await page.click('#btn-lang');
    assert.equal(await status(page), before);
    assert.match(await page.textContent('tr[data-range="r1"] .tuning-range-label'), /throttle/);
  });
});

test('overwrite Undo ends with the next tuning action instead of discarding later steps', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    await page.click('[data-tuning-step="1:1"]');
    await page.click('[data-tuning-action="applyRef"]');
    assert.equal(await isVisible(page, '#btn-tuning-apply-undo'), true);
    await page.click('[data-tuning-step="1:1"]');
    assert.equal(await isVisible(page, '#tuning-apply-banner'), false);
    assert.match(await status(page), /^K96 C5 → /, 'the step after the apply is kept');
  });
});

test('changing the carb type in the calculator resets the tuning state', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    await page.click('[data-tuning-step="1:1"]');
    await page.click('#tab-calc');
    await page.click('input[name="carbType"][value="PHBH"]');
    await page.click('#tab-tuning');
    assert.equal(await isVisible(page, '#tuning-empty'), true);
    assert.equal(await isVisible(page, '#tuning-status'), false);
    assert.match(await page.textContent('#tuning-carb-type'), /PHBH/);
    assert.equal(await page.locator('[data-tuning-source][aria-pressed="true"]').count(), 0);
  });
});

test('mobile: taps, visible reason, sticky status, no horizontal overflow at 320 and 360 px', async () => {
  for (const width of [320, 360]) {
    await withPage(async page => {
      const tap = await openTuningWithK27(page, { tap: true });
      await tap('[data-tuning-step="1:1"]');
      assert.match(await status(page), /K96 C5/, `${width}: tap on + steps`);

      assert.equal(await page.isDisabled('[data-tuning-step="4:1"]'), true);
      assert.equal(await isVisible(page, 'tr[data-range="r4"] .tuning-reason'), true,
        `${width}: reason text visible next to the disabled +`);

      const box = await page.locator('[data-tuning-step="1:1"]').boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, `${width}: ± tap target ${box.width}×${box.height}`);

      // Scroll the range table away: the status line stays in the viewport,
      // just below the sticky tab bar.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForFunction(() => document.getElementById('tuning-status').getBoundingClientRect().top < 100);
      const pos = await page.evaluate(() => {
        const s = document.getElementById('tuning-status').getBoundingClientRect();
        const tabs = document.getElementById('view-tabs').getBoundingClientRect();
        return { top: s.top, bottom: s.bottom, tabsBottom: tabs.bottom, vh: window.innerHeight };
      });
      assert.ok(pos.top >= pos.tabsBottom - 1 && pos.bottom <= pos.vh, `${width}: status in view ${JSON.stringify(pos)}`);

      assert.equal(await noHorizontalOverflow(page), true, `${width}: tab content overflows`);
      const tabsFit = await page.evaluate(() => {
        const nav = document.getElementById('view-tabs');
        return nav.scrollWidth <= nav.clientWidth
          && [...nav.querySelectorAll('[role="tab"]')].every(t => t.getBoundingClientRect().right <= innerWidth + 0.5);
      });
      assert.equal(tabsFit, true, `${width}: view tabs overflow`);
    }, { ...MOBILE, viewport: { width, height: 740 } });
  }
});
