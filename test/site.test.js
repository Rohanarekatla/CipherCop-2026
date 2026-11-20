import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('one site: SurgeForce, FireSight and AI-NETRA each have an entry page with the shared switcher', () => {
  for (const [page, nav] of [['index.html', 'site-nav.js'], ['firesight/index.html', '../site-nav.js'], ['netra/index.html', '../site-nav.js']]) {
    assert.ok(existsSync(new URL(`../${page}`, import.meta.url)), `${page} exists`);
    assert.ok(read(page).includes(`src="${nav}"`), `${page} loads the switcher`);
  }
  const nav = read('site-nav.js');
  assert.ok(nav.includes("'firesight/'") && nav.includes("'netra/'"));
});

test('FireSight and AI-NETRA pages only use files that ship with the site', () => {
  for (const f of ['respond.js', 'respond.css', 'vendor/maplibre-gl.js', 'data/buildings.json', 'data/roads.json', 'data/points.json', 'data/model.json']) {
    assert.ok(existsSync(new URL(`../firesight/${f}`, import.meta.url)), `firesight/${f}`);
  }
  const netra = read('netra/netra.js');
  for (const m of netra.matchAll(/from '\.\.\/(lib\/[\w./-]+)'/g)) assert.ok(existsSync(new URL(`../${m[1]}`, import.meta.url)), m[1]);
  for (const m of netra.matchAll(/get\('([\w./-]+\.json)'\)/g)) assert.ok(existsSync(new URL(`../data/${m[1]}`, import.meta.url)), m[1]);
});

test('Pages workflow publishes all three tools', () => {
  const wf = read('.github/workflows/pages.yml');
  for (const p of ['netra', 'firesight', 'site-nav.js']) assert.ok(wf.includes(p), `pages.yml stages ${p}`);
});
