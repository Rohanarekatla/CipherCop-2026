// Computer vision for flood signals (ideas B2, C2, C3, F1–F8). The browser runs open models on-device with
// Transformers.js: CLIP (zero-shot image classification) and DETR (object detection). This file holds the
// label sets and the decision rules, which are plain functions so the tests can check them.
// Rule shared with text triage: AI may escalate to a human, never downgrade. Only a flood signal leaves the
// device (water yes/no, depth, blockage, counts); never faces or number plates.
export const CLIP_MODEL = 'Xenova/clip-vit-base-patch32';
export const DETR_MODEL = 'Xenova/detr-resnet-50';

// B2 / F1: water depth bands, read from cars, people and kerbs in the frame (zero-shot; a fine-tuned model
// such as FloodVision reaches ~8–11 cm error, this one is coarser and labelled approximate)
export const DEPTH = [
  { label: 'a photo of a dry street with no water', cm: 0 },
  { label: 'a photo of a street with shallow ankle-deep puddles of water', cm: 10 },
  { label: 'a photo of a street flooded with knee-deep water up to car wheels', cm: 45 },
  { label: 'a photo of a street flooded with waist-deep water, cars half submerged', cm: 90 },
  { label: 'a photo of deep floodwater covering cars and the ground floor of houses', cm: 150 },
];
export function depthFromScores(scores, floodP = 1) { // scores: CLIP output; floodP: P(flooded street) from the hazard check
  const by = new Map(scores.map((s) => [s.label, s.score]));
  const total = DEPTH.reduce((a, d) => a + (by.get(d.label) ?? 0), 0) || 1;
  const cm = Math.round(DEPTH.reduce((a, d) => a + d.cm * (by.get(d.label) ?? 0), 0) / total);
  const top = DEPTH.reduce((b, d) => ((by.get(d.label) ?? 0) > (by.get(b.label) ?? 0) ? d : b), DEPTH[0]);
  const flooded = cm >= 20 && floodP >= 0.5; // depth bands alone over-read wet-looking dry streets
  return { cm: flooded ? cm : 0, band: flooded ? top.cm : 0, flooded, confidence: +((by.get(top.label) ?? 0) / total).toFixed(2) };
}

// Gate: only outdoor street / drain / canal scenes are analysed; screenshots, documents and indoor photos are refused
export const SCENE = ['a photo taken outdoors of a street, road, drain, canal or flooded area', 'a screenshot, a document, a map, a chart or an indoor photo'];
export const isScene = (scores) => (scores.find((s) => s.label === SCENE[0])?.score ?? 0) >= 0.5;

// F8: several hazards in one citizen photo. Each is scored against a neutral scene (one CLIP call per pair),
// (plus an "other" option), so the labels are independent (multi-label), and each routes to the department that fixes it.
export const NEUTRAL = 'an ordinary photo of a street';
export const OTHER = 'a photo of something else';
export const FLOODED = 'a flooded street with standing water';
// labels each hazard competes with: a hazard must beat a plain street, a plain flood and "something else"
export const hazardLabels = (h) => (h.key === 'flooding' ? [h.label, NEUTRAL, OTHER] : [h.label, NEUTRAL, FLOODED, OTHER]);
export const HAZARDS = [
  { key: 'flooding', label: 'a flooded street with standing water', route: 'GHMC Monsoon Emergency Team', human: false },
  { key: 'live_wire', label: 'electric wires or a fallen electric pole lying in water', route: 'TGSPDCL (electricity) + police cordon', human: true },
  { key: 'open_manhole', label: 'an open manhole or uncovered drain hole on a road', route: 'GHMC / HMWSSB, urgent', human: true },
  { key: 'fallen_tree', label: 'a fallen tree blocking a road', route: 'GHMC DRF tree-cutting team', human: false },
  { key: 'blocked_drain', label: 'a drain or culvert blocked with garbage and plastic', route: 'GHMC sanitation (blocked-drain ticket)', human: false },
];
// Life-safety hazards (live wire, open manhole) use a low bar and go to a human as "possible": a false alarm
// costs a check, a miss can cost a life. Others need a clear majority.
export function hazardsFromScores(pairs, { humanAt = 0.1, otherAt = 0.5 } = {}) { // pairs: { key: P(hazard) }
  const found = HAZARDS.filter((h) => (pairs[h.key] ?? 0) >= (h.human ? humanAt : otherAt))
    .map((h) => ({ ...h, p: +pairs[h.key].toFixed(2), possible: pairs[h.key] < otherAt }));
  return { found, human: found.some((h) => h.human), routes: [...new Set(found.map((h) => h.route))] };
}

