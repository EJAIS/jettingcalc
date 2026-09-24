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
const { NEEDLE_LENGTHS } = await import('../js/needledb.js');

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

// Custom needle length texts must match NEEDLE_LENGTHS (the single source
// for custom needle lengths), with a decimal point in both languages.
test('needle length texts match NEEDLE_LENGTHS in en and de', () => {
  const EXPECTED_PREFIXES = {
    'ref.note': ['K', 'U', 'X', 'D'],
    'field.needleLengthType.K': ['K'],
    'field.needleLengthType.U': ['U'],
  };
  const problems = [];
  for (const lang of ['en', 'de']) {
    for (const [key, prefixes] of Object.entries(EXPECTED_PREFIXES)) {
      const text = TRANSLATIONS[lang][key];
      for (const prefix of prefixes) {
        const mm = `${NEEDLE_LENGTHS[prefix].toFixed(1)} mm`;
        if (!text.includes(mm)) problems.push(`${lang}:${key} lacks "${mm}" (${prefix})`);
      }
      if (/\d,\d/.test(text)) problems.push(`${lang}:${key} uses a decimal comma`);
      if (/U\s*=\s*X/.test(text)) problems.push(`${lang}:${key} claims U = X`);
      if (/PHBH[^.,;]*\b68\b/.test(text)) problems.push(`${lang}:${key} gives PHBH as 68 mm`);
    }
  }
  assert.deepEqual(problems, []);
});

// Minimal HTML start-tag tokenizer: walks the markup tag by tag (comments
// skipped), so attributes spread over several lines and quoted values
// containing '>' are handled — a per-line regex would miss both. Enough
// for the project's own index.html; not a general-purpose HTML parser.
function parseStartTags(html) {
  const tag = /<!--[\s\S]*?-->|<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
  const attr = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  const tags = [];
  for (const m of html.matchAll(tag)) {
    if (!m[1]) continue; // comment
    const attrs = {};
    for (const a of (m[2] ?? '').matchAll(attr)) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
    const line = html.slice(0, m.index).split('\n').length;
    tags.push({ name: m[1].toLowerCase(), attrs, line });
  }
  return tags;
}

// Every visible attribute text in index.html must be bound to a key, so a
// language switch updates it (applyTranslations()).
test('every title, aria-label and placeholder in index.html has its data-i18n-* binding', () => {
  const html = readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const tags = parseStartTags(html);
  assert.ok(tags.some(t => t.name === 'footer'), 'tokenizer should reach the end of index.html');
  const unbound = [];
  for (const { name, attrs, line } of tags) {
    for (const a of ['title', 'aria-label', 'placeholder']) {
      if (Object.hasOwn(attrs, a) && !Object.hasOwn(attrs, `data-i18n-${a}`)) {
        unbound.push(`line ${line}: <${name}> ${a}="${attrs[a]}"`);
      }
    }
  }
  assert.deepEqual(unbound, []);
});

// Numbers use a decimal point in both languages, and units are separated
// by a space ("55 mm"). Hyphenated compounds such as "26-mm-PHBL" are
// fine: the digit is followed by '-', not by "mm".
test('no decimal comma in de and no number glued to "mm" in en or de', () => {
  const problems = [];
  for (const [key, value] of Object.entries(de)) {
    if (/\d,\d/.test(value)) problems.push(`de:${key} uses a decimal comma: ${value.match(/\S*\d,\d\S*/)[0]}`);
  }
  for (const [lang, table] of Object.entries({ en, de })) {
    for (const [key, value] of Object.entries(table)) {
      if (/\dmm\b/.test(value)) problems.push(`${lang}:${key} lacks a space before "mm": ${value.match(/\S*\dmm\b/)[0]}`);
    }
  }
  assert.deepEqual(problems, []);
});
