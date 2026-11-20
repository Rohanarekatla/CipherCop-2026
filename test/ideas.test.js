// Tests for the roadmap features: drainage intelligence (lib/water.js) and the vision decision rules (lib/vision.js).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildFlow, nearestCell, trace, catchment, deadEnds, bottlenecks, lakeBreach, drainOverflow, facilityExposure,
  rankEncroachments, complaintText, afterFlood, learn } from '../lib/water.js';
import { ASSUMPTIONS } from '../lib/risk.js';
import { plan } from '../lib/planner.js';
import * as V from '../lib/vision.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url)));
const base = load('base.json'), hand = load('hand.json'), water = load('water.json');
base.hand = hand;
const flow = buildFlow(hand, base.bbox);

test('A1: water flows downhill to a nala, and the catchment drains into the clicked cell', () => {
  const i = nearestCell(flow, [17.40, 78.53]);
  assert.ok(i >= 0);
  const t = trace(flow, i);
  for (let k = 1; k < t.path.length; k++) assert.ok(flow.cells[t.path[k]].fill <= flow.cells[t.path[k - 1]].fill, 'never flows uphill on the filled surface');
  const up = catchment(flow, t.path.at(-1));
  assert.ok(up.includes(i), 'the start cell drains into the end of its own path');
  assert.equal(new Set(up).size, up.length);
  assert.ok(deadEnds(flow).every((c) => !flow.cells[c].drain));
  assert.ok(Math.max(...flow.acc) > 100, 'depression filling lets large catchments form');
});

test('A2: culverts are ranked by what drains through them, one per cell', () => {
  const bn = bottlenecks(flow, water);
  assert.ok(bn.length > 10);
  for (let k = 1; k < bn.length; k++) assert.ok(bn[k - 1].score >= bn[k].score);
  assert.equal(new Set(bn.map((b) => b.cell)).size, bn.length);
});

test('A3: lake breach paths start at the lake and lakes off the grid rank low', () => {
  const lakes = lakeBreach(flow, water, hand);
  assert.ok(lakes.length > 20);
  for (let k = 1; k < lakes.length; k++) assert.ok(lakes[k - 1].risk >= lakes[k].risk);
  const l = lakes.find((x) => x.onGrid);
  assert.equal(l.path[0], l.outlet);
  assert.ok(l.minutesToEnd >= 0);
});

test('A4: drains overflow under a cloudburst and not in light rain; a blockage brings overflow forward', () => {
  const H = 12, times = Array.from({ length: H }, (_, h) => `2024-08-31T${String(h).padStart(2, '0')}:00`);
  assert.equal(drainOverflow(flow, Array(H).fill(3), times).length, 0);
  const storm = [0, 0, 5, 40, 60, 40, 10, 0, 0, 0, 0, 0];
  const over = drainOverflow(flow, storm, times);
  assert.ok(over.length > 20);
  const slow = [0, 0, 4, 10, 15, 18, 20, 20, 20, 20, 20, 20];
  const free = drainOverflow(flow, slow, times, { capacityMmH: 14 });
  const cell = free.length ? free[0].cell : over[0].cell;
  const blocked = drainOverflow(flow, slow, times, { capacityMmH: 14, cut: new Map([[cell, 0.6]]) });
  const at = (list) => list.find((o) => o.cell === cell)?.hour ?? Infinity;
  assert.ok(at(blocked) <= at(free));
});

test('E2: facilities on low ground raise their sector\'s exposure in the plan', () => {
  const per = facilityExposure(flow, water);
  assert.ok(per.size > 0);
  const forecast = load('replay/2024-09-01.json');
  const [s] = [...per.keys()];
  const p0 = plan(base, hand, forecast), p1 = plan(base, hand, forecast, { extraVuln: new Map([[s, 1.5]]) });
  assert.ok(Math.abs(p1.sectors[s].vulnerability - p0.sectors[s].vulnerability - 1.5) < 1e-9);
});

test('B1/B4/E3: encroachments rank flooded-area leads first; the after-flood report and learning use confirmed sectors', () => {
  const forecast = load('replay/2024-09-01.json');
  const p = plan(base, hand, forecast, { confirmed: new Set([16, 18]) });
  const enc = rankEncroachments(flow, water, new Set([16, 18]));
  if (enc.length) {
    const firstPlain = enc.findIndex((e) => !e.feeds.length);
    if (firstPlain >= 0) assert.ok(enc.slice(firstPlain).every((e) => !e.feeds.length));
    assert.match(complaintText(enc[0], 'Uppal'), /verify/);
  }
  const rep = afterFlood(flow, p, { bottleneckList: bottlenecks(flow, water), encroach: enc, deadEndCells: deadEnds(flow) });
  assert.equal(rep.rows.length, 2);
  assert.equal(rep.hits + rep.misses, 2);
  assert.ok(rep.rows.every((r) => r.causes.length));
  const changes = learn(p, flow, ASSUMPTIONS);
  const hs = changes.find((c) => c.key === 'hitShare');
  assert.ok(hs.to > Math.min(hs.from, 0) && hs.to < 1);
});

test('vision: depth needs the flood check, life-safety hazards escalate at a low bar, others need a majority', () => {
  const sc = (pairs) => V.DEPTH.map((d, i) => ({ label: d.label, score: pairs[i] }));
  assert.equal(V.depthFromScores(sc([0.1, 0.1, 0.6, 0.1, 0.1]), 0.9).flooded, true);
  assert.equal(V.depthFromScores(sc([0.1, 0.1, 0.6, 0.1, 0.1]), 0.05).flooded, false); // wet-looking but no flood
  const h = V.hazardsFromScores({ flooding: 0.99, live_wire: 0.15, open_manhole: 0.02, fallen_tree: 0.3, blocked_drain: 0.4 });
  assert.deepEqual(h.found.map((x) => x.key), ['flooding', 'live_wire']);
  assert.equal(h.human, true);
  assert.equal(h.found.find((x) => x.key === 'live_wire').possible, true);
  assert.equal(V.isScene([{ label: V.SCENE[1], score: 0.9 }, { label: V.SCENE[0], score: 0.1 }]), false);
  assert.ok(V.hazardLabels(V.HAZARDS[1]).includes(V.FLOODED), 'a hazard must beat a plain flood');
});

test('vision: gauge waterline, change share and rescue tasks', () => {
  const profile = [];
  for (let k = 0; k < 100; k++) profile.push(k < 60 ? ((k >> 2) % 2 ? 240 : 40) : 90); // stripes, then water from 60%
  const g = V.gaugeLevel(profile, 100, 0);
  assert.ok(Math.abs(g.value - 40) <= 4, `read ${g.value} cm`);
  assert.equal(V.gaugeLevel(profile.slice(0, 60), 100, 0).value, 0); // no water
  assert.equal(V.changeShare(new Uint8Array([0, 0, 0, 0]), new Uint8Array([0, 200, 0, 200])), 0.5);
  const r = V.rescueFromDetections([{ label: 'person', score: 0.9 }, { label: 'person', score: 0.65 }, { label: 'car', score: 0.95 }, { label: 'dog', score: 0.99 }]);
  assert.equal(r.people, 2); assert.equal(r.vehicles, 1); assert.match(r.task, /DRF/);
  assert.equal(V.rescueFromDetections([{ label: 'car', score: 0.9 }]).people, 0);
});
