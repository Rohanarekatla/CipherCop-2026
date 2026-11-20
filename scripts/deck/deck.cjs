const pptxgen = require('pptxgenjs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pres.title = 'SurgeForce - Team AI-vengers - CipherCop 2026';
pres.author = 'Team AI-vengers';
const NAVY = '0B1F3A', TEAL = '0E7C86', ICE = 'DCEBF5', AMBER = 'F2A33A', INK = '12263F', MUTED = '5B6B7D', WHITE = 'FFFFFF', RED = 'D64550';
const H = 'Cambria', B = 'Calibri';
const title = (s, t) => s.addText(t, { x: 0.7, y: s._b ? 0.68 : 0.45, w: 11.9, h: s._b ? 0.7 : 0.9, fontFace: H, fontSize: 32, bold: true, color: INK, isTextBox: true, margin: 0 });
const card = (s, x, y, w, h, fill = 'F2F7FB') => s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: fill }, line: { color: 'D5E3EE', width: 0.75 }, rectRadius: 0.12 });
const txt = (s, t, o) => s.addText(t, { fontFace: B, color: INK, isTextBox: true, margin: 0, valign: 'top', ...o });
const fs = require('fs');
const dims = (p) => { const b = fs.readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
// fit a screenshot inside a box (keeps aspect), with a thin frame; returns the placed rect
const pic = (s, p, x, y, w, h, alt, align = 'center') => {
  const [pw, ph] = dims(p); let iw = w, ih = (w * ph) / pw; if (ih > h) { ih = h; iw = (h * pw) / ph; }
  const ix = align === 'left' ? x : x + (w - iw) / 2, iy = y;
  s.addShape(pres.ShapeType.rect, { x: ix - 0.03, y: iy - 0.03, w: iw + 0.06, h: ih + 0.06, fill: { color: 'D5E3EE' }, line: { color: 'D5E3EE' }, shadow: { type: 'outer', blur: 6, offset: 2, angle: 90, color: '000000', opacity: 0.18 } });
  s.addImage({ path: p, x: ix, y: iy, w: iw, h: ih, altText: alt });
  return { x: ix, y: iy, w: iw, h: ih };
};
const badge = (s, n, label) => { s._b = true; s.addShape(pres.ShapeType.roundRect, { x: 0.7, y: 0.25, w: 2.6, h: 0.36, fill: { color: TEAL }, line: { color: TEAL }, rectRadius: 0.08 }); s.addText(`STEP ${n}  ·  ${label}`, { x: 0.7, y: 0.25, w: 2.6, h: 0.36, fontFace: 'Calibri', fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', margin: 0 }); };
const callout = (s, t, y) => { s.addShape(pres.ShapeType.rect, { x: 0.7, y, w: 0.08, h: 0.7, fill: { color: AMBER }, line: { color: AMBER } }); s.addText(t, { x: 0.95, y, w: 11.7, h: 0.7, fontFace: 'Cambria', fontSize: 18, bold: true, color: '0E7C86', valign: 'middle', margin: 0 }); };
const foot = (s, t) => s.addText(t, { x: 0.7, y: 6.95, w: 11.9, h: 0.3, fontFace: 'Calibri', fontSize: 11, color: '5B6B7D', margin: 0 });
const bullets = (items) => items.map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1, paraSpaceAfter: 8 } }));

// 1 title
let r, s = pres.addSlide(); s.background = { color: NAVY };
txt(s, 'CipherCop 2026  ·  Track 2: AI for Disaster Resilience', { x: 0.8, y: 0.9, w: 11.5, h: 0.4, fontSize: 16, color: 'A9C7E0' });
txt(s, 'SurgeForce', { x: 0.8, y: 1.8, w: 5.8, h: 1.2, fontFace: H, fontSize: 60, bold: true, color: WHITE });
txt(s, 'An AI command centre that decides, before the storm, who goes where in Hyderabad and when. A human commander approves every move.', { x: 0.8, y: 3.15, w: 5.6, h: 1.9, fontSize: 22, color: ICE });
pic(s, 'img/home.png', 6.75, 1.75, 6.1, 3.6, 'SurgeForce command centre');
txt(s, 'Team AI-vengers', { x: 0.8, y: 5.4, w: 6, h: 0.4, fontSize: 20, bold: true, color: AMBER });
txt(s, 'Mallikarjuna Reddy  ·  Sai Adurti  ·  Rohan A  ·  Sriram Aditya', { x: 0.8, y: 5.85, w: 11.5, h: 0.4, fontSize: 18, color: ICE });
s.addNotes('Introduce the team and the one-line idea: pre-position police, GHMC and HYDRAA teams before the rain, with a human approving every move.');

