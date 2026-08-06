// calc.js — Calculation engine
// Ported 1:1 from Excel formulas in "Calc Data" sheet
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

import { NEEDLE_DB, NEEDLE_LENGTHS, JET_OFFSETS } from './needledb.js';

const CLIP_SPACING = 1.2;   // mm between clip groove positions

// Minimum exposed needle length at idle (mm), by carburetor family.
// VHSx: 26.4 — from the original GUE spreadsheet (K/U needles).
// PHBL: 16.3 — measured 2026-08 on a 26 mm PHBL with D36 needle + AQ
//              atomizer (idlePos 31.7 mm at clip 1, cross-verified against
//              an independent measurement chain).
// PHBH: 26.4 — inherited from VHSx, NOT independently verified.
const MIN_EXPOSED_BY_CARB_TYPE = {
  VHSx: 26.4,
  PHBH: 26.4,
  PHBL: 16.3,
};
const MIN_EXPOSED_DEFAULT = 26.4;

const THROTTLE_POINTS = [
  0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45,
  0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95,
  1.0, 1.05, 1.1, 1.15,
];

// Blending weights [ndWeight, hdWeight] for throttle positions 0–0.30
const BLEND = {
  0:    [1,    0   ],
  0.05: [0.8,  0.2 ],
  0.1:  [0.6,  0.4 ],
  0.15: [0.4,  0.6 ],
  0.2:  [0.2,  0.8 ],
  0.25: [0.1,  0.9 ],
  0.3:  [0.05, 0.95],
};

export function calcSetup(setup, needleSource) {
  const { needleType, clipPos, carbSize, needleJet, jetType, nd, hd } = setup;
  const db = needleSource || NEEDLE_DB;
  if (!needleType || !db[needleType]) return null;

  const needle = db[needleType];
  let needleLength = needle.length ?? NEEDLE_LENGTHS[needleType[0]] ?? 73.5;
  if (needleType === 'X37') needleLength = 56.2;
  const needleOffset = JET_OFFSETS[jetType] ?? 0;
  const tapers = needle.F ? 3 : needle.E ? 2 : 1;

  // Taper slope (k) and diameter start point for taper 1
  const t1_k = tapers === 1
    ? (needle.A - needle.B) / needle.C
    : (needle.A - needle.D) / (needle.C - needle.E);
  const t1_d = tapers === 1 ? needle.B : needle.D;

  // Taper slope for taper 2 (0 for single-taper needles)
  const t2_k = tapers === 1
    ? 0
    : (needle.D - needle.B) / (needle.E - (needle.F || 0));

  // Needle position at idle (Excel B7)
  const minExposed = MIN_EXPOSED_BY_CARB_TYPE[needle.carbType] ?? MIN_EXPOSED_DEFAULT;
  const idlePos = needleLength - minExposed
    - (clipPos - 1) * CLIP_SPACING
    + needleOffset
    + (carbSize - 34) / 2;

  const curve = THROTTLE_POINTS.map(tp => {
    const pos = idlePos - tp * carbSize;
    const e   = needle.E || 0;
    const f   = needle.F || 0;

    let diam;
    if (pos > needle.C)  diam = needle.A;
    else if (pos < 0)    diam = 0;
    else if (pos < f)    diam = needle.B;
    else if (pos <= e)   diam = t2_k * (pos - f) + needle.B;
    else                 diam = t1_k * (pos - e) + t1_d;

    const hdEquiv = Math.sqrt(Math.max(0, needleJet ** 2 - (diam * 100) ** 2));

    let overall;
    const blend = BLEND[tp];
    if (blend) {
      overall = nd * blend[0] + hdEquiv * blend[1];
    } else {
      overall = Math.min(hd, hdEquiv);
    }

    return { tp, pos, diam, hdEquiv, overall };
  });

  // "max HD" is evaluated at 100 % throttle (WOT), matching the original
  // spreadsheet — NOT the maximum across the whole curve. Values beyond
  // 100 % are extrapolation and must not influence this figure.
  const wot = curve.find(p => Math.abs(p.tp - 1.0) < 1e-9);
  const maxHD = wot ? wot.hdEquiv : Math.max(...curve.map(p => p.hdEquiv));

  return { idlePos, tapers, t1_k, t1_d, t2_k, curve, maxHD };
}
