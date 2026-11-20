// Drainage intelligence on the 250 m terrain grid (data/hand.json) plus the OSM water layer (data/water.json).
// Shared by the browser and the tests. Everything here is an approximation of real drainage built from open
// elevation and OSM, labelled as such in the UI; GHMC's storm-drain GIS would replace it (idea A4).
import { km, kmToLine } from './geo.js';

const DLAT = 0.00225, DLON = 0.00235, CELL_KM2 = 0.0625;
const N8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

// A1: D8 steepest descent for every cell, upstream lists, flow accumulation (cells draining through each cell).
// Drain cells keep flowing (preferring lower drain neighbours) so a path continues along the nala network.
export function buildFlow(hand, bbox) {
  const [S, W] = bbox;
  const cells = hand.cells.map(([lat, lon, elev, h, sector, drain, pit], i) => ({
    i, lat, lon, elev, hand: h, sector, drain: !!drain, pit: !!pit, r: Math.round((lat - S) / DLAT), c: Math.round((lon - W) / DLON) }));
  const index = new Map(cells.map((x) => [`${x.r},${x.c}`, x.i]));
  const nb = (x) => N8.map(([dr, dc]) => [index.get(`${x.r + dr},${x.c + dc}`), Math.hypot(dr, dc)]).filter(([j]) => j != null);
  // priority-flood depression filling (Barnes et al. 2014): water that collects in a pit overflows at its lowest
  // rim, so routing on the filled surface carries it on to the nalas; fill depth > 0.3 m marks a pond.
  const filled = new Float64Array(cells.length).fill(Infinity), heap = [];
  const push = (e, i) => { heap.push([e, i]); let k = heap.length - 1; while (k && heap[(k - 1) >> 1][0] > heap[k][0]) { [heap[k], heap[(k - 1) >> 1]] = [heap[(k - 1) >> 1], heap[k]]; k = (k - 1) >> 1; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[k], heap[m]] = [heap[m], heap[k]]; k = m; } } return top; };
  cells.forEach((x) => { if (nb(x).length < 8) { filled[x.i] = x.elev; push(x.elev, x.i); } }); // grid edge drains out
  while (heap.length) {
    const [e, i] = pop();
    for (const [j] of nb(cells[i])) if (filled[j] === Infinity) { filled[j] = Math.max(cells[j].elev, e + 1e-3); push(filled[j], j); }
  }
  cells.forEach((x) => { x.fill = filled[x.i]; x.pond = filled[x.i] - x.elev > 0.3; });
  const down = cells.map((x) => {
    let best = -1, drop = 0, bestDrain = -1, dropDrain = 0;
    for (const [j, dist] of nb(x)) {
      const d = (x.fill - cells[j].fill) / dist;
      if (d > drop) { drop = d; best = j; }
      if (cells[j].drain && d > dropDrain) { dropDrain = d; bestDrain = j; }
    }
    return x.drain && bestDrain >= 0 ? bestDrain : best;
  });
  const up = cells.map(() => []);
  down.forEach((j, i) => { if (j >= 0) up[j].push(i); });
  const acc = new Float64Array(cells.length).fill(1), len = new Float64Array(cells.length); // len: longest upstream path, km
  [...cells].sort((a, b) => b.fill - a.fill).forEach(({ i }) => {
    const j = down[i];
    if (j >= 0) { acc[j] += acc[i]; len[j] = Math.max(len[j], len[i] + 0.25); }
  });
  return { cells, index, down, up, acc, len, S, W };
}

// nearest grid cell to a point: look up its row/column, then search outward (cells exist only near stations)
export function nearestCell(flow, [lat, lon]) {
  const r0 = Math.round((lat - flow.S) / DLAT), c0 = Math.round((lon - flow.W) / DLON);
  for (let rad = 0; rad <= 12; rad++) {
    let best = -1, bd = Infinity;
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const j = flow.index.get(`${r0 + dr},${c0 + dc}`);
        if (j == null) continue;
        const d = (flow.cells[j].lat - lat) ** 2 + (flow.cells[j].lon - lon) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
    }
    if (best >= 0) return best;
  }
  return -1; // more than 3 km from any grid cell
}

