# Submission checklist

I (the assistant that merged the repos) did not have the official CipherCop rules, so this list follows the team's own docs (`RESEARCH.md`, `IDEAS.md`). Check it against the organisers' brief.

## Done

- [x] One repo with the three team folders (`Rohan/`, `Aditya/`, `Malik/`) and the merged product at the root
- [x] Real data end to end, synthetic parts labelled
- [x] AI at every stage: ensemble incl. ECMWF AIFS, on-device multilingual triage, AI agent over a tested planner
- [x] 19 automated tests, CI on every push, CodeQL, Dependabot
- [x] Demo script and judge Q&A (`RESEARCH.md`), team overview (`OVERVIEW.md`), roadmap (`IDEAS.md`)

## Needs the team

- [ ] Turn on GitHub Pages: Settings, Pages, Source = **GitHub Actions**. Then the live link in `README.md` works.
- [ ] Record a 3 to 5 minute demo video (Malik's `docs/demo/demo_NETRA.mp4` is not in this repo because of its size; link it from the original repo or upload it to a release).
- [ ] Add a licence the team agrees on (none is included yet).
- [ ] Test the Claude agent path end to end with a real API key (only the local Llama path was verified, per `AGENTS.md` section 10).
- [ ] Decide on Twilio: alert delivery is off unless env vars are set. Do not put real police phone numbers in the repo.
- [ ] Fill the team names and contact into the submission form.

## Honest limits to say out loud

- Only one replay event (31 Aug to 2 Sep 2024) has full previous-runs forecasts.
- Officer and team rosters are assumptions until GHMC or police data is available.
- Building exposure is a ranking, not a flood prediction. Heights are model estimates.
- FireSight's demo buildings are generated; only its feature weights are reused.
