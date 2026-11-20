// AI-NETRA building rescue triage (from Malik's AI-NETRA-GEO), shared by the browser and tests.
// Under a Musi flood scenario every real building gets one of:
//   shelter  - at least one floor stays above water: residents move up, no boat yet
//   evacuate - no floor stays dry: boat / DRF rescue first
//   verify   - height missing or implausible: treated like evacuate until a person checks (never assume safety)
//   dry      - water below 0.3 m at this building
// Depth is a scenario, not a hydraulic model: the Musi stage fades with distance from the river's mapped water and
// is raised where the official 2020 flood map overlaps. Heights are Google Open Buildings 2.5D model estimates.
export const FLOOR_M = 3;

export const rows = (data) => data.buildings.map((r) => Object.fromEntries(data.columns.map((k, i) => [k, r[i]])));

export function depthAt(b, { stageM, reachM = 600, historyBoost = 1.3 }) {
  if (!stageM || b.musiM == null) return 0;
  const near = Math.max(0, 1 - b.musiM / reachM);
  return +(stageM * near * (b.history2020 ? historyBoost : 1)).toFixed(2);
}

export function assess(b, depthM) {
  if (depthM < 0.3) return { status: 'dry', depthM, floors: null, refugeFloor: null, priority: 0 };
  const floors = b.heightOk && b.heightM ? Math.max(1, Math.round(b.heightM / FLOOR_M)) : null;
  if (floors == null) return { status: 'verify', depthM, floors, refugeFloor: null, priority: 80 + depthM * 10 };
  const wetFloors = Math.ceil(depthM / FLOOR_M); // floors that take water (ground floor = 1)
  if (floors - wetFloors >= 1) return { status: 'shelter', depthM, floors, refugeFloor: wetFloors + 1, priority: 20 + depthM * 5 };
  return { status: 'evacuate', depthM, floors, refugeFloor: null, priority: 100 + depthM * 10 - floors };
}

// the whole pilot under one scenario: counts and a rescue queue, worst first
export function rescuePlan(buildings, scenario) {
  const all = buildings.map((b) => ({ b, ...assess(b, depthAt(b, scenario)) }));
  const counts = { evacuate: 0, verify: 0, shelter: 0, dry: 0 };
  all.forEach((x) => { counts[x.status]++; });
  const queue = all.filter((x) => x.status === 'evacuate' || x.status === 'verify').sort((a, c) => c.priority - a.priority);
  return { counts, queue, all };
}

// Musi stage from the GloFAS discharge level SurgeForce already computes (0 normal, 1 above p95, 2 above p99)
export const stageFromMusiLevel = (level) => [0, 1.5, 3][Math.max(0, Math.min(2, level))];

// ---------- Malik's AI-NETRA evidence logic, ported from Malik/scripts (same rules as the Python) ----------
const centroid = (ring) => ring.slice(0, -1).reduce((a, [x, y], i, arr) => [a[0] + x / arr.length, a[1] + y / arr.length], [0, 0]);
export function inRing([x, y], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const metres = ([x1, y1], [x2, y2]) => Math.hypot((x2 - x1) * 111320 * Math.cos((y1 * Math.PI) / 180), (y2 - y1) * 110570);

// identify_building (Malik/scripts/query_building.py): the exact footprint under a clicked point, otherwise the
// nearest candidates within radiusM (centroid distance), so the officer can pick the right one.
export function identify(buildings, lonLat, radiusM = 40, limit = 5) {
  const exact = buildings.find((b) => inRing(lonLat, b.ring));
  const nearby = buildings.map((b) => ({ b, m: Math.round(metres(lonLat, centroid(b.ring))) })).filter((x) => x.m <= radiusM && x.b !== exact)
    .sort((a, c) => a.m - c.m).slice(0, limit);
  return { exact: exact ?? null, nearby };
}

// classify_evidence (Malik/scripts/classify_evidence_quality.py): how each piece of evidence was obtained
export const EVIDENCE_RULES = { footprint: 'geometry_derived', height: 'model_estimated', area: 'geometry_derived', musi: 'geometry_derived',
  waterlogging: 'geometry_derived', history2020: 'mapped_historical', radar: 'observed_historical' };
export function evidenceRecords(b, radar, incident) {
  const has = { footprint: true, height: b.heightM != null && b.heightOk === 1, area: b.areaM2 != null, musi: b.musiM != null, waterlogging: b.waterloggingM != null,
    history2020: true, radar: !!radar };
  const rec = Object.entries(EVIDENCE_RULES).map(([field, cls]) => ({ field, available: has[field], classification: has[field] ? cls : 'unavailable', current: false, verified: false }));
  if (incident) {
    const verified = incident.verification_status === 'verified';
    for (const [field, value] of Object.entries(incident)) {
      if (!INCIDENT_FIELDS[field] || field === 'verification_status') continue;
      const ok = usable(field, value);
      rec.push({ field, available: ok, classification: ok ? (verified ? 'verified_current' : 'unverified_current') : 'unavailable', current: ok, verified: ok && verified });
    }
  }
  return rec;
}

// assess_readiness (Malik/scripts/assess_rescue_readiness.py): which current-incident evidence is missing. AI-NETRA
// never assigns a rescue priority from historical or geographic evidence, and never authorises dispatch.
export const INCIDENT_FIELDS = { incident_timestamp: 'Current incident timestamp', observation_source: 'Current observation source', verification_status: 'Verified observation status',
  estimated_people_stranded: 'People requiring assistance', observed_water_depth_m: 'Observed floodwater depth', observed_flow_velocity_mps: 'Observed water-flow velocity' };
function usable(field, v) {
  if (field === 'verification_status') return v === 'verified';
  if (typeof v === 'string') return !!v.trim() && !['unknown', 'unavailable'].includes(v.trim().toLowerCase());
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0;
  return false;
}
export function readiness(incident = {}) {
  const available = [], missing = [];
  for (const [f, desc] of Object.entries(INCIDENT_FIELDS)) (usable(f, incident[f]) ? available : missing).push({ field: f, description: desc });
  return { available, missing, rescuePriority: missing.length ? 'not_assessed' : 'ready_for_human_review', humanReviewRequired: true, automatedDispatchAuthorized: false };
}

// a SurgeForce field input (report, photo, CCTV, gauge, sensor) becomes AI-NETRA incident evidence for a building
export function incidentFromField({ reason, at, depthM = null, people = null }) {
  return { incident_timestamp: at, observation_source: reason, verification_status: 'unverified', estimated_people_stranded: people, observed_water_depth_m: depthM, observed_flow_velocity_mps: null };
}
// Malik's demo incidents use reported_* names; map them onto the incident contract
export const incidentFromDemo = (d) => ({ incident_timestamp: 'synthetic demo', observation_source: 'synthetic demo report', verification_status: d.verification_status,
  estimated_people_stranded: d.reported_people, observed_water_depth_m: d.reported_water_depth_m, observed_flow_velocity_mps: d.reported_flow_velocity_mps });
