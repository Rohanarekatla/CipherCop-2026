// Building-level exposure for the Musi pilot corridor (from Malik/AI-NETRA-GEO: real OSM footprints, Google Open
// Buildings 2.5D heights, OSM Musi polygons, TGRAC government waterlogging points).
// This is an EXPOSURE index to rank where to look first. It is not flood probability, and no building is claimed flooded.
import { km } from './geo.js';

export const BANDS = [[0.66, 'high'], [0.33, 'medium'], [0, 'low']];
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function loadBuildings(raw) {
  const ix = Object.fromEntries(raw.meta.cols.map((c, i) => [c, i]));
  return raw.rows.map((r) => ({ id: r[ix.id], pos: [r[ix.lat], r[ix.lon]], height: r[ix.height], area: r[ix.area],
    musiM: r[ix.musiM], wlM: r[ix.wlM], wlId: r[ix.wlId], kind: r[ix.kind] }));
}

// 0..1. Musi: full weight inside 100 m, none beyond 1 km. Waterlogging point: full inside 250 m, none beyond 1.5 km.
// Low-rise buildings (< 6 m, about two floors) cannot retreat upwards, so they count a little more. Unknown height adds nothing.
export function exposure(b) {
  const river = b.musiM == null ? 0 : clamp01((1000 - b.musiM) / 900);
  const wl = b.wlM == null ? 0 : clamp01((1500 - b.wlM) / 1250);
  const lowRise = b.height != null && b.height < 6 ? 1 : 0;
  return +(0.45 * river + 0.4 * wl + 0.15 * lowRise).toFixed(3);
}
export const band = (score) => BANDS.find(([t]) => score >= t)[1];

// A tall, large building near the water is a candidate vertical-evacuation refuge, to be checked on site.
export const refugeCandidate = (b) => b.height != null && b.height >= 12 && b.area != null && b.area >= 300;

export function scored(buildings) {
  return buildings.map((b) => { const score = exposure(b); return { ...b, score, band: band(score) }; });
}

export function summary(buildings, waterlogging) {
  const s = scored(buildings), count = { high: 0, medium: 0, low: 0 };
  for (const b of s) count[b.band]++;
  const byPoint = new Map();
  for (const b of s) if (b.band === 'high' && b.wlId != null) byPoint.set(b.wlId, (byPoint.get(b.wlId) ?? 0) + 1);
  const name = (id) => waterlogging.find((w) => w.id === id)?.name ?? `point ${id}`;
  return { buildings: s.length, bands: count,
    highExposureByWaterloggingPoint: [...byPoint].map(([id, n]) => ({ point: name(id), buildings: n })).sort((a, b) => b.buildings - a.buildings).slice(0, 5),
    refugeCandidates: s.filter(refugeCandidate).filter((b) => b.band !== 'low').length,
    caveat: 'Exposure index from distance to the Musi and to government-mapped waterlogging points. Not flood probability. Heights are model estimates.' };
}

// Highest-exposure buildings, optionally within radiusKm of a [lat, lon].
export function topExposed(buildings, { near, radiusKm = 0.5, limit = 5 } = {}) {
  const pool = near ? buildings.filter((b) => km(near, b.pos) <= radiusKm) : buildings;
  return scored(pool).sort((a, b) => b.score - a.score).slice(0, limit)
    .map((b) => ({ osmWay: b.id, lat: b.pos[0], lon: b.pos[1], score: b.score, band: b.band, musiM: b.musiM, waterloggingM: b.wlM, heightM: b.height, areaM2: b.area, refugeCandidate: refugeCandidate(b) }));
}