// 2 problem
s = pres.addSlide(); s.background = { color: WHITE };
title(s, 'Floods are decided before the first call');
const probs = [['Teams wait at depots', 'Response starts after distress calls, when roads are already slowed by water.'], ['Forecasts are not places', 'A weather model can say a storm is coming. It cannot say which street floods.'], ['Many agencies, one night', 'Police, GHMC METs, HYDRAA DRF, fire and volunteers must move together.']];
probs.forEach(([h, b], i) => { const x = 0.7 + i * 4.1; card(s, x, 1.8, 3.8, 3.4); txt(s, String(i + 1), { x: x + 0.3, y: 2.05, w: 1, h: 0.8, fontFace: H, fontSize: 44, bold: true, color: TEAL }); txt(s, h, { x: x + 0.3, y: 3.0, w: 3.3, h: 0.5, fontSize: 20, bold: true }); txt(s, b, { x: x + 0.3, y: 3.75, w: 3.2, h: 1.4, fontSize: 16, color: MUTED }); });
txt(s, 'The question we answer: when a storm is coming, who goes where, and when, before the first call?', { x: 0.7, y: 5.7, w: 11.9, h: 0.9, fontSize: 22, bold: true, color: TEAL });
s.addNotes('Frame the problem as a decision problem, not a prediction problem.');

// 3 key finding chart
s = pres.addSlide(); s.background = { color: WHITE };
title(s, 'We measured it: AI forecasts tell us when, not where');
card(s, 0.7, 1.6, 6.3, 4.8, WHITE);
txt(s, 'Forecast skill (ROC area), 2024–2025 monsoons', { x: 0.95, y: 1.75, w: 5.8, h: 0.4, fontSize: 14, bold: true });
const y0 = 5.6, sc = 3.0 / 0.4; // 0.5 → 0.9 mapped to 3.0 in
[0.5, 0.6, 0.7, 0.8, 0.9].forEach((v) => { const y = y0 - (v - 0.5) * sc; s.addShape(pres.ShapeType.line, { x: 1.5, y, w: 5.2, h: 0, line: { color: v === 0.5 ? '9AA9B8' : 'E3ECF3', width: 0.75, dashType: v === 0.5 ? 'dash' : 'solid' } }); txt(s, v.toFixed(1), { x: 0.95, y: y - 0.13, w: 0.45, h: 0.26, fontSize: 11, color: MUTED, align: 'right' }); });
txt(s, 'coin flip', { x: 5.6, y: y0 - 0.3, w: 1.1, h: 0.25, fontSize: 10, color: MUTED, align: 'right' });
[['Heavy rain somewhere\nin the city (WHEN)', 0.813, TEAL], ['Heavy rain at\none point (WHERE)', 0.715, RED]].forEach(([l, v, c], k) => { const x = 2.0 + k * 2.4, h = (v - 0.5) * sc;
  s.addShape(pres.ShapeType.rect, { x, y: y0 - h, w: 1.5, h, fill: { color: c }, line: { color: c } });
  txt(s, v.toFixed(3), { x, y: y0 - h - 0.42, w: 1.5, h: 0.38, fontSize: 18, bold: true, align: 'center' });
  txt(s, l, { x: x - 0.4, y: y0 + 0.1, w: 2.3, h: 0.6, fontSize: 12, align: 'center', color: INK }); });
card(s, 7.4, 1.6, 5.2, 2.0); txt(s, 'City level: useful', { x: 7.7, y: 1.8, w: 4.6, h: 0.4, fontSize: 18, bold: true, color: TEAL }); txt(s, 'Economic value +0.30 at a 1:10 cost-loss ratio. We use it to decide WHEN to mobilise.', { x: 7.7, y: 2.3, w: 4.6, h: 1.2, fontSize: 16 });
card(s, 7.4, 3.9, 5.2, 2.0); txt(s, 'Single point: worse than nothing', { x: 7.7, y: 4.1, w: 4.6, h: 0.4, fontSize: 18, bold: true, color: RED }); txt(s, 'Value -0.17. On heavy-rain days only 38% of points got 30 mm. So we never use it for WHERE.', { x: 7.7, y: 4.6, w: 4.6, h: 1.2, fontSize: 16 });
txt(s, 'Source: our backtest (scripts/backtest.js), 173-member ensemble including ECMWF AIFS. 0.5 is a coin flip.', { x: 0.7, y: 6.6, w: 11.9, h: 0.4, fontSize: 12, color: MUTED });
s.addNotes('This is the key insight. We tested before building. Forecasts are good for timing and bad for location, so location comes from terrain and citizen reports.');

