// cutaway.js — Recommended slide cutaway calculation
// Heuristic source: M. Forrest, dragonfly75.com (unverified — see disclaimer in i18n)
// Scoped to 2-stroke round-slide carburetors only.
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

const RATIO_MIN = 0.45;
const RATIO_MAX = 0.8;

const SLIDE_SIZES = {
  VHSx: [30, 35, 40, 45, 50, 55, 60],
  PHBH: [30, 35, 40, 45, 50, 55, 60, 65, 70],
  PHBL: [30, 35, 40, 45, 50, 55, 60],
};

// Explicit allowlist — any future 4-stroke or flat-slide carb type is excluded by omission
const ROUND_SLIDE_2STROKE = new Set(['VHSx', 'PHBH', 'PHBL']);

export function isRoundSlide2Stroke(carbType) {
  return ROUND_SLIDE_2STROKE.has(carbType);
}

/**
 * @param {number} carbSize     Carb bore diameter (mm)
 * @param {number} mainJetNum   Main jet number (s.hd, e.g. 175 → 1.75 mm Ø)
 * @param {number} needleJetNum Needle jet number (s.needleJet, e.g. 262 → 2.62 mm Ø)
 * @param {number} needleA      Needle shank diameter (needle.A in mm)
 */
export function calcCutaway(carbSize, mainJetNum, needleJetNum, needleA) {
  const mainArea    = Math.PI * Math.pow((mainJetNum / 100) / 2, 2);
  const njHoleArea  = Math.PI * Math.pow((needleJetNum / 100) / 2, 2);
  const needleArea  = Math.PI * Math.pow(needleA / 2, 2);
  const annulusArea = njHoleArea - needleArea;
  const ratio       = annulusArea / mainArea;

  // Needle shank meets or exceeds the needle-jet bore — no annulus left to flow through.
  if (!(annulusArea > 0)) {
    return { cutawayRaw: null, cutawayClamped: null, ratio, ratioOk: false };
  }

  const cutawayRaw  = (0.14 * carbSize * mainArea) / (1.87 * annulusArea);
  const min = carbSize / 10;
  const max = carbSize / 4;
  const cutawayClamped = Math.max(min, Math.min(max, cutawayRaw));
  return { cutawayRaw, cutawayClamped, ratio, ratioOk: ratio >= RATIO_MIN && ratio <= RATIO_MAX };
}

export function snapToSlide(cutawayMM, carbType) {
  const sizes = SLIDE_SIZES[carbType];
  if (!sizes) return null;
  const targetNum = cutawayMM * 10;
  return sizes.reduce((best, n) =>
    Math.abs(n - targetNum) < Math.abs(best - targetNum) ? n : best
  );
}
