// Local server. The whole app runs in the browser (planner, simulation, on-device AI), so on GitHub Pages it is
// static. Run locally, this server also gives the field inputs a place to land (ideas C1 and C4):
//   POST /api/report    {text, lat?, lon?, photo?}          citizen report from the public page (report.html)
//   GET/POST /api/whatsapp                                 WhatsApp Cloud API webhook (verify + incoming messages)
//   POST /api/sensor    {id, levelCm, lat?, lon?}          water-level sensor or camera-read gauge
//   GET/POST /api/notify  (also /firesight/api/notify)    FireSight alert delivery (Twilio / Telegram)
//   GET  /api/inbox?since=ISO                              what the command centre polls
// Inputs are kept in memory only (no database); the AI that reads them runs in the commander's browser.
// npm start -> http://localhost:8520
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// FireSight's alert delivery (Aditya/api/notify.js, a Vercel function: Twilio voice / SMS, Telegram) runs here
// unchanged behind a small Vercel-style req/res adapter. Without Twilio keys it reports that nothing was sent.
const notify = createRequire(import.meta.url)('./Aditya/api/notify.js');
async function runNotify(req, res) {
  if (req.method === 'POST') { try { req.body = await body(req); } catch (e) { return json(res, 400, { error: e.message }); } }
  const out = { status: (c) => { res.statusCode = c; return out; }, json: (o) => json(res, res.statusCode || 200, o), send: (t) => res.end(t), setHeader: (k, v) => res.setHeader(k, v) };
  return notify(req, out);
}

const PORT = Number(process.env.PORT) || 8520;
const ROOT = fileURLToPath(new URL('.', import.meta.url)); // keeps Windows paths valid
const PUBLIC = ['index.html', 'report.html', 'site-nav.js', 'app/', 'lib/', 'data/', 'netra/', 'firesight/']; // never serve node_modules, scripts or tests
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'surgeforce-demo';
const inbox = []; // {kind, at, ...}
const MAX_BODY = 2_000_000; // a resized photo fits; anything bigger is refused

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);
async function body(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw new Error('too large'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function add(item) {
  inbox.push({ ...item, at: new Date().toISOString() });
  if (inbox.length > 500) inbox.shift();
}

async function api(req, res, url) {
  if (url.pathname === '/api/inbox' && req.method === 'GET') {
    const since = url.searchParams.get('since') || '';
    return json(res, 200, inbox.filter((x) => x.at > since));
  }
  if (url.pathname === '/api/whatsapp' && req.method === 'GET') { // Meta webhook verification handshake
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === VERIFY_TOKEN;
    res.writeHead(ok ? 200 : 403); return res.end(ok ? url.searchParams.get('hub.challenge') ?? '' : 'forbidden');
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  let b;
  try { b = await body(req); } catch (e) { return json(res, 400, { error: e.message }); }
  if (url.pathname === '/api/report') {
    const text = String(b.text ?? '').slice(0, 1000).trim();
    if (!text) return json(res, 400, { error: 'text required' });
    const photo = typeof b.photo === 'string' && b.photo.startsWith('data:image/') ? b.photo : null;
    add({ kind: 'report', source: 'public page', text, lat: num(b.lat), lon: num(b.lon), photo });
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/api/whatsapp') { // WhatsApp Cloud API: entry[].changes[].value.messages[]
    for (const e of b.entry ?? []) for (const ch of e.changes ?? []) for (const m of ch.value?.messages ?? []) {
      if (m.type === 'text' && m.text?.body) add({ kind: 'report', source: 'whatsapp', text: String(m.text.body).slice(0, 1000) });
      if (m.type === 'location' && m.location) add({ kind: 'report', source: 'whatsapp', text: m.location.name || 'Location shared', lat: num(m.location.latitude), lon: num(m.location.longitude) });
    }
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/api/sensor') {
    const levelCm = num(b.levelCm);
    if (levelCm == null || !b.id) return json(res, 400, { error: 'id and levelCm required' });
    add({ kind: 'sensor', id: String(b.id).slice(0, 60), levelCm, lat: num(b.lat), lon: num(b.lon) });
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'not found' });
}

createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); if (url.host !== 'x') throw new Error('bad path'); } // "//host/..." would parse as another host
  catch { res.writeHead(400); return res.end('bad request'); }
  if (/^\/(firesight\/)?api\/notify$/.test(url.pathname)) return runNotify(req, res).catch((e) => json(res, 500, { error: e.message }));
  if (url.pathname.startsWith('/api/')) return api(req, res, url).catch((e) => json(res, 500, { error: e.message }));
  let path;
  try { path = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'; } catch { res.writeHead(400); return res.end('bad request'); }
  if (path.endsWith('/')) path += 'index.html'; // netra/ and firesight/ are folders with their own index.html
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT) || !PUBLIC.some((p) => path === p || path.startsWith(p))) { res.writeHead(404); return res.end('not found'); }
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(content);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, () => console.log(`SurgeForce on http://localhost:${PORT}`));
