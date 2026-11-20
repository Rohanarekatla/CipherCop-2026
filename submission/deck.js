const pptxgen = require('pptxgenjs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pres.title = 'SurgeForce - Team AI-vengers - CipherCop 2026';
pres.author = 'Team AI-vengers';
const NAVY = '0B1F3A', TEAL = '0E7C86', ICE = 'DCEBF5', AMBER = 'F2A33A', INK = '12263F', MUTED = '5B6B7D', WHITE = 'FFFFFF', RED = 'D64550';
const H = 'Cambria', B = 'Calibri';
const title = (s, t) => s.addText(t, { x: 0.7, y: 0.45, w: 11.9, h: 0.9, fontFace: H, fontSize: 32, bold: true, color: INK, isTextBox: true, margin: 0 });
const card = (s, x, y, w, h, fill = 'F2F7FB') => s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: fill }, line: { color: 'D5E3EE', width: 0.75 }, rectRadius: 0.12 });
const txt = (s, t, o) => s.addText(t, { fontFace: B, color: INK, isTextBox: true, margin: 0, valign: 'top', ...o });
const bullets = (items) => items.map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1, paraSpaceAfter: 8 } }));

// 1 title
let s = pres.addSlide(); s.background = { color: NAVY };
txt(s, 'CipherCop 2026  ·  Track 2: AI for Disaster Resilience', { x: 0.8, y: 0.9, w: 11.5, h: 0.4, fontSize: 16, color: 'A9C7E0' });
txt(s, 'SurgeForce', { x: 0.8, y: 1.8, w: 11.5, h: 1.2, fontFace: H, fontSize: 66, bold: true, color: WHITE });
txt(s, 'An AI command centre that decides, before the storm, who goes where in Hyderabad and when. A human commander approves every move.', { x: 0.8, y: 3.15, w: 9.2, h: 1.4, fontSize: 24, color: ICE });
txt(s, 'Team AI-vengers', { x: 0.8, y: 5.4, w: 6, h: 0.4, fontSize: 20, bold: true, color: AMBER });
txt(s, 'Mallikarjuna Reddy  ·  Sai Adurti  ·  Rohan A  ·  Sriram Aditya', { x: 0.8, y: 5.85, w: 11.5, h: 0.4, fontSize: 18, color: ICE });
s.addNotes('Introduce the team and the one-line idea: pre-position police, GHMC and HYDRAA teams before the rain, with a human approving every move.');

// 2 problem
s = pres.addSlide(); s.background = { color: WHITE };
title(s, 'Floods are decided before the first call');
const probs = [['Teams wait at depots', 'Response starts after distress calls, when roads are already slowed by water.'], ['Forecasts are not places', 'A weather model can say a storm is coming. It cannot say which street floods.'], ['Many agencies, one night', 'Police, GHMC METs, HYDRAA DRF, fire and volunteers must move together.']];
probs.forEach(([h, b], i) => { const x = 0.7 + i * 4.1; card(s, x, 1.8, 3.8, 3.4); txt(s, String(i + 1), { x: x + 0.3, y: 2.05, w: 1, h: 0.8, fontFace: H, fontSize: 44, bold: true, color: TEAL }); txt(s, h, { x: x + 0.3, y: 3.0, w: 3.2, h: 0.5, fontSize: 22, bold: true }); txt(s, b, { x: x + 0.3, y: 3.6, w: 3.2, h: 1.4, fontSize: 16, color: MUTED }); });
txt(s, 'The question we answer: when a storm is coming, who goes where, and when, before the first call?', { x: 0.7, y: 5.7, w: 11.9, h: 0.9, fontSize: 22, bold: true, color: TEAL });
s.addNotes('Frame the problem as a decision problem, not a prediction problem.');

// 3 key finding chart
s = pres.addSlide(); s.background = { color: WHITE };
title(s, 'We measured it: AI forecasts tell us when, not where');
s.addChart(pres.charts.BAR, [{ name: 'ROC area', labels: ['Heavy rain somewhere in the city', 'Heavy rain at one point'], values: [0.813, 0.715] }], { x: 0.7, y: 1.6, w: 6.2, h: 4.7, barDir: 'col', chartColors: [TEAL, RED], showTitle: true, title: 'Forecast skill, ROC area, 2024-2025 monsoons', titleFontFace: B, titleFontSize: 14, titleColor: INK, showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: INK, dataLabelFontSize: 14, dataLabelFontFace: B, catAxisLabelColor: INK, catAxisLabelFontFace: B, catAxisLabelFontSize: 12, valAxisLabelColor: MUTED, valAxisLabelFontFace: B, valAxisMinVal: 0.5, valAxisMaxVal: 0.9, valGridLine: { color: 'E3ECF3', size: 0.5 }, catGridLine: { style: 'none' }, showLegend: false });
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
const mods = [['Rohan', 'SurgeForce core', 'Forecast backtest, terrain, optimiser, simulation, AI triage and the agent.'], ['Malik', 'AI-NETRA-GEO', '11,659 real OSM buildings with Google heights, Musi distance and government waterlogging points, ranked by exposure.'], ['Aditya', 'FireSight', 'Fire-risk weights applied to the same real buildings, nearest real fire station, and alert delivery.']];
mods.forEach(([n, h, b], i) => { const x = 0.7 + i * 4.1; card(s, x, 1.7, 3.8, 3.6); txt(s, n, { x: x + 0.3, y: 1.95, w: 3.2, h: 0.4, fontSize: 16, bold: true, color: TEAL }); txt(s, h, { x: x + 0.3, y: 2.4, w: 3.2, h: 0.6, fontFace: H, fontSize: 24, bold: true }); txt(s, b, { x: x + 0.3, y: 3.2, w: 3.2, h: 2.0, fontSize: 15, color: MUTED }); });
txt(s, 'Together: when an area is confirmed flooded, commanders see which real buildings are most exposed, which tall ones could shelter people, and where a flood and a fire could coincide far from a fire station.', { x: 0.7, y: 5.6, w: 11.9, h: 1.2, fontSize: 18 });
s.addNotes('Each teammate built a module separately. The merged app shows them together in the Buildings tab and gives the agent two extra tools.');

