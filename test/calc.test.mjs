// test/calc.test.mjs — Regression tests for js/calc.js
// Copyright (C) 2014 GUE — GPL v2.0
//
// Plain Node.js built-in test runner (`node --test`), no dependencies,
// consistent with the project's "no build tool" philosophy. Run with:
//
//   node --test test/
//
// These tests guard the per-needle clip-groove geometry introduced in
// js/needledb.js (CLIP_GEOMETRY_BY_COUNT / getClipGeometry) and wired
// into calcSetup()'s idlePos formula. See KONSTANTEN_VERIFIKATION.md for
// the underlying measurements.

import test from 'node:test';
import assert from 'node:assert/strict';
import { calcSetup } from '../js/calc.js';

// Values close enough given IEEE-754 rounding in the idlePos arithmetic.
const EPS = 1e-6;
function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < EPS,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

// Any needleJet/nd/hd works for these tests — only idlePos is checked,
// which does not depend on them.
function idlePos(needleType, clipPos, overrides = {}) {
  const setup = {
    needleType, clipPos, carbSize: 30, needleJet: 262, jetType: 'DP',
    nd: 53, hd: 175, ...overrides,
  };
  const result = calcSetup(setup);
  assert.ok(result, `calcSetup() returned null for ${needleType} clip ${clipPos}`);
  return result.idlePos;
}

test('3-groove vs 4-groove top-offset: K1 (3) sits exactly 1.50 mm below K18 (4) at clip 1', () => {
  // Both needles share needleLength (73.5 mm, K prefix), so the whole
  // difference comes from the topOffset correction (3.10 - 1.60 = 1.50).
  const k18 = idlePos('K18', 1);
  const k1 = idlePos('K1', 1);
  assertClose(k18 - k1, 1.5, 'K18 - K1 idlePos delta');
});

test('5-groove spacing: K98 idlePos(clip 5) - idlePos(clip 1) is -4.0 mm (was -4.8 mm pre-fix)', () => {
  const clip1 = idlePos('K98', 1);
  const clip5 = idlePos('K98', 5);
  assertClose(clip5 - clip1, -4.0, 'K98 clip5 - clip1 idlePos delta');
});

test('regression: D36 (PHBL) idlePos at clip 1 is unchanged at 31.7 mm', () => {
  // D-needles have no per-needle `clips` field and fall back to the
  // 4-groove default via DEFAULT_CLIPS_BY_PREFIX, so the new geometry
  // table must not move this previously verified value.
  const pos = idlePos('D36', 1, { carbSize: 26, jetType: 'AQ' });
  assertClose(pos, 31.7, 'D36 clip 1 idlePos');
});

// PHBH calibration (2026-11-25): direct measurements on a 28 mm and a
// 30 mm PHBH, X2 at clip 1. Model: 55.0 - 23.2 + offset (AV 0, AS 2),
// no bore term. Every measurement must lie within 0.25 mm of the model.
const PHBH_MEASURED = [
  { carbSize: 28, jetType: 'AV', measured: 31.9 },
  { carbSize: 28, jetType: 'AS', measured: 34.0 },
  { carbSize: 30, jetType: 'AV', measured: 31.6 },
  { carbSize: 30, jetType: 'AS', measured: 33.8 },
];

test('regression: X2 (PHBH) idlePos at clip 1 is 31.8 mm (AV) / 33.8 mm (AS)', () => {
  assertClose(idlePos('X2', 1, { carbSize: 30, jetType: 'AV' }), 31.8, 'X2 AV 30 mm');
  assertClose(idlePos('X2', 1, { carbSize: 30, jetType: 'AS' }), 33.8, 'X2 AS 30 mm');
});

test('PHBH: idlePos matches the 2026-11-25 measurements within 0.25 mm', () => {
  for (const { carbSize, jetType, measured } of PHBH_MEASURED) {
    const pos = idlePos('X2', 1, { carbSize, jetType });
    assert.ok(
      Math.abs(pos - measured) <= 0.25,
      `X2 ${jetType} ${carbSize} mm: model ${pos.toFixed(2)}, measured ${measured}`,
    );
  }
});

test('PHBH: idlePos does not depend on the bore size (bore term 0)', () => {
  for (const jetType of ['AV', 'AS']) {
    const [a, b, c] = [26, 28, 30].map(carbSize => idlePos('X2', 1, { carbSize, jetType }));
    assertClose(a, c, `X2 ${jetType} 26 vs 30 mm`);
    assertClose(b, c, `X2 ${jetType} 28 vs 30 mm`);
  }
});

test('VHSx and PHBL keep the bore term of 1/2', () => {
  const k = [30, 34].map(carbSize => idlePos('K24', 1, { carbSize, jetType: 'DP' }));
  assertClose(k[1] - k[0], 2, 'K24 34 vs 30 mm');
  const d = [22, 26].map(carbSize => idlePos('D36', 1, { carbSize, jetType: 'AQ' }));
  assertClose(d[1] - d[0], 2, 'D36 26 vs 22 mm');
});

// Custom needles are not covered by the K-needle groove measurements, so
// they must always use the 4-groove reference geometry (topOffset 1.60,
// spacing 1.2), regardless of their `clips` count.
function customIdlePos(clips, clipPos) {
  const custom = { KC1: { carbType: 'VHSx', A: 2.5, B: 1.4, C: 38, clips } };
  const setup = {
    needleType: 'KC1', clipPos, carbSize: 30, needleJet: 262, jetType: 'DP',
    nd: 53, hd: 175,
  };
  const result = calcSetup(setup, custom);
  assert.ok(result, `calcSetup() returned null for custom needle, clips ${clips}`);
  return result.idlePos;
}

test('custom needle with clips: 3 uses the 4-groove reference topOffset, not the 3-groove K correction', () => {
  // Reference: 73.5 - 26.4 + (30 - 34) / 2 = 45.1 at clip 1 (no correction).
  // The 3-groove K geometry would give 45.1 - 1.50 = 43.6.
  assertClose(customIdlePos(3, 1), 45.1, 'custom clips 3, clip 1 idlePos');
  // Same result as the built-in 4-groove K18 with identical dimensions.
  assertClose(customIdlePos(3, 1), idlePos('K18', 1), 'custom clips 3 vs K18');
});

test('custom needle with clips: 5 uses spacing 1.2, not the 1.0 K-needle 5-groove spacing', () => {
  const delta = customIdlePos(5, 4) - customIdlePos(5, 1);
  assertClose(delta, -3.6, 'custom clips 5 clip4 - clip1 idlePos delta');
  assertClose(customIdlePos(5, 1), 45.1, 'custom clips 5, clip 1 idlePos');
});

test('regression: built-in K25 (clips 5) still uses the measured 5-groove spacing of 1.0', () => {
  // Guards against an over-broad "isBuiltIn" check that would silently
  // drop built-in K needles back to the reference geometry.
  const delta = idlePos('K25', 5) - idlePos('K25', 1);
  assertClose(delta, -4.0, 'K25 clip5 - clip1 idlePos delta');
  // topOffset 1.50 vs reference 1.60 → correction of +0.1 mm on top of 45.1.
  assertClose(idlePos('K25', 1), 45.1 + 0.1, 'K25 clip 1 idlePos');
});
