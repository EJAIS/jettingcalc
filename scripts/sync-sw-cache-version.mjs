// scripts/sync-sw-cache-version.mjs — Derives JETTINGCALC_CACHE_VERSION in
// sw.js from the actual content of every precached file, so a forgotten
// manual bump after changing a precached file (e.g. js/needledb.js) can no
// longer silently ship a stale service-worker cache.
//
// Zero dependencies (node:crypto, node:fs, node:path only), consistent
// with the project's no-build-tool philosophy. Run with:
//
//   npm run sync-sw-version
//
// test/sw.test.mjs asserts JETTINGCALC_CACHE_VERSION === computeCacheVersion()
// on every `node --test` run — that assertion is the real safety net; this
// script is just the tool that keeps the value in sync.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PRECACHE_URLS } from '../sw.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const SW_PATH = path.join(REPO_ROOT, 'sw.js');

// './' is the app shell request, served from index.html; every other entry
// is a relative "./..." path to strip down to a repo-root-relative path.
function precacheUrlToRelativePath(url) {
  return url === './' ? 'index.html' : url.replace(/^\.\//, '');
}

// Hashes both the relative path string and the file's bytes for each entry,
// so a same-content-different-path collision still changes the version.
export function computeCacheVersion() {
  const hash = createHash('sha256');
  for (const url of PRECACHE_URLS) {
    const relativePath = precacheUrlToRelativePath(url);
    const bytes = readFileSync(path.join(REPO_ROOT, relativePath));
    hash.update(relativePath);
    hash.update(bytes);
  }
  return hash.digest('hex').slice(0, 12);
}

function isRunDirectly() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isRunDirectly()) {
  const version = computeCacheVersion();
  const original = readFileSync(SW_PATH, 'utf8');
  const pattern = /export const JETTINGCALC_CACHE_VERSION = '[^']*';/;
  if (!pattern.test(original)) {
    throw new Error("sync-sw-cache-version: couldn't find JETTINGCALC_CACHE_VERSION line in sw.js");
  }
  const updated = original.replace(pattern, `export const JETTINGCALC_CACHE_VERSION = '${version}';`);

  if (updated === original) {
    console.log(`sw.js JETTINGCALC_CACHE_VERSION already current (${version})`);
  } else {
    writeFileSync(SW_PATH, updated);
    console.log(`sw.js JETTINGCALC_CACHE_VERSION updated to ${version}`);
  }
}
