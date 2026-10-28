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
//   npx playwright install chromium   # first time and after every Playwright update
//   node --test test-browser/*.mjs
//
// Each Playwright version expects its own Chromium build, so run the install
// step again after every Playwright update. Alternatively, set CHROMIUM_PATH
// to launch a preinstalled Chromium or Chrome — for environments that can't
// download the browser.
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
// The fitting box shows "Fit: Needle K27 → K96 · Clip 3 → 5 · ND 50 ·
// HD 128 · DQ 264" (changed parts as "ref → new"). Most tests only care
// about reference and current state, so this folds it into the compact
// form "K27 C3 → K96 C5 · ND 50 · HD 128 · DQ 264" (current jet values).
// The visible format itself is checked in "fitting box".
const fitText = page => page.textContent('#tuning-status');
const status = async page => {
  const text = (await fitText(page)).replace(/^[^:]*:\s*/, '');
  const pair = part => {
    const [a, b] = part.split(' → ');
    return [a, b ?? a];
  };
  const [needle, clip, nd, hd, atom] = text.split(' · ').map(pair);
  const last = v => v.split(' ').at(-1);
  const [refNeedle, curNeedle] = needle.map(last);
  const [refClip, curClip] = clip.map(last);
  // An unchanged atomizer reads "DQ 264"; a changed one "DQ 264 → DQ 266".
  return `${refNeedle} C${refClip} → ${curNeedle} C${curClip} · ND ${last(nd[1])} · HD ${last(hd[1])} · ${atom[1]}`;
};
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

// Replaces withPage()'s auto-accept: every dialog is recorded and answered
// with `accept`.
function answerDialogs(page, accept) {
  const messages = [];
  page.removeAllListeners('dialog');
  page.on('dialog', d => { messages.push(d.message()); return accept ? d.accept() : d.dismiss(); });
  return messages;
}

// Changes the HD of calculator row 1 behind the tuning session's back.
async function editRefSlotHd(page, hd) {
  await page.click('#tab-calc');
  await page.fill('tr[data-row-id="1"] [data-field="hd"]', String(hd));
  await page.press('tr[data-row-id="1"] [data-field="hd"]', 'Tab');
  await page.click('#tab-tuning');
}

test('overwrite asks first when the reference slot was changed in the calculator; cancel keeps the slot', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    await page.click('[data-tuning-step="1:1"]');
    await editRefSlotHd(page, 130);

    let dialogs = answerDialogs(page, false);
    await page.click('[data-tuning-action="applyRef"]');
    assert.equal(dialogs.length, 1);
    assert.match(dialogs[0], /"#1" was changed in the calculator/);
    let setups = await storedSetups(page);
    assert.deepEqual([setups[0].needleType, setups[0].hd], ['K27', 130], 'cancel keeps the calculator edit');
    assert.equal(await isVisible(page, '#tuning-apply-banner'), false);

    dialogs = answerDialogs(page, true);
    await page.click('[data-tuning-action="applyRef"]');
    assert.equal(dialogs.length, 1);
    setups = await storedSetups(page);
    assert.deepEqual([setups[0].needleType, setups[0].clipPos, setups[0].hd], ['K96', 5, 128]);
  });

  // Unchanged slot: no question.
  await withPage(async page => {
    await openTuningWithK27(page);
    const dialogs = answerDialogs(page, true);
    await page.click('[data-tuning-step="1:1"]');
    await page.click('[data-tuning-action="applyRef"]');
    assert.equal(dialogs.length, 0);
    assert.equal((await storedSetups(page))[0].needleType, 'K96');
  });
});

test('overwrite is disabled with a visible reason once the reference slot was cleared', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    await page.click('[data-tuning-step="1:1"]');
    await page.click('#tab-calc');
    await page.click('tr[data-row-id="1"] [data-action="reset-row"]'); // confirm auto-accepted
    await page.click('#tab-tuning');

    assert.equal(await page.isDisabled('[data-tuning-action="applyRef"]'), true);
    const hints = await page.$$eval('#tuning-actions .tuning-hint', els => els.map(el => el.textContent));
    assert.ok(hints.some(h => /reference slot was cleared/.test(h)), `hints: ${hints}`);
    assert.equal(await page.isDisabled('[data-tuning-action="applyFree"]'), false, 'a free slot still works');
  });
});

