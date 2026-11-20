// Builds data/water.json from OpenStreetMap: lakes, culverts (nala under a road), buildings inside the legal
// lake and nala buffers, and vulnerable facilities (hospitals, clinics, schools, anganwadis).
// Buffer rules (HMDA/HYDRAA): 30 m from lakes of 10 ha or more, 9 m from smaller lakes; 9 m from nalas wider
// than 10 m, 2 m from narrower ones. OSM lake outlines are NOT the notified full-tank-level line, so every
// flag is "to verify", never a finding.  Run: npm run fetch-water   (needs internet, ~2 minutes)
import { readFile, writeFile } from 'node:fs/promises';
import { kmToLine } from '../lib/geo.js';

const base = JSON.parse(await readFile(new URL('../data/base.json', import.meta.url), 'utf8'));
const [S, W, N, E] = base.bbox, bb = base.bbox.join(',');
const UA = { 'User-Agent': 'surgeforce-hackathon/0.5 (CipherCop 2026 prototype)', Accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(q) {
  const body = new URLSearchParams({ data: `[out:json][timeout:180];${q}` });
  for (const host of ['overpass-api.de', 'overpass-api.de', 'overpass.private.coffee', 'overpass-api.de', 'overpass-api.de']) {
    try {
      const res = await fetch(`https://${host}/api/interpreter`, { method: 'POST', body, headers: UA, signal: AbortSignal.timeout(200000) });
      if (res.ok) return (await res.json()).elements;
      console.warn(`${host}: ${res.status}`);
    } catch (e) { console.warn(`${host}: ${e.message.slice(0, 60)}`); }
    await sleep(20000);
  }
  throw new Error('overpass failed');
}
const r5 = (x) => +x.toFixed(5);
const centre = (e) => (e.center ? [e.center.lat, e.center.lon] : [e.lat, e.lon]);
// polygon area in hectares (shoelace on a local projection)
function hectares(ring) {
  const kx = 111320 * Math.cos((ring[0][0] * Math.PI) / 180), ky = 110570;
  let a = 0;
  for (let i = 1; i < ring.length; i++) a += (ring[i - 1][1] * kx) * (ring[i][0] * ky) - (ring[i][1] * kx) * (ring[i - 1][0] * ky);
  return Math.abs(a / 2) / 1e4;
}
function inside([lat, lon], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ai, oi] = ring[i], [aj, oj] = ring[j];
    if ((ai > lat) !== (aj > lat) && lon < ((oj - oi) * (lat - ai)) / (aj - ai) + oi) c = !c;
  }
  return c;
}

console.log('OSM lakes and tanks');
const lakeEls = await overpass(`way["natural"="water"]["water"!~"^(river|canal|stream|wastewater|pool|fountain)$"](${bb});out geom tags;`);
const lakes = lakeEls
  .filter((w) => w.geometry?.length > 3 && w.geometry[0].lat === w.geometry.at(-1).lat)
  .map((w) => ({ id: w.id, name: w.tags.name || w.tags['name:en'] || null, ring: w.geometry.map((g) => [r5(g.lat), r5(g.lon)]) }))
  .map((l) => ({ ...l, ha: +hectares(l.ring).toFixed(1) }))
  .filter((l) => l.ha >= 1);
console.log(`${lakes.length} lakes >= 1 ha (${lakes.filter((l) => l.name).length} named)`);

console.log('OSM nalas (for buffers) and culverts');
const nalaEls = await overpass(`way["waterway"~"^(river|stream|canal|drain|ditch)$"](${bb});out geom tags;`);
const nalas = nalaEls.map((w) => ({ id: w.id, kind: w.tags.waterway, name: w.tags.name ?? null, culvert: w.tags.tunnel === 'culvert', line: w.geometry.map((g) => [r5(g.lat), r5(g.lon)]) }));
const culverts = nalas.filter((n) => n.culvert).map((n) => ({ id: n.id, name: n.name, kind: n.kind, pos: n.line[Math.floor(n.line.length / 2)], lenM: Math.round(n.line.reduce((s, p, i) => (i ? s + kmToLine(p, [n.line[i - 1], n.line[i - 1]]) * 1000 : 0), 0)) }));
console.log(`${nalas.length} nala segments, ${culverts.length} culverts`);

