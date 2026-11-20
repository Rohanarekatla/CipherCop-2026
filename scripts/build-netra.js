// Builds data/netra/ from Mallikarjuna's AI-NETRA-GEO work (Malik/data): the 11,659 real building footprints of the
// Moosarambagh / Musi pilot (OpenStreetMap), with Google Open Buildings 2.5D 2023 heights (model estimates),
// distance to the Musi's mapped water, the nearest government (TGRAC) waterlogging point, and overlap with the
// official "Hyderabad Floods 2020" flood-affected areas. Compact JSON for the browser's 3D buildings layer.
// Run: npm run build-netra   (no internet needed; deterministic, so CI can check the committed file)
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const SRC = new URL('../Malik/data/', import.meta.url);
const read = async (f) => readFile(new URL(f, SRC), 'utf8');
const csv = (text) => {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const keys = head.split(',');
  return rows.map((r) => { const v = r.split(','); return Object.fromEntries(keys.map((k, i) => [k, v[i]])); });
};
const byId = (rows) => new Map(rows.map((r) => [r.building_id, r]));
const r6 = (x) => +x.toFixed(6);
// drop near-duplicate vertices (under ~0.5 m) so polygons stay light without changing shape
function thin(ring) {
  const out = [];
  for (const [x, y] of ring) { const p = out.at(-1); if (!p || Math.abs(p[0] - x) > 5e-6 || Math.abs(p[1] - y) > 5e-6) out.push([r6(x), r6(y)]); }
  if (out.length > 1 && (out[0][0] !== out.at(-1)[0] || out[0][1] !== out.at(-1)[1])) out.push(out[0]);
  return out;
}

const catalog = JSON.parse(await read('ai_netra_building_catalog_v1.geojson')).features;
const musi = byId(csv(await read('ai_netra_musi_distances_v1.csv')));
const wl = byId(csv(await read('ai_netra_waterlogging_distances_v1.csv')));
const hist = byId(csv(await read('ai_netra_historical_evidence_by_category_v1.csv')));
const area = byId(csv(await read('ai_netra_building_areas_v1.csv')));
// Sentinel-1 radar change for Malik's 40 targeted buildings (Oct 2020 event vs Sept control), from Earth Engine
const radarRows = csv(await read('ai_netra_targeted_radar_evidence_40_v1.csv'));
const HIST = { no_overlap: 0, generic_only: 1, locality_only: 2, both: 3 }; // categories in Malik's evidence file

const BAND = (b) => (b || '').replace('within_', '≤ ').replace('beyond_', '> ').replace('m', ' m');
const buildings = catalog.map((f) => {
  const p = f.properties, id = p.building_id;
  const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
  const m = musi.get(id), w = wl.get(id), h = hist.get(id), a = area.get(id);
  return [
    id,
    thin(ring),
    p.estimated_height_m == null ? null : +(+p.estimated_height_m).toFixed(1),
    p.height_quality_flag === 'unverified_estimate' ? 1 : 0, // 1 usable height; 0 missing or implausibly low
    a ? Math.round(+a.footprint_area_m2 || 0) : null,
    m ? Math.round(+m.distance_to_musi_water_m) : null,
    w ? Math.round(+w.distance_to_waterlogging_point_m) : null,
    w ? w.nearest_waterlogging_location : null,
    h ? HIST[h.historical_evidence_category] ?? 0 : 0,
    p.tags?.amenity || null,
    p.height_quality_flag ?? 'unavailable',
    m ? BAND(m.proximity_band) : null,
    m ? m.intersects_mapped_water === 'True' : false,
    w ? BAND(w.proximity_band) : null,
    h ? +(+h.generic_flood_area_overlap_pct).toFixed(1) : 0,
    h ? +(+h.named_locality_overlap_pct).toFixed(1) : 0,
    p.building_type ?? null,
    p.building_levels ?? null,
    p.source_timestamp ?? null,
  ];
});
const radar = Object.fromEntries(radarRows.map((r) => [r.building_id, {
  group: r.proximity_group, radiusM: +r.neighbourhood_radius_m,
  event: { start: r.event_start, end: r.event_end, vv: +(+r.event_VV_negative_fraction).toFixed(3), vh: +(+r.event_VH_negative_fraction).toFixed(3), n: +r.event_VV_sample_count },
  control: { start: r.control_start, end: r.control_end, vv: +(+r.control_VV_negative_fraction).toFixed(3), vh: +(+r.control_VH_negative_fraction).toFixed(3), n: +r.control_VV_sample_count },
}]));
const incidents = JSON.parse(await read('ai_netra_multi_location_incidents_v1.json'));

const histPolys = JSON.parse(await read('ai_netra_historical_flood_polygons_pilot_v1.geojson')).features
  .map((f) => ({ type: 'Feature', geometry: f.geometry, properties: {} }));

await mkdir(new URL('../data/netra/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/netra/buildings.json', import.meta.url), JSON.stringify({
  columns: ['id', 'ring', 'heightM', 'heightOk', 'areaM2', 'musiM', 'waterloggingM', 'waterloggingPlace', 'history2020', 'amenity', 'heightFlag', 'musiBand', 'inMusiWater', 'waterloggingBand', 'genericPct', 'localityPct', 'osmType', 'osmLevels', 'osmTimestamp'],
  history2020: ['no overlap', 'flood-affected area', 'named flood locality', 'flood-affected area and named locality'],
  source: 'Malik/AI-NETRA-GEO: OpenStreetMap footprints, Google Open Buildings 2.5D 2023 heights (model estimates, not field-verified), TGRAC waterlogging points, Hyderabad Floods 2020 SpatialMap',
  buildings,
}));
await writeFile(new URL('../data/netra/evidence.json', import.meta.url), JSON.stringify({
  radar, radarNote: 'Sentinel-1A VV/VH, Google Earth Engine: share of 10 m samples within the building-centred neighbourhood whose backscatter fell by more than 3 dB. Exploratory, not verified flooding.',
  incidents: incidents.incidents, incidentNote: incidents.disclaimer ?? 'Synthetic demonstration incidents.',
}));
await writeFile(new URL('../data/netra/history2020.json', import.meta.url), JSON.stringify({ type: 'FeatureCollection', features: histPolys }));
console.log(`${buildings.length} buildings; ${buildings.filter((b) => b[3]).length} usable heights; ${buildings.filter((b) => b[8]).length} overlap the 2020 flood map`);