test('a free slot is named after the needle plus every jet that differs from the reference', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    await page.click('[data-tuning-step="1:1"]');
    await page.click('[data-tuning-jet="nd:-1"]');
    await page.click('[data-tuning-jet="hd:1"]');
    await page.click('[data-tuning-jet="needleJet:1"]');
    await page.click('[data-tuning-action="applyFree"]');
    const slot = (await storedSetups(page))[1];
    assert.equal(slot.name, `K96 C5 ND49 HD129 DQ${slot.needleJet}`);
    assert.notEqual(slot.needleJet, 264);
    assert.ok(slot.name.length <= 30);
  });
});

test('cards: the target cell alone shows the change of this step, against the state before it', async () => {
  const num = text => parseFloat(text.replace('−', '-'));
  const targetCells = page => page.$$eval('.tuning-sugg', cards => cards.map(card => {
    const cells = [...card.querySelectorAll('.tuning-mini-cell')];
    const step = card.querySelectorAll('.tuning-mini-step');
    const cell = step[0]?.closest('.tuning-mini-cell');
    return {
      count: step.length, index: cells.indexOf(cell), isTarget: cell?.classList.contains('is-target'),
      value: cell?.querySelector('.tuning-mini-val').textContent,
      step: step[0]?.lastElementChild.textContent, tooltip: step[0]?.dataset.tooltip,
    };
  }));

  await withPage(async page => {
    await openTuningWithK27(page);
    await page.click('[data-tuning-step="1:1"]');
    for (const c of await targetCells(page)) {
      assert.deepEqual([c.count, c.index, c.isTarget], [1, 1, true]);
      assert.equal(c.step, c.value, 'first step from the reference: step = total');
      assert.ok(c.tooltip);
    }

    const before = num(await flowText(page, 'r1'));
    await page.click('[data-tuning-step="1:1"]');
    for (const c of await targetCells(page)) {
      assert.ok(Math.abs(num(c.value) - before - num(c.step)) <= 0.11,
        `step ${c.step} ≠ ${c.value} − ${before}`);
    }
    assert.notEqual((await targetCells(page))[0].step, (await targetCells(page))[0].value);
  });
});

test('0–1/8 row: without a reason the line says ± changes the needle — one line, EN and DE, 320 and 768 px', async () => {
  for (const [lang, hint] of [['en', '± changes the needle · ND: see below'], ['de', '± wechselt die Nadel · ND: siehe unten']]) {
    for (const width of [320, 768]) {
      await withPage(async page => {
        await page.addInitScript(l => localStorage.setItem('dellorto_lang', l), lang);
        await openTuningWithK27(page);
        const lines = await page.$$eval('.tuning-reason', els => els.map(el =>
          ({ text: el.textContent, fits: el.scrollWidth <= el.clientWidth })));
        assert.deepEqual(lines[0], { text: hint, fits: true }, `${lang} ${width}`);
        assert.ok(lines.slice(1).every(l => l.text !== hint), 'only the 0–1/8 row');
      }, { viewport: { width, height: 800 } });
    }
  }
});

// ── Guidance: steps bar, fitting box, lever line, model explanation ─────────