// 4 pipeline
s = pres.addSlide(); s.background = { color: 'F2F7FB' };
title(s, 'How it works: five steps, one human decision');
const steps = [['WHEN', '173-member forecast ensemble. Act when probability passes the cost-loss threshold.'], ['WHERE', 'Terrain model (HAND, 7,021 cells) plus AI-read citizen reports.'], ['PLAN', 'Min-cost-flow staging and counterpart stations paired before the rain.'], ['PROVE', 'Monte Carlo simulation with flood-depth road slowdowns.'], ['DECIDE', 'Commander approves. The AI agent explains using tool results only.']];
steps.forEach(([h, b], i) => { const x = 0.55 + i * 2.5; card(s, x, 1.8, 2.3, 3.9, WHITE); s.addShape(pres.ShapeType.ellipse, { x: x + 0.15, y: 2.0, w: 0.7, h: 0.7, fill: { color: i === 4 ? AMBER : TEAL }, line: { color: i === 4 ? AMBER : TEAL } }); txt(s, String(i + 1), { x: x + 0.15, y: 2.0, w: 0.7, h: 0.7, fontSize: 22, bold: true, color: WHITE, align: 'center', valign: 'middle' }); txt(s, h, { x: x + 0.15, y: 2.95, w: 2, h: 0.5, fontFace: H, fontSize: 22, bold: true }); txt(s, b, { x: x + 0.15, y: 3.55, w: 2.0, h: 2.0, fontSize: 14, color: MUTED }); });
txt(s, 'Borrowed from the best systems: Japan pairs each struggling area with a supporting one, Korea closes underpasses before they flood, Singapore pre-positions crews.', { x: 0.7, y: 6.05, w: 11.9, h: 0.9, fontSize: 16 });
s.addNotes('Walk left to right. Counterparts are Japan-style, underpass closures are Korea-style (after Osong 2023), pre-positioning is Singapore-style.');

// 7b product: four steps
s = pres.addSlide(); s.background = { color: WHITE };
title(s, 'One command centre in four steps');
pic(s, 'img/home.png', 0.7, 1.5, 8.4, 4.73, 'SurgeForce command centre: 3D map of Hyderabad, KPIs and the four-step panel', 'left');
[['1  Prepare', 'Approve staged teams, backup stations, underpass closures and public alerts'], ['2  Respond', 'Citizen reports, building rescue, safe routes, live feeds'], ['3  Prevent', 'Where water goes, blocked drains, encroachments, camera AI'], ['4  Proof & AI', 'AI assistant, backtest, simulation, method']]
  .forEach(([h, b], i) => { const y = 1.5 + i * 1.2; card(s, 9.4, y, 3.3, 1.05); txt(s, h, { x: 9.6, y: y + 0.12, w: 3, h: 0.35, fontSize: 15, bold: true, color: TEAL }); txt(s, b, { x: 9.6, y: y + 0.47, w: 3, h: 0.55, fontSize: 11, color: MUTED }); });
txt(s, 'Runs on any laptop: npm start, then open http://localhost:8520  ·  replay of the real 31 Aug 2024 storm, or the live forecast', { x: 0.7, y: 6.45, w: 11.9, h: 0.4, fontSize: 13, color: MUTED });
s.addNotes('Walk the four steps left to right. Every move needs a commander approval.');


// 7d step 1 prepare
s = pres.addSlide(); s.background = { color: 'F2F7FB' }; badge(s, 1, 'PREPARE');
title(s, 'Before the rain: a plan the commander approves');
r = pic(s, 'img/home-panel.png', 0.7, 1.45, 4.1, 5.3, 'Plan & approve: timeline of decisions with Approve and Reject');
pic(s, 'img/alerts-panel.png', 5.0, 1.45, 4.1, 5.3, 'Public alerts: SACHET CAP alert in four languages');
card(s, 9.4, 1.45, 3.3, r.h, WHITE);
txt(s, bullets(['Plan & approve: every staging move, closure and alert waits for Approve or Reject, and is logged', 'Backup stations: 20 dry stations pre-paired with exposed ones (Japan model)', 'Teams: GHMC monsoon teams and HYDRAA DRF units staged by min-cost flow', '51 underpasses closed before water arrives (Korea model)', 'Public alerts: CAP 1.2 for NDMA SACHET in English, Telugu, Hindi, Urdu']), { x: 9.6, y: 1.65, w: 2.95, h: r.h - 0.3, fontSize: 13 });
callout(s, 'Nothing moves until a human approves, and every decision is logged.', r.y + r.h + 0.35);
s.addNotes('Step 1. The forecast says when; the planner proposes; nothing moves until the commander approves.');

