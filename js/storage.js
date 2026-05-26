// storage.js — localStorage abstraction for setups and custom needles
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

import { NEEDLE_DB } from './needledb.js';

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
  return raw ? JSON.parse(raw) : structuredClone(DEFAULT_SETUPS);
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

export function getAllNeedles(carbType) {
  const custom = loadCustomNeedles()
    .filter(n => !carbType || n.carbType === carbType);
  const customMap = Object.fromEntries(
    custom.map(n => {
      const entry = { A: n.A, B: n.B, C: n.C };
      if (n.D != null && n.E != null) { entry.D = n.D; entry.E = n.E; }
      if (n.F != null)                { entry.F = n.F; }
      return [n.type, entry];
    })
  );
  // Custom needles override base DB on conflict
  return { ...NEEDLE_DB, ...customMap };
}
