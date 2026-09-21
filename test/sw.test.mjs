// test/sw.test.mjs — Regression tests for sw.js
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0
//
// Plain Node.js built-in test runner (`node --test`), no dependencies,
// consistent with the project's "no build tool" philosophy. Run with:
//
//   node --test test/
//
// sw.js only registers its install/activate/fetch listeners when it
// detects an actual ServiceWorkerGlobalScope (see `inServiceWorkerScope`
// in sw.js), so importing it here under plain Node is safe and exercises
// just the pure, testable pieces: the cache manifest and the
// share-link-aware navigation check. The caches/fetch event wiring itself
// needs a real browser and is covered by the later Playwright pass.

import test from 'node:test';
import assert from 'node:assert/strict';
import { JETTINGCALC_CACHE_VERSION, CACHE_NAME, PRECACHE_URLS, isShareNavigation } from '../sw.js';
import { hasShareParams, shareParamKeys } from '../js/share.js';

test('CACHE_NAME is derived from JETTINGCALC_CACHE_VERSION', () => {
  assert.equal(CACHE_NAME, `jettingcalc-${JETTINGCALC_CACHE_VERSION}`);
});

test('PRECACHE_URLS covers every file in the specified cache manifest', () => {
  const expected = [
    './',
    './css/style.css',
    './js/app.js',
    './js/calc.js',
    './js/cutaway.js',
    './js/storage.js',
    './js/charts.js',
    './js/i18n.js',
    './js/needledb.js',
    './js/share.js',
    './js/vendor/chart.umd.min.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './manifest.json',
  ];
  assert.deepEqual([...PRECACHE_URLS].sort(), [...expected].sort());
});

test('PRECACHE_URLS entries are all relative (no leading slash), so a subdirectory deploy works', () => {
  for (const url of PRECACHE_URLS) {
    assert.ok(url.startsWith('./'), `expected a relative "./"-prefixed URL, got: ${url}`);
  }
});

test('isShareNavigation: true for a URL carrying share-link params', () => {
  const url = new URL('https://example.com/app/?v=1&c=VHSx&s1=K98-3-30-262-DP-53-175');
  assert.equal(isShareNavigation(url), true);
});

test('isShareNavigation: false for a plain navigation with no query string', () => {
  const url = new URL('https://example.com/app/');
  assert.equal(isShareNavigation(url), false);
});

test('isShareNavigation: false for unrelated query params only', () => {
  const url = new URL('https://example.com/app/?utm_source=newsletter&ref=abc');
  assert.equal(isShareNavigation(url), false);
});

test('isShareNavigation: true even if only "v" is present (matches hasShareParams exactly)', () => {
  const url = new URL('https://example.com/app/?v=1');
  assert.equal(isShareNavigation(url), true);
});

// The whole point of importing hasShareParams() into sw.js instead of
// re-implementing the check is that the two can never drift apart — so
// assert that directly, across a range of URLs, rather than just trusting
// the wiring by inspection.
test('isShareNavigation stays in sync with share.js hasShareParams() across sample URLs', () => {
  const urls = [
    'https://example.com/app/',
    'https://example.com/app/?v=1&c=VHSx&s1=K98-3-30-262-DP-53-175&n1=Test',
    'https://example.com/app/?c=VHSx', // c without v: share.js still only keys off v
    'https://example.com/app/?v=', // v present but empty
    'https://example.com/app/?other=1',
    'https://example.com/app/?' + shareParamKeys().map(k => `${k}=x`).join('&'),
  ];
  for (const raw of urls) {
    const url = new URL(raw);
    assert.equal(isShareNavigation(url), hasShareParams(url.search), `mismatch for ${raw}`);
  }
});

test('sw.js imports cleanly under plain Node (no self/caches in this scope)', () => {
  // sw.js guards its self.addEventListener(...) calls behind a
  // ServiceWorkerGlobalScope check; if that guard were missing, the
  // `import` at the top of this file would have thrown already. Assert
  // the precondition explicitly so a future refactor that removes the
  // guard fails loudly here instead of only in a browser.
  assert.equal(typeof self, 'undefined');
});