// 7e step 2 respond
s = pres.addSlide(); s.background = { color: 'F2F7FB' }; badge(s, 2, 'RESPOND');
title(s, 'During the flood: citizens tell us where');
pic(s, 'img/reports.png', 0.7, 1.45, 8.4, 4.73, 'Citizen reports triaged by on-device AI; confirmed sectors turn red on the map', 'left');
card(s, 9.4, 1.45, 3.3, 4.73, WHITE);
txt(s, bullets(['WhatsApp-style reports in 4 languages, read by an on-device AI (no data leaves the laptop)', 'Life-threatening reports always go to a human; AI can escalate, never downgrade', 'Confirmed sectors (red) re-plan the teams', 'Live feeds: NDMA SACHET alerts, public report page, WhatsApp webhook, water-level sensors', 'Safe route avoids flooded cells']), { x: 9.6, y: 1.65, w: 2.95, h: 4.4, fontSize: 13 });
foot(s, 'Example in the screenshot: "People trapped on the terrace in Uppal, water rising" → rescue needed, Uppal sector, human review.');
s.addNotes('Step 2. Location comes from citizens and terrain, not from point forecasts.');
// 7c AI-NETRA building rescue
s = pres.addSlide(); s.background = { color: 'F2F7FB' }; badge(s, 2, 'RESPOND');
title(s, 'AI-NETRA: which buildings to reach first');
pic(s, 'img/building-card.png', 0.7, 1.5, 7.6, 4.28,  'Real buildings in 3D near the Musi with one building selected and its evidence card', 'left');
card(s, 8.6, 1.5, 4.1, 4.3, WHITE);
txt(s, bullets(['11,659 real buildings at their real height', 'Click any building: height, river and waterlogging distance, 2020 flood map, Sentinel-1 radar, sources', 'Musi forecast → 529 evacuate first, 2,083 shelter in place', 'No rescue priority without verified evidence; a human decides']), { x: 8.85, y: 1.75, w: 3.7, h: 3.9, fontSize: 14 });
s.addNotes('Malik built the building intelligence; the merged product links it to the flood forecast and to citizen reports.');


// 7f AI-NETRA evidence before priority
s = pres.addSlide(); s.background = { color: WHITE }; badge(s, 2, 'RESPOND');
title(s, 'No rescue priority without verified evidence');
r = pic(s, 'img/building-card-panel.png', 0.7, 1.45, 4.1, 5.3, 'Building card before verification: priority not assessed');
s.addShape(pres.ShapeType.rightArrow, { x: 4.95, y: 3.7, w: 0.6, h: 0.5, fill: { color: AMBER }, line: { color: AMBER } });
pic(s, 'img/building-verified-panel.png', 5.7, 1.45, 4.1, 5.3, 'After officer verification: evidence complete, ready for human review');
card(s, 10.1, 1.45, 2.6, r.h, 'F2F7FB');
txt(s, bullets(['Malik’s rule: 6 incident fields (people, depth, flow…) must be verified', 'Until then: priority "not assessed"', 'Officer verifies on the ground → ready for human review', 'Automated dispatch: never', 'Musi stage slider: shelter in place vs evacuate first']), { x: 10.25, y: 1.65, w: 2.35, h: r.h - 0.3, fontSize: 12 });
callout(s, 'Missing evidence means no priority, never a guess. A human always decides.', r.y + r.h + 0.35);
s.addNotes('Same rules as Malik’s assess_rescue_readiness.py, ported to the browser and covered by tests.');

// 7f2 original AI-NETRA prototype (frames from its recorded demo, docs/demo/demo_NETRA.mp4 in the original repo)
s = pres.addSlide(); s.background = { color: 'F2F7FB' }; badge(s, 2, 'RESPOND');
title(s, 'Where it started: the AI-NETRA prototype');
[['identify', 'Click a building: exact footprint match, evidence counts and the gaps still missing'],
 ['proximity', 'Musi distance and nearest government waterlogging point, with method and limits'],
 ['incidents', 'Three simulated incidents with Sentinel-1 radar evidence and a source investigation'],
 ['waterlogging', 'GHMC waterlogging locations on the map, and the multi-incident comparison']]
  .forEach(([f, c], i) => { const x = 0.7 + (i % 2) * 6.05, y = 1.45 + Math.floor(i / 2) * 2.85;
    const q = pic(s, `img/netra-demo-${f}.png`, x, y, 5.85, 2.4, c, 'left');
    txt(s, c, { x, y: q.y + q.h + 0.06, w: 5.85, h: 0.3, fontSize: 11, color: MUTED }); });
s.addNotes('Frames from the recorded demo of the original AI-NETRA Next.js + FastAPI app. All of these features now run inside the merged command centre.');

