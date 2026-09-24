// test/customneedle.test.mjs — Total length of custom needles
// Copyright (C) 2014 GUE — GPL v2.0
//
// Plain Node.js built-in test runner (`node --test`), no dependencies.
// Guards getCustomNeedleLength() / migrateCustomNeedles() in js/needledb.js:
// custom needles take their total length from NEEDLE_LENGTHS, and stored
// needles saved with an outdated length (PHBH = 68 mm) are corrected.

import test from 'node:test';
import assert from 'node:assert/strict';

// storage.js reads localStorage; a minimal in-memory stub lets the
// regression test below go through the real getAllNeedles() path.
const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
};

const { NEEDLE_LENGTHS, CUSTOM_LENGTH_PREFIX, CARB_TYPES, CARB_BORE_SIZES,
        getCustomNeedleLength, migrateCustomNeedles } = await import('../js/needledb.js');
const { saveCustomNeedles, getAllNeedles } = await import('../js/storage.js');
const { calcSetup } = await import('../js/calc.js');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test('getCustomNeedleLength: values come from NEEDLE_LENGTHS', () => {
  assert.equal(getCustomNeedleLength('VHSx', 'K'), NEEDLE_LENGTHS.K);
  assert.equal(getCustomNeedleLength('VHSx', 'U'), NEEDLE_LENGTHS.U);
  assert.equal(getCustomNeedleLength('PHBH'), NEEDLE_LENGTHS.X);
  assert.equal(getCustomNeedleLength('PHBL'), NEEDLE_LENGTHS.D);
  assert.equal(getCustomNeedleLength('PHBH'), 55.0);
  assert.equal(getCustomNeedleLength('PHBL'), 52.0);
  // PHBH/PHBL ignore a lengthType.
  assert.equal(getCustomNeedleLength('PHBH', 'K'), NEEDLE_LENGTHS.X);
});

test('getCustomNeedleLength: null for unknown carb type or VHSx without K/U', () => {
  assert.equal(getCustomNeedleLength('PHF'), null);
  assert.equal(getCustomNeedleLength(null), null);
  assert.equal(getCustomNeedleLength('VHSx'), null);
  assert.equal(getCustomNeedleLength('VHSx', 'X'), null);
});

test('CUSTOM_LENGTH_PREFIX covers every non-VHSx carb type', () => {
  const fixed = Object.keys(CARB_TYPES).filter(ct => ct !== 'VHSx').sort();
  assert.deepEqual(Object.keys(CUSTOM_LENGTH_PREFIX).sort(), fixed);
});

const STORED = deepFreeze([
  { type: 'XA1', carbType: 'PHBH', A: 2.5, B: 1.8, C: 24, length: 68, clips: 4 },
  { type: 'XA2', carbType: 'PHBH', A: 2.5, B: 1.6, C: 24, clips: 4 },
  { type: 'DA1', carbType: 'PHBL', A: 2.5, B: 1.0, C: 26, length: 52, clips: 4 },
  { type: 'KA1', carbType: 'VHSx', A: 2.5, B: 1.6, C: 40, length: 68, clips: 3 },
  { type: 'KA2', carbType: 'VHSx', A: 2.5, B: 1.6, C: 40, clips: 3 },
]);

test('migrateCustomNeedles: corrects PHBH, leaves PHBL at 52 and VHSx untouched', () => {
  const { needles, changes } = migrateCustomNeedles(STORED);
  assert.deepEqual(changes, [
    { type: 'XA1', carbType: 'PHBH', from: 68, to: 55 },
    { type: 'XA2', carbType: 'PHBH', from: null, to: 55 },
  ]);
  assert.equal(needles[0].length, 55);
  assert.equal(needles[1].length, 55);
  assert.equal(needles[2].length, 52);
  // VHSx: exactly as stored, including a missing length.
  assert.deepEqual(needles[3], STORED[3]);
  assert.deepEqual(needles[4], STORED[4]);
  assert.equal(Object.hasOwn(needles[4], 'length'), false);
  // All other fields survive.
  assert.deepEqual({ ...needles[0], length: 68 }, STORED[0]);
});

test('migrateCustomNeedles: idempotent and does not mutate its input', () => {
  const first = migrateCustomNeedles(STORED); // deep-frozen: a mutation would throw
  const second = migrateCustomNeedles(first.needles);
  assert.deepEqual(second.changes, []);
  assert.deepEqual(second.needles, first.needles);
  assert.equal(STORED[0].length, 68);
  assert.equal(Object.hasOwn(STORED[1], 'length'), false);
});

test('migrateCustomNeedles: empty list', () => {
  assert.deepEqual(migrateCustomNeedles([]), { needles: [], changes: [] });
});

test('regression: migrated custom PHBH needle with X2 geometry has the same idlePos as X2', () => {
  // Same geometry and clip count as the built-in X2 (4-groove default).
  const stored = [{ type: 'XX2', carbType: 'PHBH', A: 2.50, B: 1.80, C: 24.00, length: 68, clips: 4 }];
  const { needles } = migrateCustomNeedles(stored);
  saveCustomNeedles(needles);
  const allNeedles = getAllNeedles();

  const base = {
    clipPos: 2, carbSize: CARB_BORE_SIZES.PHBH[0], jetType: CARB_TYPES.PHBH.atomizers[0],
    needleJet: 262, nd: 50, hd: 120,
  };
  const x2 = calcSetup({ ...base, needleType: 'X2' }, allNeedles);
  const custom = calcSetup({ ...base, needleType: 'XX2' }, allNeedles);
  assert.ok(x2 && custom, 'calcSetup() returned null');
  assert.equal(custom.idlePos, x2.idlePos);

  // Before the migration the stored 68 mm put it 13 mm off.
  saveCustomNeedles(stored);
  const stale = calcSetup({ ...base, needleType: 'XX2' }, getAllNeedles());
  assert.ok(Math.abs(stale.idlePos - x2.idlePos - 13) < 1e-9);
});
