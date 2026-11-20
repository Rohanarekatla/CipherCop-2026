/* global maplibregl */
// AI-NETRA in the browser: the building-intelligence map from Malik/ (OSM footprints, Google heights, Musi and
// waterlogging distances) running on the same static data and modules as the rest of the site. No backend needed.
import { loadBuildings, scored, summary, refugeCandidate } from '../lib/buildings.js';
import { fireRisk } from '../lib/fire.js';
import { km } from '../lib/geo.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const get = (f) => fetch(`../data/${f}`).then((r) => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.json(); });

const [rawB, wl, base] = await Promise.all([get('buildings.json'), get('waterlogging.json'), get('base.json')]);
const buildings = scored(loadBuildings(rawB));
const risk = new Map(fireRisk(buildings, base.fire).map((b) => [b.id, b]));
const points = wl.points;

const map = new maplibregl.Map({
  container: 'map', center: [78.50, 17.375], zoom: 12.3,
  style: { version: 8, sources: { osm: { type: 'raster', tileSize: 256, attribution: '© OpenStreetMap contributors',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'] } }, layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.55, 'raster-saturation': -0.6 } }] },
});
map.addControl(new maplibregl.NavigationControl(), 'top-left');
window.netraMap = map; // handy for debugging in the console
const fc = (features) => ({ type: 'FeatureCollection', features });

map.on('load', () => {
  map.addSource('b', { type: 'geojson', data: fc(buildings.map((b) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [b.pos[1], b.pos[0]] }, properties: { id: b.id, band: b.band } }))) });
  map.addLayer({ id: 'b', type: 'circle', source: 'b', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 15, 3.5, 18, 8],
    'circle-color': ['match', ['get', 'band'], 'high', '#ff4d5e', 'medium', '#f2b544', '#5d6b7a'],
    'circle-opacity': ['match', ['get', 'band'], 'low', 0.55, 0.95] } });
  map.addSource('sel', { type: 'geojson', data: fc([]) });
  map.addLayer({ id: 'sel', type: 'circle', source: 'sel', paint: { 'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 } });
  map.addSource('w', { type: 'geojson', data: fc(points.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { name: p.name } }))) });
  map.addLayer({ id: 'w', type: 'circle', source: 'w', paint: { 'circle-radius': 7, 'circle-color': '#4fb3ff', 'circle-stroke-color': '#e8f1fa', 'circle-stroke-width': 1.5 } });
  const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
  map.on('mousemove', 'w', (e) => { map.getCanvas().style.cursor = 'pointer'; tip.setLngLat(e.lngLat).setHTML(`<b>${esc(e.features[0].properties.name)}</b><br>Government-mapped waterlogging point`).addTo(map); });
  map.on('mouseleave', 'w', () => { map.getCanvas().style.cursor = ''; tip.remove(); });
});

function select(b) {
  const r = risk.get(b.id), pw = points.find((p) => p.id === b.wlId);
  $('#sel').innerHTML = `<span class="pill ${b.band}">${b.band} exposure</span> <span class="small">score ${b.score}</span>
    <table>
      <tr><td>OSM building</td><td><a style="color:#4fb3ff" target="_blank" rel="noopener" href="https://www.openstreetmap.org/way/${b.id}">way ${b.id}</a></td></tr>
      <tr><td>Estimated height</td><td>${b.height == null ? 'unknown' : b.height + ' m'} <span class="small">(model estimate)</span></td></tr>
      <tr><td>Footprint area</td><td>${b.area == null ? 'unknown' : b.area.toLocaleString() + ' m²'}</td></tr>
      <tr><td>Distance to Musi</td><td>${b.musiM == null ? 'unknown' : b.musiM.toLocaleString() + ' m'}</td></tr>
      <tr><td>Nearest waterlogging point</td><td>${pw ? esc(pw.name) : 'none'}${b.wlM == null ? '' : ' · ' + b.wlM.toLocaleString() + ' m'}</td></tr>
      <tr><td>Nearest fire station</td><td>${esc(r.station)} · ${r.stationKm} km</td></tr>
      <tr><td>Fire score</td><td>${r.fireScore} <span class="small">(${r.neighbours50m} buildings within 50 m)</span></td></tr>
      <tr><td>Vertical refuge candidate</td><td>${refugeCandidate(b) ? 'Yes, check on site' : 'No'}</td></tr>
    </table>`;
  map.getSource('sel').setData(fc([{ type: 'Feature', geometry: { type: 'Point', coordinates: [b.pos[1], b.pos[0]] }, properties: {} }]));
}

map.on('click', (e) => {
  if (map.queryRenderedFeatures(e.point, { layers: ['w'] }).length) return;
  const p = [e.lngLat.lat, e.lngLat.lng];
  let best = null, bd = Infinity;
  for (const b of buildings) { const d = km(p, b.pos); if (d < bd) { bd = d; best = b; } }
  if (bd > 0.08) { $('#sel').textContent = 'No building within 80 m of that point.'; return; }
  select(best);
});

$('#wl').innerHTML += points.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
$('#wl').addEventListener('change', (e) => { const p = points.find((x) => x.id === Number(e.target.value)); if (p) map.flyTo({ center: [p.lon, p.lat], zoom: 16 }); });

const s = summary(buildings, points);
$('#sum').innerHTML = `<b>${s.buildings.toLocaleString()}</b> buildings: ${s.bands.high} high, ${s.bands.medium.toLocaleString()} medium, ${s.bands.low.toLocaleString()} low exposure.<br>
  ${s.refugeCandidates} tall, large buildings in medium or high exposure are candidate vertical-evacuation refuges.<br>
  Most high-exposure buildings: ${s.highExposureByWaterloggingPoint.map((h) => `${esc(h.point)} (${h.buildings})`).join(', ')}.`;
