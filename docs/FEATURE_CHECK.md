# Feature check: every member's work in the merged website

Checked on 20 Nov 2026 against the three original repos kept in `Rohan/`, `Malik/` and `Aditya/`. "Where" is the place in the merged site: the side panel is organised in four steps (1 Prepare, 2 Respond, 3 Prevent, 4 Proof & AI), and the Flood / Fire switch (bottom right) slides FireSight in. "Verified" means covered by `npm test` and/or the browser test `scripts/e2e.mjs`.

## Rohan: SurgeForce (`Rohan/`, plus the later field-and-fix work)

| Feature | Where in the merged site | Verified |
|---|---|---|
| Replay of 31 Aug 2024 and live 173-member forecast | Header: Replay / Live forecast | tests, e2e |
| Decision threshold (cost/loss), station offline, volunteer no-show | Header controls | tests |
| KPI strip | Top of page | e2e |
| 3D map: terrain columns, station exposure, backup-station links, underpasses, Musi | Map | e2e |
| Rain forecast chart with observed rain | Bottom of map | e2e |
| Timeline with human approval of every move | 1 Prepare → Plan & approve | tests, e2e |
| Counterparts (backup stations, Japan model) | 1 Prepare → Backup stations | tests, e2e |
| Team staging by min-cost flow | 1 Prepare → Teams | tests, e2e |
| CAP alerts in 4 languages | 1 Prepare → Public alerts | tests, e2e |
| On-device AI triage of citizen reports (4 languages) | 2 Respond → Citizen reports | e2e |
| AI agent (Claude or local Llama) over the planner's tools | 4 Proof & AI → AI assistant | tests (tools); the Claude path needs a key |
| Backtest, simulation, AI-vs-keyword evaluation | 4 Proof & AI → Evidence | tests, e2e |
| Method and data sources | 4 Proof & AI → How it works | e2e |
| Follow the Water, bottlenecks, lake breach, drain overflow | 3 Prevent → Water flow | tests, e2e |
| Government TGRAC data and model check | 3 Prevent → Water flow | tests, e2e |
| Encroachment leads, blocked-drain tickets, after-flood report, learning plan | 3 Prevent → Fix-it | tests, e2e |
| Camera AI: photo depth, CCTV, dashcam, culvert, drone survey and rescue, change, gauge, satellite | 3 Prevent → Camera AI | tests (rules), e2e (tab) |
| SACHET alerts, public report page, WhatsApp webhook, sensors, weather-station import, TGiCCC feed, vulnerable facilities | 2 Respond → Live feeds; `/report.html` | tests, e2e |
| Flood-aware routing | 2 Respond → Safe route | e2e (tab); routing needs internet |
| Scripts: fetch-data, fetch-hand, backtest, eval-intake, agent-demo | `scripts/` (all present) | CI syntax check |

## Malik: AI-NETRA-GEO (`Malik/`)

| Feature in his Next.js + FastAPI app | Where in the merged site | Verified |
|---|---|---|
| Building identification by map click, exact polygon match | 2 Respond → Building rescue: click a building | tests, e2e |
| Nearby building candidates when no exact match | Same: click empty ground | tests |
| Footprint highlighting | Same (dark outline; amber for candidates) | e2e |
| Google Open Buildings 2.5D height, quality flag, source | Building card: height intelligence | e2e |
| Footprint area | Building card | e2e |
| Musi proximity (distance, band, intersects water) | Building card | e2e |
| Government waterlogging proximity (nearest TGRAC point, band) | Building card | e2e |
| Waterlogging markers and dropdown navigation | Map markers; "Go to a government waterlogging point" | e2e |
| Historical October 2020 flood evidence (generic and named-locality overlap) | Building card; purple map layer | e2e |
| Sentinel-1 radar evidence for the 40 targeted buildings | Building card | tests |
| Source investigation (OSM tags, edit date) | Building card | e2e |
| Evidence quality and provenance classification | Building card (same rules as `classify_evidence_quality.py`) | tests |
| Unified rescue assessment: missing incident evidence, priority "not assessed", human review, no automated dispatch | Building card (same rules as `assess_rescue_readiness.py`) | tests, e2e |
| Simulated incidents (3 demo locations) | "Simulated incident (demo)" dropdown | e2e |
| Multi-incident comparison | "Compare the simulated incidents" | e2e |
| Exposure index for all 11,659 buildings | Building rescue tab, bottom | tests |
| FastAPI endpoints (`/building/query`, `/rescue/assessment`, `/rescue/demo-incident`, `/waterlogging/locations`, `/health`) | Same logic runs in the browser (`lib/netra.js`); the Python service itself stays in `Malik/` | CI compiles it |
| Data pipeline scripts, Earth Engine Sentinel-1 script, CV environment notebook, docs | `Malik/` (unchanged) | CI compiles the scripts |
| Demo and flood videos (about 200 MB) | Left out for GitHub's size limit; in his original repo | — |

New with the merge: the Musi forecast drives a scenario plan for every building (shelter in place / evacuate first / verify), SurgeForce's field inputs fill his incident-evidence fields, and an officer's ground verification completes them.

## Aditya: FireSight (`Aditya/`)

| Feature | Where in the merged site | Verified |
|---|---|---|
| Fire-risk map, building risk list and model explanation | Flood / Fire switch → Fire (`/firesight/`, unchanged code) | e2e |
| Incident detection and full incident window (CCTV frames, severity, coverage, hospitals) | Same | e2e (loads) |
| Responder actions: dispatch, green corridor, give-way and evacuation alerts, hospitals, police, power cut | Same | manual |
| Alert delivery by Twilio voice / SMS and Telegram (`api/notify.js`) | Runs from the local server at `/firesight/api/notify` (and `/api/notify`); needs Twilio keys to send | tests |
| Risk model weights (AUC 0.744 on his generated data) | Also applied to the 11,659 real buildings: fire score on each building card | tests |

FireSight's own buildings and incidents are generated demo data, labelled in his app.

## Not in the website (by design)

- Python services (Malik's FastAPI) and the Next.js build: the website is static so it runs on GitHub Pages; the same logic is ported to JavaScript.
- Large videos: see above.
