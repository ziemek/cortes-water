# Cortes Water

Static D3 site charting lake-monitoring data (Gunflint and Hague lakes, Cortes Island). Plain ES modules in `src/js/`, no framework, no bundler. D3 v7 is loaded from a CDN in `src/index.html` and used as a global `d3`.

## Commands

- `npm start` — merge, then live-server on `src/` (edits to records need `npm run merge-data` while it runs)
- `npm run merge-data` — rebuild `src/data/water-data.json` from `data/records/`
- `npm run build` — merge, then copy `src/` to `dist/`
- `npm run format` / `format:check` — Prettier (JSON is ignored)

There are no tests and no linter. Pushing to `main` deploys to GitHub Pages via `.github/workflows/gh-pages.yml`.

## Data pipeline

See `data/README.md` for the layout, record format and how to add a sampling. Key rules:

- `data/records/<lake>/<YYYY-MM-DD>.json` holds one sampling per file and is the source of truth. The merge fails if a file's `lake` or Pacific date doesn't match its path.
- `data/raw/` holds legacy CSVs and unedited OCR output. Never edit it; the build doesn't read it.
- `src/data/water-data.json` is generated and gitignored. Never hand-edit it.

## Dates

- Write `date` as ISO 8601 local Pacific time with its offset: `2025-12-17T14:30:00-08:00` (`-07:00` during daylight time is also fine). Never write a bare `YYYY-MM-DD`; it parses as UTC midnight and lands on the previous day.
- If the sampling time is unknown, use `T12:00:00` and say so in `data_notes`.
- In app code, group and display dates through the `America/Vancouver` helpers in `src/js/utils.js` (`getDateOnly`, `getYear`, `formatDate`), not `toISOString()` or `getFullYear()`, which use UTC or the viewer's timezone.