test('steps bar: 1 → 2 → 3 with ✓ for finished steps, same height in every step', async () => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 360, height: 740 }]) {
    await withPage(async page => {
      await openApp(page);
      await createK27Setup(page);
      await page.click('#tab-tuning');
      const state = () => page.evaluate(() => ({
        current: document.querySelector('#tuning-steps [aria-current="step"]')?.textContent,
        done: document.querySelectorAll('#tuning-steps .tuning-step.is-done').length,
        visibleText: [...document.querySelectorAll('.tuning-steps-text')]
          .filter(p => getComputedStyle(p).visibility === 'visible').map(p => p.textContent),
        height: document.getElementById('tuning-steps').getBoundingClientRect().height,
      }));
      const s1 = await state();
      assert.match(s1.current, /^1Pick reference/);
      assert.equal(s1.done, 0);
      assert.deepEqual(s1.visibleText, ['Pick the setup that is in the carburetor right now.']);
      await page.click('[data-tuning-source="1"]');
      const s2 = await state();
      assert.match(s2.current, /^2Adjust range/);
      assert.equal(s2.done, 1);
      assert.match(s2.visibleText[0], /^Is the engine too rich or too lean/);
      await page.click('[data-tuning-step="1:1"]');
      const s3 = await state();
      assert.match(s3.current, /^3Apply/);
      assert.equal(s3.done, 2);
      await page.click('[data-tuning-action="reset"]');
      const s4 = await state();
      assert.match(s4.current, /^2/, 'back to step 2 after reset');
      for (const s of [s2, s3, s4]) {
        assert.ok(Math.abs(s.height - s1.height) <= 0.5, `${viewport.width}: steps bar ${s.height} vs ${s1.height}`);
      }
    }, { viewport });
  }
});

test('fitting box: what to fit with ref → new for changed parts, note or jump to the cards', async () => {
  await withPage(async page => {
    await openTuningWithK27(page);
    assert.equal(await fitText(page), 'Fit: Needle K27 · Clip 3 · ND 50 · HD 128 · DQ 264');
    assert.equal(await page.textContent('#tuning-fit-extra'), 'nothing changed yet, same as the reference');
    await page.click('[data-tuning-step="1:1"]');
    assert.equal(await fitText(page), 'Fit: Needle K27 → K96 · Clip 3 → 5 · ND 50 · HD 128 · DQ 264');
    assert.deepEqual(await page.$$eval('#tuning-status .is-changed', els => els.map(el => el.textContent)), ['K96', '5']);
    assert.equal(await page.textContent('[data-tuning-action="viewOptions"]'), 'View options (3) ↓');
    const y0 = await page.evaluate(() => window.scrollY);
    await page.click('[data-tuning-action="viewOptions"]');
    await page.waitForFunction(y => {
      const r = document.getElementById('tuning-alternatives').getBoundingClientRect();
      return window.scrollY > y && r.top >= 0 && r.top < innerHeight;
    }, y0);
    await page.click('[data-tuning-jet="nd:1"]');
    assert.equal(await fitText(page), 'Fit: Needle K27 → K96 · Clip 3 → 5 · ND 50 → 51 · HD 128 · DQ 264');
    assert.equal(await page.locator('[data-tuning-action="viewOptions"]').count(), 0, 'no cards after a jet step');
  });
});

test('lever line: which part meters each range, from the model; fits one line at 320 and 768 px', async () => {
  const expected = {
    en: ['acts: ND 80 % · needle/atomizer 20 %', 'acts: ND 23 % · needle/atomizer 77 %',
      'acts: needle/atomizer 60 % · HD 40 %', 'acts: HD', 'acts: HD'],
    de: ['wirkt: ND 80 % · Nadel/MR 20 %', 'wirkt: ND 23 % · Nadel/MR 77 %',
      'wirkt: Nadel/MR 60 % · HD 40 %', 'wirkt: HD', 'wirkt: HD'],
  };
  for (const lang of ['en', 'de']) {
    for (const width of [320, 768, 1280]) {
      await withPage(async page => {
        await page.addInitScript(l => localStorage.setItem('dellorto_lang', l), lang);
        await openTuningWithK27(page);
        const lines = await page.$$eval('.tuning-lever', els => els.map(el =>
          ({ text: el.textContent, fits: el.scrollWidth <= el.clientWidth })));
        assert.deepEqual(lines.map(l => l.text), expected[lang], `${lang} ${width}`);
        assert.ok(lines.every(l => l.fits), `${lang} ${width}: ${JSON.stringify(lines)}`);
        // HD + far enough: in 3/4–1 the needle takes over from the HD.
        const r4 = () => page.textContent('tr[data-range="r4"] .tuning-lever');
        let steps = 0;
        while (/HD$/.test(await r4()) && steps++ < 120) await page.click('[data-tuning-jet="hd:1"]');
        assert.match(await r4(), lang === 'en' ? /^acts: needle\/atomizer \d+ % · HD \d+ %$/ : /^wirkt: Nadel\/MR \d+ % · HD \d+ %$/);
      }, { viewport: { width, height: 800 } });
    }
  }
});

