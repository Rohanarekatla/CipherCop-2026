# SurgeForce: one command centre for Hyderabad's monsoon

**CipherCop 2026 · Track 02 (AI for disaster response) · Team AI-vengers**

An AI command centre that decides, **before** a storm hits Hyderabad, which police, GHMC Monsoon Emergency Teams, HYDRAA rescue teams and volunteers should move where and when. A human commander approves every move. It runs on real public data, and it is tested.

**Live demo:** https://rohanarekatla.github.io/CipherCop-2026/ (deployed by [the Pages workflow](.github/workflows/pages.yml) once Pages is switched to "GitHub Actions" in the repo settings)

## The idea in four lines

1. We measured what AI weather forecasts can do for Hyderabad (backtest of the 2024 and 2025 monsoons). They predict **when** heavy rain hits the city (ROC 0.81) but not **where** inside it.
2. So a 173-member ensemble, including ECMWF's machine-learned AIFS model, decides **when** to mobilise. A terrain model (HAND on 7,021 cells) plus on-device AI that reads citizen reports in English, Telugu, Hindi and Urdu decides **where**.
3. An exact min-cost-flow optimiser stages teams and pre-assigns counterpart stations (Japan's *taiko shien*). A Monte Carlo simulation shows rescues reached within 30 minutes rise from 83% to 96%.
4. An AI agent (Claude Opus 5.5, or a local Llama so police data never leaves the building) answers the commander only by calling the planner's tools, so every number is grounded. It cannot approve or send anything.

## What the merged project adds

The team built three projects in parallel. This repo merges them into one app and keeps each original in its own folder.

| Folder | Owner | What it is | How it feeds the main app |
|---|---|---|---|
| [`Rohan/`](Rohan) | Rohan | SurgeForce: forecast backtest, terrain, optimiser, simulation, AI triage, agent | The core. Lives at the repo root (`app/`, `lib/`, `data/`). |
| [`Malik/`](Malik) | Malik | AI-NETRA-GEO: FastAPI + Next.js building intelligence on real OSM footprints, Google building heights, Musi distances, TGRAC waterlogging points | 11,659 real buildings ranked by flood exposure in the **Buildings** tab and on the map. |
| [`Aditya/`](Aditya) | Aditya | FireSight: fire-risk map, risk model, multi-channel alert delivery | Fire-risk weights score the same real buildings; the **flood and fire together** list; alert delivery for approved alerts. |

Together: when SurgeForce confirms an area flooded, the Buildings tab shows which real buildings are most exposed, which are tall enough to be candidate refuges, and where a flood and a fire could coincide with the nearest real fire station far away or behind a flooded road. The agent has two extra tools for this (`building_exposure`, `flood_fire_hotspots`).

## Run it

Needs Node 21 or later. Nothing to install.

```bash
npm start       # http://localhost:8520 (static server; everything runs in the browser)
npm test        # 19 tests: planner, simulation, AI triage, agent, buildings, fire, alert delivery
```

Optional: `npm run fetch-data` (refresh OSM/DEM/OSRM/GloFAS), `npm run backtest`, `npm run eval:intake`, `python scripts/build-buildings.py` (rebuild the building dataset from `Malik/`). The AI agent needs `ollama serve` with `llama3.1`, or an Anthropic API key pasted in the AI Assistant tab. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Real data and what is assumed

- **Real:** the forecasts (Open-Meteo ensembles, ECMWF AIFS, ERA5), terrain (Terrarium/SRTM), OSM police stations, fire stations, underpasses, nalas and the Musi, OSRM road times, GloFAS river discharge, GHMC/HYDRAA 2025 team counts, 11,659 OSM building footprints, Google Open Buildings 2.5D heights (model estimates), Telangana TGRAC waterlogging points.
- **Assumed and labelled in the app:** officers per station, team positions within a zone, incident rates, simulated citizen reports.
- **Not claimed:** exposure is not flood probability, and no building is said to be flooded. FireSight's own dataset is synthetic; here only its published feature weights are reused, on real buildings.

## Safety rules

AI may escalate a report, never downgrade one the rules flagged. The agent cannot approve, dispatch or send. Every action needs commander approval and is logged. Police data stays on the device.

## Repo map

`app/` UI · `lib/` planner, simulation, AI, buildings, fire (shared by browser and tests) · `data/` committed real-data snapshot · `scripts/` data and evaluation pipelines · `test/` · `.github/` CI, Pages, CodeQL · [`docs/`](docs) · [`RESEARCH.md`](RESEARCH.md), [`IDEAS.md`](IDEAS.md) · [`AGENTS.md`](AGENTS.md) for AI assistants.
