// test/needlecatalog.test.mjs — Regression tests for js/needlecatalog.js
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0
//
// Plain Node.js built-in test runner (`node --test`), no dependencies,
// consistent with the project's "no build tool" philosophy. Run with:
//
//   node --test test/

import test from 'node:test';
import assert from 'node:assert/strict';
import { NEEDLE_DB, CARB_TYPES } from '../js/needledb.js';
import {
  CATALOG_COLUMNS, CATALOG_EMPTY_VALUE, getNeedleSeries, compareNeedleTypes,
  buildCatalogRows, getSeriesList, countByTaper, filterCatalogRows,
  sortCatalogRows, formatCatalogValue,
} from '../js/needlecatalog.js';

// The three demo setups from CLAUDE.md (K98 needle, VHSx carb), plus two
// empty slots.
const DEMO_SETUPS = [
  { id: 1, name: '#1 Simonini Grund', needleType: 'K98', clipPos: 3, carbSize: 30, needleJet: 262, jetType: 'DP', nd: 53, hd: 175 },
  { id: 2, name: '#2 Simonini 6.6.23', needleType: 'K98', clipPos: 1, carbSize: 30, needleJet: 268, jetType: 'DQ', nd: 53, hd: 155 },
  { id: 3, name: '#3 Test', needleType: 'K98', clipPos: 1, carbSize: 30, needleJet: 267, jetType: 'DQ', nd: 55, hd: 155 },
  { id: 4, name: '#4', needleType: null, clipPos: null, carbSize: null, needleJet: null, jetType: null, nd: null, hd: null },
  { id: 5, name: '#5', needleType: null, clipPos: null, carbSize: null, needleJet: null, jetType: null, nd: null, hd: null },
];

// Same shape getAllNeedles() (storage.js) produces for a custom needle.
const CUSTOM_K99 = { carbType: 'VHSx', A: 2.5, B: 1.6, C: 40, clips: 3 };

function rowsFor(carbType, extra = {}) {
  return buildCatalogRows({ allNeedles: NEEDLE_DB, carbType, ...extra });
}

