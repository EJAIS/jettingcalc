// tuning.js — Fine-tuning: per-range flow deltas against a reference setup
// and ranked next steps (needle/clip changes, jet steps).
// Pure ES module: no DOM access, no localStorage, no import of storage.js
// or i18n.js, so it can be unit-tested with plain node:test. It contains
// no user-visible text — only keys, codes and numbers. Custom needles come
// in as parameters (allNeedles, customTypes) instead of being loaded here.
// Every delta is derived from the full calcSetup() curve (curve[].overall).
// Copyright (C) 2014 GUE — GPL v2.0

import { calcSetup } from './calc.js';
import { ATOMIZER_SIZES, CARB_BORE_SIZES, CARB_TYPES, resolveClipCount } from './needledb.js';
import { compareNeedleTypes, getNeedleSeries, getClipsSource,
         CATALOG_EMPTY_VALUE } from './needlecatalog.js';
import { JET_FIELD_BOUNDS } from './share.js';

// Five throttle ranges on calcSetup()'s existing 5 % grid, points as
// integer percent. 1/8 throttle = 12.5 % is not on the grid, so the r0/r1
// boundary falls between 10 and 15 %. Points above 100 % are extrapolation
// and never contribute. `lever` is a plain code for the UI: the idle jet
// dominates r0, the needle (position/profile) every other range.
export const TUNING_RANGES = Object.freeze([
  { key: 'r0', points: [0, 5, 10],             lever: 'nd' },     // 0 – 1/8
  { key: 'r1', points: [15, 20, 25],           lever: 'needle' }, // 1/8 – 1/4
  { key: 'r2', points: [30, 35, 40, 45, 50],   lever: 'needle' }, // 1/4 – 1/2
  { key: 'r3', points: [55, 60, 65, 70, 75],   lever: 'needle' }, // 1/2 – 3/4
  { key: 'r4', points: [80, 85, 90, 95, 100],  lever: 'needle' }, // 3/4 – 1
].map(range => Object.freeze({ ...range, points: Object.freeze(range.points) })));

// Smallest flow change (percentage points) that counts as a step at all;
// finer changes are below what a rider can feel or a plug chop can show.
export const MIN_STEP = 1;
// Flow change (percentage points) from which a range delta is considered
// significant for display.
export const SIGNIFICANT = 2;
// Side-effect weights for the other ranges: a neighbouring range moving
// along is partly unavoidable with a tapered needle, so it costs half;
// ranges further away should stay put and cost in full.
export const SIDE_WEIGHT_ADJACENT = 0.5;
export const SIDE_WEIGHT_FAR = 1;
// Weight of side effects relative to overshooting the target range.
export const LAMBDA = 2;
// Cost bonus for a clip-only change (same needle): cheapest to try, no
// parts to buy.
export const CLIP_BONUS = 0.5;
// The best suggestion is flagged when its side effect exceeds this multiple
// of its intended change — the requested correction is not cleanly
// achievable with the needle alone.
export const WARN_SIDE_RATIO = 3;
export const MAX_SUGGESTIONS = 3;

// Every `reason` code rankNextSteps() can return besides null. The UI maps
// them to tuning.reason.* / tuning.reasonShort.* texts.
export const TUNING_REASONS = Object.freeze(['hdLimited', 'noCandidates']);

// First throttle point (integer percent) where calcSetup() no longer
// blends the idle jet in: its BLEND table in calc.js covers 0–30 %, from
// 35 % on overall = min(hd, hdEquiv). calc.js does not export BLEND and is
// deliberately left unchanged, so this mirrors it — keep both in sync.
const BLEND_END_PERCENT = 35;

// Precision for treating two curves as identical (identical geometry,
// e.g. K27 and K33).
const CURVE_KEY_PRECISION = 1e6;

const COST_EPSILON = 1e-9;

// Curve points of `result` for the given range, matched by integer percent
// (Math.round(tp * 100)) rather than float comparison.
function rangePoints(result, rangeIndex) {
  const wanted = new Set(TUNING_RANGES[rangeIndex].points);
  return result.curve.filter(p => wanted.has(Math.round(p.tp * 100)));
}