test('± buttons: direction word from 601 px on, symbol only on phones; Ø columns and bar legend', async () => {
  for (const [width, words] of [[1280, true], [768, true], [601, true], [600, false], [360, false]]) {
    await withPage(async page => {
      await page.addInitScript(() => localStorage.setItem('dellorto_lang', 'de'));
      await openTuningWithK27(page);
      assert.equal(await page.isVisible('[data-tuning-step="1:1"] .tuning-step-word'), words, `${width}`);
      if (words) assert.equal(await page.textContent('[data-tuning-step="1:-1"] .tuning-step-word'), 'magerer');
      const box = await page.locator('[data-tuning-step="1:1"]').boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, `${width}: tap target ${box.width}×${box.height}`);
      assert.equal(await page.isVisible('.tuning-bar-legend >> visible=true'), true, `${width}: a bar legend is visible`);
      assert.equal(await noHorizontalOverflow(page), true, `${width}: overflow`);
    }, { viewport: { width, height: 800 } });
  }
  await withPage(async page => {
    await page.addInitScript(() => localStorage.setItem('dellorto_lang', 'de'));
    await openTuningWithK27(page);
    const heads = await page.$$eval('#tuning-ranges thead th', els => els.map(el => el.textContent.trim()));
    assert.equal(heads[1], 'Ref Ø');
    assert.match(heads[2], /^Aktuell Ø/);
    assert.match(heads[4], /◀ magerer.*Referenz.*fetter ▶/);
    assert.ok(await page.getAttribute('#tuning-ranges thead .cutaway-info', 'data-tooltip'));
  }, { viewport: { width: 1280, height: 800 } });
});

test('model explanation: closed by default in the jets block, survives re-renders when opened', async () => {
  await withPage(async page => {
    await page.addInitScript(() => localStorage.setItem('dellorto_lang', 'de'));
    await openTuningWithK27(page);
    assert.equal(await page.getAttribute('#tuning-explain', 'open'), null);
    await page.click('#tuning-explain summary');
    assert.match(await page.textContent('#tuning-explain'), /√\(MR² − Nadel-Ø²\)/);
    await page.click('[data-tuning-jet="hd:1"]');
    assert.notEqual(await page.getAttribute('#tuning-explain', 'open'), null, 'still open after a step');
    const order = await page.evaluate(() => {
      const top = id => document.getElementById(id).getBoundingClientRect().top;
      return top('tuning-jets') < top('tuning-explain') && top('tuning-explain') < top('tuning-actions');
    });
    assert.equal(order, true, 'between jets and actions');
  }, { viewport: { width: 1280, height: 800 } });
});

// updateUI() reads the needle data once per pass (readNeedleSnapshot() in
// app.js) and hands it to every renderer; before, one pass read the custom
// needles 15 (calculator), 19 (catalog) or 17 (fine tuning) times.
const MAX_CUSTOM_NEEDLE_READS_PER_UPDATE = 1;

test(`one updateUI() reads the custom needles at most ${MAX_CUSTOM_NEEDLE_READS_PER_UPDATE}× — calculator, catalog and fine tuning`, async () => {
  const custom = JSON.stringify([{ type: 'Z1', carbType: 'VHSx', A: 2.5, B: 1.75, C: 43, clips: 4, length: 73.5 }]);
  for (const view of ['calc', 'needles', 'tuning']) {
    await withPage(async page => {
      await page.addInitScript(() => {
        window.__reads = {};
        const getItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
          window.__reads[key] = (window.__reads[key] ?? 0) + 1;
          return getItem.call(this, key);
        };
      });
      await page.addInitScript(c => localStorage.setItem('dellorto_custom_needles', c), custom);
      await openTuningWithK27(page); // K27 in row 1, reference loaded
      await page.click('[data-tuning-step="1:1"]');
      if (view === 'calc') await page.click('#tab-calc');
      if (view === 'needles') await page.click('#tab-catalog');

      // Exactly one updateUI(): an ND edit (its handler reads no needles).
      await page.evaluate(() => { window.__reads = {}; });
      await page.evaluate(() => {
        const nd = document.querySelector('#setup-tbody tr[data-row-id="1"] [data-field="nd"]');
        nd.value = '51';
        nd.dispatchEvent(new Event('change', { bubbles: true }));
      });
      const reads = await page.evaluate(() => window.__reads);
      assert.ok((reads.dellorto_custom_needles ?? 0) <= MAX_CUSTOM_NEEDLE_READS_PER_UPDATE,
        `${view}: ${JSON.stringify(reads)}`);
      assert.equal((await storedSetups(page))[0].nd, 51, `${view}: the edit went through`);
    });
  }
});