function rowOf(rows, type) {
  const row = rows.find(r => r.type === type);
  assert.ok(row, `row ${type} missing`);
  return row;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const types = rows => rows.map(r => r.type);

// --- Completeness ------------------------------------------------------------

test('every carbType yields exactly its NEEDLE_DB entries, and the totals add up', () => {
  let total = 0;
  for (const carbType of Object.keys(CARB_TYPES)) {
    const expected = Object.values(NEEDLE_DB).filter(n => n.carbType === carbType).length;
    const rows = rowsFor(carbType);
    assert.equal(rows.length, expected, `row count for ${carbType}`);
    assert.ok(rows.length > 0, `${carbType} should have needles`);
    for (const row of rows) assert.equal(row.carbType, carbType, `${row.type} carbType`);
    total += rows.length;
  }
  assert.equal(total, Object.keys(NEEDLE_DB).length);
});

test('rows are sorted with compareNeedleTypes', () => {
  for (const carbType of Object.keys(CARB_TYPES)) {
    const rows = rowsFor(carbType);
    assert.deepEqual(types(rows), [...types(rows)].sort(compareNeedleTypes));
  }
});

test('missing geometry values are null, present ones copied', () => {
  const rows = rowsFor('VHSx');
  const k1 = rowOf(rows, 'K1');
  assert.deepEqual([k1.A, k1.B, k1.C, k1.D, k1.E, k1.F], [2.45, 1.75, 37, null, null, null]);
  const k48 = rowOf(rows, 'K48');
  assert.deepEqual([k48.A, k48.B, k48.C, k48.D, k48.E, k48.F], [2.48, 1.6, 36, 2.25, 25, 11]);
  assert.equal(k48.series, 'K');
});

// --- Derived values ----------------------------------------------------------

test('tapers: K1 → 1, K24 → 2, K48 → 3', () => {
  const rows = rowsFor('VHSx');
  assert.equal(rowOf(rows, 'K1').tapers, 1);
  assert.equal(rowOf(rows, 'K24').tapers, 2);
  assert.equal(rowOf(rows, 'K48').tapers, 3);
});

test('length: K 73.5, U 68.0, X1 55.0, X37 override 56.2, D36 52.0', () => {
  const vhsx = rowsFor('VHSx');
  assert.equal(rowOf(vhsx, 'K98').length, 73.5);
  assert.equal(rowOf(vhsx, 'U1').length, 68.0);
  const phbh = rowsFor('PHBH');
  assert.equal(rowOf(phbh, 'X1').length, 55.0);
  assert.equal(rowOf(phbh, 'X37').length, 56.2);
  assert.equal(rowOf(rowsFor('PHBL'), 'D36').length, 52.0);
});

test('clips and clipsSource', () => {
  const vhsx = rowsFor('VHSx', { allNeedles: { ...NEEDLE_DB, K99: CUSTOM_K99 }, customTypes: ['K99'] });
  assert.deepEqual([rowOf(vhsx, 'K98').clips, rowOf(vhsx, 'K98').clipsSource], [5, 'verified']);
  assert.deepEqual([rowOf(vhsx, 'U1').clips, rowOf(vhsx, 'U1').clipsSource], [4, 'default']);
  assert.deepEqual([rowOf(vhsx, 'K99').clips, rowOf(vhsx, 'K99').clipsSource], [3, 'custom']);
  const d36 = rowOf(rowsFor('PHBL'), 'D36');
  assert.deepEqual([d36.clips, d36.clipsSource], [4, 'verified']);
  const x1 = rowOf(rowsFor('PHBH'), 'X1');
  assert.deepEqual([x1.clips, x1.clipsSource], [4, 'default']);
});

// --- Custom needles ----------------------------------------------------------

test('a custom needle appears only in its own carbType, flagged isCustom', () => {
  const allNeedles = { ...NEEDLE_DB, K99: CUSTOM_K99 };
  const vhsx = buildCatalogRows({ allNeedles, carbType: 'VHSx', customTypes: ['K99'] });
  const k99 = rowOf(vhsx, 'K99');
  assert.equal(k99.isCustom, true);
  assert.equal(vhsx.filter(r => r.isCustom).length, 1);
  assert.equal(rowOf(vhsx, 'K98').isCustom, false);
  for (const carbType of ['PHBH', 'PHBL']) {
    const rows = buildCatalogRows({ allNeedles, carbType, customTypes: ['K99'] });
    assert.equal(rows.some(r => r.type === 'K99'), false, `K99 leaked into ${carbType}`);
  }
});

test('a custom needle overriding a base name supplies its own values', () => {
  const override = { carbType: 'VHSx', A: 2.4, B: 1.1, C: 30, D: 2.2, E: 20, clips: 3 };
  const rows = buildCatalogRows({
    allNeedles: { ...NEEDLE_DB, K98: override }, carbType: 'VHSx', customTypes: ['K98'],
  });
  const k98 = rowOf(rows, 'K98');
  assert.deepEqual([k98.A, k98.B, k98.C, k98.D, k98.E, k98.F], [2.4, 1.1, 30, 2.2, 20, null]);
  assert.equal(k98.tapers, 2);
  assert.equal(k98.clips, 3);
  assert.equal(k98.clipsSource, 'custom');
  assert.equal(k98.isCustom, true);
  assert.equal(rows.filter(r => r.type === 'K98').length, 1);
});

// --- usedBy ------------------------------------------------------------------

test('usedBy lists the ids of setups using the needle, ascending', () => {
  const rows = rowsFor('VHSx', { setups: [DEMO_SETUPS[2], DEMO_SETUPS[0], ...DEMO_SETUPS.slice(3), DEMO_SETUPS[1]] });
  assert.deepEqual(rowOf(rows, 'K98').usedBy, [1, 2, 3]);
  assert.deepEqual(rowOf(rows, 'K1').usedBy, []);
  assert.deepEqual(rowOf(rowsFor('VHSx'), 'K98').usedBy, []);
});

// --- Series and ordering -----------------------------------------------------

test('getNeedleSeries returns the leading uppercase letters', () => {
  assert.equal(getNeedleSeries('K98'), 'K');
  assert.equal(getNeedleSeries('U12'), 'U');
  assert.equal(getNeedleSeries('X37'), 'X');
  assert.equal(getNeedleSeries('D36'), 'D');
  assert.equal(getNeedleSeries('98'), '');
  assert.equal(getNeedleSeries(''), '');
});

test('compareNeedleTypes: K9 < K10 < K98 < K98-mod < U1', () => {
  const expected = ['K9', 'K10', 'K98', 'K98-mod', 'U1'];
  assert.deepEqual(['U1', 'K98-mod', 'K10', 'K98', 'K9'].sort(compareNeedleTypes), expected);
  for (let i = 0; i < expected.length - 1; i++) {
    assert.ok(compareNeedleTypes(expected[i], expected[i + 1]) < 0, `${expected[i]} < ${expected[i + 1]}`);
    assert.ok(compareNeedleTypes(expected[i + 1], expected[i]) > 0, `${expected[i + 1]} > ${expected[i]}`);
  }
  assert.equal(compareNeedleTypes('K98', 'K98'), 0);
  // Non-numeric remainder sorts after numeric ones within the same series.
  assert.ok(compareNeedleTypes('Kmod', 'K1') > 0);
});

test('getSeriesList returns distinct non-empty series, alphabetically', () => {
  const rows = [...rowsFor('VHSx'), ...rowsFor('PHBH'), ...rowsFor('PHBL')];
  assert.deepEqual(getSeriesList(rows), ['D', 'K', 'U', 'X']);
  assert.deepEqual(getSeriesList(rowsFor('VHSx')), ['K', 'U']);
  assert.deepEqual(getSeriesList([{ series: '' }, { series: 'K' }]), ['K']);
});

// --- Filtering ---------------------------------------------------------------

test('filterCatalogRows: series, tapers, query, usedOnly and combinations', () => {
  const rows = rowsFor('VHSx', { setups: DEMO_SETUPS });

  assert.equal(filterCatalogRows(rows).length, rows.length);
  assert.notEqual(filterCatalogRows(rows), rows, 'must return a new array');

  const uRows = filterCatalogRows(rows, { series: 'U' });
  assert.ok(uRows.length > 0);
  assert.ok(uRows.every(r => r.series === 'U'));
  assert.equal(uRows.length + filterCatalogRows(rows, { series: 'K' }).length, rows.length);
  assert.deepEqual(filterCatalogRows(rows, { series: 'X' }), []);

  for (const tapers of [1, 2, 3]) {
    const filtered = filterCatalogRows(rows, { tapers });
    assert.ok(filtered.every(r => r.tapers === tapers), `tapers ${tapers}`);
  }

  assert.deepEqual(types(filterCatalogRows(rows, { query: ' k 9 8 ' })), ['K98']);
  assert.deepEqual(types(filterCatalogRows(rows, { query: 'K98' })), ['K98']);
  assert.deepEqual(types(filterCatalogRows(rows, { query: 'u2' })), ['U2', 'U20', 'U21', 'U22', 'U23', 'U24', 'U25']);
  assert.deepEqual(filterCatalogRows(rows, { query: 'zzz' }), []);

  assert.deepEqual(types(filterCatalogRows(rows, { usedOnly: true })), ['K98']);
  assert.deepEqual(filterCatalogRows(rowsFor('VHSx'), { usedOnly: true }), []);

  // Combinations
  assert.deepEqual(types(filterCatalogRows(rows, { series: 'K', tapers: 1, usedOnly: true })), ['K98']);
  assert.deepEqual(filterCatalogRows(rows, { series: 'U', usedOnly: true }), []);
  assert.deepEqual(filterCatalogRows(rows, { tapers: 2, query: 'k98' }), []);
  assert.deepEqual(types(filterCatalogRows(rows, { series: 'U', tapers: 2, query: 'u1' })), ['U10', 'U11', 'U14']);
});

test('countByTaper matches the taper filter results', () => {
  for (const carbType of Object.keys(CARB_TYPES)) {
    const rows = rowsFor(carbType);
    const counts = countByTaper(rows);
    assert.equal(counts.all, rows.length);
    assert.equal(counts.all, filterCatalogRows(rows, { tapers: 0 }).length);
    for (const tapers of [1, 2, 3]) {
      assert.equal(counts[tapers], filterCatalogRows(rows, { tapers }).length, `${carbType} tapers ${tapers}`);
    }
    assert.equal(counts[1] + counts[2] + counts[3], counts.all);
  }
  assert.ok(countByTaper(rowsFor('VHSx'))[3] > 0);
  assert.deepEqual(countByTaper([]), { all: 0, 1: 0, 2: 0, 3: 0 });
});

// --- Sorting -----------------------------------------------------------------

test('sortCatalogRows by D keeps null values last in both directions', () => {
  const rows = rowsFor('VHSx');
  for (const dir of ['asc', 'desc']) {
    const sorted = sortCatalogRows(rows, { key: 'D', dir });
    const firstNull = sorted.findIndex(r => r.D == null);
    assert.ok(firstNull > 0, `${dir}: expected non-null D values first`);
    assert.ok(sorted.slice(firstNull).every(r => r.D == null), `${dir}: null D values must be last`);
    const values = sorted.slice(0, firstNull).map(r => r.D);
    const expected = [...values].sort((a, b) => dir === 'asc' ? a - b : b - a);
    assert.deepEqual(values, expected, `${dir}: numeric order`);
  }
});

test('sortCatalogRows breaks ties by name ascending, regardless of dir', () => {
  const rows = rowsFor('VHSx');
  for (const dir of ['asc', 'desc']) {
    const sorted = sortCatalogRows(rows, { key: 'A', dir });
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].A === sorted[i + 1].A) {
        assert.ok(compareNeedleTypes(sorted[i].type, sorted[i + 1].type) < 0,
          `${dir}: ${sorted[i].type} before ${sorted[i + 1].type}`);
      }
    }
    // The null block (no D) is also ordered by name.
    const nullBlock = sortCatalogRows(rows, { key: 'D', dir }).filter(r => r.D == null);
    assert.deepEqual(types(nullBlock), [...types(nullBlock)].sort(compareNeedleTypes));
  }
  // K1 and K2 share A = 2.45 → K1 first.
  const sorted = types(sortCatalogRows(rows, { key: 'A' }));
  assert.ok(sorted.indexOf('K1') < sorted.indexOf('K2'));
});

