// test/tuning.test.mjs — Regression tests for js/tuning.js
// Copyright (C) 2014 GUE — GPL v2.0
//
// Plain Node.js built-in test runner (`node --test`), no dependencies,
// consistent with the project's "no build tool" philosophy. Run with:
//
//   node --test test/

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcSetup } from '../js/calc.js';
import { NEEDLE_DB, ATOMIZER_SIZES } from '../js/needledb.js';
import { ND_MAX, HD_MAX } from '../js/share.js';
import {
  TUNING_RANGES, TUNING_REASONS, MIN_STEP, MAX_SUGGESTIONS,
  hdLimited, rangeSummary, evaluateCandidates, rankNextSteps, stepJet,
  formatSignedPercent, validateTuningSetup,
} from '../js/tuning.js';

// Reference values below come from the accepted prototype — if one of them
// fails, find the cause before touching the expected numbers.
const REF_VHSX = { needleType: 'K27', clipPos: 3, carbSize: 34, jetType: 'DQ', needleJet: 264, nd: 50, hd: 128 };
const REF_PHBL = { needleType: 'D36', clipPos: 2, carbSize: 24, jetType: 'AQ', needleJet: 264, nd: 40, hd: 110 };

// Same shape getAllNeedles() (storage.js) produces for a custom needle.
const CUSTOM_VHSX = { carbType: 'VHSx', A: 2.5, B: 1.75, C: 43, clips: 4, length: 73.5 };
const CUSTOM_PHBL = { carbType: 'PHBL', A: 2.5, B: 1.2, C: 22, clips: 4, length: 52 };

// Same flow as the UI: evaluate once per current state, then rank one
// range/direction.
function rank({ ref, current = ref, rangeIndex, dir, allNeedles = NEEDLE_DB, customTypes = [] }) {
  const evaluated = evaluateCandidates({ allNeedles, ref, current });
  const summary = rangeSummary(calcSetup(ref, allNeedles), calcSetup(current, allNeedles), current);
  return rankNextSteps(evaluated, {
    currentFlow: summary.map(r => r.flow),
    currentHdLimited: summary.map(r => r.hdLimited),
    rangeIndex, dir, current, customTypes,
  });
}

const round1 = values => values.map(v => Math.round(v * 10) / 10 + 0);

function assertSuggestion(s, needleType, clipPos, flow) {
  assert.equal(s.needleType, needleType);
  assert.equal(s.clipPos, clipPos);
  if (flow) assert.deepEqual(round1(s.flow), flow);
}

// ── Constants ────────────────────────────────────────────────────────────────

test('TUNING_RANGES: five frozen ranges on the 5 % grid, never above 100 %', () => {
  assert.ok(Object.isFrozen(TUNING_RANGES));
  assert.deepEqual(TUNING_RANGES.map(r => r.key), ['r0', 'r1', 'r2', 'r3', 'r4']);
  assert.deepEqual(TUNING_RANGES.map(r => r.lever), ['nd', 'needle', 'needle', 'needle', 'needle']);
  const all = TUNING_RANGES.flatMap(r => r.points);
  assert.deepEqual(all, Array.from({ length: 21 }, (_, i) => i * 5));
  for (const range of TUNING_RANGES) {
    assert.ok(Object.isFrozen(range));
    assert.ok(Object.isFrozen(range.points));
  }
});

// ── Purity ───────────────────────────────────────────────────────────────────

// Imports of a module, with comments stripped so prose mentioning e.g.
// "storage.js" does not count.
function readModule(file) {
  const src = readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const imports = [...src.matchAll(/^\s*import\b[^;]*?from\s+['"]\.\/([^'"]+)['"]/gm)].map(m => m[1]);
  return { src, imports };
}

test('tuning.js imports only calc.js, needledb.js, needlecatalog.js and share.js', () => {
  const { imports } = readModule('tuning.js');
  assert.deepEqual([...imports].sort(), ['calc.js', 'needlecatalog.js', 'needledb.js', 'share.js']);
});

