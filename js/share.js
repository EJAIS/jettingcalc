// share.js — Encode/decode setup state to/from a shareable URL query string
// Pure ES module: no DOM access, no localStorage, no import of storage.js
// or i18n.js. Only needledb.js (the read-only static data) is imported, so
// this module can be unit-tested with plain node:test.
// Copyright (C) 2014 GUE (Global Underwater Explorers) — GPL v2.0

import { NEEDLE_DB, CARB_TYPES, CARB_BORE_SIZES, ATOMIZER_SIZES, getClipCount } from './needledb.js';

export const SHARE_VERSION = 1;

// Setup fields tracked by share links, in canonical order. `id` and `name`
// are handled separately since they are never blank the way these are.
const SLOT_FIELDS = ['needleType', 'clipPos', 'carbSize', 'needleJet', 'jetType', 'nd', 'hd'];

const SLOT_COUNT = 5;
const MAX_NAME_LENGTH = 30;
const ND_MAX = 200;
const HD_MAX = 300;

export function isSlotEmpty(slot) {
  return slot.name === `#${slot.id}` && SLOT_FIELDS.every(field => slot[field] == null);
}

// Canonical JSON string for comparing app state (e.g. "did the loaded share
// link change anything the user already had?"). Fixed field order and only
// known fields, so it stays stable across unrelated object-key ordering or
// extra properties a caller might carry on a setup object.
export function stateKey({ carbType, setups }) {
  const canonical = {
    carbType,
    setups: setups.map(s => {
      const slot = { id: s.id, name: s.name };
      for (const field of SLOT_FIELDS) slot[field] = s[field];
      return slot;
    }),
  };
  return JSON.stringify(canonical);
}

export function hasShareParams(search) {
  return new URLSearchParams(search).has('v');
}

// Every query-string key a share link can use — the single source of truth
// for scrubbing a share link back out of the URL (see app.js) without
// touching unrelated params/hash that might happen to be present too.
export function shareParamKeys() {
  const keys = ['v', 'c'];
  for (let id = 1; id <= SLOT_COUNT; id++) keys.push(`s${id}`, `n${id}`);
  return keys;
}

export function encodeShare({ carbType, setups }, { baseUrl = '' } = {}) {
  if (!setups.some(s => s.needleType)) {
    return { ok: false, reason: 'noActiveSetups' };
  }

  const exportSlots = setups.filter(s => !isSlotEmpty(s));
  const invalidSlots = exportSlots.filter(s => s.needleType && !NEEDLE_DB[s.needleType]);
  if (invalidSlots.length > 0) {
    return {
      ok: false,
      reason: 'customNeedle',
      details: invalidSlots.map(s => ({ id: s.id, name: s.name, needleType: s.needleType })),
    };
  }

  const params = new URLSearchParams();
  params.set('v', String(SHARE_VERSION));
  params.set('c', carbType);

  for (const s of exportSlots) {
    const fields = SLOT_FIELDS.map(field => (s[field] == null ? '' : s[field]));
    // '-' separates fields because carbSize can contain '.' (e.g. '39.5')
    // but never '-'.
    params.set(`s${s.id}`, fields.join('-'));
    if (s.name !== `#${s.id}`) {
      params.set(`n${s.id}`, s.name);
    }
  }

  return { ok: true, url: `${baseUrl}?${params.toString()}` };
}

function sanitizeName(rawName, id) {
  if (rawName == null) return `#${id}`;
  // eslint-disable-next-line no-control-regex -- deliberately stripping control chars
  const cleaned = rawName.replace(/[\x00-\x1F\x7F]/g, '').trim();
  return cleaned === '' ? `#${id}` : cleaned.slice(0, MAX_NAME_LENGTH);
}

export function decodeShare(search) {
  const params = new URLSearchParams(search);

  if (params.get('v') !== String(SHARE_VERSION)) {
    return { ok: false, reason: 'version' };
  }

  const carbType = params.get('c');
  if (!carbType || !CARB_TYPES[carbType]) {
    return { ok: false, reason: 'carbType' };
  }

  const warnings = [];
  const setups = [];

  for (let id = 1; id <= SLOT_COUNT; id++) {
    const raw = params.get(`s${id}`);
    const name = sanitizeName(params.get(`n${id}`), id);

    let needleType = null, clipPos = null, carbSize = null,
        needleJet = null, jetType = null, nd = null, hd = null;

    if (raw != null) {
      const parts = raw.split('-');
      if (parts.length !== 7) {
        warnings.push({ code: 'malformedSlot', slot: id });
      } else {
        const [rawNeedleType, rawClipPos, rawCarbSize, rawNeedleJet, rawJetType, rawNd, rawHd] = parts;

        if (rawNeedleType !== '') {
          const needle = NEEDLE_DB[rawNeedleType];
          if (needle && needle.carbType === carbType) {
            needleType = rawNeedleType;
          } else {
            warnings.push({ code: 'invalidField', slot: id, field: 'needleType' });
          }
        }

        // needleType null ⇒ clipPos null, silently — there is no needle to
        // validate a clip position against.
        if (needleType != null && rawClipPos !== '') {
          const n = Number(rawClipPos);
          const maxClips = getClipCount(needleType);
          if (Number.isInteger(n) && n >= 1 && n <= maxClips) {
            clipPos = n;
          } else {
            warnings.push({ code: 'invalidField', slot: id, field: 'clipPos' });
          }
        }

        if (rawJetType !== '') {
          if (CARB_TYPES[carbType].atomizers.includes(rawJetType)) {
            jetType = rawJetType;
          } else {
            warnings.push({ code: 'invalidField', slot: id, field: 'jetType' });
          }
        }

        if (rawNeedleJet !== '') {
          const n = Number(rawNeedleJet);
          if (jetType != null && ATOMIZER_SIZES[jetType]?.includes(n)) {
            needleJet = n;
          } else {
            warnings.push({ code: 'invalidField', slot: id, field: 'needleJet' });
          }
        }

        if (rawCarbSize !== '') {
          const n = Number(rawCarbSize);
          if (CARB_BORE_SIZES[carbType]?.includes(n)) {
            carbSize = n;
          } else {
            warnings.push({ code: 'invalidField', slot: id, field: 'carbSize' });
          }
        }

        if (rawNd !== '') {
          const n = Number(rawNd);
          if (Number.isFinite(n) && n >= 0 && n <= ND_MAX) {
            nd = n;
          } else {
            warnings.push({ code: 'invalidField', slot: id, field: 'nd' });
          }
        }

        if (rawHd !== '') {
          const n = Number(rawHd);
          if (Number.isFinite(n) && n >= 0 && n <= HD_MAX) {
            hd = n;
          } else {
            warnings.push({ code: 'invalidField', slot: id, field: 'hd' });
          }
        }
      }
    }

    setups.push({ id, name, needleType, clipPos, carbSize, needleJet, jetType, nd, hd });
  }

  return { ok: true, state: { carbType, setups }, warnings };
}
