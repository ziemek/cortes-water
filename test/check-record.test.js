const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  formatRecord,
  sanityWarnings,
} = require('../.claude/skills/add-sampling/scripts/check-record');

const RECORDS_DIR = path.join(__dirname, '../data/records');

const profile = (rows) =>
  rows.map(([depth, temperature, DO, SPC, TDS, PH]) => ({
    depth,
    temperature,
    DO,
    SPC,
    TDS,
    PH,
  }));

const cleanRecord = () => ({
  lake: 'Hague',
  date: '2025-08-19T10:15:00-07:00',
  source: 'ocr/2025-08-19-hague.json',
  station: 'DWH',
  samplers: ['Gina', 'Carrie'],
  secchi_depth: [2.1, 2.3],
  measurements: profile([
    [0, 20.5, 8.33, 51.4, 33.15, 7.31],
    [1, 20.5, 8.2, 51.4, 33.15, 7.5],
    [2, 20.5, 8.1, 51.4, 33.15, 7.54],
    [3, 20.5, 8.24, 51.4, 33.15, 7.55],
  ]),
});

test('formatRecord reproduces the layout of existing records', () => {
  const file = path.join(RECORDS_DIR, 'hague/2025-12-17.json');
  const text = fs.readFileSync(file, 'utf8');
  assert.strictEqual(formatRecord(JSON.parse(text)), text);
});

test('formatRecord orders keys and keeps unknown keys before measurements', () => {
  const formatted = formatRecord({
    measurements: [{ PH: 7, depth: 0 }],
    ocr_notes: ['5 overwritten on 3'],
    date: '2025-08-19T10:15:00-07:00',
    lake: 'Hague',
  });
  assert.strictEqual(
    formatted,
    [
      '{',
      '  "lake": "Hague",',
      '  "date": "2025-08-19T10:15:00-07:00",',
      '  "ocr_notes": ["5 overwritten on 3"],',
      '  "measurements": [',
      '    {"depth": 0, "PH": 7}',
      '  ]',
      '}',
      '',
    ].join('\n')
  );
});

test('a clean record has no warnings', () => {
  assert.deepStrictEqual(sanityWarnings(cleanRecord()), []);
});

test('warns about a standard-time offset during daylight time', () => {
  const record = { ...cleanRecord(), date: '2025-08-19T10:15:00-08:00' };
  assert.deepStrictEqual(sanityWarnings(record), [
    'date offset -08:00 should be -07:00 on that day',
  ]);
});

test('warns about combined sampler names and the wrong station', () => {
  const record = {
    ...cleanRecord(),
    station: 'DWG',
    samplers: ['Gina and Carrie'],
  };
  assert.deepStrictEqual(sanityWarnings(record), [
    'station "DWG" should be "DWH"',
    'samplers entry "Gina and Carrie" should be one person',
  ]);
});

test('warns about TDS that does not follow SPC', () => {
  const record = cleanRecord();
  record.measurements[3].TDS = 25.9;
  assert.deepStrictEqual(sanityWarnings(record), [
    'TDS is not about 0.65 x SPC at 3m SPC=51.4 TDS=25.9',
    'TDS is not a multiple of 0.65 at 3m=25.9',
    'TDS out of line with the profile at 3m=25.9',
  ]);
});

test('warns about a single misread depth and a missing row', () => {
  const record = cleanRecord();
  record.measurements[1].PH = 8.15;
  record.measurements.splice(2, 1);
  record.measurements.push(
    ...profile([
      [4, 20.5, 8.35, 51.5, 33.15, 7.56],
      [5, 20.5, 7.98, 51.5, 33.15, 7.56],
    ])
  );
  assert.deepStrictEqual(sanityWarnings(record), [
    'no readings between 1m and 3m',
    'PH out of line with the profile at 1m=8.15',
  ]);
});