// 7g step 3 prevent: water
s = pres.addSlide(); s.background = { color: 'F2F7FB' }; badge(s, 3, 'PREVENT');
title(s, 'Between storms: follow the water, fix the cause');
pic(s, 'img/water.png', 0.7, 1.45, 8.4, 4.73, 'Follow the Water: rain from Banjara Hills traced 15 km downhill to the Musi', 'left');
card(s, 9.4, 1.45, 3.3, 2.0, WHITE);
txt(s, '1.76×', { x: 9.6, y: 1.55, w: 3, h: 0.8, fontFace: H, fontSize: 40, bold: true, color: TEAL });
txt(s, 'GHMC’s 23 official waterlogging points sit on converging flow 52% of the time, vs 30% for the city', { x: 9.6, y: 2.35, w: 2.95, h: 1.05, fontSize: 12, color: MUTED });
card(s, 9.4, 3.6, 3.3, 2.58, WHITE);
txt(s, bullets(['Click any spot: see where its rain goes', '36 culvert bottlenecks ranked by land drained', 'Lake breach and drain overflow what-ifs', '1,048 government nala segments: 838 under half their planned width']), { x: 9.6, y: 3.75, w: 2.95, h: 2.4, fontSize: 12 });
foot(s, 'Terrain: SRTM with priority-flood filling, D8 flow and HAND. Government data: Telangana TGRAC public GIS (GHMCNalas_vul).');
s.addNotes('Step 3. Our water model was checked against the official government waterlogging points.');

// 7h fix-it and camera AI
s = pres.addSlide(); s.background = { color: WHITE }; badge(s, 3, 'PREVENT');
title(s, 'Leads for the fix, and cameras as flood sensors');
r = pic(s, 'img/fixit-panel.png', 0.7, 1.45, 4.1, 5.3, 'Encroachment detector: 843 leads with complaint drafts');
pic(s, 'img/vision-panel.png', 5.0, 1.45, 4.1, 5.3, 'Camera AI: eight on-device computer-vision tools');
card(s, 9.4, 1.45, 3.3, r.h, 'F2F7FB');
txt(s, bullets(['843 buildings inside lake or nala no-build buffers, ranked by whether they drain into flooded areas', 'One-click GHMC complaint drafts and blocked-drain tickets', 'After-flood accountability report cites the official points', 'Camera AI (CLIP + DETR in the browser): photo depth, CCTV, dashcam, culvert, drone, gauge, satellite']), { x: 9.6, y: 1.65, w: 2.95, h: r.h - 0.3, fontSize: 13 });
foot(s, 'Encroachment results are leads for a human to check, not findings. OSM lake outlines are not the notified FTL line.');
callout(s, 'From flood to fix: every lead becomes a ready-to-send complaint, checked by a human.', r.y + r.h + 0.35);
s.addNotes('Step 3 continued. Every lead is for a human to verify.');

// 7i step 4 proof and AI
s = pres.addSlide(); s.background = { color: 'F2F7FB' }; badge(s, 4, 'PROOF & AI');
title(s, 'Ask the AI, then check the evidence');
r = pic(s, 'img/copilot-panel.png', 0.7, 1.45, 4.1, 5.3, 'AI assistant: answers only from the planner tools, local Llama or Claude');
pic(s, 'img/evidence-panel.png', 5.0, 1.45, 4.1, 5.3, 'Evidence: forecast backtest over two monsoons');
card(s, 9.4, 1.45, 3.3, r.h, WHITE);
txt(s, bullets(['AI assistant calls the planner’s tested tools; every number comes from a tool call', 'Runs on a local Llama (data stays on the machine) or Claude', 'It drafts and explains; it cannot approve or send', 'Evidence tab: backtest, Monte Carlo simulation, AI vs keyword triage', 'How it works: every source and assumption']), { x: 9.6, y: 1.65, w: 2.95, h: r.h - 0.3, fontSize: 13 });
callout(s, 'Forecasts are skilful for WHEN (ROC 0.81) and not for WHERE, so WHERE comes from terrain and citizens.', r.y + r.h + 0.35);
s.addNotes('Step 4. Trust comes from tools and evidence, not from the model’s word.');

// 7j FireSight: prevent (risk model)
s = pres.addSlide(); s.background = { color: 'F2F7FB' };
s.addShape(pres.ShapeType.roundRect, { x: 0.7, y: 0.25, w: 2.6, h: 0.36, fill: { color: 'D9822B' }, line: { color: 'D9822B' }, rectRadius: 0.08 }); s.addText('FIRE  ·  PREVENT', { x: 0.7, y: 0.25, w: 2.6, h: 0.36, fontFace: B, fontSize: 12, bold: true, color: WHITE, align: 'center', valign: 'middle', margin: 0 }); s._b = true;
title(s, 'Slide to Fire: see the risk before it starts');
pic(s, 'img/fs-model.png', 0.7, 1.45, 8.4, 4.73, 'FireSight risk map of the Old City with what the model learned', 'left');
card(s, 9.4, 1.45, 3.3, 1.55, WHITE);
txt(s, '0.74', { x: 9.6, y: 1.5, w: 1.6, h: 0.75, fontFace: H, fontSize: 36, bold: true, color: 'D9822B' });
txt(s, 'AUC on held-out buildings (random forest on 2,315 buildings, 374 past fires)', { x: 9.6, y: 2.2, w: 2.95, h: 0.75, fontSize: 11, color: MUTED });
card(s, 9.4, 3.15, 3.3, 3.03, WHITE);
txt(s, 'What drives fire risk', { x: 9.6, y: 3.25, w: 3, h: 0.35, fontSize: 14, bold: true });
[['Mixed use / godown', 22.2], ['Building age', 20.4], ['Built-up area', 12.1], ['Buildings within 50 m', 9.9], ['Gap to nearest building', 8.9], ['Drive time from station', 8.5]]
  .forEach(([l, w], i) => { const y = 3.68 + i * 0.4; txt(s, l, { x: 9.6, y, w: 2.0, h: 0.3, fontSize: 11 }); s.addShape(pres.ShapeType.rect, { x: 11.55, y: y + 0.07, w: (w / 22.2) * 0.75, h: 0.16, fill: { color: 'D9822B' }, line: { color: 'D9822B' } }); txt(s, `${w}%`, { x: 12.32, y, w: 0.4, h: 0.3, fontSize: 10, color: MUTED, align: 'right' }); });
