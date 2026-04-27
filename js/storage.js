// storage.js — localStorage abstraction for setups and custom needles
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

import { NEEDLE_DB } from './needledb.js';

const STORAGE_KEY        = 'dellorto_setups';
const CUSTOM_NEEDLES_KEY = 'dellorto_custom_needles';

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

export function getAllNeedles() {
  const custom = loadCustomNeedles();
  const customMap = Object.fromEntries(
    custom.map(n => {
      const entry = { a: n.a, b: n.b, c: n.c };
      if (n.d != null && n.e != null) { entry.d = n.d; entry.e = n.e; }
      if (n.f != null)                { entry.f = n.f; }
      return [n.type, entry];
    })
  );
  // Custom needles override base DB on conflict
  return { ...NEEDLE_DB, ...customMap };
}
