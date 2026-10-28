// test/clipcount.test.mjs — One clip count per needle, everywhere
// Copyright (C) 2014 GUE — GPL v2.0
//
// Plain Node.js built-in test runner (`node --test`), no dependencies.
// resolveNeedleClips() in js/needledb.js is the single source of truth for
// a needle's clip count. This guards that every consumer — resolveClipCount,
// getClipGeometry, the catalog rows, the fine tuning candidates and
// validation, and the clipPos cleanup in loadSetups() — agrees with it for
// a base needle with its own `clips`, a base needle on its series default
// and custom needles with and without `clips`.

import test from 'node:test';
import assert from 'node:assert/strict';

// storage.js reads localStorage; a minimal in-memory stub lets the test go
// through the real getAllNeedles() / loadSetups() path.
const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
};

const { NEEDLE_DB, CLIP_GEOMETRY_BY_COUNT, CLIP_TOP_OFFSET_REF, getClipCount, getClipGeometry,
        resolveNeedleClips, resolveClipCount } = await import('../js/needledb.js');
const { saveCustomNeedles, getAllNeedles, saveSetups, loadSetups } = await import('../js/storage.js');
const { buildCatalogRows } = await import('../js/needlecatalog.js');
const { evaluateCandidates, validateTuningSetup } = await import('../js/tuning.js');

const CUSTOM = [
  { type: 'Z1', carbType: 'VHSx', A: 2.5, B: 1.75, C: 43, clips: 3, length: 73.5 },
  { type: 'Z2', carbType: 'VHSx', A: 2.5, B: 1.7, C: 41, length: 73.5 }, // no clips → series default
];
saveCustomNeedles(CUSTOM);
const allNeedles = getAllNeedles();

// type → expected count, spelled out so a wrong resolution can't hide
// behind "everything agrees with the same wrong value".
const CASES = {
  K27: 5,                   // NEEDLE_DB entry with its own clips
  U7: getClipCount('U7'),   // NEEDLE_DB entry without clips → series default
  Z1: 3,                    // custom needle with clips
  Z2: getClipCount('Z2'),   // custom needle without clips → default
};

const REF = { needleType: 'K27', clipPos: 3, carbSize: 34, jetType: 'DQ', needleJet: 264, nd: 50, hd: 128 };

test('the cases cover own clips and defaults', () => {
  assert.equal(NEEDLE_DB.K27.clips, 5);
  assert.equal(NEEDLE_DB.U7.clips, undefined);
  assert.equal(CASES.U7, 4);
  assert.equal(CASES.Z2, 4);
});

test('resolveNeedleClips and resolveClipCount agree', () => {
  for (const [type, expected] of Object.entries(CASES)) {
    assert.equal(resolveNeedleClips(type, allNeedles[type]), expected, type);
    assert.equal(resolveClipCount(type, allNeedles), expected, type);
  }
  // Without allNeedles a custom type is unknown and falls back to the default.
  assert.equal(resolveClipCount('Z1'), getClipCount('Z1'));
});

test('getClipGeometry uses the same count (built-in); custom needles keep the 4-groove reference', () => {
  for (const type of ['K27', 'U7']) {
    const expected = CLIP_GEOMETRY_BY_COUNT[CASES[type]];
    const { spacing, topOffset } = getClipGeometry(allNeedles[type], type);
    assert.deepEqual({ spacing, topOffset }, { spacing: expected.spacing, topOffset: expected.topOffset }, type);
  }
  for (const type of ['Z1', 'Z2']) {
    assert.equal(getClipGeometry(allNeedles[type], type).topOffset, CLIP_TOP_OFFSET_REF, type);
  }
});

test('catalog rows show the same count', () => {
  const rows = buildCatalogRows({ allNeedles, carbType: 'VHSx', customTypes: CUSTOM.map(n => n.type) });
  for (const [type, expected] of Object.entries(CASES)) {
    assert.equal(rows.find(r => r.type === type).clips, expected, type);
  }
});

test('fine tuning evaluates exactly those clip positions and validates against them', () => {
  const evaluated = evaluateCandidates({ allNeedles, ref: REF, current: REF });
  const members = evaluated.flatMap(c => [c, ...c.alsoTypes]);
  for (const [type, expected] of Object.entries(CASES)) {
    const positions = members.filter(m => m.needleType === type).map(m => m.clipPos).sort((a, b) => a - b);
    // The current combination (K27 C3) is excluded from the candidates.
    const all = Array.from({ length: expected }, (_, i) => i + 1).filter(p => !(type === 'K27' && p === 3));
    assert.deepEqual(positions, all, type);

    const setup = { ...REF, needleType: type };
    assert.deepEqual(validateTuningSetup({ ...setup, clipPos: expected }, { allNeedles, carbType: 'VHSx' }), { ok: true }, type);
    assert.deepEqual(validateTuningSetup({ ...setup, clipPos: expected + 1 }, { allNeedles, carbType: 'VHSx' }),
      { ok: false, field: 'clipPos' }, type);
  }
});

test('loadSetups keeps clipPos up to that count and clears it above', () => {
  const entries = Object.entries(CASES);
  const setups = [1, 2, 3, 4, 5].map(id => {
    const [type, count] = entries[(id - 1) % entries.length];
    // Slots 1–4 at the last valid position, slot 5 (K27 again) one above.
    const clipPos = id === 5 ? count + 1 : count;
    return { id, name: `#${id}`, needleType: type, clipPos, carbSize: 34, needleJet: 264, jetType: 'DQ', nd: 50, hd: 128 };
  });
  saveSetups(setups);
  const loaded = loadSetups();
  assert.deepEqual(loaded.map(s => s.clipPos), [CASES.K27, CASES.U7, CASES.Z1, CASES.Z2, null]);
});