// A1: where water from cell i goes, over the filled surface, to the grid edge. pondAt: where it first collects
// in a depression before reaching any nala (dead-end ground).
export function trace(flow, i, maxSteps = 400) {
  const path = [i], seen = new Set([i]);
  let firstDrain = flow.cells[i].drain ? 0 : -1, pondAt = flow.cells[i].pond ? 0 : -1;
  while (path.length < maxSteps) {
    const j = flow.down[path.at(-1)];
    if (j < 0 || seen.has(j)) break;
    seen.add(j); path.push(j);
    if (firstDrain < 0 && flow.cells[j].drain) firstDrain = path.length - 1;
    if (pondAt < 0 && firstDrain < 0 && flow.cells[j].pond) pondAt = path.length - 1;
  }
  const end = flow.cells[path.at(-1)];
  return { path, firstDrain, pondAt, km: +((path.length - 1) * 0.25).toFixed(2), deadEnd: firstDrain < 0, endsAt: end };
}

// A1: everything uphill that drains into cell i (its catchment).
export function catchment(flow, i) {
  const out = [i];
  for (let k = 0; k < out.length; k++) out.push(...flow.up[out[k]]);
  return out;
}

// dead-end ground: low cells whose water reaches no nala (the pit flag from the HAND build)
export const deadEnds = (flow, maxHand = 2.5) => flow.cells.filter((x) => (x.pit || x.pond) && !x.drain && x.hand <= maxHand).map((x) => x.i);

// A2: culverts (nala under a road, from OSM) ranked by the land and assets that drain through them.
export function bottlenecks(flow, water, { facilities = water.facilities ?? [] } = {}) {
  const facCell = facilities.map((f) => nearestCell(flow, f.pos)).filter((c) => c >= 0);
  const encCell = (water.encroach ?? []).map((e) => nearestCell(flow, e.pos)).filter((c) => c >= 0);
  return (water.culverts ?? []).map((cv) => ({ cv, i: nearestCell(flow, cv.pos) })).filter((o) => o.i >= 0).map(({ cv, i }) => {
    const x = flow.cells[i];
    const area = new Set(catchment(flow, i));
    const upFac = facCell.filter((c) => area.has(c)).length, upEnc = encCell.filter((c) => area.has(c)).length;
    const lowShare = [...area].filter((c) => flow.cells[c].hand <= 2.5).length / area.size;
    const score = flow.acc[i] * CELL_KM2 * (1 + lowShare) + upFac * 0.2 + upEnc * 0.05;
    return { ...cv, cell: i, sector: x.sector, km2: +(flow.acc[i] * CELL_KM2).toFixed(2), lowShare: +lowShare.toFixed(2), facilities: upFac, encroach: upEnc, score: +score.toFixed(2) };
  }).sort((a, b) => b.score - a.score).filter((b, k, all) => all.findIndex((x) => x.cell === b.cell) === k); // one row per cell
}