// ── Layout stability ─────────────────────────────────────────────────────────

// No control may move under the pointer: whatever changes height through
// interaction sits below the last control or in a slot of fixed height.
const CONTROLS = '#view-tuning [data-tuning-step], #view-tuning [data-tuning-jet], #view-tuning [data-tuning-action]';
const controlTops = page => page.evaluate(sel => Object.fromEntries([...document.querySelectorAll(sel)]
  .map(b => [b.dataset.tuningStep ?? b.dataset.tuningJet ?? b.dataset.tuningAction, b.getBoundingClientRect().top])), CONTROLS);

for (const [name, contextOptions, lang] of [
  ['1280×800', { viewport: { width: 1280, height: 800 } }, 'en'],
  ['768×1024 German', { viewport: { width: 768, height: 1024 } }, 'de'],
  ['360×740 mobile', MOBILE, 'en'],
]) {
  test(`layout stability (${name}): steps, undo, jet steps and apply never move a control`, async () => {
    await withPage(async page => {
      if (lang === 'de') await page.addInitScript(() => localStorage.setItem('dellorto_lang', 'de'));
      const mobile = !!contextOptions.hasTouch;
      const press = await openTuningWithK27(page, { tap: mobile });
      // Scroll the next target to the middle of the viewport first (so the
      // click itself needn't scroll), then measure, then press: the pointer
      // stays where it was, so any change is a layout shift.
      const event = async (label, selector) => {
        await page.evaluate(sel => new Promise(resolve => {
          document.querySelector(sel).scrollIntoView({ block: 'center' });
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }), selector);
        const before = await controlTops(page);
        await press(selector);
        const after = await controlTops(page);
        for (const [key, top] of Object.entries(before)) {
          if (!(key in after)) continue;
          assert.ok(Math.abs(after[key] - top) <= 1,
            `${name}, ${label}: control ${key} moved from ${top} to ${after[key]}`);
        }
      };

      // a) Needle step with side-effect warning: r3 leaner → K58 C2.
      await event('a) needle step with warning', '[data-tuning-step="3:-1"]');
      assert.match(await status(page), /K27 C3 → K58 C2/);
      assert.equal(await page.locator('#tuning-fit #tuning-warning').count(), 1,
        'warning sits in the fitting box');
      assert.equal(await page.locator('#tuning-alternatives #tuning-warning').count(), 0);
      const flaggedRows = await page.$$eval('tr[data-range]:not(.is-last-step) .tuning-side-flag', els => els.length);
      assert.ok(flaggedRows >= 1, 'a "shifted too" chip marks at least one row besides the target');
      assert.equal(await page.locator('tr.is-last-step .tuning-side-flag').count(), 0, 'no chip on the target row');
      assert.ok(await page.getAttribute('tr[data-range]:not(.is-last-step) .tuning-side-flag >> nth=0', 'aria-label'));

      // b) Step back: warning, cards and flags disappear.
      await event('b) step back', '[data-tuning-action="undo"]');
      assert.equal(await page.locator('#tuning-warning').count(), 0);
      assert.equal(await page.locator('.tuning-side-flag').count(), 0);

      // Cards again, so the jet steps below have something to remove.
      await event('needle step', '[data-tuning-step="1:1"]');
      assert.equal(await page.locator('.tuning-sugg').count(), 3);

      // c) HD + twice: cards go, HD-limited badges and hints change.
      await event('c) HD + (1)', '[data-tuning-jet="hd:1"]');
      await event('c) HD + (2)', '[data-tuning-jet="hd:1"]');
      assert.equal(await page.locator('.tuning-sugg').count(), 0);
      assert.match(await status(page), /HD 130/);

      // d) Apply to a free slot: the message appears below the buttons.
      await event('d) apply to free slot', '[data-tuning-action="applyFree"]');
      assert.equal(await isVisible(page, '#tuning-apply-banner'), true);
      const [buttonsBottom, messageTop] = await page.evaluate(() => [
        document.getElementById('tuning-actions').getBoundingClientRect().bottom,
        document.getElementById('tuning-apply-banner').getBoundingClientRect().top,
      ]);
      assert.ok(messageTop >= buttonsBottom - 1, 'message field below the action buttons');
    }, contextOptions);
  });
}

