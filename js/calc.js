// calc.js — Calculation engine
// Ported 1:1 from Excel formulas in "Calc Data" sheet
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

import { NEEDLE_DB, NEEDLE_LENGTHS, JET_OFFSETS } from './needledb.js';

const CLIP_SPACING = 1.2;   // mm between clip groove positions
const MIN_EXPOSED  = 26.4;  // mm minimum exposed needle length at idle

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
  const needleLength = NEEDLE_LENGTHS[needleType[0]] ?? 73.5;
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
  const idlePos = needleLength - MIN_EXPOSED
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

  const maxHD = Math.max(...curve.map(p => p.hdEquiv));

  return { idlePos, tapers, t1_k, t1_d, t2_k, curve, maxHD };
}

export function calcNeedleProfile(needleType, needleSource) {
  const db = needleSource || NEEDLE_DB;
  const needle = db[needleType];
  if (!needle) return [];

  const tapers = needle.F ? 3 : needle.E ? 2 : 1;
  const t1_k = tapers === 1
    ? (needle.A - needle.B) / needle.C
    : (needle.A - needle.D) / (needle.C - needle.E);
  const t1_d = tapers === 1 ? needle.B : needle.D;
  const t2_k = tapers === 1
    ? 0
    : (needle.D - needle.B) / (needle.E - (needle.F || 0));

  const pts = [];
  for (let pos = 0; pos <= needle.C + 2; pos += 0.5) {
    const e = needle.E || 0;
    const f = needle.F || 0;
    let diam;
    if (pos > needle.C)  diam = needle.A;
    else if (pos < f)    diam = needle.B;
    else if (pos <= e)   diam = t2_k * (pos - f) + needle.B;
    else                 diam = t1_k * (pos - e) + t1_d;
    pts.push({ pos, diam });
  }
  return pts;
}