test('tuning.js never reaches storage.js, i18n.js, localStorage or the DOM, not even transitively', () => {
  const seen = new Set();
  const queue = ['tuning.js'];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const { src, imports } = readModule(file);
    assert.doesNotMatch(src, /\blocalStorage\b|\bdocument\.|\bwindow\./, file);
    queue.push(...imports);
  }
  assert.ok(!seen.has('storage.js'));
  assert.ok(!seen.has('i18n.js'));
});

test('no mutation of ref, current or allNeedles', () => {
  const allNeedles = { ...NEEDLE_DB, Z1: { ...CUSTOM_VHSX } };
  const ref = { ...REF_VHSX };
  const current = { ...REF_VHSX, needleType: 'K96', clipPos: 5 };
  const snapshot = structuredClone({ allNeedles, ref, current });

  const evaluated = evaluateCandidates({ allNeedles, ref, current });
  const summary = rangeSummary(calcSetup(ref, allNeedles), calcSetup(current, allNeedles), current);
  for (let rangeIndex = 0; rangeIndex < TUNING_RANGES.length; rangeIndex++) {
    for (const dir of [1, -1]) {
      rankNextSteps(evaluated, {
        currentFlow: summary.map(r => r.flow), currentHdLimited: summary.map(r => r.hdLimited),
        rangeIndex, dir, current, customTypes: ['Z1'],
      });
    }
  }
  for (const field of ['nd', 'hd', 'needleJet']) {
    stepJet(current, field, 1);
    stepJet(current, field, -1);
  }

  assert.deepEqual({ allNeedles, ref, current }, snapshot);
});

// ── rangeSummary / hdLimited ─────────────────────────────────────────────────

test('rangeSummary(ref, ref): flow and diameter are 0 everywhere', () => {
  const result = calcSetup(REF_VHSX, NEEDLE_DB);
  const summary = rangeSummary(result, result, REF_VHSX);
  assert.deepEqual(summary.map(r => r.key), ['r0', 'r1', 'r2', 'r3', 'r4']);
  for (const r of summary) {
    assert.equal(r.flow, 0);
    assert.equal(r.diameter, 0);
    assert.equal(r.eqCand, r.eqRef);
    assert.ok(r.eqRef > 0);
  }
});

test('hdLimited: judged on the points past the idle-jet blend (≥ 35 %) only', () => {
  const result = calcSetup(REF_VHSX, NEEDLE_DB);
  assert.equal(hdLimited(result, REF_VHSX, 4), true);
  assert.equal(hdLimited(result, REF_VHSX, 2), false);
});

test('hdLimited: 0–1/8 and 1/8–1/4 are never limited — no point ≥ 35 %, not an empty every()', () => {
  // HD 0: every hdEquiv ≥ HD, so an every() over the blended points — or
  // over an empty set — would call these ranges limited.
  for (const hd of [0, 1, 20]) {
    const setup = { ...REF_VHSX, hd };
    const result = calcSetup(setup, NEEDLE_DB);
    assert.equal(hdLimited(result, setup, 0), false, `r0, hd ${hd}`);
    assert.equal(hdLimited(result, setup, 1), false, `r1, hd ${hd}`);
    const summary = rangeSummary(calcSetup(REF_VHSX, NEEDLE_DB), result, setup);
    assert.deepEqual(summary.slice(0, 2).map(r => r.hdLimited), [false, false], `summary, hd ${hd}`);
  }
});

test('hdLimited: 1/4–1/2 can be limited while its blended 30 % point is not', () => {
  // K27 C3: hdEquiv is 112.4 at 30 % and 118.0–133.0 at 35–50 %.
  const setup = { ...REF_VHSX, hd: 115 };
  const result = calcSetup(setup, NEEDLE_DB);
  const at = pct => result.curve.find(p => Math.round(p.tp * 100) === pct).hdEquiv;
  assert.ok(at(30) < setup.hd, '30 % point is not HD-limited');
  assert.ok([35, 40, 45, 50].every(pct => at(pct) >= setup.hd), '35–50 % are');
  assert.equal(hdLimited(result, setup, 2), true);
  // Just below the 35 % value the range is no longer limited.
  const higher = { ...REF_VHSX, hd: 119 };
  assert.equal(hdLimited(calcSetup(higher, NEEDLE_DB), higher, 2), false);
});