test('sortCatalogRows by name, unknown key falls back to name, input unchanged', () => {
  const rows = rowsFor('VHSx');
  const shuffled = [...rows].reverse();
  const before = types(shuffled);
  const byName = sortCatalogRows(shuffled);
  assert.deepEqual(types(byName), types(rows));
  assert.deepEqual(types(shuffled), before, 'input must not be reordered');
  assert.notEqual(byName, shuffled);
  assert.deepEqual(types(sortCatalogRows(shuffled, { key: 'bogus' })), types(rows));
  assert.deepEqual(types(sortCatalogRows(shuffled, { key: 'bogus', dir: 'desc' })), [...types(rows)].reverse());
  assert.deepEqual(types(sortCatalogRows(rows, { key: 'name', dir: 'desc' })), [...types(rows)].reverse());
});

test('every CATALOG_COLUMNS key sorts without error', () => {
  const rows = rowsFor('VHSx');
  for (const { key } of CATALOG_COLUMNS) {
    for (const dir of ['asc', 'desc']) {
      assert.equal(sortCatalogRows(rows, { key, dir }).length, rows.length, `${key} ${dir}`);
    }
  }
});

// --- Columns and formatting --------------------------------------------------

test('CATALOG_COLUMNS: order, kinds, frozen', () => {
  assert.deepEqual(CATALOG_COLUMNS.map(c => `${c.key}:${c.kind}`), [
    'name:text', 'tapers:int', 'A:diameter', 'B:diameter', 'C:position',
    'D:diameter', 'E:position', 'F:position', 'clips:int', 'length:position',
  ]);
  assert.ok(Object.isFrozen(CATALOG_COLUMNS));
  assert.ok(CATALOG_COLUMNS.every(c => Object.isFrozen(c)));
});