// 8 real data
s = pres.addSlide(); s.background = { color: 'F2F7FB' };
title(s, 'Real data, honestly labelled');
card(s, 0.7, 1.7, 5.8, 4.8, WHITE); txt(s, 'Real', { x: 1.0, y: 1.95, w: 5, h: 0.5, fontFace: H, fontSize: 24, bold: true, color: TEAL });
txt(s, bullets(['Open-Meteo ensembles, ECMWF AIFS, ERA5', 'SRTM terrain, OSM nalas and the Musi', 'OSM police and fire stations, 51 underpasses', 'OSRM road times, GloFAS river discharge', '11,659 OSM buildings, Google heights', 'Telangana TGRAC waterlogging points']), { x: 1.0, y: 2.6, w: 5.2, h: 3.7, fontSize: 15 });
card(s, 6.8, 1.7, 5.8, 4.8, WHITE); txt(s, 'Assumed, and labelled in the app', { x: 7.1, y: 1.95, w: 5.2, h: 0.5, fontFace: H, fontSize: 24, bold: true, color: 'B7741A' });
txt(s, bullets(['Officers per station, team locations in a zone', 'Incident rates in the simulation', 'Simulated citizen reports', 'FireSight demo buildings: only its weights are reused', 'Exposure is a ranking, not flood probability']), { x: 7.1, y: 2.6, w: 5.2, h: 3.7, fontSize: 15 });
s.addNotes('Judges will ask what is real. This slide answers it.');

// 9 safety
s = pres.addSlide(); s.background = { color: WHITE };
title(s, 'Built so a commander can trust it');
const safe = [['AI may escalate, never downgrade', 'If rules flag a report as life-threatening, the AI cannot lower it. Covered by a test.'], ['The agent cannot act', 'It drafts and recommends. Only the commander approves, and every approval is logged.'], ['Police data stays local', 'Triage runs in the browser. The agent can run on a local Llama model.'], ['Tested and automated', '19 automated tests, CI on every push, security scanning.']];
safe.forEach(([h, b], i) => { const x = 0.7 + (i % 2) * 6.1, y = 1.7 + Math.floor(i / 2) * 2.4; card(s, x, y, 5.8, 2.1); txt(s, h, { x: x + 0.3, y: y + 0.25, w: 5.2, h: 0.5, fontSize: 20, bold: true, color: TEAL }); txt(s, b, { x: x + 0.3, y: y + 0.85, w: 5.2, h: 1.1, fontSize: 16, color: MUTED }); });
s.addNotes('Safety rules are non-negotiable and documented in AGENTS.md.');

// 10 close
s = pres.addSlide(); s.background = { color: NAVY };
txt(s, 'What we need to go live', { x: 0.8, y: 0.8, w: 11.5, h: 0.9, fontFace: H, fontSize: 40, bold: true, color: WHITE });
txt(s, bullets(['GHMC and police duty rosters and 1070 complaint logs to replace our assumed numbers', 'Official flooding points and NDMA SACHET alerts on the same timeline', 'Next: follow-the-water tracing, encroachment detector, photo-to-depth reports']), { x: 0.8, y: 2.1, w: 11.5, h: 2.8, fontSize: 22, color: ICE });
txt(s, 'Forecasts say when, terrain and citizens say where, a human decides.', { x: 0.8, y: 5.2, w: 11.5, h: 0.9, fontFace: H, fontSize: 28, bold: true, color: AMBER });
txt(s, 'github.com/Rohanarekatla/CipherCop-2026', { x: 0.8, y: 6.5, w: 11.5, h: 0.4, fontSize: 16, color: 'A9C7E0' });
s.addNotes('Close with the one-line summary and the ask.');

pres.writeFile({ fileName: 'CipherCop2026_AI-vengers_Presentation.pptx' }).then(() => console.log('ok'));
