// The roadmap ideas (IDEAS.md), built into the command centre: drainage intelligence (A1–A4), accountability
// (B1–B4), field sensors and citizen reports (C1–C4), government data (D1–D5), response (E1–E3) and on-device
// computer vision (F1–F9). Anything simulated or approximate says so in the UI.
import { buildFlow, nearestCell, trace, catchment, deadEnds, bottlenecks, lakeBreach, drainOverflow, facilityExposure,
  rankEncroachments, complaintText, afterFlood, learn, officialValidation, narrowSegments } from '../lib/water.js';
import { ASSUMPTIONS } from '../lib/risk.js';
import { quantile, km } from '../lib/geo.js';
import * as V from '../lib/vision.js';

export async function installIdeas(api) {
  const { state, map, ready, panels, drawPanel, load, esc, fc, feat, ll, box, area, fmt, pct, getJSON, TRANSFORMERS } = api;
  const $ = (s) => document.querySelector(s);
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } } };
  const [water, sachet, gwl, gseg, gtanks] = await Promise.all(['water.json', 'sachet.json', 'tgrac/waterlogging.json', 'tgrac/segments.json', 'tgrac/tanks.json'].map((f) => getJSON(f).catch(() => null)));
  const base = state.base, hand = base.hand;
  const W = {
    water: water ?? { lakes: [], culverts: [], encroach: [], facilities: [] }, sachet,
    flow: buildFlow(hand, base.bbox), pick: null, follow: null, show: { ponds: false, culverts: true, lakes: true, enc: false, fac: false, over: true, s2: false, gwl: true, seg: false, tanks: false },
    tickets: store.get('surgeforce-tickets', []), learnLog: store.get('surgeforce-learning', []), clockH: 0,
    vis: { mode: 'photo', status: 'not loaded (downloads once, ~90 MB)' }, sensors: null, sensorHour: 0, inbox: [], route: null, aws: null,
  };
  const names = base.stations.map((s) => area(s.name) || s.name);
  const cellPos = (i) => [W.flow.cells[i].lat, W.flow.cells[i].lon];
  // official government drainage data (TGRAC): GHMC waterlogging points, surveyed nala widths, tanks
  W.gov = { points: (gwl?.features ?? []).map((f) => ({ name: f.properties.Name, pos: [f.geometry.coordinates[1], f.geometry.coordinates[0]] })), segs: narrowSegments(gseg?.features ?? []), tanks: gtanks };
  W.gov.points.forEach((p) => { const i = nearestCell(W.flow, p.pos); p.cell = i; p.sector = i >= 0 ? W.flow.cells[i].sector : null; });
  W.gov.val = officialValidation(W.flow, W.gov.points.map((p) => p.pos));
  W.dead = deadEnds(W.flow);
  W.bn = bottlenecks(W.flow, W.water);
  W.facExp = facilityExposure(W.flow, W.water);
  state.extraVuln = new Map([...W.facExp].map(([s, list]) => [s, Math.min(2, list.length * 0.25)]));
  state.extraConfirmed = new Map();

  const confirm = (sector, reason) => { if (sector == null || sector < 0) return; state.extraConfirmed.set(sector, reason); load(); };
  const sectorAt = (pos) => { const i = nearestCell(W.flow, pos); return i >= 0 ? W.flow.cells[i].sector : base.stations.reduce((b, s, k) => (km(pos, s.pos) < km(pos, base.stations[b].pos) ? k : b), 0); };
  const sectorSelect = (id, sel = 0) => `<select id="${id}">${names.map((n, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  const flyTo = (pos, zoom = 14) => map.flyTo({ center: [pos[1], pos[0]], zoom, pitch: 50, duration: 1200 });
  const nowH = () => Date.now() + W.clockH * 3600e3;
  const severityStage = () => (state.plan?.city.p2 >= state.plan?.city.costLoss ? ASSUMPTIONS.stageM[2] : ASSUMPTIONS.stageM[1]);

  // ---------- map layers ----------
  await ready;
  for (const id of ['i-ponds', 'i-catch', 'i-flow', 'i-culverts', 'i-lakes', 'i-breach', 'i-enc', 'i-fac', 'i-over', 'i-route', 'i-pins', 'i-gwl', 'i-seg', 'i-tanks']) map.addSource(id, { type: 'geojson', data: fc([]) });
  map.addSource('s2', { type: 'raster', tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg'], tileSize: 256, maxzoom: 15, attribution: 'Sentinel-2 cloudless 2023 by EOX (Copernicus data)' });
  map.addLayer({ id: 'i-s2', type: 'raster', source: 's2', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.85 } }, 'shade');
  map.addLayer({ id: 'i-lakes', type: 'fill', source: 'i-lakes', paint: { 'fill-color': ['case', ['get', 'outflow'], '#2a6fb0', '#b48cff'], 'fill-opacity': 0.45, 'fill-outline-color': '#cfe6ff' } });
  map.addLayer({ id: 'i-tanks', type: 'fill', source: 'i-tanks', paint: { 'fill-color': '#4fb3ff', 'fill-opacity': 0.25, 'fill-outline-color': '#9fd6ff' } });
  map.addLayer({ id: 'i-seg', type: 'line', source: 'i-seg', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['interpolate', ['linear'], ['get', 'ratio'], 0.2, '#ff4d5e', 0.5, '#f2b544', 0.9, '#3ccf91'], 'line-width': 3 } });
  map.addLayer({ id: 'i-catch', type: 'fill-extrusion', source: 'i-catch', paint: { 'fill-extrusion-color': '#3ccf91', 'fill-extrusion-height': 60, 'fill-extrusion-opacity': 0.45 } });
  map.addLayer({ id: 'i-ponds', type: 'circle', source: 'i-ponds', paint: { 'circle-radius': 4, 'circle-color': '#b48cff', 'circle-opacity': 0.85, 'circle-pitch-alignment': 'map' } });
  const lineLayout = { 'line-cap': 'round', 'line-join': 'round' };
  for (const id of ['i-breach', 'i-flow', 'i-route']) map.addLayer({ id: `${id}-case`, type: 'line', source: id, layout: lineLayout, paint: { 'line-color': '#05080c', 'line-width': 10, 'line-opacity': 0.75 } });
  map.addLayer({ id: 'i-breach', type: 'line', source: 'i-breach', layout: lineLayout, paint: { 'line-color': '#ff4d5e', 'line-width': 6 } });
  map.addLayer({ id: 'i-flow', type: 'line', source: 'i-flow', layout: lineLayout, paint: { 'line-color': ['get', 'color'], 'line-width': 6 } });
  map.addLayer({ id: 'i-route', type: 'line', source: 'i-route', layout: lineLayout, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'w'], 'line-opacity': 0.95 } });
  map.addLayer({ id: 'i-over', type: 'circle', source: 'i-over', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'km2'], 0.5, 4, 20, 11], 'circle-color': '#ff8a3d', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1, 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'i-culverts', type: 'circle', source: 'i-culverts', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'rank'], 1, 9, 20, 4], 'circle-color': '#f2b544', 'circle-stroke-color': '#1a1200', 'circle-stroke-width': 1.5, 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'i-enc', type: 'circle', source: 'i-enc', paint: { 'circle-radius': 3.5, 'circle-color': ['match', ['get', 'type'], 'lake-bed', '#ff4d5e', 'lake-buffer', '#ff8a3d', '#ffd27a'], 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'i-fac', type: 'circle', source: 'i-fac', paint: { 'circle-radius': 4, 'circle-color': ['case', ['get', 'low'], '#ff4d5e', '#e8eef7'], 'circle-stroke-color': '#000', 'circle-stroke-width': 1, 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'i-gwl', type: 'circle', source: 'i-gwl', paint: { 'circle-radius': 7, 'circle-color': '#ff4d5e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5, 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'i-pins', type: 'circle', source: 'i-pins', paint: { 'circle-radius': 7, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-pitch-alignment': 'map' } });
  const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'tip', offset: 10 });
  for (const id of ['i-culverts', 'i-lakes', 'i-enc', 'i-fac', 'i-over', 'i-pins', 'i-gwl', 'i-seg']) {
    map.on('mousemove', id, (e) => { if (!W.pick) tip.setLngLat(e.lngLat).setHTML(e.features[0].properties.tip).addTo(map); });
    map.on('mouseleave', id, () => tip.remove());
  }
  map.on('click', (e) => {
    if (!W.pick) return;
    const pos = [e.lngLat.lat, e.lngLat.lng];
    if (W.pick === 'follow') followFrom(pos);
    if (W.pick === 'ticket') { W.ticketPos = pos; W.pick = null; map.getCanvas().style.cursor = ''; state.tab = 'fixit'; drawPanel(); }
  });

  function drawLayers() {
    const vis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    map.getSource('i-ponds').setData(fc(W.show.ponds ? W.dead.map((i) => feat('Point', [W.flow.cells[i].lon, W.flow.cells[i].lat])) : []));
    map.getSource('i-culverts').setData(fc(W.show.culverts ? W.bn.map((b, k) => feat('Point', [b.pos[1], b.pos[0]], { rank: k + 1,
      tip: `<b>#${k + 1} culvert${b.name ? `: ${esc(b.name)}` : ''}</b><br>${b.km2} km² drains through it · ${pct(b.lowShare)} low ground<br>${b.facilities} facilities, ${b.encroach} buffer buildings upstream` })) : []));
    map.getSource('i-lakes').setData(fc(W.show.lakes ? W.water.lakes.map((l) => {
      const lb = W.lakes?.find((x) => x.id === l.id);
      return feat('Polygon', [ll(l.ring)], { outflow: lb ? lb.outflow : true, tip: `<b>${esc(l.name || 'Unnamed lake')}</b> · ${l.ha} ha${lb ? `<br>${lb.outflow ? 'outflow nala mapped' : '<span class="bad">no outflow nala in OSM</span>'}` : ''}` });
    }) : []));
    map.getSource('i-enc').setData(fc(W.show.enc ? W.water.encroach.map((e) => feat('Point', [e.pos[1], e.pos[0]], { type: e.type, tip: `<b>${e.type.replace('-', ' ')}</b>: ${esc(e.water)}<br>${e.m} m from edge (rule ${e.limit} m) · to verify` })) : []));
    const low = new Set([...W.facExp.values()].flat().map((f) => f.pos.join()));
    map.getSource('i-fac').setData(fc(W.show.fac ? W.water.facilities.map((f) => feat('Point', [f.pos[1], f.pos[0]], { low: low.has(f.pos.join()), tip: `<b>${esc(f.name || f.kind)}</b><br>${esc(f.kind)}${low.has(f.pos.join()) ? ' · <span class="bad">low ground</span>' : ''}` })) : []));
    map.getSource('i-over').setData(fc(W.show.over && W.over ? W.over.slice(0, 60).map((o) => feat('Point', [W.flow.cells[o.cell].lon, W.flow.cells[o.cell].lat], { km2: o.km2, tip: `<b>Drain overflows ${fmt(o.at)}</b><br>${o.km2} km² upstream · peak ${o.ratio}× capacity` })) : []));
    map.getSource('i-gwl').setData(fc(W.show.gwl ? W.gov.points.map((p) => feat('Point', [p.pos[1], p.pos[0]], { tip: `<b>${esc(p.name)}</b><br>GHMC official waterlogging point (TGRAC)` })) : []));
    map.getSource('i-seg').setData(fc(W.show.seg ? (gseg?.features ?? []).filter((f) => f.properties.Ext_Width && f.properties.Prop_Width).map((f) => ({ ...f, properties: { ratio: f.properties.Ext_Width / f.properties.Prop_Width,
      tip: `<b>${esc(f.properties.Nala_Name)}</b><br>existing ${f.properties.Ext_Width} m vs proposed ${f.properties.Prop_Width} m (${Math.round((f.properties.Ext_Width / f.properties.Prop_Width) * 100)}%)` } })) : []));
    map.getSource('i-tanks').setData(W.show.tanks && W.gov.tanks ? W.gov.tanks : fc([]));
    vis('i-s2', W.show.s2);
  }

  // the 3D terrain columns hide lines drawn on the ground: fade them while a path is shown, and frame the path
  const focus = (coords) => {
    if (map.getLayer('hand')) map.setLayoutProperty('hand', 'visibility', coords ? 'none' : 'visible'); // columns write depth even when faded
    if (map.getLayer('stations')) map.setPaintProperty('stations', 'fill-extrusion-opacity', coords ? 0.35 : 0.95);
    if (!coords?.length) return;
    const xs = coords.map((c) => c[0]), ys = coords.map((c) => c[1]);
    // padding keeps the path clear of the legend (left) and the rain chart (bottom)
    map.fitBounds([[Math.min(...xs) - 0.003, Math.min(...ys) - 0.003], [Math.max(...xs) + 0.003, Math.max(...ys) + 0.003]], { padding: { top: 70, bottom: 230, left: 290, right: 70 }, pitch: 25, bearing: 0, maxZoom: 15, duration: 1200 });
  };

  // ---------- A1 Follow the Water ----------
  function followFrom(pos) {
    const i = nearestCell(W.flow, pos);
    if (i < 0) { W.follow = { error: 'That spot is outside the terrain grid (more than 2.5 km from a police station).' }; drawPanel(); return; }
    const t = trace(W.flow, i), up = catchment(W.flow, i);
    const upSet = new Set(up);
    const fac = W.water.facilities.filter((f) => upSet.has(nearestCell(W.flow, f.pos)));
    W.follow = { i, t, up, fac, sectors: [...new Set(t.path.map((c) => W.flow.cells[c].sector))], cell: W.flow.cells[i] };
    const pts = t.path.map((c) => [W.flow.cells[c].lon, W.flow.cells[c].lat]);
    const toDrain = t.firstDrain >= 0 ? pts.slice(0, t.firstDrain + 1) : pts;
    map.getSource('i-flow').setData(fc([feat('LineString', pts, { color: '#ffd166' }), feat('LineString', toDrain, { color: t.deadEnd ? '#b48cff' : '#3ccf91' })]));
    map.getSource('i-catch').setData(fc(up.slice(0, 3000).map((c) => feat('Polygon', box(cellPos(c), 0.00105, 0.00113)))));
    focus(pts);
    state.tab = 'water'; drawPanel();
  }

  // ---------- A4 drain overflow (approximation) ----------
  function computeOverflow() {
    const p = state.plan; if (!p) return [];
    const q = 1 - p.costLoss, H = p.forecast.times.length, fc0 = state.forecast;
    // each drain takes the rain at its nearest forecast point (the 9-point city lattice), at the plan's quantile
    const pts = fc0.points.slice(0, 9);
    const series = pts.map((_, k) => Array.from({ length: H }, (_, h) => quantile(fc0.members.map((m) => m.series[k][h]), q)));
    const rainFor = (x) => series[pts.reduce((b, pt, k) => ((pt[0] - x.lat) ** 2 + (pt[1] - x.lon) ** 2 < (pts[b][0] - x.lat) ** 2 + (pts[b][1] - x.lon) ** 2 ? k : b), 0)];
    const cut = new Map();
    const drains = W.flow.cells.filter((x) => x.drain);
    const nearestDrain = (pos) => drains.reduce((b, x) => { const d = (x.lat - pos[0]) ** 2 + (x.lon - pos[1]) ** 2; return d < b.d ? { d, i: x.i } : b; }, { d: Infinity, i: -1 }).i;
    for (const t of W.tickets.filter((x) => x.status !== 'cleared' && x.pos)) cut.set(nearestDrain(t.pos), Math.min(0.6, (cut.get(nearestDrain(t.pos)) ?? 0) + 0.5));
    for (const e of W.water.encroach.filter((x) => x.type === 'nala-buffer').slice(0, 400)) { const d = nearestDrain(e.pos); cut.set(d, Math.min(0.6, (cut.get(d) ?? 0) + 0.05)); }
    W.over = drainOverflow(W.flow, null, p.forecast.times, { cut, rainFor });
    W.overRain = Math.max(...series.flat());
    return W.over;
  }

  // ---------- tickets (B3) ----------
  const saveTickets = () => store.set('surgeforce-tickets', W.tickets);
  const hoursToRain = () => (state.plan?.city.onset != null ? Math.max(1, state.plan.city.onset) : 24);
  function addTicket({ sector, pos, note, photo, source }) {
    const created = nowH();
    W.tickets.unshift({ id: `T${Date.now().toString(36)}`, sector, pos: pos ?? base.stations[sector].pos, note, photo, source, created, deadline: created + hoursToRain() * 3600e3, status: 'open' });
    saveTickets();
  }
  const ticketStatus = (t) => (t.status === 'cleared' ? 'cleared' : nowH() > t.deadline ? 'escalated' : 'open');

  // ---------- vision (Transformers.js, on-device) ----------
  async function tf() { if (!W.tf) { W.tf = await import(TRANSFORMERS); W.tf.env.allowLocalModels = false; } return W.tf; }
  async function clip() {
    if (W.clip) return W.clip;
    W.vis.status = 'downloading CLIP (once, then cached)…'; drawPanel();
    W.clip = await (await tf()).pipeline('zero-shot-image-classification', V.CLIP_MODEL, { dtype: 'q8' });
    W.vis.status = 'CLIP ready (on-device)'; return W.clip;
  }
  async function detr() {
    if (W.detr) return W.detr;
    W.vis.status = 'downloading DETR object detector (once)…'; drawPanel();
    W.detr = await (await tf()).pipeline('object-detection', V.DETR_MODEL, { dtype: 'q8' });
    W.vis.status = 'DETR ready (on-device)'; return W.detr;
  }
  const classify = async (img, labels) => (await clip())(img, labels, { hypothesis_template: '{}' });
  const hazardScore = async (img, h) => (await classify(img, V.hazardLabels(h))).find((s) => s.label === h.label).score;
  const readFile = (file, max = 640) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.85)); }; im.onerror = rej; im.src = r.result; };
    r.onerror = rej; r.readAsDataURL(file);
  });
  const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = src; });
  async function grey(src, size = 256) {
    const im = await loadImg(src), c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, size, size);
    const d = g.getImageData(0, 0, size, size).data, out = new Uint8Array(size * size);
    for (let i = 0; i < out.length; i++) out[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    return out;
  }
  async function run(fn) {
    W.vis.busy = true; W.vis.error = null; drawPanel();
    try { await fn(); } catch (e) { W.vis.error = e.message; }
    W.vis.busy = false; if (W.vis.status.startsWith('downloading')) W.vis.status = 'ready'; drawPanel();
  }
  const VISION = {
    photo: ['Photo → depth → complaint', 'B2 · F8', 'A citizen or officer photo: AI estimates water depth and spots hazards (live wire, open manhole, fallen tree, blocked drain), routes each to the right department, and pre-fills a GHMC MyCURE complaint.'],
    cctv: ['CCTV water watch', 'C2 · F1', 'A camera over a hotspot or underpass: every 2 s the frame is checked for water and depth. The first camera to see water confirms the sector; 30 cm or more at an underpass closes it. Use a video file or this device\'s camera as the feed.'],
    dashcam: ['Dashcam street audit', 'C3 · F3', 'Patrol dashcam video, sampled every 2 s: open manholes, garbage by drains, silt, waterlogging and fallen trees are pinned for the pre-monsoon checklist.'],
    culvert: ['Culvert blockage', 'F2', 'A fixed camera or photo at a chokepoint: clear or blocked. Blocked opens a ticket on the escalation clock (B3) that must be cleared before the rain.'],
    nala: ['Drone nala survey', 'F4', 'A drone image of a nala is split into 9 tiles; each is checked for garbage, silt, weeds, broken walls and buildings at the edge.'],
    rescue: ['Drone search & rescue', 'F5', 'An aerial image after flooding: an object detector finds people, vehicles and boats; people become a rescue task for the nearest DRF team.'],
    change: ['Change detection', 'F6', 'Two images of the same lake edge or nala on different dates: the share of the scene that changed, as a heat map. New construction inside a buffer becomes an encroachment lead.'],
    gauge: ['Camera-read gauge', 'F7', 'A painted water-level scale on an underpass wall: click the top and the bottom of the scale; the waterline is where the stripes disappear.'],
    satellite: ['Satellite view', 'D3 · F9', 'Sentinel-2 imagery on the map, and Sentinel-1 radar (sees through cloud) for the event dates in the Copernicus Browser.'],
  };

  // openly licensed sample photos from Wikimedia Commons, loaded at runtime (shown with credit)
  const CM = 'https://upload.wikimedia.org/wikipedia/commons/thumb/';
  const SAMPLES = {
    photo: [['Hyderabad flood 2020', `${CM}9/97/2020_Hyderabad_floods.jpg/960px-2020_Hyderabad_floods.jpg`], ['Flooded colony, Hyderabad', `${CM}2/28/A_Flooded_Colony_in_Hyderabad.jpg/960px-A_Flooded_Colony_in_Hyderabad.jpg`], ['Dry street, Afzal Gunj', `${CM}b/bd/AfzalGunj_Hyderabad.jpg/960px-AfzalGunj_Hyderabad.jpg`]],
    rescue: [['IAF flood rescue, Gujarat 2015', `${CM}9/93/Rescue_Operations_by_Indian_Air_Force_in_July_2015_Gujarat_Flood_1.jpg/960px-Rescue_Operations_by_Indian_Air_Force_in_July_2015_Gujarat_Flood_1.jpg`]],
  };
  const sampleButtons = (mode) => (SAMPLES[mode] ?? []).map(([n, u]) => `<button class="btn" data-sample="${esc(u)}">Sample: ${esc(n)}</button>`).join('');
  async function urlToData(url, max = 640) {
    const im = await loadImg(url), sc = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  }

  // ---------- panels ----------
  panels.water = () => {
    const f = W.follow, lakes = W.lakes ?? [];
    const over = computeOverflow(); drawLayers();
    const followCard = `<div class="card"><h4>A1 · Follow the Water</h4><div class="muted small">Click any spot: the yellow line is where its rain flows downhill (green up to the first nala, purple if it ponds first), and the green blocks are everything uphill that drains into it. Built from the 250 m terrain grid with depression filling (Barnes 2014) and D8 flow directions.</div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn ${W.pick === 'follow' ? 'primary' : ''}" data-w="pick-follow">${W.pick === 'follow' ? 'Click on the map…' : 'Pick a spot on the map'}</button>
      <button class="btn" data-w="clear-follow">Clear</button><label class="ctl small"><input type="checkbox" data-show="ponds" ${W.show.ponds ? 'checked' : ''}> dead-end ground (${W.dead.length} cells)</label></div>
      ${f?.error ? `<p class="bad small">${esc(f.error)}</p>` : f ? `<table style="margin-top:8px">
        <tr><td>Spot</td><td>${esc(names[f.cell.sector])} · ${f.cell.elev} m, ${f.cell.hand} m above nearest drain</td></tr>
        <tr><td>Water goes</td><td>${f.t.deadEnd ? '<b class="bad">ponds before reaching any nala (dead end)</b>' : `reaches a nala after ${(f.t.firstDrain * 0.25).toFixed(2)} km`}${f.t.pondAt >= 0 ? ' · collects in a depression on the way' : ''}; traced ${f.t.km} km through ${f.sectors.map((s) => esc(names[s])).join(' → ')}</td></tr>
        <tr><td>Drains into it</td><td>${(f.up.length * 0.0625).toFixed(2)} km² uphill${f.fac.length ? ` incl. ${f.fac.length} facilities` : ''}</td></tr></table>` : ''}</div>`;
    const govNear = (pos) => W.gov.points.reduce((best, p) => { const d = km(pos, p.pos); return d < best.d ? { d, p } : best; }, { d: Infinity, p: null });
    const bnRows = W.bn.slice(0, 12).map((b, k) => { const g = govNear(b.pos); return `<tr><td>#${k + 1} ${esc(b.name || `culvert on ${b.kind}`)}<div class="muted small">${esc(names[b.sector])}${g.d <= 0.5 ? ` · <b class="bad">${Math.round(g.d * 1000)} m from GHMC point ${esc(g.p.name)}</b>` : ''}</div></td><td class="n">${b.km2}</td><td class="n">${pct(b.lowShare)}</td><td class="n">${b.facilities}/${b.encroach}</td><td><button class="btn" data-fly="${b.pos.join(',')}">Show</button></td></tr>`; }).join('');
    const bnCard = `<div class="card"><h4>A2 · Bottleneck Finder</h4><div class="muted small">${W.bn.length} places where a nala passes under a road (OSM culverts on the terrain grid), ranked by land draining through them, how much of it is low ground, and the facilities and buffer buildings upstream. Clear these first before the monsoon.</div>
      <label class="ctl small"><input type="checkbox" data-show="culverts" ${W.show.culverts ? 'checked' : ''}> show on map</label>
      ${bnRows ? `<table style="margin-top:6px"><tr><th>Culvert</th><th class="n">km² up</th><th class="n">low</th><th class="n">fac/enc</th><th></th></tr>${bnRows}</table>` : '<p class="muted small">No culvert data: run npm run fetch-water.</p>'}
      <div class="muted small">Culverts within 500 m of a GHMC official waterlogging point are flagged in red.</div></div>`;
    const v = W.gov.val, segs = W.gov.segs;
    const govCard = `<div class="card"><h4>Official GHMC drainage data (TGRAC) <span class="badge ok">government data</span></h4><div class="muted small">Public GIS of the Telangana Remote Sensing Applications Centre: GHMC's ${W.gov.points.length} major waterlogging points, ${segs.length.toLocaleString('en-IN')} surveyed nala segments with existing and proposed widths, and ${W.gov.tanks?.features.length ?? 0} tanks.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px"><label class="ctl small"><input type="checkbox" data-show="gwl" ${W.show.gwl ? 'checked' : ''}> waterlogging points</label><label class="ctl small"><input type="checkbox" data-show="seg" ${W.show.seg ? 'checked' : ''}> nala widths (red = far below proposed)</label><label class="ctl small"><input type="checkbox" data-show="tanks" ${W.show.tanks ? 'checked' : ''}> tanks</label></div>
      <p class="small"><b>Model check against the government points:</b> ${Math.round(v.conv * 100)}% of the ${v.n} points sit where at least 0.25 km² of rain converges, against ${Math.round(v.convBase * 100)}% of the city (<b>${v.convLift}× lift</b>). Low ground alone does not explain them (${Math.round(v.low * 100)}% vs ${Math.round(v.lowBase * 100)}%): most are underpasses and junctions where drains fail, so SurgeForce uses flow convergence and the official list together. Small sample (n = ${v.n}).</p>
      <p class="small"><b>${segs.filter((x) => x.ratio < 0.5).length.toLocaleString('en-IN')} of ${segs.length.toLocaleString('en-IN')}</b> nala segments are under half their proposed width. Biggest shortfalls:</p>
      <table>${segs.slice(0, 8).map((x) => `<tr><td class="small">${esc(x.nala)}<div class="muted">${esc(x.circle ?? '')} · ${x.lengthM} m long</div></td><td class="n small">${x.ext} / ${x.prop} m</td><td><button class="btn" data-fly="${x.pos.join(',')}">Show</button></td></tr>`).join('')}</table>
      <details class="small" style="margin-top:6px"><summary>All ${W.gov.points.length} GHMC waterlogging points</summary>${W.gov.points.map((p) => `<div><a href="#" data-fly="${p.pos.join(',')}">${esc(p.name)}</a> <span class="muted">${p.sector != null ? esc(names[p.sector]) : ''}</span></div>`).join('')}</details></div>`;
    const watch = state.plan && state.plan.city.p2 >= state.plan.city.costLoss;
    const lkRows = lakes.slice(0, 10).map((l) => `<tr><td>${esc(l.name)}<div class="muted small">${l.ha} ha · ${l.outflow ? 'outflow nala mapped' : '<b class="bad">no outflow nala in OSM</b>'}${l.onGrid ? '' : ' · edge of terrain grid'}${watch && !l.outflow ? ' · <b class="bad">watch this bund</b>' : ''}</div></td><td class="n">${l.capped ? '6+' : l.pathKm} km</td><td class="n">${l.minutesToEnd}′</td><td class="n">${l.facilities.length}</td><td><button class="btn" data-breach="${l.id}">Path</button></td></tr>`).join('');
    const sel = lakes.find((l) => l.id === W.breachId);
    const lkCard = `<div class="card"><h4>A3 · Lake Breach Watch</h4><div class="muted small">For every lake of 5 ha or more: the path water takes from its lowest edge if the bund fails (first 6 km), how long it takes to travel it (at about 1.5 m/s), the facilities within 300 m of the path, and whether any mapped nala leaves the lake (Gurram Cheruvu, 2020, had no outflow channel). OSM misses many nalas, so "no outflow in OSM" means check on the ground.</div>
      <label class="ctl small"><input type="checkbox" data-show="lakes" ${W.show.lakes ? 'checked' : ''}> lakes on map (purple = no outflow nala in OSM)</label>
      ${lkRows ? `<table style="margin-top:6px"><tr><th>Lake</th><th class="n">Path</th><th class="n">Time</th><th class="n">Fac.</th><th></th></tr>${lkRows}</table>` : '<p class="muted small">Computing lake paths…</p>'}
      ${sel ? `<div class="small" style="margin-top:6px"><b>Pre-written evacuation message (${esc(sel.name)})</b><pre class="xml" style="white-space:pre-wrap">EN: Heavy rain. ${sel.name} bund is under watch. Residents of ${sel.sectors.map((s) => names[s]).join(', ')} downstream: move to higher floors or the nearest shelter now. Do not cross flowing water. Dial 100 / 1070.
TE: భారీ వర్షం. ${sel.name} కట్టను పర్యవేక్షిస్తున్నాం. దిగువ ప్రాంత ప్రజలు వెంటనే ఎత్తైన అంతస్తులకు లేదా సమీప శిబిరానికి వెళ్ళండి. 100 / 1070 కు కాల్ చేయండి.</pre></div>` : ''}</div>`;
    const ovRows = over.slice(0, 10).map((o) => `<tr><td>${fmt(o.at)}</td><td>${esc(names[o.sector])}</td><td class="n">${o.km2}</td><td class="n">${o.ratio}×</td></tr>`).join('');
    const ovCard = `<div class="card"><h4>A4 · Drain overflow forecast</h4><div class="muted small">Approximate digital twin until GHMC's storm-drain GIS is released: each nala cell carries what its catchment sheds; it overflows when rain averaged over the catchment's travel time exceeds 12 mm/h, the drain capacity NIH Roorkee measured (GHMC states up to 20; rational method, runoff 0.8). Blocked-drain tickets and buffer buildings cut capacity. Rain: each drain's nearest forecast point at the plan's ${pct(1 - (state.plan?.costLoss ?? 0.1))} quantile (peak ${W.overRain?.toFixed(1)} mm/h).</div>
      <label class="ctl small"><input type="checkbox" data-show="over" ${W.show.over ? 'checked' : ''}> show on map (orange)</label>
      ${ovRows ? `<p class="small"><b>${over.length}</b> drain points overflow in this forecast; first at <b>${fmt(over[0].at)}</b>.</p><table><tr><th>When</th><th>Area</th><th class="n">km² up</th><th class="n">peak</th></tr>${ovRows}</table>` : '<p class="small ok">No drain overflows in this forecast.</p>'}
      <div class="muted small">Replace with EPA SWMM on the GHMC drain network (as NIH did for Zone XII) when the GIS is shared.</div></div>`;
    return followCard + bnCard + govCard + lkCard + ovCard;
  };

  panels.fixit = () => {
    const confirmedSet = new Set(state.plan.sectors.filter((s) => s.confirmed).map((s) => s.id));
    W.enc = rankEncroachments(W.flow, W.water, confirmedSet);
    const counts = W.enc.reduce((o, e) => { o[e.type] = (o[e.type] ?? 0) + 1; return o; }, {});
    const encRows = W.enc.slice(0, 15).map((e, k) => `<tr><td>${esc(e.water)}<div class="muted small">${e.type.replace('-', ' ')} · ${e.m} m (rule ${e.limit} m) · ${esc(names[e.sector])}${e.feeds.length ? ' · <b class="bad">drains into flooded area</b>' : ''}</div></td>
      <td><button class="btn" data-fly="${e.pos.join(',')}">Show</button> <button class="btn" data-complaint="${k}">Copy complaint</button></td></tr>`).join('');
    const encCard = `<div class="card"><h4>B1 · Encroachment Detector</h4><div class="muted small">OSM buildings inside the legal no-build buffers: 30 m from lakes of 10 ha+, 9 m from smaller lakes, 9 m from wide nalas, 2 m from narrow ones. Ranked by whether they drain into a flooded area. OSM lake outlines are not the notified FTL line (only 765 of 3,532 lakes are final): every row is a lead for a human to verify, never a finding.</div>
      <p class="small"><b>${W.enc.length}</b> leads: ${counts['lake-bed'] ?? 0} inside a lake bed, ${counts['lake-buffer'] ?? 0} in a lake buffer, ${counts['nala-buffer'] ?? 0} in a nala buffer.
      <label class="ctl"><input type="checkbox" data-show="enc" ${W.show.enc ? 'checked' : ''}> show on map</label></p>
      ${encRows ? `<table>${encRows}</table>` : ''}${W.copied ? `<p class="small ok">Complaint copied: paste into the HYDRAA / GHMC grievance form.</p>` : ''}</div>`;
    const tRows = W.tickets.map((t) => {
      const st = ticketStatus(t), left = (t.deadline - nowH()) / 3600e3;
      return `<div class="act ${st === 'cleared' ? 'approved' : st === 'escalated' ? 'rejected' : ''}" style="border-left-color:${st === 'cleared' ? 'var(--ok)' : st === 'escalated' ? 'var(--act)' : 'var(--prepare)'}">
        <div class="t"><span>${t.id} · ${esc(names[t.sector])}${t.source ? ` · ${esc(t.source)}` : ''}</span><span class="badge ${st === 'cleared' ? 'ok' : st === 'escalated' ? 'late' : 'req'}">${st}</span></div>
        <div style="display:flex;gap:8px;margin-top:4px">${t.photo ? `<img src="${t.photo}" style="width:64px;height:48px;object-fit:cover;border-radius:6px">` : ''}${t.afterPhoto ? `<img src="${t.afterPhoto}" style="width:64px;height:48px;object-fit:cover;border-radius:6px;outline:2px solid var(--ok)">` : ''}
        <div class="small">${esc(t.note || 'Blocked drain')}<div class="muted">${st === 'cleared' ? 'cleared with an after-photo' : st === 'escalated' ? `deadline passed ${Math.abs(left).toFixed(1)} h ago: escalated to the zonal office` : `clear within <b>${left.toFixed(1)} h</b> (rain expected then)`}</div></div></div>
        ${st !== 'cleared' ? `<div class="row"><label class="btn">After-photo to close<input type="file" accept="image/*" data-after="${t.id}" hidden></label></div>` : ''}${W.closeMsg?.id === t.id ? `<div class="small bad">${esc(W.closeMsg.text)}</div>` : ''}</div>`;
    }).join('');
    const tkCard = `<div class="card"><h4>B3 · Blocked-drain tracker with an escalation clock</h4><div class="muted small">Every blocked drain gets a pin, a photo and a deadline tied to the rain forecast (rain expected in ${hoursToRain()} h). Missed deadlines escalate to the zonal office. Closing needs an after-photo, and if the vision model is loaded it checks that the drain is actually clear, so tickets cannot be closed on paper. Stored in this browser.</div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center">${sectorSelect('tkSector', W.ticketPos ? sectorAt(W.ticketPos) : 0)}
      <button class="btn ${W.pick === 'ticket' ? 'primary' : ''}" data-w="pick-ticket">${W.ticketPos ? '📍 placed' : 'Place on map'}</button>
      <input type="text" id="tkNote" placeholder="What is blocked?" style="flex:1;min-width:120px;max-width:none"></div>
      <div style="display:flex;gap:6px;margin-top:6px;align-items:center"><label class="btn">Photo (required)<input type="file" accept="image/*" id="tkPhoto" hidden></label>${W.tkPhoto ? '<span class="small ok">photo added</span>' : ''}
      <button class="btn primary" data-w="add-ticket">Open ticket</button><button class="btn" data-w="ff">Fast-forward 12 h</button>${W.clockH ? `<span class="muted small">clock +${W.clockH} h</span>` : ''}</div>
      ${tRows || '<p class="muted small" style="margin-top:6px">No tickets yet.</p>'}</div>`;
    const rep = afterFlood(W.flow, state.raw, { govPoints: W.gov.points, govSegs: W.gov.segs, bottleneckList: W.bn, encroach: W.enc, lakes: W.lakes ?? [], tickets: W.tickets.map((t) => ({ ...t, status: ticketStatus(t) })), deadEndCells: W.dead });
    W.report = rep;
    const rRows = rep.rows.map((r) => `<tr><td>${esc(names[r.id])}<div class="muted small">${r.predicted ? 'predicted' : '<b class="bad">missed</b>'}</div></td><td class="small">${r.causes.map(esc).join('<br>')}</td></tr>`).join('');
    const rpCard = `<div class="card"><h4>B4 · After-Flood Accountability Report</h4><div class="muted small">For each sector where flooding was confirmed: was it predicted (top quarter by exposure), and the likely causes from the bottlenecks, encroachments, lakes, dead-end ground and open tickets. Builds a year-on-year evidence trail.</div>
      ${rep.rows.length ? `<p class="small">${rep.rows.length} flooded sectors: <b>${rep.hits}</b> predicted, <b>${rep.misses}</b> missed; ${rep.falseAlarms} of ${rep.predicted} predicted sectors not (yet) reported.</p><table>${rRows}</table>
      <button class="btn" data-w="report-dl">Download report (.md)</button>` : '<p class="muted small">No confirmed flooding yet. In Reports, send a report or "Simulate 10 reports" to see the report fill in.</p>'}</div>`;
    const changes = learn(state.raw, W.flow, ASSUMPTIONS);
    const lnCard = `<div class="card"><h4>E3 · A plan that learns from every storm</h4><div class="muted small">After an event, the confirmed reports re-fit what the plan assumes. Each proposal moves 30% of the way to what this event showed (one storm is little evidence); a human applies it, and every change is logged.</div>
      ${changes.length ? `<table>${changes.map((c, k) => `<tr><td><b>${c.key}</b><div class="muted small">${esc(c.why)}</div></td><td class="n">${c.from} → <b>${c.to}</b></td><td><button class="btn" data-learn="${k}">Apply</button></td></tr>`).join('')}</table>` : '<p class="muted small">Needs confirmed flooding to learn from.</p>'}
      ${W.learnLog.length ? `<div class="small" style="margin-top:6px"><b>Change log</b>${W.learnLog.slice(-5).reverse().map((l) => `<div class="muted">${new Date(l.at).toLocaleString('en-IN')}: ${esc(l.key)} ${l.from} → ${l.to}</div>`).join('')}<button class="btn" data-w="learn-reset" style="margin-top:4px">Reset to defaults</button></div>` : ''}</div>`;
    return encCard + tkCard + rpCard + lnCard;
  };

  panels.vision = () => {
    const v = W.vis, m = VISION[v.mode];
    const tabs = Object.entries(VISION).map(([k, [n, code]]) => `<button class="btn ${v.mode === k ? 'primary' : ''}" data-vmode="${k}" title="${code}">${n}</button>`).join('');
    const file = (id, label = 'Choose image') => `<label class="btn">${label}<input type="file" accept="image/*" id="${id}" hidden></label>`;
    const where = `<span class="small muted">Area</span> ${sectorSelect('vSector', v.sector ?? 0)}`;
    const img = (src, extra = '') => src ? `<div style="position:relative;margin-top:8px;display:inline-block;max-width:100%">${'<img src="' + src + '" style="max-width:100%;border-radius:8px;display:block" id="vImg">'}${extra}</div>` : '';
    let body = '';
    if (v.mode === 'photo') {
      const r = v.result;
      body = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${file('vFile')}${where}</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${sampleButtons('photo')}</div>${img(v.img)}${v.credit ? `<div class="muted small">Photo: Wikimedia Commons (${esc(v.credit)})</div>` : ''}
        ${r ? `<table style="margin-top:8px"><tr><td>Water depth</td><td><b>~${r.depth.cm} cm</b> ${r.depth.flooded ? '<span class="badge late">flooded</span>' : '<span class="badge ok">not flooded</span>'} <span class="muted small">confidence ${pct(r.depth.confidence)}</span></td></tr>
          <tr><td>Hazards</td><td>${r.haz.found.length ? r.haz.found.map((h) => `<span class="badge ${h.human ? 'late' : ''}">${h.possible ? 'possible ' : ''}${h.key.replace('_', ' ')} ${pct(h.p)}</span>`).join(' ') : '<span class="muted">none</span>'}</td></tr>
          <tr><td>Route to</td><td>${r.haz.routes.map(esc).join('<br>') || '—'}${r.haz.human ? '<div class="bad small">Human review required (life-safety hazard)</div>' : ''}</td></tr></table>
          <pre class="xml" style="white-space:pre-wrap">${esc(r.complaint)}</pre>
          <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" data-w="copy-mycure">Copy MyCURE complaint</button>${r.depth.flooded ? `<button class="btn primary" data-w="confirm-photo">Confirm flooding in ${esc(names[v.sector ?? 0])}</button>` : ''}${r.haz.found.some((h) => h.key === 'blocked_drain') ? '<button class="btn" data-w="ticket-photo">Open blocked-drain ticket</button>' : ''}</div>` : ''}`;
    } else if (v.mode === 'cctv') {
      const cams = base.underpasses.map((u) => ({ id: u.id, name: u.name, sector: u.sector }));
      body = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><select id="vCam">${cams.map((c) => `<option value="${c.id}" ${v.cam === c.id ? 'selected' : ''}>CCTV at ${esc(c.name)}</option>`).join('')}</select>
        <label class="btn">Video file<input type="file" accept="video/*" id="vVideo" hidden></label><button class="btn" data-w="webcam">Use this device's camera</button>${W.cctv ? '<button class="btn" data-w="cctv-stop">Stop</button>' : ''}</div>
        <p class="muted small">The camera feeds of the city's command centres are not public, so this uses a video you choose or your own camera as the feed for the selected underpass camera. Only a water/depth signal leaves the analysis.</p>
        ${W.cctvLog?.length ? `<table>${W.cctvLog.slice(-8).reverse().map((l) => `<tr><td>${l.t}</td><td>${l.flooded ? `<b class="bad">water ~${l.cm} cm</b>` : 'dry'}</td><td class="small muted">${esc(l.action || '')}</td></tr>`).join('')}</table>` : ''}`;
    } else if (v.mode === 'dashcam') {
      body = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><label class="btn">Dashcam video<input type="file" accept="video/*" id="vDash" hidden></label>${where}</div>
        <p class="muted small">Without GPS in the video, findings are pinned in the chosen area; a patrol app would use the phone's GPS for each frame.</p>
        ${v.dash ? `<p class="small">${v.dash.frames} frames checked · <b>${v.dash.finds.length}</b> findings</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${v.dash.finds.map((f) => `<div class="small"><img src="${f.img}" style="width:100%;border-radius:6px"><div><b>${f.key.replace('_', ' ')}</b> ${pct(f.score)} · ${f.t}s</div></div>`).join('')}</div>` : ''}`;
    } else if (v.mode === 'culvert') {
      body = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${file('vFile')}<select id="vCulvert">${W.bn.slice(0, 30).map((b, k) => `<option value="${k}">#${k + 1} ${esc(b.name || 'culvert')} · ${esc(names[b.sector])}</option>`).join('')}</select></div>${img(v.img)}
        ${v.result ? `<p class="small">${v.result.blocked ? `<b class="bad">Blocked</b> (${pct(v.result.p)}): ticket opened on the escalation clock.` : `<b class="ok">Clear</b> (${pct(1 - v.result.p)}).`}</p>` : ''}`;
    } else if (v.mode === 'nala') {
      body = `<div style="display:flex;gap:6px;flex-wrap:wrap">${file('vFile', 'Drone image')}</div>${img(v.img, v.tiles ? `<div style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr)">${v.tiles.map((t) => `<div style="border:1px solid rgba(255,255,255,.4);background:${t.key === 'clear' ? 'transparent' : 'rgba(255,77,94,.28)'};font-size:10px;padding:2px;color:#fff;text-shadow:0 0 3px #000">${t.key === 'clear' ? '' : `${t.key} ${pct(t.score)}`}</div>`).join('')}</div>` : '')}
        ${v.tiles ? `<p class="small">${v.tiles.filter((t) => t.key !== 'clear').length} of 9 tiles need work: ${[...new Set(v.tiles.filter((t) => t.key !== 'clear').map((t) => t.key))].join(', ') || 'none'}.</p>` : ''}`;
    } else if (v.mode === 'rescue') {
      const r = v.rescue;
      body = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${file('vFile', 'Aerial image')}${where}${sampleButtons('rescue')}</div>${img(v.img, r ? r.keep.map((d) => `<div style="position:absolute;left:${d.box.xmin * 100}%;top:${d.box.ymin * 100}%;width:${(d.box.xmax - d.box.xmin) * 100}%;height:${(d.box.ymax - d.box.ymin) * 100}%;border:2px solid ${d.label === 'person' ? '#ff4d5e' : '#f2b544'};font-size:10px;color:#fff;text-shadow:0 0 3px #000">${d.label}</div>`).join('') : '')}
        ${r ? `<p class="small">${r.people} people · ${r.vehicles} vehicles · ${r.boats} boats</p>${r.task ? `<p class="small"><b>${esc(r.task)}</b></p><button class="btn primary" data-w="rescue-task">Create rescue task in ${esc(names[v.sector ?? 0])}</button>` : '<p class="muted small">Nobody detected.</p>'}` : ''}`;
    } else if (v.mode === 'change') {
      body = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${file('vA', 'Before image')}${file('vB', 'After image')}${v.a ? '<span class="small ok">before ✓</span>' : ''}${v.b ? '<span class="small ok">after ✓</span>' : ''}</div>
        ${v.change ? `<div style="display:flex;gap:6px;margin-top:8px"><img src="${v.a}" style="width:32%;border-radius:6px"><img src="${v.b}" style="width:32%;border-radius:6px"><img src="${v.change.heat}" style="width:32%;border-radius:6px"></div>
        <p class="small"><b>${pct(v.change.share)}</b> of the scene changed${v.change.share > 0.15 ? ': <b class="bad">significant change, check for new construction inside the buffer</b>' : '.'}</p>` : ''}
        <p class="muted small">Images should show the same view (fixed camera or co-registered drone/satellite tiles). Sentinel-2 at 10 m is enough for lake water spread, not single buildings.</p>`;
    } else if (v.mode === 'gauge') {
      body = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${file('vFile', 'Gauge photo')}<select id="vCam">${base.underpasses.map((u) => `<option value="${u.id}" ${v.cam === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
        <span class="small">top <input type="number" id="gTop" value="${v.gTop ?? 100}" style="width:56px"> cm, bottom <input type="number" id="gBot" value="${v.gBot ?? 0}" style="width:50px"> cm</span></div>
        ${v.img ? `<p class="small">${!v.clicks?.length ? 'Click the <b>top</b> of the scale on the photo.' : v.clicks.length === 1 ? 'Now click the <b>bottom</b> of the scale.' : ''}</p>` : ''}
        ${img(v.img, (v.clicks ?? []).map((c) => `<div style="position:absolute;left:${c[0] * 100}%;top:${c[1] * 100}%;width:10px;height:10px;margin:-5px;border-radius:50%;background:#f2b544"></div>`).join('') + (v.gauge ? `<div style="position:absolute;left:0;right:0;top:${v.gauge.y * 100}%;border-top:2px dashed #4fb3ff"></div>` : ''))}
        ${v.gauge ? `<p class="small">Water level: <b>${v.gauge.value} cm</b>${v.gauge.value >= 30 ? ' · <b class="bad">above 30 cm: underpass closure confirmed</b>' : ''}</p>` : ''}`;
    } else if (v.mode === 'satellite') {
      body = `<label class="ctl small"><input type="checkbox" data-show="s2" ${W.show.s2 ? 'checked' : ''}> Sentinel-2 cloudless imagery on the map (EOX, 2023)</label>
        <p class="small" style="margin-top:6px"><a target="_blank" rel="noopener" href="https://browser.dataspace.copernicus.eu/?zoom=12&lat=17.385&lng=78.475&datasetId=S1_AWS_IW_VVVH&fromTime=2024-08-30T00%3A00%3A00.000Z&toTime=2024-09-03T23%3A59%3A59.999Z">Open Sentinel-1 radar for 30 Aug – 3 Sep 2024 in the Copernicus Browser</a></p>
        <p class="muted small">Radar sees through cloud and at night; standing water is dark. A change-detection pipeline on Sentinel-1 (as in recent Mumbai and Delhi studies) would map what actually flooded and score our terrain model (B4, E3). It needs a Copernicus account and server-side processing, so it is not run in the browser.</p>`;
    }
    return `<div class="card"><h4>Computer vision, on this device</h4><div class="muted small">Open models run in the browser with Transformers.js (CLIP for zero-shot classification, DETR for detection). Images never leave the device; only a flood signal is used. AI may escalate to a human, never downgrade. Zero-shot results are approximate: production would fine-tune on Hyderabad imagery.</div>
      <div class="small" style="margin-top:4px">Model: <b>${esc(v.status)}</b>${v.busy ? ' · working…' : ''}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px">${tabs}</div></div>
      <div class="card"><h4>${m[0]} <span class="badge">${m[1]}</span></h4><div class="muted small">${m[2]}</div><div style="margin-top:8px">${body}</div>${v.error ? `<p class="bad small">${esc(v.error)}</p>` : ''}</div>`;
  };

  panels.live = () => {
    const items = W.sachet?.items ?? [], tg = items.filter((i) => i.telangana);
    const sachetCard = `<div class="card"><h4>D1 · Official alerts (NDMA SACHET)</h4><div class="muted small">Public CAP 1.2 alerts from IMD and other agencies. SACHET blocks browser requests, so a GitHub Action saves a copy every 15 minutes${W.sachet ? ` (this copy: ${new Date(W.sachet.fetchedAt).toLocaleString('en-IN')})` : ''}.</div>
      <p class="small">${tg.length ? `<b class="bad">${tg.length} alerts for Telangana</b>` : '<span class="ok">No current alert for Telangana.</span>'} · ${items.length} alerts nationwide.</p>
      ${(tg.length ? tg : items).slice(0, 6).map((i) => `<div class="small" style="margin-bottom:6px"><span class="badge">${esc(i.category)}</span> <b>${esc(i.sender)}</b> · ${new Date(i.time).toLocaleString('en-IN')}<div class="muted">${esc(i.title.slice(0, 180))}</div></div>`).join('')}</div>`;
    const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    const c1 = `<div class="card"><h4>C1 · Citizen reporting and public map</h4><div class="muted small">Residents report on a public page (or WhatsApp) in any of our 4 languages, with a photo and location. Reports land here, are read by the same on-device AI, and appear on the public map after verification, like Jakarta's PetaBencana.</div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><a class="btn" href="report.html" target="_blank" rel="noopener">Open the public report page</a></div>
      <p class="small">${isLocal ? 'Local server: reports from any phone on this network and the WhatsApp webhook (<code>/api/whatsapp</code>) arrive here every 10 s.' : 'On this static site, reports from the public page reach this command centre in the same browser. Run <code>npm start</code> for reports from other devices and the WhatsApp webhook.'}</p>
      ${W.inbox.length ? `<table>${W.inbox.slice(-6).reverse().map((r) => `<tr><td class="small">${esc(r.text)}</td><td class="small muted">${esc(r.source ?? '')}</td></tr>`).join('')}</table>` : '<p class="muted small">No public reports yet.</p>'}</div>`;
    const s = W.sensors;
    const c4 = `<div class="card"><h4>C4 · Water-level sensors at the hotspots</h4><div class="muted small">Ultrasonic sensors at the lowest underpasses and the top culverts. <b>Readings here are simulated</b> from the forecast rain and each site's terrain; a real sensor posts to <code>/api/sensor</code> on the local server. 30 cm or more confirms the sector and closes the underpass.</div>
      <div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" data-w="sensors">${s ? 'Restart' : 'Run the storm on the sensors'}</button>${s ? `<input type="range" id="sHour" min="0" max="${state.plan.forecast.times.length - 1}" value="${W.sensorHour}" style="flex:1"><span class="small">${fmt(state.plan.forecast.times[W.sensorHour])}</span>` : ''}</div>
      ${s ? `<table style="margin-top:6px">${s.map((x) => { const lv = x.levels[W.sensorHour]; return `<tr><td class="small">${esc(x.name)}</td><td class="n small">${lv} cm</td><td style="width:40%"><div class="bar"><i class="${lv >= 30 ? 'short' : ''}" style="width:${Math.min(100, lv)}%"></i></div></td></tr>`; }).join('')}</table>` : ''}</div>`;
    const aws = W.aws;
    const d2 = `<div class="card"><h4>D2 · Telangana automatic weather stations</h4><div class="muted small">TSDPS runs 1,044 stations (about 78 in Hyderabad); live access needs a data agreement. Import their hourly data as CSV (<code>station,lat,lon,time,rain_mm</code>): any station with 20 mm/h or more confirms rain in its sector before the first citizen call.</div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><label class="btn">Import AWS CSV<input type="file" accept=".csv,text/csv" id="awsFile" hidden></label><button class="btn" data-w="aws-template">Download template</button></div>
      ${aws ? `<p class="small">${aws.rows} readings from ${aws.stations.length} stations; ${aws.heavy.length ? `<b class="bad">${aws.heavy.length} above 20 mm/h</b>: ${aws.heavy.map((h) => `${esc(h.station)} ${h.mm} mm/h`).join(', ')}` : 'none above 20 mm/h'}.</p>` : ''}</div>`;
    const d4 = `<div class="card"><h4>D4 · IMD forecasts and warnings</h4><div class="muted small">IMD's API (api.imd.gov.in) serves city forecasts only to registered, IP-whitelisted users, so it cannot be called from a public web page. SurgeForce already uses IMD's heavy / very heavy / extremely heavy rain categories as its 24 h triggers, and SACHET (above) carries IMD's official warnings.</div>
      <p class="small"><a target="_blank" rel="noopener" href="https://mausam.imd.gov.in/hyderabad/">IMD Hyderabad</a> · <a target="_blank" rel="noopener" href="https://mausam.imd.gov.in/responsive/districtWiseWarningGIS.php">District warnings map</a></p></div>`;
    const approved = state.plan.actions.filter((a) => a.approval?.decision === 'approved');
    W.boards = approved.filter((a) => ['underpass', 'alert', 'counterpart', 'musi'].includes(a.kind)).map((a) => ({ id: a.id, kind: a.kind, at: a.at,
      vms: a.kind === 'underpass' ? `${a.title.replace(/^Close /, '').replace(/ \(.*/, '').toUpperCase()} CLOSED · FLOODING · USE ALTERNATE ROUTE` : a.kind === 'alert' ? 'HEAVY RAIN ALERT · AVOID UNDERPASSES AND NALAS · DIAL 100' : 'FLOOD RESPONSE IN PROGRESS · GIVE WAY TO EMERGENCY VEHICLES',
      pa: a.kind === 'alert' ? a.detail : a.title }));
    const d5 = `<div class="card"><h4>D5 · Push to TGiCCC message boards and PA</h4><div class="muted small">Approved actions become variable-message-sign text and public-address announcements in the format a command-and-control centre ingests. Approve underpass closures or alerts in the Timeline to fill this; the feed downloads as JSON until TGiCCC gives an endpoint.</div>
      ${W.boards.length ? `<table style="margin-top:6px">${W.boards.slice(0, 6).map((b) => `<tr><td class="small"><code>${esc(b.vms)}</code></td></tr>`).join('')}</table><button class="btn" data-w="boards-dl">Download board feed (JSON)</button>` : '<p class="muted small">Nothing approved yet.</p>'}</div>`;
    const lowFac = [...W.facExp.values()].flat();
    const top = [...W.facExp].sort((a, b) => b[1].length - a[1].length).slice(0, 5);
    const e2 = `<div class="card"><h4>E2 · Protect the most vulnerable first</h4><div class="muted small">${W.water.facilities.length} hospitals, clinics, schools, anganwadis and care homes from OSM. <b>${lowFac.length}</b> sit on low ground (≤ 2.5 m above the nearest drain); each adds to its sector's exposure in the plan, so those sectors get teams and counterparts first.</div>
      <label class="ctl small"><input type="checkbox" data-show="fac" ${W.show.fac ? 'checked' : ''}> show on map (red = low ground)</label>
      <table style="margin-top:6px">${top.map(([s, l]) => `<tr><td class="small">${esc(names[s])}</td><td class="small muted">${l.length} on low ground: ${l.slice(0, 3).map((f) => esc(f.name || f.kind)).join(', ')}</td></tr>`).join('')}</table></div>`;
    return sachetCard + c1 + c4 + d2 + d4 + d5 + e2;
  };

  panels.route = () => {
    const r = W.route;
    const from = W.routeFrom ?? 0, to = W.routeTo ?? (state.plan.sectors.find((s) => s.confirmed)?.id ?? 1);
    return `<div class="card"><h4>E1 · Flood-aware routing</h4><div class="muted small">Asks the OSRM road router for up to 3 routes, then counts how many flooded 250 m cells each one crosses (ground below the current flood stage in exposed sectors, every low cell in confirmed sectors, and closed underpasses). Each flooded cell costs 10 minutes; the safest route wins. Live road data, needs internet.</div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:6px;margin-top:8px;align-items:center"><span class="small">From</span>${sectorSelect('rFrom', from)}<span class="small">To</span>${sectorSelect('rTo', to)}</div>
      <div style="display:flex;gap:6px;margin-top:8px"><button class="btn primary" data-w="route">Find a flood-safe route</button><button class="btn" data-w="clear-follow">Clear map</button></div></div>
      ${r?.error ? `<p class="bad small">${esc(r.error)}</p>` : ''}
      ${r?.routes ? `<div class="card"><table><tr><th>Route</th><th class="n">Drive</th><th class="n">Flooded cells</th><th class="n">Score</th></tr>${r.routes.map((x, k) => `<tr><td>${k === r.best ? '<b class="ok">chosen</b>' : 'rejected'}</td><td class="n">${x.min}′</td><td class="n">${x.wet}</td><td class="n">${x.score}′</td></tr>`).join('')}</table>
        <p class="small">${r.routes[r.best].wet ? `Every option crosses some water; the chosen one crosses the least (${r.routes[r.best].wet} cells).` : 'The chosen route avoids all flooded cells.'}${r.best !== 0 ? ` It is ${r.routes[r.best].min - r.routes[0].min} min longer than the fastest but drier.` : ''}</p></div>` : ''}`;
  };

  // ---------- route (E1) ----------
  async function findRoute() {
    const from = Number($('#rFrom').value), to = Number($('#rTo').value);
    W.routeFrom = from; W.routeTo = to;
    const a = base.stations[from].pos, b = base.stations[to].pos;
    W.route = { pending: true }; drawPanel();
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?alternatives=3&overview=full&geometries=geojson`);
      if (!res.ok) throw new Error(`router ${res.status}`);
      const j = await res.json();
      const stage = severityStage(), p = state.plan;
      const conf = new Set(p.sectors.filter((s) => s.confirmed).map((s) => s.id)), exposed = new Set(p.sectors.filter((s) => s.onset != null).map((s) => s.id));
      const wetCell = (i) => { const x = W.flow.cells[i]; return conf.has(x.sector) ? x.hand <= ASSUMPTIONS.stageM[3] : exposed.has(x.sector) && x.hand <= stage; };
      const closed = p.actions.filter((x) => x.kind === 'underpass').map((x) => x.pos);
      const routes = j.routes.map((rt) => {
        const cells = new Set();
        for (const [lon, lat] of rt.geometry.coordinates) { const i = nearestCell(W.flow, [lat, lon]); if (i >= 0 && km([lat, lon], cellPos(i)) < 0.2 && wetCell(i)) cells.add(i); }
        const under = closed.filter((u) => rt.geometry.coordinates.some(([lon, lat]) => km([lat, lon], u) < 0.08)).length;
        const wet = cells.size + under * 3, min = Math.round(rt.duration / 60);
        return { min, wet, score: min + wet * 10, coords: rt.geometry.coordinates };
      });
      const best = routes.reduce((b2, x, k) => (x.score < routes[b2].score ? k : b2), 0);
      W.route = { routes, best };
      map.getSource('i-route').setData(fc(routes.map((x, k) => feat('LineString', x.coords, { color: k === best ? '#3ccf91' : '#ff4d5e', w: k === best ? 6 : 3 }))));
      focus(routes.flatMap((x) => x.coords));
    } catch (e) { W.route = { error: `Routing failed: ${e.message}` }; }
    drawPanel();
  }

  // ---------- sensors (C4, simulated) ----------
  function runSensors() {
    const p = state.plan, H = p.forecast.times.length, q = 1 - p.costLoss, fc0 = state.forecast, pts = fc0.points.slice(0, 9);
    const rainAt = (pos) => { const k = pts.reduce((b, pt, j) => (km(pos, pt) < km(pos, pts[b]) ? j : b), 0); return Array.from({ length: H }, (_, h) => quantile(fc0.members.map((m) => m.series[k][h]), q)); };
    const sites = [...base.underpasses.map((u) => ({ name: `Underpass: ${u.name}`, pos: u.pos, sector: u.sector, hand: p.underpassHand[u.id] }))
      .sort((a, b) => a.hand - b.hand).slice(0, 8), ...W.bn.slice(0, 4).map((b, k) => ({ name: `Culvert #${k + 1} (${names[b.sector]})`, pos: b.pos, sector: b.sector, hand: W.flow.cells[b.cell].hand }))];
    W.sensors = sites.map((s) => {
      const i = nearestCell(W.flow, s.pos), up = i >= 0 ? W.flow.acc[i] : 1;
      const k = (0.6 + Math.log10(1 + up)) / (1 + s.hand); // more land draining in and lower ground = faster rise
      let level = 0;
      const levels = rainAt(s.pos).map((r) => { level = Math.max(0, level * 0.75 + Math.max(0, r - 6) * k * 4); return Math.round(level); }); // drains carry ~6 mm/h, the rest ponds
      return { ...s, levels };
    });
    W.sensorHour = Math.max(0, W.sensors[0].levels.findIndex((_, h) => W.sensors.some((x) => x.levels[h] >= 30)));
    applySensors();
  }
  function applySensors() {
    const hits = W.sensors.filter((x) => x.levels[W.sensorHour] >= 30);
    const fresh = hits.filter((x) => !state.extraConfirmed.has(x.sector));
    fresh.forEach((x) => state.extraConfirmed.set(x.sector, `sensor ${x.name}: ${x.levels[W.sensorHour]} cm`));
    if (fresh.length) load(); else drawPanel();
  }

  // ---------- inbox (C1 public reports, local sensors) ----------
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('surgeforce') : null;
  const intake = (r) => {
    W.inbox.push(r);
    if (r.kind === 'sensor') {
      if (r.levelCm >= 30 && r.lat != null) state.extraConfirmed.set(sectorAt([r.lat, r.lon]), `sensor ${r.id}: ${r.levelCm} cm`);
    } else {
      const key = state.plan.key, place = r.lat != null ? ` (near ${names[sectorAt([r.lat, r.lon])]})` : '';
      state.reports[key] = [...(state.reports[key] ?? []), { text: `${r.text}${place}`, at: r.at ?? new Date().toISOString() }];
    }
    load();
  };
  bc?.addEventListener('message', (e) => e.data?.text && intake({ ...e.data, kind: 'report', source: 'public page' }));
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    let since = new Date().toISOString();
    setInterval(async () => {
      try {
        const items = await (await fetch(`/api/inbox?since=${encodeURIComponent(since)}`)).json();
        if (items.length) { since = items.at(-1).at; items.forEach(intake); }
      } catch { /* server not running the API */ }
    }, 10000);
  }

  // ---------- events ----------
  const download = (name, text, type = 'text/plain') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  document.addEventListener('click', async (e) => {
    const vimg = e.target.closest('#vImg');
    if (vimg && W.vis.mode === 'gauge') {
      const r = vimg.getBoundingClientRect(), pt = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
      W.vis.clicks = [...(W.vis.clicks ?? []).slice(-1 * ((W.vis.clicks ?? []).length >= 2 ? 0 : 1)), pt].slice(-2);
      if ((W.vis.clicks ?? []).length === 2) await readGauge(); else drawPanel();
      return;
    }
    const t = e.target.closest('button,[data-w],[data-fly]');
    if (!t) return;
    const w = t.dataset.w;
    if (t.dataset.fly) { e.preventDefault(); return flyTo(t.dataset.fly.split(',').map(Number), 15); }
    if (t.dataset.breach) {
      const l = W.lakes.find((x) => String(x.id) === t.dataset.breach); W.breachId = l.id;
      const coords = l.path.map((c) => [W.flow.cells[c].lon, W.flow.cells[c].lat]);
      map.getSource('i-breach').setData(fc([feat('LineString', coords)]));
      focus([...coords, ...W.water.lakes.find((x) => x.id === l.id).ring.map(([a, b]) => [b, a])]); return drawPanel();
    }
    if (t.dataset.complaint) {
      const en = W.enc[Number(t.dataset.complaint)];
      await navigator.clipboard?.writeText(complaintText(en, names[en.sector])).catch(() => {});
      W.copied = true; drawPanel(); setTimeout(() => { W.copied = false; }, 3000); return;
    }
    if (t.dataset.learn) {
      const c = learn(state.raw, W.flow, ASSUMPTIONS)[Number(t.dataset.learn)];
      if (c.key === 'hitShare') ASSUMPTIONS.hitShare = c.to; else ASSUMPTIONS.stageM[2] = c.to;
      W.learnLog.push({ ...c, at: new Date().toISOString() }); store.set('surgeforce-learning', W.learnLog); return load();
    }
    if (t.dataset.sample) {
      W.vis.sector = Number($('#vSector')?.value ?? W.vis.sector ?? 0);
      W.vis.credit = t.textContent.replace('Sample: ', ''); W.vis.result = null; W.vis.rescue = null;
      try { W.vis.img = await urlToData(t.dataset.sample, W.vis.mode === 'rescue' ? 960 : 640); } catch { W.vis.error = 'Could not load the sample photo (offline?).'; return drawPanel(); }
      return run(W.vis.mode === 'rescue' ? rescue : analysePhoto);
    }
    if (t.dataset.vmode) { W.vis.mode = t.dataset.vmode; W.vis.img = null; W.vis.result = null; W.vis.clicks = []; W.vis.gauge = null; return drawPanel(); }
    if (!w) return;
    if (w === 'pick-follow' || w === 'pick-ticket') { W.pick = W.pick ? null : w.slice(5); map.getCanvas().style.cursor = W.pick ? 'crosshair' : ''; return drawPanel(); }
    if (w === 'clear-follow') { W.follow = null; W.pick = null; W.breachId = null; map.getCanvas().style.cursor = ''; for (const id of ['i-flow', 'i-catch', 'i-breach', 'i-route']) map.getSource(id).setData(fc([])); focus(null); return drawPanel(); }
    if (w === 'add-ticket') {
      if (!W.tkPhoto) { W.closeMsg = null; alert('A photo is required to open a ticket.'); return; }
      addTicket({ sector: Number($('#tkSector').value), pos: W.ticketPos, note: $('#tkNote').value.trim().slice(0, 200), photo: W.tkPhoto, source: 'officer' });
      W.tkPhoto = null; W.ticketPos = null; return drawPanel();
    }
    if (w === 'ff') { W.clockH += 12; return drawPanel(); }
    if (w === 'report-dl') {
      const r = W.report;
      return download(`surgeforce-after-flood-${state.plan.key}.md`, `# After-Flood Accountability Report: ${state.plan.key}\n\n${r.rows.length} flooded sectors: ${r.hits} predicted, ${r.misses} missed, ${r.falseAlarms} predicted but not reported.\n\n| Sector | Predicted | Likely causes |\n|---|---|---|\n${r.rows.map((x) => `| ${names[x.id]} | ${x.predicted ? 'yes' : 'no'} | ${x.causes.join('; ')} |`).join('\n')}\n\nSource: SurgeForce (OSM, terrain model; causes are leads to verify).\n`, 'text/markdown');
    }
    if (w === 'learn-reset') { localStorage.removeItem('surgeforce-learning'); location.reload(); return; }
    if (w === 'copy-mycure') { await navigator.clipboard?.writeText(W.vis.result.complaint).catch(() => {}); t.textContent = 'Copied'; return; }
    if (w === 'confirm-photo') return confirm(W.vis.sector ?? 0, `photo: ~${W.vis.result.depth.cm} cm water`);
    if (w === 'ticket-photo') { addTicket({ sector: W.vis.sector ?? 0, note: 'Blocked drain seen in citizen photo', photo: W.vis.img, source: 'photo AI' }); state.tab = 'fixit'; return drawPanel(); }
    if (w === 'rescue-task') return confirm(W.vis.sector ?? 0, `drone: ${W.vis.rescue.task}`);
    if (w === 'webcam') return startCctv(null);
    if (w === 'cctv-stop') return stopCctv();
    if (w === 'sensors') return runSensors();
    if (w === 'aws-template') return download('tsdps-aws-template.csv', 'station,lat,lon,time,rain_mm\nUppal AWS,17.4010,78.5590,2024-08-31T14:00,32.5\nSecunderabad AWS,17.4399,78.4983,2024-08-31T14:00,12.0\n', 'text/csv');
    if (w === 'boards-dl') return download('tgiccc-board-feed.json', JSON.stringify({ generatedAt: new Date().toISOString(), source: 'SurgeForce (approved actions only)', messages: W.boards }, null, 2), 'application/json');
    if (w === 'route') return findRoute();
  });

  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.dataset.show) { W.show[el.dataset.show] = el.checked; drawLayers(); return; }
    if (el.id === 'vSector') { W.vis.sector = Number(el.value); return; }
    if (el.id === 'vCam') { W.vis.cam = Number(el.value); return; }
    if (el.id === 'gTop' || el.id === 'gBot') { W.vis.gTop = Number($('#gTop').value); W.vis.gBot = Number($('#gBot').value); if (W.vis.clicks?.length === 2) await readGauge(); return; }
    if (el.id === 'sHour') { W.sensorHour = Number(el.value); return applySensors(); }
    if (el.id === 'tkPhoto' && el.files[0]) { W.tkPhoto = await readFile(el.files[0], 320); return drawPanel(); }
    if (el.dataset.after && el.files[0]) return closeTicket(el.dataset.after, await readFile(el.files[0], 320));
    if (el.id === 'awsFile' && el.files[0]) return importAws(await el.files[0].text());
    if (el.id === 'vVideo' && el.files[0]) return startCctv(URL.createObjectURL(el.files[0]));
    if (el.id === 'vDash' && el.files[0]) return run(() => dashcam(URL.createObjectURL(el.files[0])));
    if (['vFile', 'vA', 'vB'].includes(el.id) && el.files[0]) {
      const src = await readFile(el.files[0], W.vis.mode === 'rescue' ? 960 : 640);
      if (el.id === 'vA') { W.vis.a = src; return W.vis.b ? run(changeDetect) : drawPanel(); }
      if (el.id === 'vB') { W.vis.b = src; return W.vis.a ? run(changeDetect) : drawPanel(); }
      W.vis.img = src; W.vis.credit = null; W.vis.result = null; W.vis.tiles = null; W.vis.rescue = null; W.vis.clicks = []; W.vis.gauge = null;
      W.vis.sector = Number($('#vSector')?.value ?? W.vis.sector ?? 0);
      if (W.vis.mode === 'photo') return run(analysePhoto);
      if (W.vis.mode === 'culvert') return run(culvert);
      if (W.vis.mode === 'nala') return run(nalaSurvey);
      if (W.vis.mode === 'rescue') return run(rescue);
      return drawPanel();
    }
  });

  // ---------- vision tasks ----------
  async function analysePhoto() {
    const img = W.vis.img;
    if (!V.isScene(await classify(img, V.SCENE))) { W.vis.result = null; W.vis.error = 'This does not look like an outdoor photo of a street, drain or flooded area, so it was not analysed.'; return; }
    const pairs = {};
    for (const h of V.HAZARDS) pairs[h.key] = await hazardScore(img, h);
    const depth = V.depthFromScores(await classify(img, V.DEPTH.map((d) => d.label)), pairs.flooding);
    const haz = V.hazardsFromScores(pairs);
    const s = W.vis.sector ?? 0;
    const complaint = ['GHMC MyCURE grievance (draft, the citizen approves before sending)', `Category: ${haz.found.some((h) => h.key === 'blocked_drain') ? 'Storm water drain blocked' : depth.flooded ? 'Water logging' : 'Other'}`,
      `Location: ${names[s]} area (${base.stations[s].pos.join(', ')})`, depth.flooded ? `Water depth estimated from photo: about ${depth.cm} cm` : 'No standing water seen in the photo',
      haz.found.length ? `Also seen: ${haz.found.map((h) => `${h.key.replace('_', ' ')}${h.possible ? ' (possible)' : ''}`).join(', ')}` : '', 'Photo attached. Reported via SurgeForce.'].filter(Boolean).join('\n');
    W.vis.result = { depth, haz, complaint };
  }
  async function culvert() {
    const sc = await classify(W.vis.img, V.CULVERT), blocked = V.culvertBlocked(sc), p = sc.find((x) => x.label === V.CULVERT[1]).score;
    W.vis.result = { blocked, p };
    if (blocked) { const b = W.bn[Number($('#vCulvert')?.value ?? 0)]; addTicket({ sector: b?.sector ?? 0, pos: b?.pos, note: `Culvert ${b?.name || ''} blocked (camera AI ${Math.round(p * 100)}%)`, photo: W.vis.img, source: 'culvert camera' }); }
  }
  async function nalaSurvey() {
    const im = await loadImg(W.vis.img), tiles = [];
    const labels = [...V.NALA.map((n) => n.label), V.NALA_CLEAR];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const cv = document.createElement('canvas'); cv.width = Math.round(im.width / 3); cv.height = Math.round(im.height / 3);
      cv.getContext('2d').drawImage(im, (c * im.width) / 3, (r * im.height) / 3, im.width / 3, im.height / 3, 0, 0, cv.width, cv.height);
      const top = (await classify(cv.toDataURL('image/jpeg', 0.85), labels))[0];
      tiles.push({ key: top.label === V.NALA_CLEAR || top.score < 0.35 ? 'clear' : V.NALA.find((n) => n.label === top.label).key, score: top.score });
    }
    W.vis.tiles = tiles;
  }
  async function rescue() { W.vis.rescue = V.rescueFromDetections(await (await detr())(W.vis.img, { threshold: 0.5, percentage: true })); }
  async function changeDetect() {
    const size = 256, a = await grey(W.vis.a, size), b = await grey(W.vis.b, size), share = V.changeShare(a, b);
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    g.drawImage(await loadImg(W.vis.b), 0, 0, size, size);
    const d = g.getImageData(0, 0, size, size);
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 40) { d.data[i * 4] = 255; d.data[i * 4 + 1] = 40; d.data[i * 4 + 2] = 60; }
    g.putImageData(d, 0, 0);
    W.vis.change = { share, heat: c.toDataURL() };
  }
  async function readGauge() {
    const [p1, p2] = W.vis.clicks, im = await loadImg(W.vis.img);
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const n = Math.max(20, Math.round(Math.abs(p2[1] - p1[1]) * im.height)), profile = [];
    for (let k = 0; k < n; k++) {
      const x = Math.round((p1[0] + (p2[0] - p1[0]) * (k / (n - 1))) * (im.width - 1)), y = Math.round((p1[1] + (p2[1] - p1[1]) * (k / (n - 1))) * (im.height - 1));
      const d = g.getImageData(Math.max(0, x - 2), y, 5, 1).data; let s = 0;
      for (let j = 0; j < d.length; j += 4) s += 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
      profile.push(s / (d.length / 4));
    }
    const top = Number($('#gTop')?.value ?? 100), bot = Number($('#gBot')?.value ?? 0), r = V.gaugeLevel(profile, top, bot);
    if (!r) { W.vis.error = 'Scale too short in the photo: click further apart.'; return drawPanel(); }
    W.vis.gauge = { value: r.value, y: p1[1] + (p2[1] - p1[1]) * (r.row / n) };
    const u = base.underpasses[W.vis.cam ?? 0];
    if (r.value >= 30) return confirm(u.sector, `gauge at ${u.name}: ${r.value} cm`);
    drawPanel();
  }
  async function dashcam(url) {
    const v = document.createElement('video'); v.src = url; v.muted = true; v.playsInline = true;
    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('could not read this video')); });
    const c = document.createElement('canvas'), finds = []; let frames = 0;
    const labels = V.DASHCAM.map((d) => d.label);
    for (let t = 0.5; t < Math.min(v.duration, 120); t += 2) {
      v.currentTime = t; await new Promise((res) => { v.onseeked = res; });
      c.width = 320; c.height = Math.round((320 * v.videoHeight) / v.videoWidth); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      const img = c.toDataURL('image/jpeg', 0.7), top = (await classify(img, labels))[0]; frames++;
      const key = V.DASHCAM.find((d) => d.label === top.label).key;
      if (key !== 'clear' && top.score >= 0.5) finds.push({ key, score: top.score, t: Math.round(t), img });
      W.vis.status = `dashcam: ${frames} frames checked`; drawPanel();
    }
    W.vis.dash = { frames, finds };
    const s = W.vis.sector ?? 0, c0 = base.stations[s].pos;
    map.getSource('i-pins').setData(fc(finds.map((f, k) => feat('Point', [c0[1] + Math.cos(k * 2.4) * 0.004 * (1 + k % 3), c0[0] + Math.sin(k * 2.4) * 0.004 * (1 + k % 3)], { color: f.key === 'open_manhole' ? '#ff4d5e' : '#f2b544', tip: `<b>${f.key.replace('_', ' ')}</b> · dashcam ${f.t}s` }))));
    W.vis.status = 'ready';
  }
  function startCctv(url) {
    stopCctv();
    const box2 = document.createElement('div'); box2.id = 'cctvBox'; box2.className = 'glass cctv';
    const cam = base.underpasses[W.vis.cam ?? 0];
    box2.innerHTML = `<div class="small"><b>CCTV · ${esc(cam.name)}</b> <span id="cctvState" class="muted">starting…</span></div><video autoplay muted playsinline loop></video>`;
    document.querySelector('.left').appendChild(box2);
    const video = box2.querySelector('video');
    const go = async () => {
      if (url) { video.src = url; } else { video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true }); }
      await video.play().catch(() => {});
      await clip();
      W.cctvLog = [];
      const c = document.createElement('canvas');
      W.cctv = setInterval(async () => {
        if (!video.videoWidth || W.cctvBusy) return;
        W.cctvBusy = true;
        c.width = 320; c.height = Math.round((320 * video.videoHeight) / video.videoWidth); c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
        const frame = c.toDataURL('image/jpeg', 0.7);
        const d = V.depthFromScores(await classify(frame, V.DEPTH.map((x) => x.label)), await hazardScore(frame, V.HAZARDS[0]));
        let action = '';
        if (d.flooded && !state.extraConfirmed.has(cam.sector)) { action = `sector confirmed${d.cm >= 30 ? ', underpass closure' : ''}`; confirm(cam.sector, `CCTV ${cam.name}: ~${d.cm} cm`); }
        W.cctvLog.push({ t: new Date().toLocaleTimeString('en-IN'), flooded: d.flooded, cm: d.cm, action });
        const st = document.getElementById('cctvState'); if (st) st.innerHTML = d.flooded ? `<b class="bad">water ~${d.cm} cm</b>` : 'dry';
        W.cctvBusy = false;
        if (state.tab === 'vision' && W.vis.mode === 'cctv') drawPanel();
      }, 2000);
      drawPanel();
    };
    go().catch((e) => { W.vis.error = `Camera: ${e.message}`; stopCctv(); drawPanel(); });
  }
  function stopCctv() {
    clearInterval(W.cctv); W.cctv = null;
    const b = document.getElementById('cctvBox');
    b?.querySelector('video')?.srcObject?.getTracks?.().forEach((tr) => tr.stop());
    b?.remove();
    if (state.tab === 'vision') drawPanel();
  }
  async function closeTicket(id, photo) {
    const t = W.tickets.find((x) => x.id === id);
    W.closeMsg = null;
    if (W.clip) {
      const sc = await classify(photo, V.CULVERT);
      if (V.culvertBlocked(sc)) { W.closeMsg = { id, text: 'The after-photo still looks blocked to the vision model: ticket stays open.' }; return drawPanel(); }
    }
    Object.assign(t, { status: 'cleared', afterPhoto: photo, closedAt: nowH() }); saveTickets(); drawPanel();
  }
  function importAws(text) {
    const rows = text.trim().split(/\r?\n/).slice(1).map((l) => l.split(',')).filter((r) => r.length >= 5)
      .map(([station, lat, lon, time, mm]) => ({ station: station.trim(), pos: [Number(lat), Number(lon)], time, mm: Number(mm) }))
      .filter((r) => Number.isFinite(r.pos[0]) && Number.isFinite(r.pos[1]) && Number.isFinite(r.mm));
    const heavy = rows.filter((r) => r.mm >= 20);
    W.aws = { rows: rows.length, stations: [...new Set(rows.map((r) => r.station))], heavy };
    map.getSource('i-pins').setData(fc(rows.map((r) => feat('Point', [r.pos[1], r.pos[0]], { color: r.mm >= 20 ? '#ff4d5e' : '#4fb3ff', tip: `<b>${esc(r.station)}</b><br>${r.mm} mm/h · ${esc(r.time)}` }))));
    heavy.forEach((r) => state.extraConfirmed.set(sectorAt(r.pos), `AWS ${r.station}: ${r.mm} mm/h`));
    if (heavy.length) load(); else drawPanel();
  }

  drawLayers();
  setTimeout(() => { W.lakes = lakeBreach(W.flow, W.water, hand); if (state.tab === 'water') drawPanel(); drawLayers(); }, 50);
  return W;
}