foot(s, 'FireSight buildings and past fires are generated demo data, labelled in the app. Its learned weights also score the 11,659 real OSM buildings in the flood centre.');
s.addNotes('One slide of the switch at the bottom right brings in FireSight over the flood centre. Day and night risk differ because occupancy differs.');

// 7k FireSight: four risk layers
s = pres.addSlide(); s.background = { color: WHITE };
s.addShape(pres.ShapeType.roundRect, { x: 0.7, y: 0.25, w: 2.6, h: 0.36, fill: { color: 'D9822B' }, line: { color: 'D9822B' }, rectRadius: 0.08 }); s.addText('FIRE  ·  PREVENT', { x: 0.7, y: 0.25, w: 2.6, h: 0.36, fontFace: B, fontSize: 12, bold: true, color: WHITE, align: 'center', valign: 'middle', margin: 0 }); s._b = true;
title(s, 'Four ways to read the same street');
[['fs-risk', 'Fire risk: model score 1–10, by day or by night'],
 ['fs-paper', 'Paper vs reality: floors above the approved plan, missing or expired fire NOC'],
 ['fs-reach', 'Fire tender reach: roads under 6 m a tender cannot enter, drive time'],
 ['fs-spread', 'Spread clusters: buildings joined wall to wall, where one fire becomes many']]
  .forEach(([f, c], i) => { const x = 0.7 + (i % 2) * 6.05, y = 1.45 + Math.floor(i / 2) * 2.85;
    const q = pic(s, `img/${f}${f.startsWith('fs-') ? '-wide' : ''}.png`, x, y, 5.85, 2.4, c, 'left');
    txt(s, c, { x, y: q.y + q.h + 0.06, w: 5.85, h: 0.3, fontSize: 11, color: MUTED }); });
s.addNotes('Inspectors get a ranked list: risky buildings whose records do not match, that tenders cannot reach, inside big joined clusters.');

// 7l FireSight: detect and respond
s = pres.addSlide(); s.background = { color: 'F2F7FB' };
s.addShape(pres.ShapeType.roundRect, { x: 0.7, y: 0.25, w: 2.6, h: 0.36, fill: { color: 'D64550' }, line: { color: 'D64550' }, rectRadius: 0.08 }); s.addText('FIRE  ·  DETECT & RESPOND', { x: 0.7, y: 0.25, w: 2.6, h: 0.36, fontFace: B, fontSize: 12, bold: true, color: WHITE, align: 'center', valign: 'middle', margin: 0 }); s._b = true;
title(s, 'From a camera frame to a cleared fire');
r = pic(s, 'img/fs-detect.png', 0.7, 1.45, 5.85, 3.3, 'Detect mode: live incidents ranked by level', 'left');
pic(s, 'img/fs-incident.png', 6.75, 1.45, 5.85, 3.3, 'Incident window: CCTV frames, severity, location, hospitals and required actions', 'left');
[['1', 'Detect', 'CCTV or a citizen report raises a fire, levelled 1 to 3'], ['2', 'Size it up', 'People inside, joined buildings, NOC status, goods stored'], ['3', 'Act', 'Dispatch, green corridor, give-way and evacuation alerts, hospitals, police, power cut'], ['4', 'Alert', 'Approved alerts go out by Twilio voice/SMS and Telegram']]
  .forEach(([n, h, b], i) => { const x = 0.7 + i * 3.0, y = r.y + r.h + 0.3; card(s, x, y, 2.85, 1.55, WHITE);
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.15, y: y + 0.15, w: 0.45, h: 0.45, fill: { color: 'D64550' }, line: { color: 'D64550' } });
    txt(s, n, { x: x + 0.15, y: y + 0.15, w: 0.45, h: 0.45, fontSize: 14, bold: true, color: WHITE, align: 'center', valign: 'middle' });
    txt(s, h, { x: x + 0.7, y: y + 0.18, w: 2.05, h: 0.4, fontSize: 15, bold: true });
    txt(s, b, { x: x + 0.15, y: y + 0.68, w: 2.6, h: 0.82, fontSize: 11, color: MUTED }); });