test('diameter is smaller than flow for positive changes', () => {
  const evaluated = evaluateCandidates({ allNeedles: NEEDLE_DB, ref: REF_VHSX, current: REF_VHSX });
  let checked = 0;
  for (const cand of evaluated) {
    cand.flow.forEach((flow, r) => {
      if (flow > 0) {
        assert.ok(cand.diameter[r] < flow, `${cand.needleType} C${cand.clipPos} r${r}`);
        checked++;
      }
    });
  }
  assert.ok(checked > 0);
});

// ── evaluateCandidates ───────────────────────────────────────────────────────

test('evaluateCandidates: all series of the carb type, current combo excluded, identical curves grouped', () => {
  const current = { ...REF_VHSX, needleType: 'K96', clipPos: 5 };
  const evaluated = evaluateCandidates({ allNeedles: NEEDLE_DB, ref: REF_VHSX, current });
  const members = evaluated.flatMap(c => [c, ...c.alsoTypes]);

  assert.ok(!members.some(c => c.needleType === 'K96' && c.clipPos === 5));
  assert.ok(members.some(c => c.needleType === 'K96' && c.clipPos === 4));
  assert.ok(members.some(c => c.needleType.startsWith('U')));
  assert.ok(members.every(c => NEEDLE_DB[c.needleType].carbType === 'VHSx'));

  const k27c4 = evaluated.find(c => c.needleType === 'K27' && c.clipPos === 4);
  assert.deepEqual(k27c4.alsoTypes, [{ needleType: 'K33', clipPos: 4 }]);
  assert.ok(!evaluated.some(c => c.needleType === 'K33' && c.clipPos === 4));

  // Jet values always come from current.
  for (const c of evaluated) {
    assert.equal(c.setup.hd, current.hd);
    assert.equal(c.setup.needleJet, current.needleJet);
  }
});

// ── rankNextSteps: VHSx regression ───────────────────────────────────────────

test('VHSx K27 C3: r1 richer → K96 C5, U7 C3, K97 C3', () => {
  const res = rank({ ref: REF_VHSX, rangeIndex: 1, dir: 1 });
  assert.equal(res.reason, null);
  assert.equal(res.suggestions.length, MAX_SUGGESTIONS);
  assert.ok(res.count >= MAX_SUGGESTIONS);
  const [first, second, third] = res.suggestions;

  assertSuggestion(first, 'K96', 5, [0.0, 2.9, 3.4, 0.0, 0.0]);
  assertSuggestion(second, 'U7', 3);
  assert.equal(second.tags.seriesChange, true);
  assert.equal(second.tags.clipsUnverified, true);
  assertSuggestion(third, 'K97', 3, [1.9, 6.3, 2.9, 0.0, 0.0]);

  assert.deepEqual(first.tags, { clipOnly: false, seriesChange: false, custom: false, clipsUnverified: false });
  for (const s of res.suggestions) assert.ok(s.inc >= MIN_STEP);
  assert.ok(first.cost <= second.cost && second.cost <= third.cost);
});

test('VHSx after K96 C5: r1 richer → K97 C3, then group K27 C4 / K33 C4', () => {
  const current = { ...REF_VHSX, needleType: 'K96', clipPos: 5 };
  const res = rank({ ref: REF_VHSX, current, rangeIndex: 1, dir: 1 });
  const [first, second] = res.suggestions;
  assertSuggestion(first, 'K97', 3);
  assertSuggestion(second, 'K27', 4, [1.9, 6.6, 3.2, 0.0, 0.0]);
  assert.deepEqual(second.alsoTypes, [{ needleType: 'K33', clipPos: 4 }]);
});

test('identical-curve group containing the current needle is shown as a clip-only change of it', () => {
  // K27 and K33 share their geometry, so K27 C2 and K33 C2 form one group.
  const fromK27 = rank({ ref: REF_VHSX, rangeIndex: 2, dir: -1 }).suggestions[2];
  assertSuggestion(fromK27, 'K27', 2);
  assert.deepEqual(fromK27.alsoTypes, [{ needleType: 'K33', clipPos: 2 }]);
  assert.equal(fromK27.tags.clipOnly, true);

  const refK33 = { ...REF_VHSX, needleType: 'K33' };
  const fromK33 = rank({ ref: refK33, rangeIndex: 2, dir: -1 }).suggestions[2];
  assertSuggestion(fromK33, 'K33', 2);
  assert.equal(fromK33.setup.needleType, 'K33');
  assert.deepEqual(fromK33.alsoTypes, [{ needleType: 'K27', clipPos: 2 }]);
  assert.equal(fromK33.tags.clipOnly, true);
  assert.equal(fromK33.cost, fromK27.cost, 'same clip bonus either way');
});

