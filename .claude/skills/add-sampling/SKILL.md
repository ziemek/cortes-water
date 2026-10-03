---
name: add-sampling
description: Transcribe a photo of a Gunflint/Hague Lake field sheet (handwritten water-quality profile) into this repo's data, writing the literal OCR to data/raw/ocr/ and a verified record to data/records/. Use whenever the user shares or points to a field-sheet photo, JPEG or scan, or asks to OCR, add, import, enter or re-transcribe a sampling.
---

# Add a sampling from a field-sheet photo

Turns one field-sheet photo into, for each lake on it:

1. `data/raw/ocr/<YYYY-MM-DD>-<lake>.json` (lake in lower case, as in the records folder): what the sheet says, as first read. Write once, never edit.
2. `data/records/<lake>/<YYYY-MM-DD>.json`: the cleaned, verified record the app uses.

This follows "Adding a sampling" in `data/README.md`; read it and the "Dates" section of `CLAUDE.md` first. The repo
doesn't keep photos, so the raw file is the earliest copy that survives. Tell the user to keep the photo until the
record is verified, and never delete or modify it yourself.

Accuracy matters more than speed. Past OCR of these sheets dropped whole rows, shifted the pH column by a row, turned
"Gina" into "Grace", and stored 27.95 for a written 37.05. Never fill a gap by interpolation or invent a value. When
unsure, ask.

## The field sheet

A ring-binder spread, usually one lake per page, typically Gunflint on the left and Hague on the right. Page order is
not reliable, though.

- **Header**: date with weekday (e.g. "Tuesday, Aug 19, 2025"; crossed-out corrections are common), then the lake name.
  The lake name is sometimes missing.
- **Date/time**: e.g. `9:30AM`, `10:15 AM`, or `13:30 PM` (24-hour with a redundant PM, so 13:30).
- **Who**: samplers, e.g. "Gina & Carrie". Gina's own "Gina" reads like "Gima".
- **Weather**: free text. **Secchi**: two readings in metres. **Air Temp**: °C, sometimes squeezed in small.
- Sometimes UTM coordinates, e.g. `10 N 360043 / E 5548176 N`, boxed or squeezed beside the header.
- **Table**: `Depth | °C | DO mg/L | SPC | TDS | pH`, one row per metre from 0 down to about 14–16.
  - Values carry trailing zeros (`35.10`). Digits are often overwritten, e.g. a 5 written over a 3.
  - Ditto marks (`"`) repeat the value above.
- **Note**: free text at the bottom of the page.

If a sheet doesn't match this description, tell the user what differs and offer to update this section.

## Workflow

### 1. Find the photo and the date

- Prefer a file path, since you can crop it. A photo pasted into the chat is usually saved too: look for its
  `[Image: source: …]` path. That copy is downscaled to about 2000 px wide, which is enough for crops, but ask for
  the original when a cell is still hard to read.
- For each page, identify the lake from its header. If a page has no lake name, don't assume. Propose the lake implied
  by the other page and the number of depths (Gunflint about 16–17 m, Hague 14–15 m), and have the user confirm.
- Read the date and check the written weekday: `date -j -f %Y-%m-%d 2025-10-05 +%A`. If the sheet omits the year,
  check the photo's capture date: `mdls -name kMDItemContentCreationDate <photo>`.
- If `data/raw/ocr/<date>-<lake>.json` or `data/records/<lake>/<date>.json` already exists, stop and ask. The raw file
  is write-once. An existing record is replaced only if the user wants a re-transcription.

### 2. Read the sheet carefully

The image you see is downscaled. Work from crops of the full-resolution photo in the scratchpad (macOS `sips`):

```bash
sips -g pixelWidth -g pixelHeight photo.jpg
sips -c <height> <width> --cropOffset <y> <x> photo.jpg --out <scratchpad>/gunflint-table.jpg
```

Crop each page's header, then its table. Split the table into strips of 2–3 columns if digits are small, and zoom
into any doubtful cell. If the photo is rotated, use `sips -r 90`.

- Read the table **column by column**, not row by row. Each column must have exactly as many entries as there are
  depth labels. If a column has one more or one fewer, the rows are misaligned: depth labels often sit half a row
  off, and the pH column is the usual culprit. Re-read before going on.
- As you read, list every cell you're not sure of (overwritten, smudged, ambiguous digit such as 1/7, 3/8, 5/6, 0/6,
  or a missing decimal point) with your best reading and the alternatives.

### 3. Write the raw OCR file

Write `data/raw/ocr/<YYYY-MM-DD>-<lake>.json` in record shape, recording what the sheet says without corrections:

- `lake`, `date` (the written date and time as ISO with the correct Pacific offset, see below), `source` (the photo's
  file name, or `"photo pasted in chat"`), `samplers` as written (`["Gima", "Carrie"]`), `weather`,
  `air_temperature`, `secchi_depth`, `measurements` (your first reading of each cell).
- `sheet_note`: the bottom note verbatim. `coordinates`: as written, if present.
- Ditto marks stay as the string `"\""`. Use `null` for a blank cell.
- `ocr_notes`: an array listing each uncertain cell (`"Gunflint 12m SPC: 58.1 or 53.1, 5 overwritten on 3"`), anything
  crossed out, and how the lake was identified if the page was unlabeled.

Then run `node .claude/skills/add-sampling/scripts/check-record.js --format-only <raw file>` once to apply the house
JSON layout. From here on, never edit the raw file.

### 4. Build the record

Copy the raw file to `data/records/<lake>/<YYYY-MM-DD>.json`, then clean it:

