// Official Telangana government drainage GIS (TGRAC, Telangana Remote Sensing Applications Centre), public
// ArcGIS REST service "GHMCNalas_vul": GHMC's major waterlogging points, the surveyed nala segments with
// existing and proposed widths, tanks, GHMC zones and area names. Saved as compact GeoJSON in data/tgrac/.
// Run: npm run fetch-tgrac   (needs internet, about a minute). Optional: name layers, e.g. `segments tanks`.
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://tgrac.telangana.gov.in/arcgis/rest/services/GHMCNalas_Folder/GHMCNalas_vul/MapServer';
const UA = { 'User-Agent': 'ciphercop-2026-ai-vengers (hackathon prototype)' };
const LAYERS = {
  waterlogging: { id: 1, fields: ['Name'] },
  nalas: { id: 2, fields: ['Nala_ID', 'Nala_Name', 'Circle', 'Total_Seg', 'Length_m', 'Mandal'] },
  segments: { id: 5, fields: ['Segment_ID', 'Nala_ID', 'Nala_Name', 'Circle', 'Village', 'Length_m', 'Ext_Width', 'Prop_Width'] },
  tanks: { id: 13, fields: ['Descr_1', 'Descr_2'] },
  zones: { id: 7, fields: ['ZONE_NAME', 'ZONE_ID'] },
};
const round = (c) => (typeof c[0] === 'number' ? [+c[0].toFixed(5), +c[1].toFixed(5)] : c.map(round));
// Esri JSON -> GeoJSON (the service refuses f=geojson on some layers)
const toGeo = (g) => (g.x != null ? { type: 'Point', coordinates: round([g.x, g.y]) }
  : g.paths ? { type: g.paths.length > 1 ? 'MultiLineString' : 'LineString', coordinates: round(g.paths.length > 1 ? g.paths : g.paths[0]) }
    : g.rings ? { type: 'Polygon', coordinates: round(g.rings) } : null);

async function get(url) {
  for (let attempt = 1; ; attempt++) { // the government server drops connections under load: retry with backoff
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(120000) });
      if (res.ok) { const j = await res.json(); if (!j.error) return j; }
    } catch (e) { if (attempt >= 5) throw e; }
    if (attempt >= 5) throw new Error(`failed: ${url.slice(0, 120)}`);
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
}

// this server ignores resultOffset paging, so list the feature ids first and fetch them in chunks
async function layer(id, fields) {
  const ids = ((await get(`${BASE}/${id}/query?${new URLSearchParams({ where: '1=1', returnIdsOnly: 'true', f: 'json' })}`)).objectIds ?? []).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const q = new URLSearchParams({ objectIds: ids.slice(i, i + 200).join(','), outFields: fields.join(','), outSR: '4326', f: 'json', returnGeometry: 'true', maxAllowableOffset: '0.00003' }); // ~3 m generalisation
    const page = await get(`${BASE}/${id}/query?${q}`);
    out.push(...page.features.filter((f) => f.geometry).map((f) => ({ type: 'Feature', geometry: toGeo(f.geometry), properties: f.attributes })).filter((f) => f.geometry));
  }
  return out;
}

await mkdir(new URL('../data/tgrac/', import.meta.url), { recursive: true });
const only = process.argv.slice(2);
const meta = { source: BASE, fetchedAt: new Date().toISOString(), note: 'Telangana government public GIS service (TGRAC). Encroachment fields are published empty, so only widths are used.', layers: {} };
for (const [name, { id, fields }] of Object.entries(LAYERS)) {
  if (only.length && !only.includes(name)) continue;
  const features = await layer(id, fields);
  meta.layers[name] = features.length;
  await writeFile(new URL(`../data/tgrac/${name}.json`, import.meta.url), JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`${name}: ${features.length}`);
}
if (!only.length) await writeFile(new URL('../data/tgrac/meta.json', import.meta.url), JSON.stringify(meta, null, 1));