test('formatCatalogValue examples', () => {
  assert.equal(formatCatalogValue(null, 'diameter'), CATALOG_EMPTY_VALUE);
  assert.equal(formatCatalogValue(undefined, 'position'), CATALOG_EMPTY_VALUE);
  assert.equal(CATALOG_EMPTY_VALUE, '–');
  assert.equal(formatCatalogValue(2.5, 'diameter'), '2.50');
  assert.equal(formatCatalogValue(2.108, 'diameter'), '2.108');
  assert.equal(formatCatalogValue(2.45, 'diameter'), '2.45');
  assert.equal(formatCatalogValue(37, 'position'), '37.0');
  assert.equal(formatCatalogValue(32.4, 'position'), '32.4');
  assert.equal(formatCatalogValue(29.46, 'position'), '29.46');
  assert.equal(formatCatalogValue(3, 'int'), '3');
  assert.equal(formatCatalogValue('K98', 'text'), 'K98');
  assert.equal(formatCatalogValue(0, 'int'), '0');
});

test('formatCatalogValue round-trips every NEEDLE_DB value per column', () => {
  const kindByKey = Object.fromEntries(CATALOG_COLUMNS.map(c => [c.key, c.kind]));
  const rows = Object.keys(CARB_TYPES).flatMap(carbType => rowsFor(carbType));
  for (const key of ['tapers', 'A', 'B', 'C', 'D', 'E', 'F', 'clips', 'length']) {
    for (const row of rows) {
      const value = row[key];
      if (value == null) continue;
      const formatted = formatCatalogValue(value, kindByKey[key]);
      assert.equal(parseFloat(formatted), value, `${row.type}.${key}: ${value} shown as '${formatted}'`);
      assert.ok(!formatted.includes(','), `${row.type}.${key}: decimal separator must be '.'`);
    }
  }
});