console.log('OSM buildings near lakes and nalas');
// Overpass "around" proved unreliable over many lakes at once, so ask for buildings in small boxes around each
// lake and each ~400 m stretch of nala (padded ~40 m), then measure the exact distance here.
const PAD = 0.0004;
const boxOf = (pts) => [Math.min(...pts.map((p) => p[0])) - PAD, Math.min(...pts.map((p) => p[1])) - PAD, Math.max(...pts.map((p) => p[0])) + PAD, Math.max(...pts.map((p) => p[1])) + PAD].map((x) => x.toFixed(5)).join(',');
const lakeBoxes = lakes.map((l) => boxOf(l.ring));
const nalaBoxes = nalas.filter((n) => !n.culvert).flatMap((n) => { const out = []; for (let i = 0; i < n.line.length - 1; i += 8) out.push(boxOf(n.line.slice(i, i + 9))); return out; });
async function buildingsIn(boxes, label) {
  const seenIds = new Set(), out = [];
  for (let i = 0; i < boxes.length; i += 60) {
    const els = await overpass(`(${boxes.slice(i, i + 60).map((b) => `way["building"](${b});`).join('')});out center;`);
    for (const e of els) if (!seenIds.has(e.id)) { seenIds.add(e.id); out.push(e); }
    console.log(`${label}: ${Math.min(i + 60, boxes.length)}/${boxes.length} boxes, ${out.length} buildings`);
  }
  return out;
}
const bLake = await buildingsIn(lakeBoxes, 'near lakes');
const bNala = await buildingsIn(nalaBoxes, 'near nalas');
const wide = (k) => k === 'river' || k === 'canal';
const encroach = [];
const seen = new Set();
for (const b of bLake) {
  const p = centre(b);
  let best = null;
  for (const l of lakes) {
    const lim = l.ha >= 10 ? 30 : 9;
    const inBed = inside(p, l.ring), d = inBed ? 0 : kmToLine(p, l.ring) * 1000;
    if ((inBed || d <= lim) && (!best || d < best.d)) best = { d, lim, lake: l, inBed };
  }
  if (best && !seen.has(b.id)) {
    seen.add(b.id);
    encroach.push({ id: b.id, pos: [r5(p[0]), r5(p[1])], type: best.inBed ? 'lake-bed' : 'lake-buffer', m: Math.round(best.d), limit: best.lim, water: best.lake.name || `Unnamed lake (${best.lake.ha} ha)`, lakeId: best.lake.id });
  }
}
for (const b of bNala) {
  if (seen.has(b.id)) continue;
  const p = centre(b);
  let best = null;
  for (const n of nalas) {
    if (n.culvert) continue;
    const lim = wide(n.kind) ? 9 : 2, d = kmToLine(p, n.line) * 1000;
    if (d <= lim && (!best || d < best.d)) best = { d, lim, n };
  }
  if (best) { seen.add(b.id); encroach.push({ id: b.id, pos: [r5(p[0]), r5(p[1])], type: 'nala-buffer', m: Math.round(best.d), limit: best.lim, water: best.n.name || `Unnamed ${best.n.kind}` }); }
}
console.log(`${encroach.length} buildings inside a buffer (to verify)`);

console.log('OSM vulnerable facilities');
const facEls = await overpass(`nwr["amenity"~"^(hospital|clinic|school|kindergarten|nursing_home)$"](${bb});out center tags;`);
const KINDS = { hospital: 'hospital', clinic: 'clinic', nursing_home: 'care home', school: 'school', kindergarten: 'anganwadi / pre-school' };
const facilities = facEls.map((e) => ({ kind: KINDS[e.tags.amenity], name: e.tags.name || null, pos: centre(e).map(r5) }))
  .filter((f) => f.pos[0] >= S && f.pos[0] <= N && f.pos[1] >= W && f.pos[1] <= E);
console.log(`${facilities.length} facilities`);

await writeFile(new URL('../data/water.json', import.meta.url), JSON.stringify({
  fetchedAt: new Date().toISOString(),
  note: 'OpenStreetMap (ODbL). Lake outlines are OSM, not the notified HMDA full-tank-level line: every encroachment is a lead to verify.',
  lakes: lakes.map(({ id, name, ha, ring }) => ({ id, name, ha, ring })),
  culverts, encroach, facilities,
}));
console.log('wrote data/water.json');
