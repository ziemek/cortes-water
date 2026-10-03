const { test } = require('node:test');
const assert = require('node:assert');
const { validateRecord } = require('../scripts/validate-data');

const validRecord = () => ({
  lake: 'Gunflint',
  date: '2025-12-17T14:30:00-08:00',
  source: 'ocr/2025-12-17-gunflint.json',
  air_temperature: 14.5,
  secchi_depth: [5.0, 3.5],
  measurements: [
    { depth: 0, temperature: 7.0, DO: 12.3, SPC: 42.0, TDS: 24.7, PH: 6.92 },
    { depth: 1, temperature: null, DO: null, SPC: null, TDS: null, PH: null },
  ],
});

const validate = (record) =>
  validateRecord('gunflint/2025-12-17.json', record).map((issue) =>
    issue.replace('gunflint/2025-12-17.json: ', '')
  );

test('accepts a valid record, including null (unmeasured) values', () => {
  assert.deepStrictEqual(validate(validRecord()), []);
});

test('reports an unknown lake and a missing source', () => {
  const record = { ...validRecord(), lake: 'Gunflnt', source: '' };
  assert.deepStrictEqual(validate(record), [
    'unknown lake "Gunflnt"',
    'missing source',
  ]);
});

test('groups out-of-range values and repeated depths per record', () => {
  const record = validRecord();
  record.measurements = [
    { depth: 0, DO: 119.2, PH: 7 },
    { depth: 1, DO: 112, PH: '7.1' },
    { depth: 1, DO: 10, PH: 7 },
  ];

  assert.deepStrictEqual(validate(record), [
    'repeated depths 1',
    'DO outside 0..20 at 0m=119.2, 1m=112',
    'PH not a number at 1m="7.1"',
  ]);
});

test('checks record-level fields', () => {
  const record = { ...validRecord(), air_temperature: 70, secchi_depth: [-1] };
  assert.deepStrictEqual(validate(record), [
    'air_temperature=70 outside -20..45',
    'secchi_depth=-1 outside 0..30',
  ]);
});

test('reports measurements that are not an array or lack a depth', () => {
  assert.deepStrictEqual(validate({ ...validRecord(), measurements: null }), [
    'measurements is not an array',
  ]);
  assert.deepStrictEqual(
    validate({ ...validRecord(), measurements: [{ DO: 10 }] }),
    ['measurement without numeric depth']
  );
});
