# SurgeForce: one command centre for Hyderabad's monsoon

**CipherCop 2026 · Track 2: AI for Disaster Resilience · Team AI-vengers** (Mallikarjuna Reddy, Sai Adurti, Rohan A, Sriram Aditya)

An AI command centre that decides, **before** a storm hits Hyderabad, which police, GHMC Monsoon Emergency Teams, HYDRAA rescue teams and volunteers should move where and when. A human commander approves every move. It runs on real public data, and it is tested.

**Live demo:** https://rohanarekatla.github.io/CipherCop-2026/ (deployed by [the Pages workflow](.github/workflows/pages.yml) once Pages is switched to "GitHub Actions" in the repo settings)

## The idea in four lines

1. We measured what AI weather forecasts can do for Hyderabad (backtest of the 2024 and 2025 monsoons). They predict **when** heavy rain hits the city (ROC 0.81) but not **where** inside it.
2. So a 173-member ensemble, including ECMWF's machine-learned AIFS model, decides **when** to mobilise. A terrain model (HAND on 7,021 cells) plus on-device AI that reads citizen reports in English, Telugu, Hindi and Urdu decides **where**.
3. An exact min-cost-flow optimiser stages teams and pre-assigns counterpart stations (Japan's *taiko shien*). A Monte Carlo simulation shows rescues reached within 30 minutes rise from 83% to 96%.
4. An AI agent (Claude Opus 5.5, or a local Llama so police data never leaves the building) answers the commander only by calling the planner's tools, so every number is grounded. It cannot approve or send anything.

## One flood command centre, with fire one slide away

Run `npm start` and open http://localhost:8520.

- **Flood (SurgeForce + AI-NETRA, Rohan + Malik):** one product. SurgeForce decides when and where to stage teams; AI-NETRA, in the **Buildings** tab, says which buildings. Malik's 11,659 real buildings stand in 3D at their real height. Click any building for every piece of his evidence: exact identification with nearby candidates, Google height intelligence, footprint, Musi and government-waterlogging proximity, the official October 2020 flood map, Sentinel-1 radar change, source investigation, evidence quality and provenance, and his rescue-readiness rule (no rescue priority without verified current evidence, never automated dispatch). The Musi forecast sets the scenario plan: shelter in place, evacuate first or verify.
- **Fire (FireSight, Aditya):** slide the **Flood / Fire** switch (bottom right; click, drag or arrow keys) and FireSight slides in over the flood centre, which keeps running underneath. `#fire` in the URL opens it directly; `/netra/` now opens the Buildings tab.

## What the merged project adds

The team built three projects in parallel. This repo merges them into one app and keeps each original in its own folder.

| Folder | Owner | What it is | How it feeds the main app |
|---|---|---|---|
| [`Rohan/`](Rohan) | Rohan | SurgeForce: forecast backtest, terrain, optimiser, simulation, AI triage, agent | The core. Lives at the repo root (`app/`, `lib/`, `data/`). |
| [`Malik/`](Malik) | Malik | AI-NETRA-GEO: FastAPI + Next.js building intelligence on real OSM footprints, Google building heights, Musi distances, TGRAC waterlogging points | 11,659 real buildings ranked by flood exposure in the **Buildings** tab, and the AI-NETRA map at `/netra/`. |
| [`Aditya/`](Aditya) | Aditya | FireSight: fire-risk map, risk model, multi-channel alert delivery | FireSight runs at `/firesight/`; its fire-risk weights also score the real buildings (the **flood and fire together** list); alert delivery for approved alerts. |

Together: when SurgeForce confirms an area flooded, the Buildings tab shows which real buildings are most exposed, which are tall enough to be candidate refuges, and where a flood and a fire could coincide with the nearest real fire station far away or behind a flooded road. The agent has two extra tools for this (`building_exposure`, `flood_fire_hotspots`).

## Field & fix tools: every roadmap idea, working

A second row of tabs in SurgeForce turns the [IDEAS.md](IDEAS.md) roadmap into working tools (status of each idea in IDEAS.md, section 1b):

- **Water flow:** click any spot to see where its rain goes and what drains into it; culvert bottlenecks; lake breach paths with evacuation text in English and Telugu; drain overflow times from the forecast.
- **Official government data (TGRAC):** GHMC's 23 major waterlogging points and 1,048 surveyed nala segments with existing vs proposed widths (838 are under half the proposed width). Our model is checked against the official points: 52% of them sit where rain converges, against 30% of the city (1.76× lift).
- **Fix-it:** encroachment leads with ready complaints, blocked-drain tickets on an escalation clock (closed only with an AI-checked after-photo), an after-flood accountability report, and a plan that learns from each storm.
- **Vision (on-device AI):** photo → water depth → hazards → GHMC MyCURE complaint (try the 2020 Hyderabad flood sample photo), CCTV and dashcam video, culvert blockage, drone nala survey, drone search and rescue, change detection, camera-read water gauge, satellite view.
- **Live data:** official NDMA SACHET alerts, the public report page (`report.html`) and a WhatsApp webhook, hotspot water-level sensors (simulated, labelled), weather-station CSV import, message-board feed for TGiCCC, vulnerable facilities in the plan.
- **Safe route:** road routes scored by the flooded cells and closed underpasses they cross.

## Run it

Needs Node 21 or later. Nothing to install.

```bash
npm start       # http://localhost:8520 (static server; everything runs in the browser)
npm test        # 37 tests: planner, simulation, AI triage, agent, buildings, fire, drainage, vision rules, government data, AI-NETRA evidence rules, server
node scripts/e2e.mjs   # browser test of every tab (needs: npm i --no-save playwright@1.48.2 && npx playwright install chromium)
```

Optional: `npm run fetch-data` (refresh OSM/DEM/OSRM/GloFAS), `npm run backtest`, `npm run eval:intake`, `python scripts/build-buildings.py` (rebuild the building dataset from `Malik/`). The AI agent needs `ollama serve` with `llama3.1`, or an Anthropic API key pasted in the AI Assistant tab. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Real data and what is assumed

- **Real:** the forecasts (Open-Meteo ensembles, ECMWF AIFS, ERA5), terrain (Terrarium/SRTM), OSM police stations, fire stations, underpasses, nalas and the Musi, OSRM road times, GloFAS river discharge, GHMC/HYDRAA 2025 team counts, 11,659 OSM building footprints, Google Open Buildings 2.5D heights (model estimates), Telangana TGRAC government drainage GIS (waterlogging points, surveyed nala widths, tanks), NDMA SACHET official alerts, OSM lakes, culverts and vulnerable facilities.
- **Assumed and labelled in the app:** officers per station, team positions within a zone, incident rates, simulated citizen reports, hotspot sensor readings. Camera tools use a video you choose or your own camera until police feeds are shared.
- **Not claimed:** exposure is not flood probability, and no building is said to be flooded. FireSight's own dataset is synthetic; here only its published feature weights are reused, on real buildings.

## Safety rules

AI may escalate a report, never downgrade one the rules flagged. The agent cannot approve, dispatch or send. Every action needs commander approval and is logged. Police data stays on the device.

## Repo map

`app/` UI · `lib/` planner, simulation, AI, buildings, fire (shared by browser and tests) · `data/` committed real-data snapshot · `scripts/` data and evaluation pipelines · `test/` · `.github/` CI (unit tests, data checks, end-to-end browser test), Pages, CodeQL, hourly SACHET refresh · [`docs/`](docs) · [`RESEARCH.md`](RESEARCH.md), [`IDEAS.md`](IDEAS.md) · [`AGENTS.md`](AGENTS.md) for AI assistants.