s.addNotes('Each action in the incident window is a checklist item; alerts go out only after a responder approves. The alert service runs from the local server at /firesight/api/notify.');

// 5 AI table
s = pres.addSlide(); s.background = { color: WHITE };
title(s, 'Where AI does the work');
const hd = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY }, fontFace: B, fontSize: 14 } });
const cell = (t, o = {}) => ({ text: t, options: { fontFace: B, fontSize: 14, color: INK, valign: 'middle', ...o } });
s.addTable([[hd('Stage'), hd('AI used'), hd('Evidence')],
  [cell('When', { bold: true }), cell('173-member ensemble incl. 51 members of ECMWF AIFS, a machine-learned weather model'), cell('Backtest of 2 monsoons: ROC 0.81')],
  [cell('Where', { bold: true }), cell('On-device multilingual AI reads WhatsApp-style reports in English, Telugu, Hindi and Urdu'), cell('91% accuracy vs 13% for keywords; misses 2 of 20 life-threatening reports vs 17 of 20')],
  [cell('Moves', { bold: true }), cell('Exact optimiser by design, so every move is auditable'), cell('Supply, floors and safety rules covered by automated tests')],
  [cell('Ask', { bold: true }), cell('AI agent (Claude, or local Llama) with 10 planner tools'), cell('Every number comes from a tool call; it cannot approve or send')]],
  { x: 0.7, y: 1.6, w: 11.9, colW: [1.5, 6.1, 4.3], rowH: [0.5, 0.95, 1.1, 0.8, 0.95], border: { type: 'solid', color: 'D5E3EE', pt: 0.75 }, fill: { color: 'F7FAFC' } });
txt(s, 'AI reads, forecasts and explains. The optimiser stays exact so a commander can audit every move.', { x: 0.7, y: 5.9, w: 11.9, h: 0.6, fontFace: H, fontSize: 20, bold: true, color: TEAL });
s.addNotes('AI is used where it adds value and kept out of the optimiser on purpose: a commander must be able to audit every move.');

// 6 proof
s = pres.addSlide(); s.background = { color: NAVY };
txt(s, 'It works: staging reaches more people in time', { x: 0.7, y: 0.45, w: 11.9, h: 0.9, fontFace: H, fontSize: 32, bold: true, color: WHITE });
const stats = [['83% → 96%', 'rescues reached within 30 minutes, teams at depots vs SurgeForce staging (Monte Carlo on the 31 Aug 2024 replay)'], ['91% vs 13%', 'report triage accuracy, on-device AI vs keyword rules, on held-out English, Telugu, Hindi and Urdu messages'], ['2 vs 17', 'life-threatening reports missed out of 20, AI vs keyword rules']];
stats.forEach(([n, d], i) => { const x = 0.7 + i * 4.1; s.addShape(pres.ShapeType.roundRect, { x, y: 1.9, w: 3.8, h: 3.9, fill: { color: '15325A' }, line: { color: '2A4C7D', width: 0.75 }, rectRadius: 0.12 }); txt(s, n, { x: x + 0.25, y: 2.2, w: 3.3, h: 1.0, fontFace: H, fontSize: 36, bold: true, color: AMBER }); txt(s, d, { x: x + 0.25, y: 3.4, w: 3.3, h: 2.2, fontSize: 16, color: ICE }); });
txt(s, 'Simulation incident rates are synthetic and labelled as such in the app.', { x: 0.7, y: 6.3, w: 11.9, h: 0.4, fontSize: 13, color: 'A9C7E0' });
s.addNotes('Be honest: incident rates in the simulation are assumptions. The forecast, terrain and station data are real.');

// 7 merge
s = pres.addSlide(); s.background = { color: WHITE };
title(s, 'Three builds, one command centre');
const mods = [['Rohan', 'SurgeForce', 'Forecast backtest, terrain, optimiser, simulation, AI triage, agent, water flow, camera AI and government drainage data.'], ['Malik', 'AI-NETRA', 'Building rescue: 11,659 real buildings in 3D, click-to-identify, height, river, waterlogging, 2020 flood map, Sentinel-1 radar and his rescue-readiness rule.'], ['Aditya', 'FireSight', 'Fire risk and response, one slide away; its model weights score the same real buildings, and its Twilio alerts send approved warnings.']];
mods.forEach(([n, h, b], i) => { const x = 0.7 + i * 4.1; card(s, x, 1.7, 3.8, 3.6); txt(s, n, { x: x + 0.3, y: 1.95, w: 3.2, h: 0.4, fontSize: 16, bold: true, color: TEAL }); txt(s, h, { x: x + 0.3, y: 2.4, w: 3.2, h: 0.6, fontFace: H, fontSize: 24, bold: true }); txt(s, b, { x: x + 0.3, y: 3.2, w: 3.2, h: 2.0, fontSize: 15, color: MUTED }); });
txt(s, 'One flood product: SurgeForce decides when and where to stage teams, AI-NETRA tells them which buildings, and FireSight covers fire with a slide of the switch.', { x: 0.7, y: 5.6, w: 11.9, h: 1.2, fontSize: 18 });
s.addNotes('Each teammate built a module separately. The merged app shows them together in the Buildings tab and gives the agent two extra tools.');

