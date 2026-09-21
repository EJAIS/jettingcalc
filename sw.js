// sw.js — Service worker for offline support.
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0
//
// Registered as an ES module ({ type: 'module' }, see registerServiceWorker()
// in js/app.js) so it can import hasShareParams() straight from share.js
// instead of re-implementing the check — the two can't drift apart.
//
// Bump JETTINGCALC_CACHE_VERSION on any release that changes js/needledb.js
// or adds/removes a file from PRECACHE_URLS: it changes CACHE_NAME, which
// makes the next install() populate a fresh cache and the next activate()
// delete the old one.
//
// Deliberately does NOT call self.skipWaiting() during install: once an
// existing controller is already in place, a newly installed worker is
// meant to sit in `registration.waiting` until the user opts in (see the
// update banner / "Update now" flow in js/app.js), which is what the
// 'message' listener below is for.

import { hasShareParams } from './js/share.js';

export const JETTINGCALC_CACHE_VERSION = 'v1';
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
  './js/vendor/chart.umd.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
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

async function networkFirst(request) {
  try {
    const response = await networkWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (response?.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('sw: network-first failed and nothing cached for ' + request.url);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response?.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
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
      event.respondWith(isShareNavigation(url) ? networkFirst(request) : cacheFirst(request));
      return;
    }

    event.respondWith(cacheFirst(request));
  });
}