test('VHSx K27 C3: r4 richer → no suggestions, reason hdLimited', () => {
  const res = rank({ ref: REF_VHSX, rangeIndex: 4, dir: 1 });
  assert.deepEqual(res.suggestions, []);
  assert.equal(res.count, 0);
  assert.equal(res.reason, 'hdLimited');
  assert.equal(res.warning, false);
});

test('VHSx K27 C3: r3 leaner → K58 C2 with side-effect warning', () => {
  const res = rank({ ref: REF_VHSX, rangeIndex: 3, dir: -1 });
  assertSuggestion(res.suggestions[0], 'K58', 2);
  assert.equal(res.warning, true);
  assert.ok(res.suggestions[0].side > 3 * res.suggestions[0].inc);
});

test('every returned reason is listed in TUNING_REASONS', () => {
  const evaluated = evaluateCandidates({ allNeedles: NEEDLE_DB, ref: REF_VHSX, current: REF_VHSX });
  const reasons = new Set();
  for (let rangeIndex = 0; rangeIndex < TUNING_RANGES.length; rangeIndex++) {
    for (const dir of [1, -1]) {
      for (const hd of [true, false]) {
        const { reason } = rankNextSteps(dir > 0 ? [] : evaluated, {
          currentFlow: [0, 0, 0, 0, 0], currentHdLimited: Array(5).fill(hd), rangeIndex, dir, current: REF_VHSX,
        });
        if (reason != null) reasons.add(reason);
      }
    }
  }
  assert.deepEqual([...reasons].sort(), [...TUNING_REASONS].sort());
});

test('noCandidates when the range is not main-jet limited', () => {
  const res = rankNextSteps([], {
    currentFlow: [0, 0, 0, 0, 0], currentHdLimited: [false, false, false, false, true],
    rangeIndex: 1, dir: 1, current: REF_VHSX,
  });
  assert.equal(res.reason, 'noCandidates');
  assert.deepEqual(res.suggestions, []);
});

// ── rankNextSteps: PHBL regression ───────────────────────────────────────────

test('PHBL D36 C2: r2 richer → D21 C4, D34 C2, D31 C2 with no side effects', () => {
  const res = rank({ ref: REF_PHBL, rangeIndex: 2, dir: 1 });
  const [first, second, third] = res.suggestions;
  assertSuggestion(first, 'D21', 4, [0.0, 0.0, 1.6, 0.0, 0.0]);
  assertSuggestion(second, 'D34', 2, [0.0, 0.0, 1.7, 0.0, 0.0]);
  assertSuggestion(third, 'D31', 2, [0.0, 0.0, 3.4, 0.0, 0.0]);
  assert.equal(res.warning, false);
});

// ── Custom needles ───────────────────────────────────────────────────────────

test('custom needle of the same carb type is a candidate tagged custom; other carb types never', () => {
  const allNeedles = { ...NEEDLE_DB, Z1: CUSTOM_VHSX, Z2: CUSTOM_PHBL };
  const customTypes = ['Z1', 'Z2'];
  const evaluated = evaluateCandidates({ allNeedles, ref: REF_VHSX, current: REF_VHSX });
  const members = evaluated.flatMap(c => [c, ...c.alsoTypes]);

  assert.deepEqual(members.filter(c => c.needleType === 'Z1').map(c => c.clipPos), [1, 2, 3, 4]);
  assert.ok(!members.some(c => c.needleType === 'Z2'));

  const summary = rangeSummary(calcSetup(REF_VHSX, allNeedles), calcSetup(REF_VHSX, allNeedles), REF_VHSX);
  const res = rankNextSteps(evaluated.filter(c => c.needleType === 'Z1'), {
    currentFlow: summary.map(r => r.flow), currentHdLimited: summary.map(r => r.hdLimited),
    rangeIndex: 1, dir: 1, current: REF_VHSX, customTypes,
  });
  assert.ok(res.suggestions.length > 0);
  for (const s of res.suggestions) {
    assert.equal(s.needleType, 'Z1');
    assert.equal(s.tags.custom, true);
    assert.equal(s.tags.clipsUnverified, false);
  }

  // Ranked over everything, Z2 still never appears in any direction.
  for (let rangeIndex = 0; rangeIndex < TUNING_RANGES.length; rangeIndex++) {
    for (const dir of [1, -1]) {
      const all = rankNextSteps(evaluated, {
        currentFlow: summary.map(r => r.flow), currentHdLimited: summary.map(r => r.hdLimited),
        rangeIndex, dir, current: REF_VHSX, customTypes,
      });
      assert.ok(!all.suggestions.some(s => s.needleType === 'Z2'));
    }
  }
});