// 8 real data
s = pres.addSlide(); s.background = { color: 'F2F7FB' };
title(s, 'Real data, honestly labelled');
card(s, 0.7, 1.7, 5.8, 4.8, WHITE); txt(s, 'Real', { x: 1.0, y: 1.95, w: 5, h: 0.5, fontFace: H, fontSize: 24, bold: true, color: TEAL });
txt(s, bullets(['Open-Meteo ensembles, ECMWF AIFS, ERA5', 'SRTM terrain, OSM nalas and the Musi', 'OSM police and fire stations, 51 underpasses', 'OSRM road times, GloFAS river discharge', '11,659 OSM buildings, Google heights', 'Telangana TGRAC govt drainage GIS: 23 waterlogging points, 1,048 nala widths', 'NDMA SACHET official alerts']), { x: 1.0, y: 2.6, w: 5.2, h: 3.7, fontSize: 15 });
card(s, 6.8, 1.7, 5.8, 4.8, WHITE); txt(s, 'Assumed, and labelled in the app', { x: 7.1, y: 1.95, w: 5.2, h: 0.5, fontFace: H, fontSize: 24, bold: true, color: 'B7741A' });
txt(s, bullets(['Officers per station, team locations in a zone', 'Incident rates in the simulation', 'Simulated citizen reports', 'FireSight demo buildings: only its weights are reused', 'Exposure is a ranking, not flood probability']), { x: 7.1, y: 2.6, w: 5.2, h: 3.7, fontSize: 15 });
s.addNotes('Judges will ask what is real. This slide answers it.');

// 9 safety
s = pres.addSlide(); s.background = { color: WHITE };
title(s, 'Built so a commander can trust it');
const safe = [['AI may escalate, never downgrade', 'If rules flag a report as life-threatening, the AI cannot lower it. Covered by a test.'], ['The agent cannot act', 'It drafts and recommends. Only the commander approves, and every approval is logged.'], ['Police data stays local', 'Triage runs in the browser. The agent can run on a local Llama model.'], ['Tested and automated', '37 automated tests, a real-browser test of every screen, CI on every push, CodeQL scanning.']];
safe.forEach(([h, b], i) => { const x = 0.7 + (i % 2) * 6.1, y = 1.7 + Math.floor(i / 2) * 2.4; card(s, x, y, 5.8, 2.1); txt(s, h, { x: x + 0.3, y: y + 0.25, w: 5.2, h: 0.5, fontSize: 20, bold: true, color: TEAL }); txt(s, b, { x: x + 0.3, y: y + 0.85, w: 5.2, h: 1.1, fontSize: 16, color: MUTED }); });
s.addNotes('Safety rules are non-negotiable and documented in AGENTS.md.');

// 10 close
s = pres.addSlide(); s.background = { color: NAVY };
txt(s, 'What we need to go live', { x: 0.8, y: 0.8, w: 11.5, h: 0.9, fontFace: H, fontSize: 40, bold: true, color: WHITE });
txt(s, bullets(['GHMC and police duty rosters and 1070 complaint logs to replace our assumed numbers', 'GHMC storm-drain GIS and HMDA lake boundaries for the drainage model', 'A water / no-water signal from police CCTV at hotspots, and a WhatsApp business number']), { x: 0.8, y: 2.1, w: 11.5, h: 2.8, fontSize: 22, color: ICE });
txt(s, 'Forecasts say when, terrain and citizens say where, a human decides.', { x: 0.8, y: 5.2, w: 11.5, h: 0.9, fontFace: H, fontSize: 28, bold: true, color: AMBER });
txt(s, 'github.com/Rohanarekatla/CipherCop-2026  ·  npm start → http://localhost:8520', { x: 0.8, y: 6.5, w: 11.5, h: 0.4, fontSize: 16, color: 'A9C7E0' });
s.addNotes('Close with the one-line summary and the ask.');

pres.writeFile({ fileName: '../../submission/3_Presentation/CipherCop2026_AI-vengers_Presentation.pptx' }).then(() => console.log('ok'));
