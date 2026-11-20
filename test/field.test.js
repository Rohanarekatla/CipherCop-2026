// Tests for the field-and-fix additions: official TGRAC government data checks, and the local server
// (static files, field-input APIs, and robustness against malformed paths).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { test } from 'node:test';
import { buildFlow, officialValidation, narrowSegments, afterFlood } from '../lib/water.js';
import { plan } from '../lib/planner.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url)));

test('TGRAC: official points validate flow convergence; segments rank by width lost; the report cites them', () => {
  const base = load('base.json'), hand = load('hand.json'), flow = buildFlow(hand, base.bbox);
  const pts = load('tgrac/waterlogging.json').features.map((f) => [f.geometry.coordinates[1], f.geometry.coordinates[0]]);
  assert.equal(pts.length, 23);
  const v = officialValidation(flow, pts);
  assert.equal(v.n, 23);
  assert.ok(v.convLift > 1, `official points sit on converging flow more often than the city does (lift ${v.convLift})`);
  const segs = narrowSegments(load('tgrac/segments.json').features);
  assert.ok(segs.length > 1000);
  for (let k = 1; k < segs.length; k++) assert.ok(segs[k - 1].lostM2 >= segs[k].lostM2);
  assert.ok(segs.every((x) => x.ratio > 0));
  const gov = pts.map((pos, i) => ({ name: `P${i}`, pos, sector: i === 0 ? 16 : null }));
  const p = plan(base, hand, load('replay/2024-09-01.json'), { confirmed: new Set([16]) });
  const rep = afterFlood(flow, p, { govPoints: gov, govSegs: segs });
  assert.match(rep.rows[0].causes.join(' '), /GHMC official waterlogging point/);
});

// raw request so paths like "//x" reach the server exactly as written
const raw = (port, path) => new Promise((resolve, reject) => {
  const r = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  r.on('error', reject); r.end();
});

test('server: static files, field inputs, WhatsApp verification, and no crash on malformed paths', async () => {
  const port = 8600 + Math.floor(Math.random() * 300);
  const srv = spawn(process.execPath, ['server.js'], { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    await new Promise((r) => srv.stdout.once('data', r));
    const u = (p) => `http://127.0.0.1:${port}${p}`;
    const post = (p, body) => fetch(u(p), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    for (const p of ['/', '/report.html', '/firesight/', '/netra/', '/app/ideas.js', '/data/tgrac/segments.json']) assert.equal((await fetch(u(p))).status, 200, p);
    assert.equal((await fetch(u('/scripts/fetch-data.js'))).status, 404, 'scripts are never served');
    for (const p of ['//', '//evil.example/x', '/%E0%A4%A', '/..%2Fpackage.json']) assert.ok([400, 404].includes(await raw(port, p)), `${p} is refused`);
    assert.equal((await fetch(u('/'))).status, 200, 'still serving after malformed requests');
    assert.equal((await post('/api/report', { text: 'Water in houses near Malakpet', lat: 17.37, lon: 78.51 })).status, 200);
    assert.equal((await post('/api/report', {})).status, 400);
    assert.equal((await post('/api/sensor', { id: 'UP-1', levelCm: 42 })).status, 200);
    assert.equal((await (await fetch(u('/api/inbox'))).json()).length, 2);
    assert.equal(await (await fetch(u('/api/whatsapp?hub.mode=subscribe&hub.verify_token=surgeforce-demo&hub.challenge=42'))).text(), '42');
    assert.equal((await fetch(u('/api/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1'))).status, 403);
  } finally { srv.kill(); }
});
