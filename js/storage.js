// storage.js — localStorage abstraction for setups and custom needles
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

import { NEEDLE_DB, getClipCount } from './needledb.js';

const STORAGE_KEY        = 'dellorto_setups';
const CUSTOM_NEEDLES_KEY = 'dellorto_custom_needles';
const CARB_TYPE_KEY      = 'dellorto_carb_type';

const DEFAULT_SETUPS = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  name: `#${i + 1}`,
  needleType: null,
  clipPos: null,
  carbSize: null,
  needleJet: null,
  jetType: null,
  nd: null,
  hd: null,
}));

export function loadSetups() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(DEFAULT_SETUPS);

  const setups = JSON.parse(raw);

  // Per-needle clip-position counts (js/needledb.js `clips` field) are newer
  // than some stored setups: a clipPos saved back when every needle allowed
  // a uniform 1–4 range can now exceed its needle's actual count (e.g. many
  // K-needles cap at 3). Clear any such stale value here, the same way the
  // old K90→K96 migration used to normalize stale data on load — silently,
  // once, at load time — rather than leaving calcSetup() to silently compute
  // from a clip position that no longer exists on that needle.
  const allNeedles = getAllNeedles();
  let reconciled = false;
  setups.forEach(s => {
    if (s.needleType && s.clipPos != null) {
      const maxClips = allNeedles[s.needleType]?.clips ?? getClipCount(s.needleType);
      if (s.clipPos > maxClips) {
        s.clipPos = null;
        reconciled = true;
      }
    }
  });
  if (reconciled) {
    console.info('[storage] Cleared out-of-range clipPos value(s) — needle clip-position count changed since these setups were saved.');
    saveSetups(setups);
  }

  return setups;
}

export function saveSetups(setups) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(setups));
}

export function loadCustomNeedles() {
  const raw = localStorage.getItem(CUSTOM_NEEDLES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveCustomNeedles(needles) {
  localStorage.setItem(CUSTOM_NEEDLES_KEY, JSON.stringify(needles));
}

export function loadCarbType() {
  return localStorage.getItem(CARB_TYPE_KEY) || 'VHSx';
}

export function saveCarbType(ct) {
  localStorage.setItem(CARB_TYPE_KEY, ct);
}

export function getAllNeedles() {
  const custom = loadCustomNeedles();
  const customMap = Object.fromEntries(
    custom.map(n => {
      const entry = { carbType: n.carbType, A: n.A, B: n.B, C: n.C };
      if (n.length != null)           { entry.length = n.length; }
      if (n.D != null && n.E != null) { entry.D = n.D; entry.E = n.E; }
      if (n.F != null)                { entry.F = n.F; }
      if (n.clips != null)            { entry.clips = n.clips; }
      return [n.type, entry];
    })
  );
  // Custom needles override base DB on conflict
  return { ...NEEDLE_DB, ...customMap };
}
