# FireSight (Aditya)

Fire-risk map and response page for Hyderabad: a risk model, route planning, and alert delivery through `api/notify.js` (Twilio and Telegram; off unless the environment variables in that file are set).

All buildings, records and incidents in this folder's demo are **generated**. The main app reuses only the published feature importances in `data/model.json`, applied to real OSM buildings (see `lib/fire.js` at the repo root).

Run standalone: serve this folder with any static server and open `index.html`.
