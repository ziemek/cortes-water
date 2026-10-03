# Cortes Water

Static D3 site charting lake-monitoring data (Gunflint and Hague lakes, Cortes Island). Plain ES modules in `src/js/`, no framework, no bundler. D3 v7 is loaded from a CDN in `src/index.html` and used as a global `d3`. When changing its version, update the `integrity` hash too; CI fails if it doesn't match the CDN file.

## Commands

- `npm start` — merge, then five-server (live reload) on `src/` at http://localhost:5500 (edits to records need `npm run merge-data` while it runs)
- `npm run merge-data` — rebuild `src/data/water-data.json` from `data/records/`
- `npm run build` — merge, then copy `src/` to `dist/`
- `npm run format` / `format:check` — Prettier (JSON is ignored)
- `npm run validate-data` — check records for implausible values; issues listed in `scripts/known-data-issues.json` are ignored
- `npm test` — `node:test` tests for the scripts in `test/` (none for the app code)

There is no linter. Pull requests run `.github/workflows/ci.yml` (format, validate-data, test, build, D3 integrity hash). Pushing to `main` runs the same checks, then deploys to GitHub Pages via `.github/workflows/gh-pages.yml` (Pages actions, not a `gh-pages` branch).

## Data pipeline

See `data/README.md` for the layout, record format and how to add a sampling. Key rules:

- `data/records/<lake>/<YYYY-MM-DD>.json` holds one sampling per file and is the source of truth. The merge fails if a file's `lake` or Pacific date doesn't match its path.
- `data/raw/` holds legacy CSVs and unedited OCR output. Never edit it; the build doesn't read it.
- `src/data/water-data.json` is generated and gitignored. Never hand-edit it.

## Dates

- Write `date` as ISO 8601 local Pacific time with its offset: `2025-12-17T14:30:00-08:00` (`-07:00` during daylight time is also fine). Never write a bare `YYYY-MM-DD`; it parses as UTC midnight and lands on the previous day.
- If the sampling time is unknown, use `T12:00:00` and say so in `data_notes`.
- In app code, group and display dates through the `America/Vancouver` helpers in `src/js/utils.js` (`getDateOnly`, `getYear`, `formatDate`), not `toISOString()` or `getFullYear()`, which use UTC or the viewer's timezone.
