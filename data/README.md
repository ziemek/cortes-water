# Data

| Folder            | Contents                                                      | Edit?                    |
| ----------------- | ------------------------------------------------------------- | ------------------------ |
| `raw/csv/`        | Field-sheet transcriptions, 2019 – Oct 2024                   | No                       |
| `raw/ocr/`        | OCR output, exactly as produced, one file per field sheet     | No, write once           |
| `records/<lake>/` | Verified samplings, one `<YYYY-MM-DD>.json` file per sampling | Yes, the source of truth |

`npm run merge-data` (run automatically by `npm start` and `npm run build`) combines `records/` into
`src/data/water-data.json`, the only file the app loads. That file is generated and not committed.

Field-sheet photos are discarded after OCR, so `raw/ocr/` is the earliest copy of a sampling that we keep.

## Adding a sampling

1. OCR the field sheet and save the output as `raw/ocr/<YYYY-MM-DD>-<lake>.json`. Don't edit it afterwards.
2. Copy it to `records/<lake>/<YYYY-MM-DD>.json` (Pacific date of the sampling), as a single object, not an array.
3. Check every value against the sheet and fix the record. `diff` against the OCR file shows what was corrected.
4. Set `"source": "ocr/<YYYY-MM-DD>-<lake>.json"`.
5. Run `npm start` and check the charts.

To correct an existing sampling, edit its file in `records/` directly.

## Record format

Each record file holds one JSON object:

- `lake`: `"Gunflint"` or `"Hague"`, matching the folder name.
- `date`: local Pacific time with its offset, e.g. `2025-12-17T14:30:00-08:00`. Never a bare `YYYY-MM-DD`, which parses
  as UTC midnight and lands on the previous day. If the time is unknown, use `T12:00:00` and say so in `data_notes`.
- `source`: where the record came from (a path under `raw/`, or a note). Not passed to the app.
- `measurements`: one `{depth, temperature, DO, SPC, TDS, PH}` object per depth.
- Optional: `station`, `samplers`, `weather`, `air_temperature`, `secchi_depth`, `nitrogen`, `phosphorus`,
  `data_notes`.

The merge fails if a file isn't a single object, or if its `lake` or Pacific `date` doesn't match its path.

## History

Records up to Oct 2024 were converted from `raw/csv/`. Later records were OCR'd and cleaned before this layout existed,
and their raw OCR output wasn't kept. Each record's `source` says which applies.

Some early records store dissolved oxygen in % rather than mg/L (see `data_notes`); nothing filters them out yet.
