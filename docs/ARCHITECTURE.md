# Architecture

```
            forecasts (Open-Meteo 173-member ensemble)        OSM, DEM, OSRM, GloFAS
                     │ WHEN                                          │ WHERE
                     ▼                                               ▼
              lib/risk.js ── cost–loss rule ──►  lib/planner.js  ◄── terrain HAND (data/hand.json)
                                                │  pairCounterparts, allocate (lib/mcf.js)
 citizen reports ─► lib/intake.js + lib/ai/intake-ai.js   │
 (en/te/hi/ur, on-device AI)  ── confirms sector ─────────┤
                                                          ▼
   Malik/ data ─► scripts/build-buildings.py ─► data/buildings.json ─► lib/buildings.js (exposure)
   Aditya/ weights ───────────────────────────────────────────────► lib/fire.js (fire score, compound hazard)
                                                          │
                              lib/sim.js (Monte Carlo)    ▼
                              lib/ai/agent.js: 10 tools ─► app/app.js (MapLibre UI, human approval, audit log)
```

## Layers

| Layer | Files | Notes |
|---|---|---|
| Forecast (when) | `lib/weather.js`, `lib/risk.js`, `lib/calibrate.js` | Raw ensemble, because calibration overfit on about 15 events. Documented in the Evidence tab. |
| Terrain (where) | `scripts/fetch-hand.js`, `lib/risk.js` | HAND on 250 m cells, D8 routing, 260 OSM nalas. |
| Optimiser | `lib/planner.js`, `lib/mcf.js` | Exact min-cost flow, so every move is explainable. Not AI by design. |
| Proof | `lib/sim.js` | Monte Carlo with Pregnolato (2017) depth–speed disruption. |
| AI triage | `lib/ai/intake-ai.js`, `lib/intake.js` | multilingual-e5-small in the browser. Rules can override the AI upward only. |
| Agent | `lib/ai/agent.js` | 10 tools. Claude Opus 5.5 or local Llama through Ollama. |
| Buildings | `lib/buildings.js`, `data/buildings.json` | Exposure index from Musi and waterlogging distance, low-rise flag, refuge candidates. |
| Fire | `lib/fire.js` | FireSight importances on built-up area, density within 50 m, height, distance to nearest real fire station. |
| Alerts | `lib/cap.js`, `Aditya/api/notify.js` | CAP 1.2 XML (status Exercise). Twilio/Telegram delivery is optional, env-var driven, off by default. |

## Original projects, kept intact

- `Rohan/` is the SurgeForce repo as of the merge. The root copy continues from it.
- `Aditya/` is FireSight (static page plus a Vercel function). Its data is generated demo data. It runs standalone: serve the folder and open `index.html`.
- `Malik/` is AI-NETRA-GEO (FastAPI, Next.js, Earth Engine pipelines). Large videos and zip backups were left out of this repo to respect GitHub size limits; they remain in the original repo. Setup: `Malik/README.md`.

## Testing and CI

`npm test` runs `test/surgeforce.test.js` (planner, simulation, calibration, triage, agent) and `test/modules.test.js` (real-data integrity, exposure, fire, agent tools, alert delivery). CI also rebuilds the building dataset from `Malik/` and fails if it differs from the committed file, compiles the Python backend, and checks that the server serves the app files and refuses everything else.
