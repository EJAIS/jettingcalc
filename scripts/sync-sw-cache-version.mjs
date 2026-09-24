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

// Extensions whose content is hashed with CRLF normalized to LF, so a
// Windows checkout that converted line endings (core.autocrlf, an editor
// saving CRLF) computes the same version as the LF bytes the server
// actually ships. .gitattributes enforces LF in the repo; this keeps the
// hash stable even where a working tree ignores that. Everything else
// (e.g. .png, .ico) is binary, where a CR LF byte pair is real data and
// must not be touched.
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.md']);

function isTextFile(relativePath) {
  return TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

// Replaces every CR LF byte pair with a single LF; a lone CR is left as is.
// Returns the input unchanged when there is nothing to replace, so LF files
// hash byte-for-byte as they did before normalization existed.
function normalizeLineEndings(bytes) {
  if (!bytes.includes(0x0d)) return bytes;
  const out = Buffer.allocUnsafe(bytes.length);
  let length = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a) continue;
    out[length++] = bytes[i];
  }
  return out.subarray(0, length);
}

// Pure core of computeCacheVersion(), exported so the normalization rules
// can be tested without touching the file system. Hashes both the relative
// path string and the file's bytes for each entry, so a
// same-content-different-path collision still changes the version.
export function hashEntries(entries) {
  const hash = createHash('sha256');
  for (const { relativePath, bytes } of entries) {
    hash.update(relativePath);
    hash.update(isTextFile(relativePath) ? normalizeLineEndings(bytes) : bytes);
  }
  return hash.digest('hex').slice(0, 12);
}

export function computeCacheVersion() {
  return hashEntries(PRECACHE_URLS.map(url => {
    const relativePath = precacheUrlToRelativePath(url);
    return { relativePath, bytes: readFileSync(path.join(REPO_ROOT, relativePath)) };
  }));
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
