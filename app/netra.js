/* global maplibregl */
// Buildings tab = AI-NETRA (Malik) inside SurgeForce (Rohan): one flood product. SurgeForce decides when and where
// to stage teams; AI-NETRA says which buildings, with every piece of Malik's evidence: exact building identification
// with nearby candidates, Google height intelligence, footprint area, Musi and government-waterlogging proximity,
// the official October 2020 flood map, Sentinel-1 radar change, source investigation, evidence quality and
// provenance, and his rescue-readiness rule (no rescue priority without verified current incident evidence).
// The 11,659 real buildings stand in 3D at their model-estimated height, coloured by the Musi scenario plan.
import { rows, rescuePlan, stageFromMusiLevel, FLOOR_M, identify, evidenceRecords, readiness, incidentFromDemo, incidentFromField, depthAt, assess } from '../lib/netra.js';
import { musiLevels } from '../lib/risk.js';
import { scored } from '../lib/buildings.js';
import { fireRisk } from '../lib/fire.js';

const COLOR = { evacuate: '#e5484d', verify: '#e8a23a', shelter: '#2fb27c', dry: '#c3ccd8' };
const LABEL = { evacuate: 'Evacuate first', verify: 'Verify height', shelter: 'Shelter in place', dry: 'Dry' };
const CLASS = { geometry_derived: 'derived from mapped geometry', model_estimated: 'model estimate', mapped_historical: 'mapped historical', observed_historical: 'observed historical (satellite)',
  verified_current: 'verified current', unverified_current: 'unverified current', unavailable: 'unavailable' };
const PILOT = [78.513, 17.374];
const PAD = { top: 60, bottom: 230, left: 300, right: 40 }; // keep targets clear of the legend and rain chart