| Field             | Rule                                                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lake`            | `"Gunflint"` or `"Hague"`, matching the folder.                                                                                                                                                                                                                                             |
| `date`            | `YYYY-MM-DDTHH:MM:00` plus the offset in effect that day: `-07:00` during daylight time (second Sunday of March to first Sunday of November), `-08:00` otherwise; `check-record.js` warns if it's wrong. The file name is the Pacific date. If there's no time, see "Missing values" below. |
| `source`          | `"ocr/<YYYY-MM-DD>-<lake>.json"`.                                                                                                                                                                                                                                                           |
| `station`         | Always: `"DWG"` for Gunflint, `"DWH"` for Hague.                                                                                                                                                                                                                                            |
| `samplers`        | One person per entry, `["Gina", "Carrie"]`. Match names against the roster below. Confirm with the user any name not on it before writing it.                                                                                                                                               |
| `weather`         | As written, spelling fixed, lower case.                                                                                                                                                                                                                                                     |
| `air_temperature` | Number in °C.                                                                                                                                                                                                                                                                               |
| `secchi_depth`    | Both readings as numbers, `[4.2, 4.7]`.                                                                                                                                                                                                                                                     |
| `measurements`    | `{depth, temperature, DO, SPC, TDS, PH}` per row, numbers only, with ditto marks resolved to the value above. `null` for a blank or unreadable cell, never a guess.                                                                                                                         |
| `data_notes`      | Only when there's something to say: the sheet note, coordinates (`"UTM 10N 360043 E 5548176 N"`), borrowed or assumed values, and any recorded value that differs from what's written (with the reason).                                                                                    |
| others            | `nitrogen`, `phosphorus` only if the sheet gives them. Drop `sheet_note`, `coordinates` and `ocr_notes`.                                                                                                                                                                                    |

Units are implicit. If DO looks like % saturation (values around 80–130) instead of mg/L, ask; don't convert.

**Missing values.** If one lake's page lacks the time or weather, ask the user, offering the other lake's value from
the same day as the default. If they accept, record "time/weather taken from the Hague sheet" in `data_notes`. If
there's no time at all, use `T12:00:00` and say so in `data_notes`.

### 5. Check and resolve doubts

```bash
node .claude/skills/add-sampling/scripts/check-record.js --format data/records/<lake>/<date>.json ...
```

This rewrites the files in the house layout and reports:

- **ERROR**: the merge or `validate-data` would reject the record.
- **WARN**: readings to re-examine. The checks are a wrong time zone offset, out-of-hours time, a station mismatch,
  combined sampler names, depth gaps or depths too deep for the lake, TDS not ≈ 0.65 × SPC or not a multiple of 0.65,
  DO > 20, and a single depth out of line with its neighbours.
- **Context**: the lake's previous sampling and the other lake's same-day sampling.

For every warning, zoom into that cell again. Many warnings are real misreads. Others are real lake behaviour (see
"What's normal" below) or the sampler's own slip, and those stay as written.

Then ask the user **once**, with every open question together:

- Each doubtful cell with your reading, the alternatives and why it's doubtful (overwritten, a warning, an ambiguous
  digit). Use AskUserQuestion when there are 4 or fewer with clear options. Otherwise list them in a table and ask the
  user to reply.
- Any unlabeled lake, unknown sampler name, or missing time or weather not yet settled.

Apply the answers to the record only, then re-run the check.

### 6. Validate and report

Run `npm run validate-data`. Don't add issues to `scripts/known-data-issues.json` unless the user asks. Then report:

- Files written.
- `git diff --no-index data/raw/ocr/<file> data/records/<lake>/<file>`, which shows what was corrected from the raw
  reading.
- Each lake's profile as a compact table with corrected or confirmed-doubtful cells in bold, so the user can scan it
  against the photo.
- Warnings that remain, and why they were kept.

Stop there. Don't commit, open a PR or start the app unless asked.

## Reference

### Sampler roster

Regulars: Gina, Carrie, Max, Heidi. Others who have sampled: Akshara, Alma, Andrew, Ania, Autumn, Helen, Lisa, Manuel,
Mary, Mary Claire, Michelle, Norleen, Sarah, Slawka, Sue, Wisia, Xavier, Ziemek. Known misreads include "Gima", "Gino",
"Grace" and "Gimel" for Gina, and "Ziemer" for Ziemek. Add new people here once the user confirms them.

### What's normal

These ranges are taken from 2019–2025 records. Values outside them aren't wrong, but recheck the sheet.

| Measure         | Gunflint                                                                 | Hague                                                                                    |
| --------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Depths          | 0–16 m (17 rarely)                                                       | 0–14 m (15–16 sometimes)                                                                 |
| Temperature     | 3–25 °C, falling with depth in summer                                    | 3–25 °C                                                                                  |
| DO mg/L         | 2.5–14                                                                   | 1–15; 1–4 below about 9 m in late summer and fall                                        |
| SPC µS/cm       | 44–58                                                                    | 45–55, rising to 60–95 below about 9 m in late summer and fall (TDS rises along with it) |
| TDS mg/L        | 0.65 × SPC, nearly always a multiple of 0.65                             | same                                                                                     |
| pH              | 5.7–8.5                                                                  | 5.7–8.5                                                                                  |
| Secchi          | 2–7 m, two readings within about 1 m                                     | same                                                                                     |
| Air temperature | Often reads several °C warmer than Hague's the same day; keep as written | —                                                                                        |

A thermocline (sharp drops in temperature and DO over 1–3 m) is real, as is the bottom-water rise in SPC and TDS at
Hague. A single depth that departs from both neighbours and returns is usually a misread.
