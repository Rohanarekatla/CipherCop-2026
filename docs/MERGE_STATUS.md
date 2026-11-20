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

## Status

- Local run of all three pages checked in a browser. 22 automated tests pass.
- The GitHub Actions workflows (CI, Pages, CodeQL) are in the repo but have not run yet. They run on pull requests and pushes to `main`.
- All of this work is on the branch `submission/ai-vengers-merge`. `main` is still the initial commit.
- Not tested: the Claude and Ollama agent paths (they need an API key or a local model) and live forecast mode.

See also: `README.md`, `docs/ARCHITECTURE.md`, `docs/DATASETS.md`, `docs/SUBMISSION.md`.
