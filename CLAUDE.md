# Cortes Water

Static D3 site charting lake-monitoring data (Gunflint and Hague lakes, Cortes Island). Plain ES modules in `src/js/`, no framework, no bundler. D3 v7 is loaded from a CDN in `src/index.html` and used as a global `d3`.

## Commands

- `npm start` — live-server on `src/` (does **not** re-run the data merge)
- `npm run merge-data` — rebuild `src/data/water-data.json` from the source files
- `npm run build` — merge, then copy `src/` to `dist/`
- `npm run format` / `format:check` — Prettier (JSON is ignored)

There are no tests and no linter. Pushing to `main` deploys to GitHub Pages via `.github/workflows/gh-pages.yml`.

## Data pipeline

- Every `*.json` in `src/data/` except `water-data.json` is a source file: an array of sampling records (`lake`, `date`, `measurements[]`, plus optional `samplers`, `weather`, `secchi_depth`, `nitrogen`, `phosphorus`, `data_notes`).
- `scripts/merge-data.js` merges them into `water-data.json`, the only file the app fetches. Never hand-edit `water-data.json`; it is committed, so regenerate it in the same commit as any source change.
- Records are keyed by lake + Pacific calendar date. The merge fails if a record has no `lake` or valid `date`, or if two records share a key, so each sampling must live in exactly one source file.
- `gunflint-lake.json` and `hague-lake.json` hold samplings through 2024, converted from the CSVs with `scripts/convert-csv.js`. Later samplings live in `water-quality.json` and the dated files.
- New samplings go in a new dated file (e.g. `2025-12-17.json`), one record per lake.
- `original-data/` holds the raw field-sheet CSVs. They are the source of truth for pre-2024 dates and are not read by the app or build.

## Dates

- Write `date` as ISO 8601 local Pacific time with its offset: `2025-12-17T14:30:00-08:00` (`-07:00` during daylight time is also fine). Never write a bare `YYYY-MM-DD`; it parses as UTC midnight and lands on the previous day.
- If the sampling time is unknown, use `T12:00:00` and say so in `data_notes`.
- In app code, group and display dates through the `America/Vancouver` helpers in `src/js/utils.js` (`getDateOnly`, `getYear`, `formatDate`), not `toISOString()` or `getFullYear()`, which use UTC or the viewer's timezone.

## Data quirks

- Some early records store dissolved oxygen in % rather than mg/L (see `data_notes`); nothing filters them out yet.
