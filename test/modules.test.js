import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { band, exposure, loadBuildings, refugeCandidate, summary, topExposed } from '../lib/buildings.js';
import { compoundHazard, density50, fireRisk, WEIGHTS } from '../lib/fire.js';
import { makeTools, TOOLS } from '../lib/ai/agent.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url)));
const buildings = loadBuildings(load('buildings.json'));
const waterlogging = load('waterlogging.json').points;
const base = load('base.json');

test('real pilot data: 11,659 OSM buildings inside Hyderabad and 23 government waterlogging points', () => {
  assert.equal(buildings.length, 11659);
  assert.equal(waterlogging.length, 23);
  for (const b of buildings) assert.ok(b.pos[0] > 17.2 && b.pos[0] < 17.6 && b.pos[1] > 78.3 && b.pos[1] < 78.7, `way ${b.id} outside Hyderabad`);
  assert.ok(new Set(buildings.map((b) => b.id)).size > 11000, 'OSM way ids are distinct');
});

test('exposure index: closer to the Musi or a waterlogging point scores higher, bands are ordered, range is 0..1', () => {
  const far = { musiM: 2000, wlM: 3000, height: 20 };
  assert.equal(exposure(far), 0);
  assert.ok(exposure({ ...far, musiM: 300 }) > exposure({ ...far, musiM: 800 }));
  assert.ok(exposure({ ...far, wlM: 200 }) > exposure({ ...far, wlM: 900 }));
  assert.ok(exposure({ ...far, height: 3 }) > exposure(far), 'low-rise counts more');
  assert.equal(exposure({ musiM: null, wlM: null, height: null }), 0, 'missing data adds nothing');
  assert.equal(exposure({ musiM: 0, wlM: 0, height: 1 }), 1);
  assert.deepEqual([0.9, 0.5, 0.1].map(band), ['high', 'medium', 'low']);
});

test('building summary adds up, states its limits, and never claims flooding', () => {
  const s = summary(buildings, waterlogging);
  assert.equal(s.bands.high + s.bands.medium + s.bands.low, buildings.length);
  assert.match(s.caveat, /Not flood probability/);
  assert.ok(s.highExposureByWaterloggingPoint.every((p) => p.point && p.buildings > 0));
  const top = topExposed(buildings, { limit: 3 });
  assert.equal(top.length, 3);
  assert.ok(top[0].score >= top[2].score);
  assert.equal(refugeCandidate({ height: 15, area: 500 }), true);
  assert.equal(refugeCandidate({ height: 15, area: null }), false);
});

test('fire weights come from FireSight importances and sum to 1', () => {
  assert.ok(Math.abs(Object.values(WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-3);
  const model = JSON.parse(readFileSync(new URL('../Aditya/data/model.json', import.meta.url)));
  const imp = Object.fromEntries(model.importances.map((i) => [i.key, i.w]));
  for (const k of Object.keys(WEIGHTS)) assert.ok(k in imp, `${k} is a FireSight feature`);
});

test('density within 50 m counts only close neighbours', () => {
  const at = (lat, lon) => ({ pos: [lat, lon] });
  const [a, b, c] = [at(17.4, 78.4), at(17.4, 78.40025), at(17.4, 78.41)]; // b is ~27 m from a, c is ~1 km
  assert.deepEqual(density50([a, b, c]), [1, 1, 0]);
});

test('fire risk uses real fire stations; compound hazards need both flood exposure and fire score', () => {
  assert.ok(base.fire.length >= 8);
  const risk = fireRisk(buildings.slice(0, 500), base.fire);
  assert.ok(risk.every((r) => r.fireScore >= 0 && r.fireScore <= 1 && r.stationKm >= 0));
  const hot = compoundHazard(buildings, base.fire, { limit: 5 });
  assert.ok(hot.length > 0);
  assert.ok(hot.every((h) => h.floodExposure >= 0.33 && h.fireScore >= 0.3));
});

test('agent exposes building tools that answer from data, and degrades without it', () => {
  assert.ok(['building_exposure', 'flood_fire_hotspots'].every((n) => TOOLS.some((t) => t.name === n)));
  const withData = makeTools({ base, buildings, waterlogging });
  assert.equal(withData.building_exposure().buildings, 11659);
  assert.ok(withData.flood_fire_hotspots().hotspots.length > 0);
  assert.match(makeTools({ base }).building_exposure().error, /not loaded/);
});

// ---- Aditya's alert function: runs with no network and no secrets
const notify = createRequire(import.meta.url)('../Aditya/api/notify.js');
const call = async (req) => {
  const out = {};
  const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; }, end() { return this; } };
  await (notify.default ?? notify)({ headers: {}, ...req }, res);
  return out;
};

test('alert delivery: GET lists channel types only, never phone numbers', async () => {
  process.env.ROLE_FIRE = 'call:+910000000001,sms:+910000000002';
  const { code, body } = await call({ method: 'GET', query: {} });
  assert.equal(code, 200);
  assert.deepEqual(body.roles.FIRE, ['call', 'sms']);
  assert.ok(!JSON.stringify(body).includes('+91'));
  delete process.env.ROLE_FIRE;
});

test('alert delivery: rejects empty text, unknown roles and numbers outside the allow-list', async () => {
  assert.equal((await call({ method: 'POST', body: { role: 'FIRE', text: ' ' }, query: {} })).code, 400);
  assert.equal((await call({ method: 'POST', body: { role: 'NOPE', text: 'x' }, query: {} })).code, 400);
  assert.equal((await call({ method: 'POST', body: { to: '+910000000009', text: 'x' }, query: {} })).code, 403);
  assert.equal((await call({ method: 'PUT', query: {} })).code, 405);
});