export async function installNetra(api) {
  const { state, map, ready, panels, drawPanel, load, esc, fc, feat, getJSON } = api;
  const N = { stage: null, plan: null, shown: false, sel: null, nearby: null, incident: null, verified: new Set() };
  const forecastStage = () => {
    const lv = state.forecast ? Math.max(0, ...musiLevels(state.forecast, state.base.musiThresholds)) : 0;
    return { level: lv, stage: stageFromMusiLevel(lv) };
  };
  const sectorAt = ([lon, lat]) => state.base.stations.reduce((b, s, i) => ((s.pos[0] - lat) ** 2 + (s.pos[1] - lon) ** 2 < (state.base.stations[b].pos[0] - lat) ** 2 + (state.base.stations[b].pos[1] - lon) ** 2 ? i : b), 0);

  const [data, hist, ev] = await Promise.all([getJSON('netra/buildings.json'), getJSON('netra/history2020.json'), getJSON('netra/evidence.json')]);
  N.data = data; N.list = rows(data); N.ev = ev;
  const byId = new Map(N.list.map((b) => [b.id, b]));
  const extra = new Map(); // exposure index and FireSight fire score, joined by OSM way id
  if (state.buildings) for (const b of fireRisk(scored(state.buildings), state.base.fire)) extra.set(`osm-way-${b.id}`, { exposure: b.score, band: b.band, fire: b.fireScore, station: b.station, stationKm: b.stationKm });

  await ready;
  map.addSource('n-bld', { type: 'geojson', data: fc([]) });
  map.addSource('n-hist', { type: 'geojson', data: hist });
  map.addSource('n-sel', { type: 'geojson', data: fc([]) });
  map.addSource('n-inc', { type: 'geojson', data: fc([]) });
  map.addLayer({ id: 'n-hist', type: 'fill', source: 'n-hist', layout: { visibility: 'none' }, paint: { 'fill-color': '#7d94ff', 'fill-opacity': 0.16, 'fill-outline-color': '#b8c4ff' } });
  map.addLayer({ id: 'n-bld', type: 'fill-extrusion', source: 'n-bld', layout: { visibility: 'none' }, paint: {
    'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.93 } });
  map.addLayer({ id: 'n-sel', type: 'line', source: 'n-sel', layout: { visibility: 'none' }, paint: { 'line-color': ['get', 'c'], 'line-width': 3 } });
  map.addLayer({ id: 'n-inc', type: 'circle', source: 'n-inc', layout: { visibility: 'none' }, paint: { 'circle-radius': 9, 'circle-color': '#f2b544', 'circle-stroke-color': '#000', 'circle-stroke-width': 2 } });

  // AI-NETRA building identification: click anywhere in the pilot. Exact footprint, or nearby candidates.
  map.on('click', (e) => {
    if (!N.shown) return;
    const r = identify(N.list, [e.lngLat.lng, e.lngLat.lat]);
    select(r.exact, r.exact ? null : r.nearby);
  });
  map.on('mouseenter', 'n-bld', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'n-bld', () => { map.getCanvas().style.cursor = ''; });

  function select(b, nearby = null) {
    N.sel = b; N.nearby = nearby;
    const lines = [];
    if (b) lines.push(feat('LineString', b.ring, { c: '#142033' }));
    for (const x of nearby ?? []) lines.push(feat('LineString', x.b.ring, { c: '#f2b544' }));
    map.getSource('n-sel').setData(fc(lines));
    state.tab = 'buildings'; drawPanel();
    document.getElementById('nSel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function recompute() {
    N.plan = rescuePlan(N.list, { stageM: N.stage });
    map.getSource('n-bld').setData(fc(N.plan.all.map((x, k) => feat('Polygon', [x.b.ring], { k, color: COLOR[x.status], h: Math.max(3, x.b.heightM ?? 3) }))));
  }
  // city-scale columns and station blocks hide street-level buildings: swap them while the tab is open
  function show(on) {
    if (on === N.shown) return;
    for (const id of ['n-bld', 'n-hist', 'n-sel', 'n-inc']) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    for (const id of ['hand', 'stations', 'links-ready', 'links-active', 'bldg']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible');
    if (on) map.flyTo({ center: PILOT, zoom: 15.3, pitch: 60, bearing: -28, padding: PAD, duration: 1600 });
    N.shown = on;
  }

  // current incident evidence for a building: Malik's demo incident (synthetic) or a SurgeForce field input
  function incidentFor(b) {
    const demo = N.ev.incidents.find((d) => d.building_id === b.id && N.incident === d.scenario_id);
    if (demo) return { kind: 'demo', inc: incidentFromDemo(demo), demo };
    const s = sectorAt(b.ring[0]), reason = state.extraConfirmed?.get(s);
    const rep = (state.plan?.reports ?? []).find((r) => r.sector === s && ['rescue_needed', 'medical'].includes(r.category));
    if (reason || rep) return { kind: 'field', inc: incidentFromField({ reason: reason ?? `citizen report: ${rep.text.slice(0, 60)}`, at: new Date().toISOString() }) };
    return null;
  }

  const row = (k, v) => `<tr><td class="muted small">${k}</td><td class="small">${v}</td></tr>`;
  function buildingCard(b) {
    const x = assess(b, depthAt(b, { stageM: N.stage })), e = extra.get(b.id), rad = N.ev.radar[b.id], inc = incidentFor(b);
    const incident = inc ? { ...inc.inc, verification_status: N.verified.has(b.id) ? 'verified' : inc.inc.verification_status } : {};
    const rd = readiness(incident), recs = evidenceRecords(b, rad, inc ? incident : null);
    const floors = b.heightOk && b.heightM ? Math.max(1, Math.round(b.heightM / FLOOR_M)) : null;
    return `<div class="card" id="nSel"><h4>Building identification <span class="badge ok">exact footprint match</span></h4><table>
      ${row('Building', `${esc(b.amenity ? b.amenity.replace(/_/g, ' ') : b.osmType && b.osmType !== 'yes' ? b.osmType : 'Building')} · ${esc(b.id.replace('osm-way-', 'OSM way '))}`)}
      ${row('Scenario plan', `<b style="color:${COLOR[x.status]}">${LABEL[x.status]}</b> · water ~${x.depthM} m at a ${N.stage} m Musi stage${x.refugeFloor ? ` · residents move to floor ${x.refugeFloor}+` : ''}`)}</table></div>
      <div class="card"><h4>Google building height intelligence</h4><table>
      ${row('Estimated height', b.heightM != null ? `${b.heightM} m${floors ? ` (~${floors} floors at 3 m)` : ''}` : 'unavailable')}
      ${row('Quality flag', `${esc(b.heightFlag.replace(/_/g, ' '))}${b.heightOk ? '' : ' · <span class="bad">not usable: treated as unknown</span>'}`)}
      ${row('Source', 'Google Open Buildings 2.5D (2023), model estimate, not field-verified')}</table></div>
      <div class="card"><h4>Footprint, river and waterlogging proximity</h4><table>
      ${row('Footprint area', b.areaM2 != null ? `${b.areaM2.toLocaleString('en-IN')} m² (not usable floor area)` : 'unavailable')}
      ${row('Musi mapped water', b.musiM != null ? `${b.musiM} m · ${esc(b.musiBand ?? '')}${b.inMusiWater ? ' · <b class="bad">intersects mapped water</b>' : ''}` : 'unavailable')}
      ${row('Govt waterlogging point', b.waterloggingM != null ? `${esc(b.waterloggingPlace)} · ${b.waterloggingM} m · ${esc(b.waterloggingBand ?? '')}` : 'unavailable')}
      ${row('', '<span class="muted">Distance to a waterlogging point is not evidence that this building floods.</span>')}</table></div>
      <div class="card"><h4>Historical mapped-area evidence: October 2020</h4><table>
      ${row('Category', esc(N.data.history2020[b.history2020]))}
      ${row('Generic flood-affected area', `${b.genericPct}% of footprint`)}${row('Named flood locality', `${b.localityPct}% of footprint`)}
      ${row('', '<span class="muted">Mapped-area coverage is not confirmed flooding of this building.</span>')}</table></div>
      <div class="card"><h4>Sentinel-1 historical radar evidence</h4>${rad ? `<table>
      ${row('Neighbourhood', `${rad.radiusM} m around the building · ${esc(rad.group)}`)}
      ${row(`Event ${rad.event.start} → ${rad.event.end}`, `VV ${Math.round(rad.event.vv * 100)}% · VH ${Math.round(rad.event.vh * 100)}% of ${rad.event.n} samples fell > 3 dB`)}
      ${row(`Control ${rad.control.start} → ${rad.control.end}`, `VV ${Math.round(rad.control.vv * 100)}% · VH ${Math.round(rad.control.vh * 100)}%`)}
      ${row('', '<span class="muted">Exploratory radar change, not verified flooding.</span>')}</table>` : '<p class="muted small">Not one of the 40 buildings in the targeted Sentinel-1 experiment (Google Earth Engine, October 2020).</p>'}</div>
      <div class="card"><h4>Source investigation</h4><table>
      ${row('Footprint', `OpenStreetMap${b.osmTimestamp ? ` · last edited ${esc(b.osmTimestamp.slice(0, 10))}` : ''} · crowdsourced, not cadastral`)}
      ${row('OSM tags', `building=${esc(b.osmType ?? '?')}${b.amenity ? ` · amenity=${esc(b.amenity)}` : ''}${b.osmLevels ? ` · levels=${esc(b.osmLevels)}` : ' · levels not recorded'}`)}
      ${row('Waterlogging points', 'Telangana Government TGRAC (GHMC major waterlogging places)')}${row('Flood map', 'Hyderabad Floods 2020 SpatialMap')}</table></div>
      ${e ? `<div class="card"><h4>Exposure and fire (shared with FireSight)</h4><table>${row('Flood exposure index', `${e.exposure} (${e.band})`)}${row('Fire score', `${e.fire} · nearest real fire station ${esc(e.station)}, ${e.stationKm} km`)}</table></div>` : ''}
      <div class="card"><h4>Evidence quality and provenance</h4><table>${recs.map((r) => row(esc(r.field.replace(/_/g, ' ')), `${r.available ? '✓' : '✗'} ${esc(CLASS[r.classification] ?? r.classification)}`)).join('')}</table></div>
      <div class="card"><h4>Unified rescue assessment <span class="badge">experimental</span></h4>
      ${inc ? `<p class="small">${inc.kind === 'demo' ? `<b>⚠ Simulated incident</b> ${esc(inc.demo.scenario_id)}: ${inc.demo.reported_people} people (${inc.demo.reported_children} children, ${inc.demo.reported_seniors} seniors), water ${inc.demo.reported_water_depth_m} m, flow ${inc.demo.reported_flow_velocity_mps} m/s.` : `Current evidence from SurgeForce: ${esc(incident.observation_source)}.`}</p>` : '<p class="small muted">No current incident evidence for this building.</p>'}
      <table>${row('Current incident evidence', `${rd.available.length} of 6 fields`)}${rd.missing.length ? row('Missing', rd.missing.map((m) => esc(m.description)).join(', ')) : ''}
      ${row('Rescue priority', rd.rescuePriority === 'not_assessed' ? '<b>not assessed</b>: current evidence is incomplete or unverified' : '<b class="ok">evidence complete: ready for human review</b>')}
      ${row('Automated dispatch', 'never authorised; a human decides')}</table>
      ${inc && !N.verified.has(b.id) ? `<button class="btn" data-n="verify" style="margin-top:6px">Officer verified on the ground</button>` : ''}</div>`;
  }

  const prev = panels.buildings; // exposure bands and flood + fire list (lib/buildings.js, lib/fire.js)
  panels.buildings = () => {
    if (N.stage == null) N.stage = forecastStage().stage;
    if (!N.plan) recompute();
    show(true);
    const fs = forecastStage(), c = N.plan.counts, q = N.plan.queue, sector = sectorAt(PILOT), pts = state.waterlogging ?? [];
    const queueRows = q.slice(0, 8).map((x) => `<tr><td><span class="badge" style="border-color:${COLOR[x.status]};color:${COLOR[x.status]}">${LABEL[x.status]}</span><div class="muted small">${esc(x.b.amenity ? x.b.amenity.replace(/_/g, ' ') : x.b.id.replace('osm-way-', 'way '))} · ${x.b.heightM ?? '?'} m tall</div></td>
      <td class="n">${x.depthM} m</td><td class="n">${x.b.musiM} m</td><td><button class="btn" data-nsel="${esc(x.b.id)}">Open</button></td></tr>`).join('');
    const selCard = N.sel ? buildingCard(N.sel) : N.nearby ? `<div class="card" id="nSel"><h4>No exact building match</h4><p class="small">Nearby candidates within 40 m (outlined in amber):</p><table>${N.nearby.map((x) => `<tr><td class="small">${esc(x.b.id.replace('osm-way-', 'OSM way '))} · ${x.b.heightM ?? '?'} m tall</td><td class="n small">${x.m} m</td><td><button class="btn" data-nsel="${esc(x.b.id)}">Open</button></td></tr>`).join('') || '<tr><td class="muted small">None within 40 m.</td></tr>'}</table></div>` : '';
    return `<div class="card"><h4>AI-NETRA building rescue intelligence <span class="badge">Malik + Rohan</span></h4>
      <div class="muted small">SurgeForce decides when and where to stage teams; AI-NETRA tells them which buildings. ${N.list.length.toLocaleString('en-IN')} real buildings of the Moosarambagh / Musi pilot stand in 3D at their real height (OpenStreetMap footprints, Google Open Buildings 2.5D). <b>Click any building</b> for its full evidence. Purple: the official 2020 flood map.</div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <select id="nWl"><option value="">Go to a government waterlogging point…</option>${pts.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('')}</select>
        <select id="nDemo"><option value="">Simulated incident (demo)…</option>${N.ev.incidents.map((d) => `<option value="${esc(d.scenario_id)}" ${N.incident === d.scenario_id ? 'selected' : ''}>${esc(d.scenario_id)} · ${d.reported_people} people · ${d.reported_water_depth_m} m</option>`).join('')}</select></div></div>
      ${selCard}
      <details class="card"><summary><b>Compare the simulated incidents</b> (Malik's multi-incident comparison)</summary><table style="margin-top:6px"><tr><th>Incident</th><th class="n">People</th><th class="n">Children / seniors</th><th class="n">Water</th><th class="n">Flow</th><th>Assessment</th></tr>
        ${N.ev.incidents.map((d) => { const r = readiness(incidentFromDemo(d)); return `<tr><td class="small">${esc(d.scenario_id)}</td><td class="n">${d.reported_people}</td><td class="n">${d.reported_children} / ${d.reported_seniors}</td><td class="n">${d.reported_water_depth_m} m</td><td class="n">${d.reported_flow_velocity_mps} m/s</td><td class="small">${r.rescuePriority === 'not_assessed' ? 'not ranked: unverified' : 'ready for review'}</td></tr>`; }).join('')}</table>
        <div class="muted small">Synthetic demonstration reports. As in AI-NETRA, incidents are compared side by side but never ranked automatically: a person verifies each one first.</div></details>
      <div class="card"><h4>Musi scenario plan</h4>
      <div style="display:flex;gap:8px;align-items:center"><span class="small">Musi stage</span><input type="range" id="nStage" min="0" max="5" step="0.5" value="${N.stage}" style="flex:1"><b class="small" id="nStageOut">${N.stage} m</b></div>
      <div class="muted small">Forecast default ${fs.stage} m: GloFAS Musi discharge ${['normal', 'above its 95th percentile', 'above its 99th percentile'][fs.level]}. <button class="btn" data-n="reset">Use forecast</button></div>
      <table style="margin-top:6px"><tr><th>What residents do</th><th class="n">Buildings</th></tr>${Object.keys(LABEL).map((k) => `<tr><td><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLOR[k]};margin-right:6px"></i>${LABEL[k]}</td><td class="n">${c[k].toLocaleString('en-IN')}</td></tr>`).join('')}</table>
      ${q.length ? `<button class="btn primary" data-n="confirm" style="margin-top:8px">Stage DRF boats: confirm ${esc(state.base.stations[sector].name.replace(/ Police Station/, ''))} sector</button>` : ''}
      <div class="muted small" style="margin-top:6px">A planning scenario to stage boats, not a rescue priority: the stage fades to nothing 600 m from the river's mapped water and is raised 30% where the 2020 flood map overlaps. Floors assume 3 m. Rescue priority needs verified current evidence (see a building's rescue assessment).</div></div>
      ${queueRows ? `<div class="card"><h4>Buildings to check first in this scenario</h4><table><tr><th>Building</th><th class="n">Water</th><th class="n">To Musi</th><th></th></tr>${queueRows}</table><div class="muted small">${q.length.toLocaleString('en-IN')} buildings have no dry floor or an unknown height at this stage.</div></div>` : ''}
      ${prev ? prev() : ''}`;
  };

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-t],[data-step]')) setTimeout(() => { if (state.tab !== 'buildings') show(false); }, 0); // tab or step buttons
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.nsel) { const b = byId.get(t.dataset.nsel); select(b); map.flyTo({ center: b.ring[0], zoom: 17.4, pitch: 55, padding: PAD, duration: 1200 }); }
    if (t.dataset.n === 'reset') { N.stage = forecastStage().stage; recompute(); drawPanel(); }
    if (t.dataset.n === 'verify' && N.sel) { N.verified.add(N.sel.id); drawPanel(); }
    if (t.dataset.n === 'confirm') { state.extraConfirmed?.set(sectorAt(PILOT), `AI-NETRA: ${N.plan.queue.length} buildings without a dry floor at a ${N.stage} m Musi stage`); load(); }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'nStage') { N.stage = Number(e.target.value); const o = document.getElementById('nStageOut'); if (o) o.textContent = `${N.stage} m`; recompute(); } });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'nStage') drawPanel();
    if (e.target.id === 'nWl' && e.target.value !== '') { const p = state.waterlogging[Number(e.target.value)]; map.flyTo({ center: [p.lon, p.lat], zoom: 16, pitch: 55, padding: PAD, duration: 1400 }); }
    if (e.target.id === 'nDemo') {
      N.incident = e.target.value || null;
      const d = N.ev.incidents.find((x) => x.scenario_id === N.incident);
      map.getSource('n-inc').setData(fc(d ? [feat('Point', [d.location.longitude, d.location.latitude])] : []));
      if (d) { const b = byId.get(d.building_id); select(b); map.flyTo({ center: [d.location.longitude, d.location.latitude], zoom: 17.4, pitch: 55, padding: PAD, duration: 1400 }); } else drawPanel();
    }
  });
  if (state.tab === 'buildings') drawPanel();
  return N;
}
