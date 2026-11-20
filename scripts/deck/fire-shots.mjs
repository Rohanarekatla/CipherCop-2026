// FireSight screenshots for the deck (local app on PORT, default 8530). Carto basemap tiles are blocked:
// they now answer with an "API key required" image, and FireSight draws its own dark background without them.
import { chromium } from 'playwright';
const base = `http://127.0.0.1:${process.env.PORT ?? 8530}`;
const out = (n) => new URL(`img/${n}.png`, import.meta.url).pathname;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
await page.route(/basemaps\.cartocdn\.com/, (r) => r.abort());
const shot = async (n, ms = 3000) => { await page.waitForTimeout(ms); await page.screenshot({ path: out(n) }); console.log(n); };
const click = async (t) => { try { await page.getByText(t, { exact: false }).first().click({ timeout: 5000 }); } catch (e) { console.warn('no', t); } };
const sel = async (q) => { const ok = await page.evaluate((q) => { const e = document.querySelector(q); e?.click(); return !!e; }, q); if (!ok) console.warn('no', q); await page.waitForTimeout(400); };
await page.goto(`${base}/firesight/`);
await page.waitForSelector('#inc.open', { timeout: 30000 }); // a demo CCTV incident opens on its own after ~7 s
await shot('fs-incident', 4000);
await click('Back to map'); await page.waitForTimeout(1500);
await shot('fs-detect', 500);
await sel('[data-m="prevent"]');
await sel('button[data-mode="risk"]'); await shot('fs-risk');
await sel('button[data-mode="paper"]'); await shot('fs-paper');
await sel('button[data-mode="reach"]'); await shot('fs-reach');
await sel('button[data-mode="spread"]'); await shot('fs-spread');
await sel('button[data-mode="risk"]'); await sel('button[aria-controls="panelBody"]'); await shot('fs-model');
await browser.close();