// A3: for each lake, the outlet (lowest cell on its edge), the path water takes if the bund fails, what lies
// on that path, and whether any mapped nala leaves the lake (no outflow = the Gurram Cheruvu failure mode).
export function lakeBreach(flow, water, hand, { speedKmH = 5.4, pathKm = 6 } = {}) {
  const nalas = hand.waterways ?? [];
  const facilities = water.facilities ?? [];
  return (water.lakes ?? []).filter((l) => l.ha >= 5).map((l) => {
    const ringCells = new Set(l.ring.map((p) => nearestCell(flow, p)).filter((c) => c >= 0));
    if (!ringCells.size) return null;
    const outlet = [...ringCells].sort((a, b) => flow.cells[a].elev - flow.cells[b].elev)[0];
    const t = trace(flow, outlet, Math.round(pathKm / 0.25) + 1);
    const pathPts = t.path.map((c) => [flow.cells[c].lat, flow.cells[c].lon]);
    const exposed = facilities.filter((f) => pathPts.length > 1 && kmToLine(f.pos, pathPts) <= 0.3);
    const outflow = nalas.some((w) => l.ring.some((p, k) => k % 3 === 0 && kmToLine(p, w) <= 0.08));
    const sectors = [...new Set(t.path.map((c) => flow.cells[c].sector))];
    return { id: l.id, name: l.name || `Unnamed lake (${l.ha} ha)`, ha: l.ha, outlet, path: t.path, pathKm: t.km, capped: t.path.length > pathKm / 0.25,
      minutesToEnd: Math.round((t.km / speedKmH) * 60), facilities: exposed, sectors, outflow,
      onGrid: t.km >= 0.5, // lakes at the edge of the terrain grid have no traceable path
      risk: +((l.ha / 10 * (outflow ? 1 : 2) + exposed.length * 0.5 + sectors.length * 0.3) * (t.km >= 0.5 ? 1 : 0.2)).toFixed(1) };
  }).filter(Boolean).sort((a, b) => b.risk - a.risk);
}

// A4 (approximation until GHMC's drain GIS exists): each nala cell carries what its catchment sheds. A drain
// sized for `capacityMmH` over its catchment overflows when the rain averaged over the catchment's time of
// concentration exceeds that capacity (rational method). Blocked reports and encroachments cut capacity.
// capacity: GHMC states ~20 mm/h, NIH Roorkee's SWMM study found ~12 mm/h; we plan for the lower figure
export function drainOverflow(flow, rainMmH, times, { capacityMmH = 12, runoff = 0.8, cut = new Map(), rainFor = null } = {}) {
  // rainFor(cell) -> hourly mm for that cell (e.g. its nearest forecast point); otherwise one series for all
  const prefix = (series) => { const pre = [0]; series.forEach((v, h) => pre.push(pre[h] + v)); return pre; };
  const shared = rainFor ? null : prefix(rainMmH), cache = new Map();
  const out = [];
  flow.cells.forEach((x) => {
    if (!x.drain || flow.acc[x.i] < 8) return; // at least 0.5 km2 upstream
    let pre = shared;
    if (rainFor) { const series = rainFor(x); if (!cache.has(series)) cache.set(series, prefix(series)); pre = cache.get(series); }
    const n = pre.length - 1;
    const tc = Math.max(1, Math.round(0.5 + flow.len[x.i] / 2)); // hours
    const cap = capacityMmH * (1 - (cut.get(x.i) ?? 0));
    let first = -1, peak = 0;
    for (let h = 0; h < n; h++) {
      const avg = ((pre[h + 1] - pre[Math.max(0, h + 1 - tc)]) / Math.min(tc, h + 1)) * runoff;
      peak = Math.max(peak, avg / cap);
      if (first < 0 && avg > cap) first = h;
    }
    if (first >= 0) out.push({ cell: x.i, sector: x.sector, at: times[first], hour: first, km2: +(flow.acc[x.i] * CELL_KM2).toFixed(2), tc, ratio: +peak.toFixed(2) });
  });
  return out.sort((a, b) => a.hour - b.hour || b.km2 - a.km2);
}

// E2: vulnerable facilities on low ground, counted per police sector (adds to the sector's exposure)
export function facilityExposure(flow, water, maxHand = 2.5) {
  const per = new Map();
  for (const f of water.facilities ?? []) {
    const x = flow.cells[nearestCell(flow, f.pos)];
    if (!x || x.hand > maxHand) continue;
    if (!per.has(x.sector)) per.set(x.sector, []);
    per.get(x.sector).push({ ...f, hand: x.hand });
  }
  return per;
}

