// test/share.test.mjs — Regression tests for js/share.js
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0
//
// Plain Node.js built-in test runner (`node --test`), no dependencies,
// consistent with the project's "no build tool" philosophy. Run with:
//
//   node --test test/

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARE_VERSION, isSlotEmpty, stateKey, hasShareParams, encodeShare, decodeShare,
} from '../js/share.js';

function emptySlot(id) {
  return {
    id, name: `#${id}`, needleType: null, clipPos: null, carbSize: null,
    needleJet: null, jetType: null, nd: null, hd: null,
  };
}

// Fills slots 4-5 (and any gaps) with empty defaults so callers only need
// to spell out the slots they care about.
function fillSlots(partial) {
  const byId = new Map(partial.map(s => [s.id, s]));
  return Array.from({ length: 5 }, (_, i) => byId.get(i + 1) ?? emptySlot(i + 1));
}

// The three demo setups from CLAUDE.md, ported inline (K98 needle, VHSx carb).
const DEMO_SETUPS = fillSlots([
  { id: 1, name: '#1 Simonini Grund', needleType: 'K98', clipPos: 3, carbSize: 30, needleJet: 262, jetType: 'DP', nd: 53, hd: 175 },
  { id: 2, name: '#2 Simonini 6.6.23', needleType: 'K98', clipPos: 1, carbSize: 30, needleJet: 268, jetType: 'DQ', nd: 53, hd: 155 },
  { id: 3, name: '#3 Test', needleType: 'K98', clipPos: 1, carbSize: 30, needleJet: 267, jetType: 'DQ', nd: 55, hd: 155 },
]);

function roundTrip(state) {
  const encoded = encodeShare(state, { baseUrl: 'https://example.com/' });
  assert.equal(encoded.ok, true, `encodeShare failed: ${JSON.stringify(encoded)}`);
  const url = new URL(encoded.url);
  const decoded = decodeShare(url.search);
  assert.equal(decoded.ok, true, `decodeShare failed: ${JSON.stringify(decoded)}`);
  return decoded;
}

test('SHARE_VERSION is 1', () => {
  assert.equal(SHARE_VERSION, 1);
});

test('isSlotEmpty: default slot is empty', () => {
  assert.equal(isSlotEmpty(emptySlot(3)), true);
});

test('isSlotEmpty: renamed empty slot is not empty', () => {
  assert.equal(isSlotEmpty({ ...emptySlot(3), name: 'My rig' }), false);
});

test('isSlotEmpty: slot with any non-null field is not empty', () => {
  assert.equal(isSlotEmpty({ ...emptySlot(3), needleType: 'K98' }), false);
});

test('round-trip: three demo setups', () => {
  const decoded = roundTrip({ carbType: 'VHSx', setups: DEMO_SETUPS });
  assert.equal(decoded.warnings.length, 0);
  assert.equal(decoded.state.carbType, 'VHSx');
  assert.deepEqual(decoded.state.setups[0], DEMO_SETUPS[0]);
  assert.deepEqual(decoded.state.setups[1], DEMO_SETUPS[1]);
  assert.deepEqual(decoded.state.setups[2], DEMO_SETUPS[2]);
  // Slots 4-5 stayed empty
  assert.deepEqual(decoded.state.setups[3], emptySlot(4));
  assert.deepEqual(decoded.state.setups[4], emptySlot(5));
});

test('round-trip: carbSize 39.5', () => {
  const setups = fillSlots([
    { id: 1, name: '#1', needleType: 'K98', clipPos: 1, carbSize: 39.5, needleJet: 262, jetType: 'DP', nd: 53, hd: 175 },
  ]);
  const decoded = roundTrip({ carbType: 'VHSx', setups });
  assert.equal(decoded.warnings.length, 0);
  assert.equal(decoded.state.setups[0].carbSize, 39.5);
});

test('round-trip: partial setup (only needle, clip, bore chosen)', () => {
  const setups = fillSlots([
    { id: 1, name: '#1', needleType: 'K98', clipPos: 1, carbSize: 30, needleJet: null, jetType: null, nd: null, hd: null },
  ]);
  const decoded = roundTrip({ carbType: 'VHSx', setups });
  assert.equal(decoded.warnings.length, 0);
  assert.deepEqual(decoded.state.setups[0], setups[0]);
});

test('round-trip: umlaut and space in name', () => {
  const setups = fillSlots([
    { id: 1, name: 'Käfer Öl Übung', needleType: 'K98', clipPos: 1, carbSize: 30, needleJet: 262, jetType: 'DP', nd: 53, hd: 175 },
  ]);
  const decoded = roundTrip({ carbType: 'VHSx', setups });
  assert.equal(decoded.warnings.length, 0);
  assert.equal(decoded.state.setups[0].name, 'Käfer Öl Übung');
});

