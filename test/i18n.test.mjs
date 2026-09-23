// test/i18n.test.mjs — Permanent guard for EN/DE completeness of the UI
// Copyright (C) 2014 GUE — GPL v2.0
//
// Plain Node.js built-in test runner (`node --test`), no dependencies,
// consistent with the project's "no build tool" philosophy. Run with:
//
//   node --test test/
//
// Checks that en and de carry the same keys, no empty strings, matching
// {placeholder} sets, and that every key referenced from index.html
// (data-i18n*) and from literal t('…') calls in js/*.js exists.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// i18n.js reads the stored language from localStorage at module load, so
// a minimal stub must exist before it is imported — hence the dynamic
// import() instead of a static one (static imports are hoisted).
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
};
const { TRANSLATIONS } = await import('../js/i18n.js');
const { CATALOG_COLUMNS } = await import('../js/needlecatalog.js');

const { en, de } = TRANSLATIONS;
const PLACEHOLDER = /\{[a-zA-Z]+\}/g;

function placeholders(str) {
  return [...new Set(str.match(PLACEHOLDER) ?? [])].sort();
}

function missingFromEn(keys) {
  return [...new Set(keys)].filter(key => !Object.hasOwn(en, key)).sort();
}

test('en and de have exactly the same keys', () => {
  const onlyEn = Object.keys(en).filter(key => !Object.hasOwn(de, key)).sort();
  const onlyDe = Object.keys(de).filter(key => !Object.hasOwn(en, key)).sort();
  assert.deepEqual({ onlyEn, onlyDe }, { onlyEn: [], onlyDe: [] },
    `key sets differ — only in en: ${JSON.stringify(onlyEn)}, only in de: ${JSON.stringify(onlyDe)}`);
});

test('no translation value is empty or whitespace-only', () => {
  const blank = [];
  for (const [lang, table] of Object.entries(TRANSLATIONS)) {
    for (const [key, value] of Object.entries(table)) {
      if (typeof value !== 'string' || value.trim() === '') blank.push(`${lang}:${key}`);
    }
  }
  assert.deepEqual(blank, []);
});

test('placeholder sets match between en and de for every key', () => {
  const mismatched = Object.keys(en)
    .filter(key => Object.hasOwn(de, key))
    .filter(key => placeholders(en[key]).join() !== placeholders(de[key]).join())
    .map(key => `${key}: en ${placeholders(en[key]).join(' ')} / de ${placeholders(de[key]).join(' ')}`);
  assert.deepEqual(mismatched, []);
});

test('every data-i18n* key in index.html exists in TRANSLATIONS.en', () => {
  const html = readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const attr = /\bdata-i18n(?:-placeholder|-title|-aria-label|-tooltip)?\s*=\s*(["'])(.*?)\1/g;
  const keys = [...html.matchAll(attr)].map(m => m[2]);
  assert.ok(keys.length > 0, 'expected data-i18n attributes in index.html');
  assert.deepEqual(missingFromEn(keys), []);
});

// Only literal keys — t('key') / t("key") — are collected. Dynamic keys
// built from template strings or variables (e.g. t(`carbType.${ct}`),
// t(key)) are deliberately not covered: they cannot be resolved
// statically, so their completeness stays the caller's responsibility.
test('every literal t(\'…\') key in js/*.js exists in TRANSLATIONS.en', () => {
  const jsDir = path.join(REPO_ROOT, 'js');
  const call = /(?<![\w$.])t\(\s*(["'])([^"'\\]+)\1\s*[,)]/g;
  const keys = [];
  for (const file of readdirSync(jsDir).filter(f => f.endsWith('.js'))) {
    const src = readFileSync(path.join(jsDir, file), 'utf8');
    keys.push(...[...src.matchAll(call)].map(m => m[2]));
  }
  assert.ok(keys.length > 0, 'expected literal t() calls in js/*.js');
  assert.deepEqual(missingFromEn(keys), []);
});

// The catalog table headers use dynamic keys (t(`catalog.col.${key}`)),
// which the literal-t() scan above cannot see — so guard them explicitly.
test('every CATALOG_COLUMNS key has a catalog.col.* translation in en and de', () => {
  const missing = [];
  for (const { key } of CATALOG_COLUMNS) {
    for (const lang of ['en', 'de']) {
      if (!Object.hasOwn(TRANSLATIONS[lang], `catalog.col.${key}`)) missing.push(`${lang}:catalog.col.${key}`);
    }
  }
  assert.deepEqual(missing, []);
});