// B1: encroachment leads ranked by what they harm: inside the lake bed first, then by upstream-of-flooding
export function rankEncroachments(flow, water, floodedSectors = new Set()) {
  const order = { 'lake-bed': 0, 'lake-buffer': 1, 'nala-buffer': 2 };
  return (water.encroach ?? []).map((e) => ({ e, i: nearestCell(flow, e.pos) })).filter((o) => o.i >= 0).map(({ e, i }) => {
    const t = trace(flow, i, 40);
    const feeds = [...new Set(t.path.map((c) => flow.cells[c].sector))].filter((s) => floodedSectors.has(s));
    return { ...e, sector: flow.cells[i].sector, feeds };
  }).sort((a, b) => b.feeds.length - a.feeds.length || order[a.type] - order[b.type] || a.m - b.m);
}

export function complaintText(e, sectorName) {
  const rule = e.type === 'nala-buffer' ? `${e.limit} m nala buffer` : e.type === 'lake-bed' ? 'lake bed (inside the water body)' : `${e.limit} m lake buffer (FTL)`;
  return [
    'To: HYDRAA / GHMC Town Planning',
    `Subject: Possible structure inside ${rule} of ${e.water}`,
    `Location: ${e.pos[0]}, ${e.pos[1]} (https://www.openstreetmap.org/?mlat=${e.pos[0]}&mlon=${e.pos[1]}#map=19/${e.pos[0]}/${e.pos[1]})`,
    `Police sector: ${sectorName}`,
    `Finding: a building about ${e.m} m from the mapped edge of ${e.water}; the rule is ${rule}.`,
    e.feeds?.length ? `Its drainage runs into an area that flooded in this event.` : '',
    'Please verify against the notified FTL/buffer boundary and the building permission. Source: SurgeForce (OpenStreetMap outlines, not the notified FTL line).',
  ].filter(Boolean).join('\n');
}

// B4: after an event, compare predicted exposure with confirmed reports and give each flooded sector its likely causes
export function afterFlood(flow, plan, { bottleneckList = [], encroach = [], lakes = [], tickets = [], deadEndCells = [], govPoints = [], govSegs = [] } = {}) {
  const sectors = plan.sectors;
  const ranked = [...sectors].sort((a, b) => b.vulnerability - a.vulnerability);
  const predicted = new Set(ranked.slice(0, Math.ceil(sectors.length / 4)).map((s) => s.id)); // top quarter by exposure
  const confirmed = new Set(sectors.filter((s) => s.confirmed).map((s) => s.id));
  const dead = new Set(deadEndCells);
  const rows = [...confirmed].map((id) => {
    const causes = [];
    const gp = govPoints.filter((p) => p.sector === id);
    if (gp.length) causes.push(`GHMC official waterlogging point${gp.length > 1 ? 's' : ''}: ${gp.map((p) => p.name).join(', ')}`);
    const st = plan.sectors[id].pos;
    const gs = govSegs.filter((x) => x.ratio < 0.5 && km(x.pos, st) <= 2.5);
    if (gs.length) causes.push(`${gs.length} official nala segment${gs.length > 1 ? 's' : ''} within 2.5 km under half the proposed width (worst: ${gs[0].nala}, ${gs[0].ext} of ${gs[0].prop} m)`);
    const bn = bottleneckList.filter((b) => b.sector === id);
    if (bn.length) causes.push(`${bn.length} culvert bottleneck${bn.length > 1 ? 's' : ''} (${bn[0].km2} km² drains through the worst)`);
    const en = encroach.filter((e) => e.sector === id || e.feeds?.includes(id));
    if (en.length) causes.push(`${en.length} building${en.length > 1 ? 's' : ''} in lake/nala buffers draining here`);
    const lk = lakes.filter((l) => l.sectors.includes(id) && !l.outflow);
    if (lk.length) causes.push(`downstream of ${lk.map((l) => l.name).slice(0, 2).join(', ')} (no mapped outflow)`);
    const dc = flow.cells.filter((x) => x.sector === id && dead.has(x.i)).length;
    if (dc) causes.push(`${(dc * CELL_KM2).toFixed(2)} km² of dead-end ground (water has no drain)`);
    const tk = tickets.filter((t) => t.sector === id && t.status !== 'cleared');
    if (tk.length) causes.push(`${tk.length} blocked-drain report${tk.length > 1 ? 's' : ''} not cleared`);
    return { id, name: sectors[id].name, predicted: predicted.has(id), causes: causes.length ? causes : ['no mapped cause: inspect on the ground'] };
  });
  return { rows, hits: rows.filter((r) => r.predicted).length, misses: rows.filter((r) => !r.predicted).length,
    falseAlarms: [...predicted].filter((id) => !confirmed.has(id)).length, predicted: predicted.size };
}