// F2: culvert or trash screen, clear or blocked (research: ~85% plain classifier, ~94% detect-then-classify)
export const CULVERT = ['a clear culvert or drain opening with water flowing freely', 'a culvert or trash screen blocked with garbage, plastic and debris'];
export const culvertBlocked = (scores) => (scores.find((s) => s.label === CULVERT[1])?.score ?? 0) >= 0.5;

// F4: drone view of a nala, problems that eat channel capacity (multi-label per image tile)
export const NALA = [
  { key: 'garbage', label: 'garbage and plastic waste dumped in a canal' },
  { key: 'silt', label: 'a canal choked with silt and mud banks' },
  { key: 'weeds', label: 'a canal covered with weeds or water hyacinth' },
  { key: 'wall', label: 'a broken or collapsed canal retaining wall' },
  { key: 'building', label: 'houses and buildings built right at the edge of a canal' },
];
export const NALA_CLEAR = 'a clean open concrete canal with flowing water';

// C3 / F3: dashcam pre-monsoon audit labels (single best label per frame, with a "nothing" class)
export const DASHCAM = [
  { key: 'clear', label: 'a clear dry road seen from a car dashboard' },
  { key: 'waterlogging', label: 'a waterlogged flooded road seen from a car' },
  { key: 'open_manhole', label: 'an open manhole on the road' },
  { key: 'garbage', label: 'a heap of garbage next to a roadside drain' },
  { key: 'silt', label: 'mud and silt deposited on the road' },
  { key: 'fallen_tree', label: 'a fallen tree on the road' },
];

// F5: drone search and rescue. DETR boxes (COCO labels) become rescue tasks; people are what matters.
export function rescueFromDetections(dets, minScore = 0.6) { // a missed person costs more than a check
  const keep = dets.filter((d) => d.score >= minScore && ['person', 'car', 'truck', 'boat', 'bus', 'motorcycle'].includes(d.label));
  const count = (l) => keep.filter((d) => d.label === l).length;
  const people = count('person'), vehicles = count('car') + count('truck') + count('bus') + count('motorcycle'), boats = count('boat');
  return { keep, people, vehicles, boats, task: people ? `${people} people seen${vehicles ? `, ${vehicles} vehicles` : ''}: send DRF boat team` : vehicles ? `${vehicles} vehicles seen, no people: check for stranded drivers` : null };
}

// F7: camera-read water gauge. Input: the luminance profile along the painted scale, top to bottom, and the
// scale values at the two ends. Water hides the painted scale, so the waterline is the row where the
// contrast of the stripes (local variance) drops and stays low.
export function gaugeLevel(profile, topValue, bottomValue, win = 5) {
  const n = profile.length;
  if (n < win * 4) return null;
  const variance = profile.map((_, i) => {
    const s = profile.slice(Math.max(0, i - win), Math.min(n, i + win + 1)), m = s.reduce((a, b) => a + b, 0) / s.length;
    return s.reduce((a, b) => a + (b - m) ** 2, 0) / s.length;
  });
  const hi = Math.max(...variance), cut = hi * 0.25;
  let line = n; // walk up from the bottom while the stripes stay hidden
  for (let i = n - 1; i >= 0; i--) { if (variance[i] > cut) break; line = i; }
  if (line >= n - 1) return { row: n, value: bottomValue, submergedShare: 0 };
  const share = (n - line) / n;
  return { row: line, value: +(bottomValue + (topValue - bottomValue) * share).toFixed(2), submergedShare: +share.toFixed(2) };
}

// F6: change between two images of the same place (grey levels, same size): share of pixels that changed
export function changeShare(a, b, threshold = 40) {
  let changed = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > threshold) changed++;
  return +(changed / a.length).toFixed(3);
}