// ── stepJet ──────────────────────────────────────────────────────────────────

test('stepJet nd/hd: ±1 within the share.js bounds, null at the limits', () => {
  assert.deepEqual(stepJet(REF_VHSX, 'nd', 1), { ...REF_VHSX, nd: 51 });
  assert.deepEqual(stepJet(REF_VHSX, 'hd', -1), { ...REF_VHSX, hd: 127 });
  assert.equal(stepJet({ ...REF_VHSX, nd: ND_MAX }, 'nd', 1), null);
  assert.equal(stepJet({ ...REF_VHSX, nd: 0 }, 'nd', -1), null);
  assert.equal(stepJet({ ...REF_VHSX, hd: HD_MAX }, 'hd', 1), null);
  assert.equal(stepJet({ ...REF_VHSX, hd: 0 }, 'hd', -1), null);
  assert.deepEqual(stepJet({ ...REF_VHSX, hd: HD_MAX }, 'hd', -1), { ...REF_VHSX, hd: HD_MAX - 1 });
  assert.equal(stepJet({ ...REF_VHSX, nd: null }, 'nd', 1), null);
  assert.equal(stepJet(REF_VHSX, 'carbSize', 1), null);
});

test('stepJet needleJet: walks ATOMIZER_SIZES and jumps from off-list values', () => {
  const sizes = [...ATOMIZER_SIZES.DQ].sort((a, b) => a - b);

  const up = [];
  for (let s = { ...REF_VHSX, needleJet: sizes[0] }; s; s = stepJet(s, 'needleJet', 1)) up.push(s.needleJet);
  assert.deepEqual(up, sizes);

  const down = [];
  for (let s = { ...REF_VHSX, needleJet: sizes.at(-1) }; s; s = stepJet(s, 'needleJet', -1)) down.push(s.needleJet);
  assert.deepEqual(down, [...sizes].reverse());

  assert.equal(stepJet({ ...REF_VHSX, needleJet: 264.5 }, 'needleJet', 1).needleJet, 265);
  assert.equal(stepJet({ ...REF_VHSX, needleJet: 264.5 }, 'needleJet', -1).needleJet, 264);
  assert.equal(stepJet({ ...REF_VHSX, needleJet: 250 }, 'needleJet', 1).needleJet, sizes[0]);
  assert.equal(stepJet({ ...REF_VHSX, needleJet: 250 }, 'needleJet', -1), null);
  assert.equal(stepJet({ ...REF_VHSX, needleJet: 290 }, 'needleJet', -1).needleJet, sizes.at(-1));
  assert.equal(stepJet({ ...REF_VHSX, needleJet: 290 }, 'needleJet', 1), null);
  assert.equal(stepJet({ ...REF_VHSX, jetType: 'XX' }, 'needleJet', 1), null);
});

// ── formatSignedPercent ──────────────────────────────────────────────────────

test('formatSignedPercent: sign, decimal point, space before %', () => {
  assert.equal(formatSignedPercent(6.28), '+6.3 %');
  assert.equal(formatSignedPercent(-2), '\u22122.0 %');
  assert.equal(formatSignedPercent(0), '0.0 %');
  assert.equal(formatSignedPercent(-0.04), '0.0 %');
  assert.equal(formatSignedPercent(0.04), '0.0 %');
  assert.equal(formatSignedPercent(12.345, 2), '+12.35 %');
  assert.equal(formatSignedPercent(null), '–');
  assert.equal(formatSignedPercent(NaN), '–');
});

