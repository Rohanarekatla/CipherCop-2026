// Fire risk layer, ported from Aditya/FireSight. FireSight trained a model on synthetic buildings (AUC 0.744 on its
// own mock data) and published feature importances. Here the same importances weight the features that real OSM
// buildings actually have, so the output is a structural ranking, not the trained model and not a prediction.
//   built-up area, building density within 50 m (fire spread), height (floors), and distance to the nearest real fire
//   station (a stand-in for drive time). Why it matters in a flood: roads slow down and crews take longer, and flooded
//   electrics start fires, which SurgeForce already tracks as the `power_hazard` report category.
import { km, nearest } from './geo.js';
import { exposure } from './buildings.js';

// importances from Aditya/data/model.json, restricted to the features we can derive and renormalised
export const WEIGHTS = (() => {
  const w = { built_up_m2: 0.1205, density_50m: 0.0991, drive_min: 0.085, floors: 0.0329 };
  const t = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, +(v / t).toFixed(4)]));
})();

const clamp01 = (x) => Math.min(1, Math.max(0, x));

// neighbours within 50 m via a ~55 m grid (O(n) instead of O(n^2))
export function density50(buildings) {
  const cell = 0.0005, key = (lat, lon) => `${Math.floor(lat / cell)},${Math.floor(lon / cell)}`, grid = new Map();
  for (const b of buildings) { const k = key(...b.pos); (grid.get(k) ?? grid.set(k, []).get(k)).push(b); }
  return buildings.map((b) => {
    const [la, lo] = [Math.floor(b.pos[0] / cell), Math.floor(b.pos[1] / cell)];
    let n = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const o of grid.get(`${la + i},${lo + j}`) ?? []) if (o !== b && km(b.pos, o.pos) <= 0.05) n++;
    return n;
  });
}

// stations: base.fire = [{ id, name, pos }]. Returns each building with fire score 0..1 and station distance.
export function fireRisk(buildings, stations) {
  const dens = density50(buildings);
  return buildings.map((b, i) => {
    const s = stations[nearest(b.pos, stations, (x) => x.pos)], d = km(b.pos, s.pos);
    const score = WEIGHTS.built_up_m2 * clamp01((b.area ?? 0) / 1500) + WEIGHTS.density_50m * clamp01(dens[i] / 15)
      + WEIGHTS.drive_min * clamp01(d / 5) + WEIGHTS.floors * clamp01((b.height ?? 0) / 25);
    return { ...b, fireScore: +score.toFixed(3), stationKm: +d.toFixed(2), station: s.name, neighbours50m: dens[i] };
  });
}

// Buildings where a flood and a fire could coincide: high flood exposure AND high fire score. These need a crew
// plan that does not rely on the flooded road.
export function compoundHazard(buildings, stations, { minFlood = 0.33, minFire = 0.3, limit = 5 } = {}) {
  return fireRisk(buildings, stations).map((b) => ({ ...b, flood: exposure(b) }))
    .filter((b) => b.flood >= minFlood && b.fireScore >= minFire)
    .sort((a, b) => b.flood * b.fireScore - a.flood * a.fireScore).slice(0, limit)
    .map((b) => ({ osmWay: b.id, lat: b.pos[0], lon: b.pos[1], floodExposure: b.flood, fireScore: b.fireScore, nearestFireStation: b.station, stationKm: b.stationKm, neighbours50m: b.neighbours50m }));
}