// E3: re-fit what the plan assumes from what happened. Returns proposed values with reasons; a human applies them.
export function learn(plan, flow, assumptions) {
  const conf = plan.sectors.filter((s) => s.confirmed);
  const exposed = plan.sectors.filter((s) => s.onset != null);
  const changes = [];
  if (exposed.length && conf.length) {
    const share = conf.length / exposed.length;
    const next = +(assumptions.hitShare * 0.7 + share * 0.3).toFixed(3); // shrink towards the old value: one event is little evidence
    changes.push({ key: 'hitShare', from: assumptions.hitShare, to: next, why: `${conf.length} of ${exposed.length} exposed sectors were confirmed (${Math.round(share * 100)}%)` });
  }
  const confCells = flow.cells.filter((x) => conf.some((s) => s.id === x.sector));
  if (confCells.length) {
    const h = confCells.map((x) => x.hand).sort((a, b) => a - b), med = h[Math.floor(h.length / 2)];
    const old = assumptions.stageM[2], next = +(old * 0.7 + Math.min(6, Math.max(1, med)) * 0.3).toFixed(2);
    changes.push({ key: 'stageM[2]', from: old, to: next, why: `median HAND in confirmed sectors is ${med} m` });
  }
  return changes;
}

export const sectorOfPos = (base, pos) => base.stations.reduce((b, s, i) => (km(pos, s.pos) < b.d ? { d: km(pos, s.pos), i } : b), { d: Infinity, i: -1 }).i;

// ---------- official government data (TGRAC "GHMCNalas_vul" service) ----------
// Validation: do GHMC's official waterlogging points sit where our model says water collects? Compares the share
// of points on low ground (HAND) and on converging flow (accumulation) with the share of all grid cells.
export function officialValidation(flow, points, { lowHand = 2.5, minAcc = 4 } = {}) {
  const cells = points.map((p) => nearestCell(flow, p)).filter((i) => i >= 0);
  const share = (pred, list) => list.filter(pred).length / Math.max(1, list.length);
  const all = flow.cells.map((x) => x.i);
  const low = (i) => flow.cells[i].hand <= lowHand, conv = (i) => flow.acc[i] >= minAcc;
  const r = (x) => +x.toFixed(2);
  return { n: cells.length, low: r(share(low, cells)), lowBase: r(share(low, all)), conv: r(share(conv, cells)), convBase: r(share(conv, all)),
    convLift: r(share(conv, cells) / Math.max(1e-9, share(conv, all))), lowLift: r(share(low, cells) / Math.max(1e-9, share(low, all))) };
}

// surveyed nala segments ranked by how far they fall short of GHMC's proposed width (metres lost x length)
export function narrowSegments(segments) {
  return segments.map((f) => {
    const p = f.properties, line = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat();
    const mid = line[Math.floor(line.length / 2)];
    return { id: p.Segment_ID, nala: p.Nala_Name, circle: p.Circle, ext: p.Ext_Width, prop: p.Prop_Width, lengthM: p.Length_m,
      ratio: p.Ext_Width && p.Prop_Width ? +(p.Ext_Width / p.Prop_Width).toFixed(2) : null, pos: [mid[1], mid[0]],
      lostM2: p.Ext_Width && p.Prop_Width ? Math.round(Math.max(0, p.Prop_Width - p.Ext_Width) * (p.Length_m || 0)) : 0 };
  }).filter((s) => s.ratio != null).sort((a, b) => b.lostM2 - a.lostM2);
}