for (const [name, contextOptions] of [
  ['320 px (grid)', { ...MOBILE, viewport: { width: 320, height: 740 } }],
  ['768 px (table)', { viewport: { width: 768, height: 1024 } }],
]) test(`${name}, German: every reason text under the bar fits one line, no horizontal overflow`, async () => {
  await withPage(async page => {
    await page.addInitScript(() => localStorage.setItem('dellorto_lang', 'de'));
    await openTuningWithK27(page, { tap: !!contextOptions.hasTouch });
    assert.equal(await noHorizontalOverflow(page), true, `${name}: page overflows`);
    // Every text tuningReasonLine() can produce, built from the live
    // translations, measured in a real reason line of the table.
    const results = await page.evaluate(async () => {
      const { t } = await import('./js/i18n.js');
      const fill = (tpl, map) => Object.entries(map).reduce((str, [k, v]) => str.replace(`{${k}}`, v), tpl);
      const dir = d => t(d > 0 ? 'tuning.dir.richer' : 'tuning.dir.leaner');
      const texts = [];
      for (const reason of ['hdLimited', 'noCandidates']) {
        texts.push(t(`tuning.reasonShort.${reason}`));
        for (const d of [-1, 1]) texts.push(fill(t('tuning.reasonLine'), { dir: dir(d), reason: t(`tuning.reasonShort.${reason}`) }));
      }
      for (const [lean, rich] of [['hdLimited', 'noCandidates'], ['noCandidates', 'hdLimited']]) {
        texts.push([fill(t('tuning.reasonLine'), { dir: dir(-1), reason: t(`tuning.reasonTiny.${lean}`) }),
          fill(t('tuning.reasonLine'), { dir: dir(1), reason: t(`tuning.reasonTiny.${rich}`) })].join(' · '));
      }
      const el = document.querySelector('tr[data-range="r4"] .tuning-reason');
      const original = el.textContent;
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      const out = texts.map(text => {
        el.textContent = text;
        return { text, height: el.getBoundingClientRect().height, lineHeight, overflow: el.scrollWidth - el.clientWidth };
      });
      el.textContent = original;
      return out;
    });
    assert.equal(results.length, 8);
    for (const r of results) {
      assert.ok(r.height <= r.lineHeight + 1, `"${r.text}" is ${r.height} px high`);
      assert.ok(r.overflow <= 0, `"${r.text}" overflows its line by ${r.overflow} px`);
    }
  }, contextOptions);
});

// ── HD lever badge ───────────────────────────────────────────────────────────

test('HD "lever" badge works like ⓘ: tap and Enter/Space open its tooltip with the ranges', async () => {
  await withPage(async page => {
    await openTuningWithK27(page, { tap: true });
    const badge = 'tr[data-jet="hd"] .tuning-badge';
    assert.equal(await page.getAttribute(badge, 'role'), 'button');
    assert.equal(await page.getAttribute(badge, 'tabindex'), '0');
    const tooltip = () => page.evaluate(() => {
      const box = document.querySelector('.tooltip-box');
      return box.hidden ? null : box.textContent;
    });

    await page.tap(badge);
    const text = await tooltip();
    assert.ok(text, 'tap opens the tooltip');
    assert.match(text, /1\/2–3\/4.*3\/4–1/, 'tooltip names the HD-limited ranges');

    await page.tap('#tuning-status'); // tap elsewhere closes it
    assert.equal(await tooltip(), null);

    await page.focus(badge);
    await page.keyboard.press('Enter');
    assert.equal(await tooltip(), text);
    await page.keyboard.press(' ');
    assert.equal(await tooltip(), null);
  }, MOBILE);
});

