// End-to-end smoke test in a real browser (Playwright Chromium): starts the local server, opens the command
// centre, clicks every tab, sends a citizen report, opens FireSight, AI-NETRA and the public report page, and
// fails on any page error or console error. CI installs Playwright on the fly; locally:
//   npm i --no-save playwright@1.48.2 && npx playwright install chromium && node scripts/e2e.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 8700 + Math.floor(Math.random() * 200);
const srv = spawn(process.execPath, ['server.js'], { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => srv.stdout.once('data', r));
const base = `http://127.0.0.1:${port}`;
const errors = [], ok = [];
const check = (cond, msg) => { if (!cond) throw new Error(`FAIL: ${msg}`); ok.push(msg); };
// third-party tiles, fonts and CDNs failing on a CI runner are not app errors
const ignorable = (t) => /Failed to load resource|Failed to fetch|net::ERR|tile|basemaps|arcgisonline|elevation|fonts\.g|WebGL|GPU|GroupMarker/i.test(t);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(`console: ${m.text()}`); });
  await page.goto(`${base}/`);
  await page.waitForFunction(() => /\d+%/.test(document.querySelector('#kpis')?.innerText ?? ''), null, { timeout: 90000 });
  check(true, 'plan built and KPIs shown');
  const STEP = { timeline: 'prepare', pairs: 'prepare', teams: 'prepare', alerts: 'prepare', reports: 'respond', buildings: 'respond', route: 'respond', live: 'respond',
    water: 'prevent', fixit: 'prevent', vision: 'prevent', copilot: 'proof', evidence: 'proof', method: 'proof' };
  const tab = async (t, expect) => {
    await page.click(`[data-step="${STEP[t]}"]`); // the four workflow steps show their own tabs
    await page.click(`[data-t="${t}"]`);
    await page.waitForFunction((e) => document.querySelector('#panel').innerText.includes(e), expect, { timeout: 90000 });
    check(true, `tab "${t}" shows "${expect}"`);
  };
  await tab('timeline', 'Approve');
  await tab('pairs', 'Pre-designated');
  await tab('teams', 'Monsoon Emergency Teams');
  await tab('alerts', 'CAP');
  await tab('evidence', 'Can the forecast tell us when');
  await tab('method', 'Where AI is used');
  await tab('copilot', 'AI assistant');
  await tab('reports', 'Citizen reports');
  await page.fill('#rep', 'People trapped on the terrace in Uppal, water rising');
  await page.click('#send');
  await page.waitForFunction(() => /rescue/i.test(document.querySelector('#panel').innerText) && document.querySelector('#panel').innerText.includes('Uppal'), null, { timeout: 30000 });
  check(true, 'a citizen report is triaged and placed in Uppal');
  await tab('buildings', 'AI-NETRA building rescue intelligence');
  await page.waitForFunction(() => document.querySelector('#nDemo'), null, { timeout: 60000 });
  await page.selectOption('#nDemo', { index: 1 });
  await page.waitForFunction(() => document.querySelector('#panel').innerText.includes('Unified rescue assessment'), null, { timeout: 30000 });
  const card = await page.innerText('#panel');
  check(/Building identification[\s\S]*Google building height intelligence[\s\S]*Sentinel-1 historical radar evidence[\s\S]*Evidence quality and provenance/.test(card), 'AI-NETRA building card shows Malik\'s evidence sections');
  check(/Rescue priority\s+not assessed/.test(card), 'unverified incident: rescue priority not assessed');
  await page.click('[data-n="verify"]');
  await page.waitForFunction(() => document.querySelector('#panel').innerText.includes('ready for human review'), null, { timeout: 10000 });
  check(true, 'officer verification completes the evidence for human review');
  await tab('water', 'Official GHMC drainage data');
  await tab('fixit', 'After-Flood Accountability Report');
  await tab('vision', 'Computer vision, on this device');
  await tab('live', 'Official alerts (NDMA SACHET)');
  await tab('route', 'Flood-aware routing');
  // Flood / Fire slide switch: FireSight slides in over the flood centre and back out
  await page.click('#hz .track');
  await page.waitForFunction(() => document.querySelector('#fireStage')?.classList.contains('open'), null, { timeout: 10000 });
  const frame = page.frameLocator('#fireStage iframe');
  await frame.locator('body').waitFor({ timeout: 30000 });
  check((await page.evaluate(() => location.hash)) === '#fire', 'slide to Fire opens FireSight over the flood centre');
  await page.click('#hz .track');
  await page.waitForFunction(() => !document.querySelector('#fireStage').classList.contains('open'), null, { timeout: 10000 });
  check(true, 'slide back to Flood');
  await page.goto(`${base}/netra/`);
  await page.waitForFunction(() => location.hash === '#buildings', null, { timeout: 15000 });
  check(true, '/netra/ redirects to the Buildings tab');
  for (const [path, sel] of [['/firesight/', 'body'], ['/report.html', 'h1']]) {
    const res = await page.goto(`${base}${path}`);
    await page.waitForTimeout(2500);
    check(res.status() === 200 && (await page.innerText(sel)).length > 0, `${path} loads`);
  }
  check(errors.length === 0, `no page or console errors${errors.length ? `:\n${errors.join('\n')}` : ''}`);
  console.log(ok.map((m) => `ok - ${m}`).join('\n'));
} catch (e) {
  console.error(ok.map((m) => `ok - ${m}`).join('\n'));
  console.error(e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  srv.kill();
}
