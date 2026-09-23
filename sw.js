// sw.js — Service worker for offline support.
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0
//
// Registered as an ES module ({ type: 'module' }, see registerServiceWorker()
// in js/app.js) so it can import hasShareParams() straight from share.js
// instead of re-implementing the check — the two can't drift apart.
//
// JETTINGCALC_CACHE_VERSION is a generated content hash (see
// scripts/sync-sw-cache-version.mjs) — it must NOT be hand-edited. It is
// kept in sync by running `npm run sync-sw-version` whenever a precached
// file changes, which changes CACHE_NAME and makes the next install()
// populate a fresh cache and the next activate() delete the old one. If
// that step is forgotten, test/sw.test.mjs fails the next `node --test`
// run as the fallback safety net.
//
// Deliberately does NOT call self.skipWaiting() during install: once an
// existing controller is already in place, a newly installed worker is
// meant to sit in `registration.waiting` until the user opts in (see the
// update banner / "Update now" flow in js/app.js), which is what the
// 'message' listener below is for.

import { hasShareParams } from './js/share.js';

export const JETTINGCALC_CACHE_VERSION = '14e1bea5fd8c';
export const CACHE_NAME = `jettingcalc-${JETTINGCALC_CACHE_VERSION}`;

// All paths are relative to this file's own location (the repo root), so
// this works unmodified when the app is deployed to a subdirectory.
export const PRECACHE_URLS = [
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
  './js/needlecatalog.js',
  './js/vendor/chart.umd.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/apple-touch-icon.png',
  './manifest.json',
];

const NETWORK_TIMEOUT_MS = 3000;

// A share link must decode against the current needle database, not a
// stale cached one, so a navigation carrying share params (`?v=...&c=...`,
// same params share.js's hasShareParams() checks for) needs a network-first
// fetch instead of the usual cache-first one.
export function isShareNavigation(url) {
  return hasShareParams(url.search);
}

function networkWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('sw: network timeout')), timeoutMs);
    fetch(request).then(
      response => { clearTimeout(timer); resolve(response); },
      err => { clearTimeout(timer); reject(err); },
    );
  });
}

// Caches `response` under `request` without delaying the response we've
// already decided to return: extends the event's lifetime via waitUntil()
// instead of being awaited inline, so the write can't be dropped by the
// worker being terminated right after respondWith()'s promise settles.
function putInCache(event, request, response) {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, response)));
}

async function networkFirst(event, request) {
  try {
    const response = await networkWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (response?.ok) putInCache(event, request, response.clone());
    return response;
  } catch {
    // A share-link navigation's URL carries `?v=...&c=...` params that
    // never match the precached bare './' entry under a strict same-URL
    // lookup — ignoreSearch falls back to the cached app shell by path
    // alone, which is what we want here regardless of query string.
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw new Error('sw: network-first failed and nothing cached for ' + request.url);
  }
}

async function cacheFirst(event, request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response?.ok) putInCache(event, request, response.clone());
  return response;
}

// Guarded so this module can also be imported under plain Node (see
// test/sw.test.mjs) to unit-test the pure helpers above without a
// ServiceWorkerGlobalScope.
const inServiceWorkerScope = typeof self !== 'undefined' && typeof self.addEventListener === 'function';

if (inServiceWorkerScope) {
  self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(PRECACHE_URLS)),
    );
  });

  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys()
        .then(names => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))))
        .then(() => self.clients.claim()),
    );
  });

  // Lets js/app.js's "Update now" button move a waiting worker into
  // activation on demand, instead of it happening automatically on
  // install (which would make the update banner/registration.waiting
  // check pointless — the new worker would already have taken over by
  // the time either ran).
  self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  });

  self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    if (request.mode === 'navigate') {
      const url = new URL(request.url);
      event.respondWith(isShareNavigation(url) ? networkFirst(event, request) : cacheFirst(event, request));
      return;
    }

    event.respondWith(cacheFirst(event, request));
  });
}
