// AI-NETRA (Malik) inside SurgeForce: scenario triage, building identification, evidence quality and the
// rescue-readiness rule ported from Malik/scripts. Uses the real 11,659-building pilot.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { rows, depthAt, assess, rescuePlan, stageFromMusiLevel, identify, evidenceRecords, readiness, incidentFromDemo, incidentFromField } from '../lib/netra.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url)));
const data = load('netra/buildings.json'), ev = load('netra/evidence.json'), list = rows(data);

test('scenario triage: a dry floor means shelter, none means evacuate, unknown height is never assumed safe', () => {
  const tall = { heightM: 12, heightOk: 1, musiM: 0, history2020: 0 }, low = { heightM: 3.2, heightOk: 1, musiM: 0, history2020: 0 };
  assert.equal(assess(tall, 2).status, 'shelter');
  assert.equal(assess(tall, 2).refugeFloor, 2);
  assert.equal(assess(low, 2).status, 'evacuate');
  assert.equal(assess({ heightM: null, heightOk: 0 }, 2).status, 'verify');
  assert.equal(assess(low, 0.2).status, 'dry');
  assert.ok(assess(low, 2).priority > assess({ heightM: null, heightOk: 0 }, 2).priority);
  assert.equal(depthAt({ musiM: 600, history2020: 0 }, { stageM: 3 }), 0);
  assert.ok(depthAt({ musiM: 100, history2020: 2 }, { stageM: 3 }) > depthAt({ musiM: 100, history2020: 0 }, { stageM: 3 }));
  assert.deepEqual([0, 1, 2].map(stageFromMusiLevel), [0, 1.5, 3]);
});

test('the real pilot: 11,659 buildings, consistent counts, more water at a higher stage', () => {
  assert.equal(list.length, 11659);
  const a = rescuePlan(list, { stageM: 1.5 }), b = rescuePlan(list, { stageM: 3 });
  for (const p of [a, b]) assert.equal(Object.values(p.counts).reduce((x, y) => x + y, 0), 11659);
  assert.ok(b.counts.dry < a.counts.dry);
  for (let k = 1; k < b.queue.length; k++) assert.ok(b.queue[k - 1].priority >= b.queue[k].priority);
});

test('identification: a click inside a footprint is an exact match; outside gives nearby candidates', () => {
  const b = list[100], [x0, y0] = b.ring[0], [x2, y2] = b.ring[Math.floor(b.ring.length / 2)];
  const r = identify(list, [(x0 + x2) / 2, (y0 + y2) / 2]);
  assert.equal(r.exact?.id, b.id);
  const far = identify(list, [78.40, 17.30]);
  assert.equal(far.exact, null); assert.equal(far.nearby.length, 0);
});

test('Malik\'s rescue-readiness rule: no priority without verified current evidence, never automated dispatch', () => {
  const none = readiness({});
  assert.equal(none.missing.length, 6); assert.equal(none.rescuePriority, 'not_assessed');
  const demo = incidentFromDemo(ev.incidents[0]);
  assert.equal(readiness(demo).rescuePriority, 'not_assessed', 'unverified synthetic report');
  const verified = readiness({ ...demo, verification_status: 'verified' });
  assert.equal(verified.rescuePriority, 'ready_for_human_review');
  for (const r of [none, verified]) { assert.equal(r.humanReviewRequired, true); assert.equal(r.automatedDispatchAuthorized, false); }
  const field = readiness(incidentFromField({ reason: 'CCTV underpass', at: '2024-08-31T10:00Z' }));
  assert.ok(field.available.some((f) => f.field === 'observation_source'));
});

test('evidence quality: every building field gets Malik\'s classification; radar only for the 40 targeted buildings', () => {
  assert.equal(Object.keys(ev.radar).length, 40);
  const withRadar = list.find((b) => ev.radar[b.id]);
  const rec = evidenceRecords(withRadar, ev.radar[withRadar.id], null);
  assert.equal(rec.find((r) => r.field === 'radar').classification, 'observed_historical');
  assert.equal(rec.find((r) => r.field === 'height').classification, withRadar.heightOk ? 'model_estimated' : 'unavailable');
  const recInc = evidenceRecords(withRadar, null, incidentFromDemo(ev.incidents[0]));
  assert.ok(recInc.some((r) => r.classification === 'unverified_current'));
});