// ── validateTuningSetup ──────────────────────────────────────────────────────

test('validateTuningSetup: accepts complete, whitelisted setups', () => {
  assert.deepEqual(validateTuningSetup(REF_VHSX, { allNeedles: NEEDLE_DB, carbType: 'VHSx' }), { ok: true });
  assert.deepEqual(validateTuningSetup(REF_PHBL, { allNeedles: NEEDLE_DB, carbType: 'PHBL' }), { ok: true });
  // Bounds are inclusive.
  assert.deepEqual(validateTuningSetup({ ...REF_VHSX, nd: 0, hd: HD_MAX }, { allNeedles: NEEDLE_DB, carbType: 'VHSx' }), { ok: true });
  assert.deepEqual(validateTuningSetup({ ...REF_VHSX, nd: ND_MAX, hd: 0 }, { allNeedles: NEEDLE_DB, carbType: 'VHSx' }), { ok: true });
});

test('validateTuningSetup: reports the first invalid field', () => {
  const check = (patch, carbType = 'VHSx', allNeedles = NEEDLE_DB) =>
    validateTuningSetup({ ...REF_VHSX, ...patch }, { allNeedles, carbType });
  assert.deepEqual(check({ needleType: 'K999' }), { ok: false, field: 'needleType' });
  assert.deepEqual(check({ needleType: null }), { ok: false, field: 'needleType' });
  assert.deepEqual(check({}, 'PHBL'), { ok: false, field: 'needleType' });
  assert.deepEqual(check({ clipPos: 0 }), { ok: false, field: 'clipPos' });
  assert.deepEqual(check({ clipPos: 6 }), { ok: false, field: 'clipPos' }); // K27 has 5 grooves
  assert.deepEqual(check({ clipPos: 2.5 }), { ok: false, field: 'clipPos' });
  assert.deepEqual(check({ carbSize: 33 }), { ok: false, field: 'carbSize' });
  assert.deepEqual(check({ jetType: 'AQ' }), { ok: false, field: 'jetType' });
  assert.deepEqual(check({ needleJet: 259 }), { ok: false, field: 'needleJet' });
  assert.deepEqual(check({ nd: ND_MAX + 1 }), { ok: false, field: 'nd' });
  assert.deepEqual(check({ nd: null }), { ok: false, field: 'nd' });
  assert.deepEqual(check({ hd: -1 }), { ok: false, field: 'hd' });
  assert.deepEqual(check({ hd: NaN }), { ok: false, field: 'hd' });
  assert.deepEqual(check({ needleType: 'K999', hd: -1 }), { ok: false, field: 'needleType' });
});

test('validateTuningSetup: custom needles via allNeedles, with their own clip count', () => {
  const allNeedles = { ...NEEDLE_DB, Z1: CUSTOM_VHSX, Z2: CUSTOM_PHBL };
  const ok = s => validateTuningSetup({ ...REF_VHSX, ...s }, { allNeedles, carbType: 'VHSx' });
  assert.deepEqual(ok({ needleType: 'Z1', clipPos: 4 }), { ok: true });
  assert.deepEqual(ok({ needleType: 'Z1', clipPos: 5 }), { ok: false, field: 'clipPos' });
  assert.deepEqual(ok({ needleType: 'Z2', clipPos: 1 }), { ok: false, field: 'needleType' });
  // Without allNeedles containing it, a custom type is unknown.
  assert.deepEqual(validateTuningSetup({ ...REF_VHSX, needleType: 'Z1' }, { allNeedles: NEEDLE_DB, carbType: 'VHSx' }),
    { ok: false, field: 'needleType' });
});

test('validateTuningSetup: does not mutate its inputs', () => {
  const setup = { ...REF_VHSX };
  const allNeedles = { ...NEEDLE_DB, Z1: { ...CUSTOM_VHSX } };
  const snapshot = structuredClone({ setup, allNeedles });
  validateTuningSetup(setup, { allNeedles, carbType: 'VHSx' });
  assert.deepEqual({ setup, allNeedles }, snapshot);
});