// ── Scroll-clamp spacer ──────────────────────────────────────────────────────

for (const [name, contextOptions] of [
  ['360×740 mobile', MOBILE],
  ['1280×800', { viewport: { width: 1280, height: 800 } }],
]) {
  test(`scroll-clamp spacer (${name}): at the page end ± never moves, spacer bounded, released on scroll-up and reset`, async () => {
    await withPage(async page => {
      await openTuningWithK27(page, { tap: !!contextOptions.hasTouch });
      const spacerHeight = () => page.evaluate(() => document.getElementById('tuning-scroll-spacer').getBoundingClientRect().height);
      const variantsHeight = () => page.evaluate(() => document.getElementById('tuning-alternatives').getBoundingClientRect().height);
      const stepTops = () => page.evaluate(() => Object.fromEntries(
        [...document.querySelectorAll('#view-tuning [data-tuning-step], #view-tuning [data-tuning-jet]')]
          .map(b => [b.dataset.tuningStep ?? b.dataset.tuningJet, b.getBoundingClientRect().top])));
      const toEnd = () => page.evaluate(() => new Promise(resolve => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }));

      assert.deepEqual(await page.evaluate(() => {
        const el = document.getElementById('tuning-scroll-spacer');
        return [el.getAttribute('aria-hidden'), el.children.length, el.textContent];
      }), ['true', 0, ''], 'spacer is aria-hidden and empty');

      let maxVariants = await variantsHeight();
      // Needle +, HD +, needle +, HD +, needle −, HD −. The page end is
      // far below the ± buttons, so they are pressed without scrolling.
      const steps = ['[data-tuning-step="1:1"]', '[data-tuning-jet="hd:1"]', '[data-tuning-step="1:1"]',
        '[data-tuning-jet="hd:1"]', '[data-tuning-step="1:-1"]', '[data-tuning-jet="hd:-1"]'];
      let sawSpacer = false;
      for (const [n, selector] of steps.entries()) {
        await toEnd();
        assert.equal(await page.isDisabled(selector), false, `step ${n + 1}: ${selector} available`);
        const before = await stepTops();
        await page.evaluate(sel => document.querySelector(sel).click(), selector);
        const after = await stepTops();
        for (const [key, top] of Object.entries(before)) {
          assert.ok(Math.abs(after[key] - top) <= 1, `${name}, step ${n + 1} (${selector}): ${key} moved ${top} → ${after[key]}`);
        }
        maxVariants = Math.max(maxVariants, await variantsHeight());
        const spacer = await spacerHeight();
        if (spacer > 0) sawSpacer = true;
        assert.ok(spacer <= maxVariants + 0.5, `step ${n + 1}: spacer ${spacer} > largest suggestions area ${maxVariants}`);
      }
      assert.ok(sawSpacer, 'the spacer was needed at least once (cards removed at the page end)');

      // Scrolling up releases what is no longer needed …
      await page.evaluate(() => new Promise(resolve => {
        window.scrollTo(0, 0);
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }));
      assert.equal(await spacerHeight(), 0, 'released after scrolling up');
      // … and "Reset" leaves it at 0.
      await page.evaluate(() => document.querySelector('[data-tuning-action="reset"]').click());
      assert.equal(await spacerHeight(), 0, 'reset: spacer 0');

      // A tab switch releases it as well, even at the page end.
      await page.evaluate(() => document.querySelector('[data-tuning-step="1:1"]').click());
      await toEnd();
      await page.evaluate(() => document.querySelector('[data-tuning-jet="hd:1"]').click());
      await page.evaluate(() => document.getElementById('tab-calc').click());
      assert.equal(await spacerHeight(), 0, 'tab switch: spacer 0');
    }, contextOptions);
  });
}

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