function mean(values) {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

// true when the range has points past the idle-jet blend (≥ 35 %) and at
// every one of them the needle opens more than the main jet: there the main
// jet alone meters fuel, so no needle change makes them richer. Blended
// points (≤ 30 %) are left out rather than disqualifying the range — else
// 1/4–1/2, which starts at 30 %, could never count as limited. Ranges with
// blended points only (0–1/8, 1/8–1/4) are never limited.
export function hdLimited(result, setup, rangeIndex) {
  const unblended = rangePoints(result, rangeIndex)
    .filter(p => Math.round(p.tp * 100) >= BLEND_END_PERCENT);
  return unblended.length > 0 && unblended.every(p => p.hdEquiv >= setup.hd);
}

// Per-range comparison of a candidate curve against the reference curve.
// flow: mean of (overall_cand² / overall_ref² − 1) × 100 — flow scales
//       with the open area, i.e. with the square of the equivalent jet.
//       Primary figure, used for ranking.
// diameter: mean of (overall_cand / overall_ref − 1) × 100 — display only.
// eqRef / eqCand: mean equivalent jet (overall) over the range.
// Points with overall_ref <= 0 are skipped; if none are left, the range's
// figures are null.
export function rangeSummary(refResult, candResult, candSetup) {
  return TUNING_RANGES.map((range, i) => {
    const refPoints = rangePoints(refResult, i);
    const candPoints = rangePoints(candResult, i);
    const flows = [];
    const diameters = [];
    const eqRefs = [];
    const eqCands = [];
    refPoints.forEach((refPoint, j) => {
      const ref = refPoint.overall;
      const cand = candPoints[j].overall;
      if (!(ref > 0)) return;
      flows.push((cand ** 2 / ref ** 2 - 1) * 100);
      diameters.push((cand / ref - 1) * 100);
      eqRefs.push(ref);
      eqCands.push(cand);
    });
    return {
      key: range.key,
      eqRef: mean(eqRefs),
      eqCand: mean(eqCands),
      flow: mean(flows),
      diameter: mean(diameters),
      hdLimited: hdLimited(candResult, candSetup, i),
    };
  });
}

function curveKey(result) {
  return result.curve
    .map(p => `${Math.round(p.overall * CURVE_KEY_PRECISION)}:${Math.round(p.hdEquiv * CURVE_KEY_PRECISION)}`)
    .join('|');
}

function compareTypeClip(a, b) {
  return compareNeedleTypes(a.needleType, b.needleType) || a.clipPos - b.clipPos;
}

// Every needle of the reference needle's carbType (all series) at every
// clip position, with the jet values (carbSize, jetType, needleJet, nd, hd)
// taken from `current`. The exact current needle + clip is excluded.
// Candidates with identical overall and hdEquiv curves are merged into one
// entry: the representative is the smallest type (compareNeedleTypes, then
// clipPos), the others are listed in alsoTypes. Computed once per current
// state and reused for every range and direction.
// Returns [{ needleType, clipPos, alsoTypes, setup, flow[5], diameter[5],
// eq[5] }] with flow/diameter/eq per TUNING_RANGES entry, against `ref`.
export function evaluateCandidates({ allNeedles, ref, current }) {
  const refResult = calcSetup(ref, allNeedles);
  const carbType = allNeedles[ref.needleType]?.carbType;
  if (!refResult || !carbType) return [];

  const { carbSize, jetType, needleJet, nd, hd } = current;
  const groups = new Map();

  for (const needleType of Object.keys(allNeedles)) {
    const needle = allNeedles[needleType];
    if (needle?.carbType !== carbType) continue;
    const clips = resolveClipCount(needleType, allNeedles);
    for (let clipPos = 1; clipPos <= clips; clipPos++) {
      if (needleType === current.needleType && clipPos === current.clipPos) continue;
      const setup = { needleType, clipPos, carbSize, jetType, needleJet, nd, hd };
      const result = calcSetup(setup, allNeedles);
      if (!result) continue;
      const key = curveKey(result);
      const member = { needleType, clipPos, setup, result };
      if (groups.has(key)) groups.get(key).push(member);
      else groups.set(key, [member]);
    }
  }

  return [...groups.values()].map(members => {
    const [rep, ...others] = members.sort(compareTypeClip);
    const summary = rangeSummary(refResult, rep.result, rep.setup);
    return {
      needleType: rep.needleType,
      clipPos: rep.clipPos,
      alsoTypes: others.map(({ needleType, clipPos }) => ({ needleType, clipPos })),
      setup: rep.setup,
      flow: summary.map(r => r.flow),
      diameter: summary.map(r => r.diameter),
      eq: summary.map(r => r.eqCand),
    };
  });
}

// A group of identical curves that contains the current needle (at another
// clip) is presented as that needle: the same curve is then a clip-only
// change instead of a needle swap. The former representative moves into
// alsoTypes. Other groups are returned unchanged.
function asSeenFrom(cand, current) {
  const own = cand.alsoTypes.find(a => a.needleType === current.needleType);
  if (!own) return cand;
  return {
    ...cand,
    needleType: own.needleType,
    clipPos: own.clipPos,
    setup: { ...cand.setup, needleType: own.needleType, clipPos: own.clipPos },
    alsoTypes: [{ needleType: cand.needleType, clipPos: cand.clipPos }, ...cand.alsoTypes.filter(a => a !== own)]
      .sort(compareTypeClip),
  };
}

function sideWeight(r, rangeIndex) {
  return Math.abs(r - rangeIndex) === 1 ? SIDE_WEIGHT_ADJACENT : SIDE_WEIGHT_FAR;
}

// Ranks the evaluated candidates for one range and direction.
// currentFlow: flow[5] of `current` against the reference (rangeSummary).
// currentHdLimited: hdLimited[5] of `current` (rangeSummary), only used to
//   explain an empty result.
// dir: +1 richer | −1 leaner.
// inc  = dir · (flow_R(cand) − flow_R(current)), only inc >= MIN_STEP.
// side = Σ_{r≠R} w_r · |flow_r(cand) − flow_r(current)| — measured against
//        current, not the reference, so ranges already tuned stay put.
// cost = (inc − MIN_STEP) + LAMBDA · side − (clipOnly ? CLIP_BONUS : 0).
// Returns { suggestions (≤ MAX_SUGGESTIONS), count, reason, warning }:
// reason: null | 'hdLimited' (no candidates and the range is main-jet
// limited in current) | 'noCandidates'; warning: the best suggestion's
// side effect exceeds WARN_SIDE_RATIO · inc.
export function rankNextSteps(evaluated, {
  currentFlow, currentHdLimited = [], rangeIndex, dir, current, customTypes = [],
}) {
  const target = currentFlow[rangeIndex];
  const ranked = [];

  if (target != null) {
    for (const group of evaluated) {
      const cand = asSeenFrom(group, current);
      const candTarget = cand.flow[rangeIndex];
      if (candTarget == null) continue;
      const inc = dir * (candTarget - target);
      if (inc < MIN_STEP) continue;

      let side = 0;
      cand.flow.forEach((flow, r) => {
        if (r === rangeIndex || flow == null || currentFlow[r] == null) return;
        side += sideWeight(r, rangeIndex) * Math.abs(flow - currentFlow[r]);
      });

      const isCustom = customTypes.includes(cand.needleType);
      const tags = {
        clipOnly: cand.needleType === current.needleType,
        seriesChange: getNeedleSeries(cand.needleType) !== getNeedleSeries(current.needleType),
        custom: isCustom,
        clipsUnverified: getClipsSource(cand.needleType, isCustom) === 'default',
      };
      const cost = (inc - MIN_STEP) + LAMBDA * side - (tags.clipOnly ? CLIP_BONUS : 0);
      ranked.push({ ...cand, inc, side, cost, tags });
    }
  }

  ranked.sort((a, b) => {
    if (Math.abs(a.cost - b.cost) > COST_EPSILON) return a.cost - b.cost;
    return compareTypeClip(a, b);
  });

  let reason = null;
  if (ranked.length === 0) {
    reason = currentHdLimited[rangeIndex] ? 'hdLimited' : 'noCandidates';
  }
  const best = ranked[0];

  return {
    suggestions: ranked.slice(0, MAX_SUGGESTIONS),
    count: ranked.length,
    reason,
    warning: best != null && best.side > WARN_SIDE_RATIO * best.inc,
  };
}

// Whitelist check before a tuning state is written into a setup slot —
// the same rules decodeShare() (share.js) applies to a share link, but
// against `allNeedles` (custom needles included) and the given carbType.
// Returns { ok: true } or { ok: false, field } for the first invalid field
// in calcSetup() input order.
export function validateTuningSetup(setup, { allNeedles, carbType }) {
  const fail = field => ({ ok: false, field });
  const { needleType, clipPos, carbSize, jetType, needleJet } = setup;

  if (allNeedles[needleType]?.carbType !== carbType) return fail('needleType');
  if (!Number.isInteger(clipPos) || clipPos < 1 || clipPos > resolveClipCount(needleType, allNeedles)) {
    return fail('clipPos');
  }
  if (!CARB_BORE_SIZES[carbType]?.includes(carbSize)) return fail('carbSize');
  if (!CARB_TYPES[carbType]?.atomizers.includes(jetType)) return fail('jetType');
  if (!ATOMIZER_SIZES[jetType]?.includes(needleJet)) return fail('needleJet');
  for (const field of ['nd', 'hd']) {
    const [min, max] = JET_FIELD_BOUNDS[field];
    const value = setup[field];
    if (!Number.isFinite(value) || value < min || value > max) return fail(field);
  }
  return { ok: true };
}

// Display string for a signed percentage: '+6.3 %', '−2.0 %' (U+2212
// minus), '0.0 %' for anything that rounds to zero. Decimal point in both
// languages and a space before '%', like every other unit in the app.
// null / non-finite → CATALOG_EMPTY_VALUE.
export function formatSignedPercent(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return CATALOG_EMPTY_VALUE;
  const abs = Math.abs(value).toFixed(digits);
  if (Number(abs) === 0) return `${abs} %`;
  return `${value > 0 ? '+' : '\u2212'}${abs} %`;
}

// One step of a jet field in direction dir (+1 | −1).
// nd / hd: ±1 within the share.js bounds.
// needleJet: next ATOMIZER_SIZES[jetType] value in direction dir; a value
//   not in the list jumps to the nearest list value in that direction.
// Returns a new setup object, or null when no further step is possible.
// `current` is never mutated.
export function stepJet(current, field, dir) {
  const value = current[field];
  if (value == null) return null;

  if (field === 'nd' || field === 'hd') {
    const [min, max] = JET_FIELD_BOUNDS[field];
    const next = value + dir;
    if (next < min || next > max) return null;
    return { ...current, [field]: next };
  }

  if (field === 'needleJet') {
    const sizes = [...(ATOMIZER_SIZES[current.jetType] ?? [])].sort((a, b) => a - b);
    const next = dir > 0
      ? sizes.find(size => size > value)
      : sizes.findLast(size => size < value);
    return next == null ? null : { ...current, needleJet: next };
  }

  return null;
}