// --- Purity ------------------------------------------------------------------

test('no function mutates its (deep-frozen) inputs', () => {
  const allNeedles = deepFreeze(structuredClone({ ...NEEDLE_DB, K99: CUSTOM_K99 }));
  const customTypes = deepFreeze(['K99']);
  const setups = deepFreeze(structuredClone(DEMO_SETUPS).reverse());
  const snapshot = JSON.stringify({ allNeedles, customTypes, setups });

  const rows = deepFreeze(buildCatalogRows({ allNeedles, carbType: 'VHSx', customTypes, setups }));
  const rowsSnapshot = JSON.stringify(rows);

  getSeriesList(rows);
  countByTaper(rows);
  filterCatalogRows(rows, deepFreeze({ series: 'K', tapers: 1, query: ' k 9 ', usedOnly: true }));
  for (const { key } of CATALOG_COLUMNS) {
    sortCatalogRows(rows, deepFreeze({ key, dir: 'asc' }));
    sortCatalogRows(rows, deepFreeze({ key, dir: 'desc' }));
  }
  for (const row of rows) {
    for (const { key, kind } of CATALOG_COLUMNS) formatCatalogValue(key === 'name' ? row.type : row[key], kind);
  }

  assert.equal(JSON.stringify({ allNeedles, customTypes, setups }), snapshot);
  assert.equal(JSON.stringify(rows), rowsSnapshot);
});
