// test/docker.test.mjs — Guards the container image's file list
// Copyright (C) 2014 GUE — GPL v2.0
//
// The Dockerfile copies only the runtime files into the image, and
// .dockerignore is an allowlist for the build context. Both are hand-written
// lists, so a new runtime file (e.g. a new js/ module or icon outside the
// copied directories) could be added to sw.js's PRECACHE_URLS without
// reaching the image — the app would then 404 in production only. This test
// fails instead. Building and serving the image itself is checked in CI
// (.github/workflows/docker.yml, smoke test).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRECACHE_URLS } from '../sw.js';

const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const dockerignore = readFileSync(new URL('../.dockerignore', import.meta.url), 'utf8')
  .split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));

const WEB_ROOT = '/usr/share/nginx/html/';

// Sources of every `COPY … <dest under WEB_ROOT>` line (continuation lines
// are not used in the Dockerfile's COPY instructions).
function copiedSources() {
  const sources = [];
  for (const line of dockerfile.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] !== 'COPY') continue;
    const args = parts.slice(1).filter(arg => !arg.startsWith('--'));
    const dest = args.at(-1);
    if (!dest.startsWith(WEB_ROOT)) continue;
    sources.push(...args.slice(0, -1));
  }
  return sources;
}

// Files the browser needs: everything precached ('./' is index.html) plus
// the service worker itself.
function runtimeFiles() {
  const files = PRECACHE_URLS.map(url => (url === './' ? 'index.html' : url.replace(/^\.\//, '')));
  return [...files, 'sw.js'];
}

function coveringSource(file, sources) {
  return sources.find(src => (src.endsWith('/') ? file.startsWith(src) : file === src));
}

test('Dockerfile copies every runtime file into the web root', () => {
  const sources = copiedSources();
  assert.ok(sources.length > 0, 'no COPY into the web root found');
  for (const file of runtimeFiles()) {
    assert.ok(coveringSource(file, sources), `${file} is not copied into the image`);
  }
});

test('.dockerignore lets every copied source into the build context', () => {
  const sources = copiedSources();
  for (const src of sources) {
    assert.ok(dockerignore.includes(`!${src}`), `.dockerignore lacks "!${src}"`);
  }
  for (const file of runtimeFiles()) {
    assert.ok(!dockerignore.includes(file), `.dockerignore excludes runtime file ${file}`);
  }
});

test('.dockerignore starts by excluding everything (allowlist)', () => {
  assert.equal(dockerignore[0], '*');
});
