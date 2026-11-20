# Merge status: three repos, one repo, one website

Team AI-vengers, CipherCop 2026, Track 2. This file says what was merged, what each tool became, and what is not the same as the original.

## One repo

The three team repos are kept as they were, and the merged product is at the repo root.

| Folder | Owner | Original repo |
|---|---|---|
| `Rohan/` | Rohan | https://github.com/Rohanarekatla/hyd-short-staff |
| `Aditya/` | Aditya | https://github.com/Sriram-Aditya-Manje/CipherCop-colab |
| `Malik/` | Malik | https://github.com/mallinitc/As_I_Know (folder `Hack/AI-NETRA-GEO`) |

The root (`app/`, `lib/`, `data/`, `scripts/`, `test/`, `.github/`) continues from Rohan's SurgeForce and adds the other two.

## One website

Run `npm start` and open http://localhost:8520. A switcher at the bottom of every page moves between the three tools.

| URL | Tool | Source |
|---|---|---|
| `/` | SurgeForce command centre (forecast, plan, reports, agent, Buildings tab) | Rohan |
| `/firesight/` | FireSight fire-risk map and incident flow | Aditya (site copied in) |
| `/netra/` | AI-NETRA building map: click any of 11,659 real buildings | Malik (rebuilt as a static page) |

## What the tools share

- The SurgeForce **Buildings** tab and the `/netra/` map use the same 11,659 real OpenStreetMap buildings (`data/buildings.json`, built from `Malik/data` by `scripts/build-buildings.py`).
- FireSight's published feature weights score those buildings for fire risk (`lib/fire.js`), giving the "flood and fire together" list.
- The SurgeForce AI agent has two tools for this: `building_exposure` and `flood_fire_hotspots`.

## What is not the same as the originals

- **AI-NETRA is a lighter version.** Malik's original is a Next.js frontend with a FastAPI backend (building polygons, Sentinel-1 radar evidence). A static site cannot run that, so `/netra/` shows buildings as points from the same real data. The full stack remains in `Malik/` and needs Python to run.
- **FireSight alert sending is off on static hosting.** Its Twilio and Telegram function (`Aditya/api/notify.js`) needs a Vercel-style server. The page shows alert delivery as unavailable. FireSight's buildings and incidents are generated demo data and are labelled that way.
- **Left out of this repo:** Malik's three videos (about 200 MB) and zip backups, to respect GitHub size limits. They remain in his original repo.

## Field & fix tools added (branch `submission/field-and-fix`)

Rohan's later SurgeForce work (v0.5, after the copy in `Rohan/`) is merged into the root: the Water flow, Fix-it, Vision, Live data and Safe route tabs (`app/ideas.js`, `lib/water.js`, `lib/vision.js`), the public report page (`report.html`), the server's field-input APIs, NDMA SACHET alerts with an hourly GitHub Action, and the Telangana TGRAC government drainage data (`data/tgrac/`). Also fixed:

- the server crashed on any request whose path starts with `//` (it now answers 400);
- the Method tab crashed because it read `assumptions` from `base.json`, which has none (this bug was also in `Rohan/`);
- a browser end-to-end test (`scripts/e2e.mjs`) now opens every tab in CI.

## One flood product (SurgeForce + AI-NETRA) and the Flood / Fire switch

AI-NETRA is no longer a separate lighter page. Its features live in SurgeForce's Buildings tab (`app/netra.js`, `lib/netra.js`, data built from `Malik/data` by `scripts/build-netra.js`): 3D footprints at real heights, click-to-identify with nearby candidates, every evidence section of Malik's map (height, area, Musi and waterlogging proximity, 2020 flood map, Sentinel-1 radar for his 40 targeted buildings, source investigation, evidence quality and provenance), his demo incidents (labelled synthetic), and his rescue-readiness rule ported from `Malik/scripts/assess_rescue_readiness.py` and `classify_evidence_quality.py`. SurgeForce field inputs (reports, photos, CCTV, gauges) become his current-incident evidence, and an officer's ground verification completes it for human review. `/netra/` redirects there. FireSight is reached by a slide switch instead of a link.

Still only in `Malik/`: the FastAPI service and Next.js app themselves (Python), and his computer-vision notebook.

## Status

- Local run of all three pages checked in a browser. 37 automated tests and the end-to-end browser test pass.
- The GitHub Actions workflows (CI, Pages, CodeQL) are in the repo but have not run yet. They run on pull requests and pushes to `main`.
- All of this work is merged into `main` (pull request #1, every CI job passing).
- Not tested: the Claude and Ollama agent paths (they need an API key or a local model) and live forecast mode.

See also: `README.md`, `docs/ARCHITECTURE.md`, `docs/DATASETS.md`, `docs/SUBMISSION.md`.