test('name longer than 30 characters is truncated', () => {
  const longName = 'This name is definitely longer than thirty characters';
  const setups = fillSlots([
    { id: 1, name: longName, needleType: 'K98', clipPos: 1, carbSize: 30, needleJet: 262, jetType: 'DP', nd: 53, hd: 175 },
  ]);
  const decoded = roundTrip({ carbType: 'VHSx', setups });
  assert.equal(decoded.state.setups[0].name, longName.slice(0, 30));
  assert.equal(decoded.state.setups[0].name.length, 30);
});

test('<script> in name stays plain text', () => {
  const evilName = '<script>alert(1)</script>';
  const setups = fillSlots([
    { id: 1, name: evilName, needleType: 'K98', clipPos: 1, carbSize: 30, needleJet: 262, jetType: 'DP', nd: 53, hd: 175 },
  ]);
  const decoded = roundTrip({ carbType: 'VHSx', setups });
  assert.equal(decoded.state.setups[0].name, evilName);
  assert.equal(typeof decoded.state.setups[0].name, 'string');
});

test('unknown version fails decode', () => {
  const result = decodeShare('?v=2&c=VHSx&s1=K98-1-30-262-DP-53-175');
  assert.deepEqual(result, { ok: false, reason: 'version' });
});

test('missing version fails decode', () => {
  const result = decodeShare('?c=VHSx&s1=K98-1-30-262-DP-53-175');
  assert.deepEqual(result, { ok: false, reason: 'version' });
});

test('invalid carbType fails decode', () => {
  const result = decodeShare('?v=1&c=NOTACARB&s1=K98-1-30-262-DP-53-175');
  assert.deepEqual(result, { ok: false, reason: 'carbType' });
});

test('invalid fields become null with a warning', () => {
  // needleJet 999 is not a valid DP atomizer size, hd 9999 is out of range.
  const result = decodeShare('?v=1&c=VHSx&s1=K98-1-30-999-DP-53-9999');
  assert.equal(result.ok, true);
  const slot = result.state.setups[0];
  assert.equal(slot.needleType, 'K98');
  assert.equal(slot.needleJet, null);
  assert.equal(slot.hd, null);
  assert.ok(result.warnings.some(w => w.slot === 1 && w.field === 'needleJet'));
  assert.ok(result.warnings.some(w => w.slot === 1 && w.field === 'hd'));
});

test('clipPos beyond getClipCount(needleType) becomes null with a warning', () => {
  // K1 has clips: 3, so clip position 4 is out of range.
  const result = decodeShare('?v=1&c=VHSx&s1=K1-4-30-262-DP-53-175');
  assert.equal(result.ok, true);
  const slot = result.state.setups[0];
  assert.equal(slot.needleType, 'K1');
  assert.equal(slot.clipPos, null);
  assert.ok(result.warnings.some(w => w.slot === 1 && w.field === 'clipPos'));
});

test('encodeShare: custom needle blocks sharing', () => {
  const setups = fillSlots([
    { id: 1, name: '#1', needleType: 'K999-CUSTOM', clipPos: 1, carbSize: 30, needleJet: 262, jetType: 'DP', nd: 53, hd: 175 },
  ]);
  const result = encodeShare({ carbType: 'VHSx', setups });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'customNeedle');
  assert.equal(result.details.length, 1);
  assert.equal(result.details[0].needleType, 'K999-CUSTOM');
});

test('encodeShare: only empty slots fails with noActiveSetups', () => {
  const result = encodeShare({ carbType: 'VHSx', setups: fillSlots([]) });
  assert.deepEqual(result, { ok: false, reason: 'noActiveSetups' });
});

test('hasShareParams: true only when "v" param is present', () => {
  assert.equal(hasShareParams('?v=1&c=VHSx'), true);
  assert.equal(hasShareParams('?c=VHSx'), false);
  assert.equal(hasShareParams(''), false);
});

test('stateKey: same content produces the same key regardless of extra properties', () => {
  const state = { carbType: 'VHSx', setups: DEMO_SETUPS };
  const stateWithExtra = {
    carbType: 'VHSx',
    setups: DEMO_SETUPS.map(s => ({ ...s, _uiHighlighted: true })),
  };
  assert.equal(stateKey(state), stateKey(stateWithExtra));
});

test('stateKey: differing content produces a different key', () => {
  const a = { carbType: 'VHSx', setups: DEMO_SETUPS };
  const b = { carbType: 'VHSx', setups: fillSlots([{ ...DEMO_SETUPS[0], hd: 999 }, DEMO_SETUPS[1], DEMO_SETUPS[2]]) };
  assert.notEqual(stateKey(a), stateKey(b));
});
