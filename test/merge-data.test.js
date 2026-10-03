const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkRecord, loadRecords } = require('../scripts/merge-data');

const record = (overrides = {}) => ({
  lake: 'Gunflint',
  date: '2025-12-17T14:30:00-08:00',
  source: 'test',
  measurements: [],
  ...overrides,
});

test('accepts a record whose lake and Pacific date match its path', () => {
  assert.strictEqual(
    checkRecord(record(), 'gunflint', '2025-12-17.json'),
    null
  );
});

test('uses the Pacific date, not the UTC date, for the file name', () => {
  // 17:30 Pacific is 01:30 UTC the next day
  const evening = record({ date: '2025-12-17T17:30:00-08:00' });
  assert.strictEqual(checkRecord(evening, 'gunflint', '2025-12-17.json'), null);
  assert.match(
    checkRecord(evening, 'gunflint', '2025-12-18.json'),
    /should be in 2025-12-17\.json/
  );
});

test('rejects arrays, missing dates and a lake in the wrong folder', () => {
  assert.match(
    checkRecord([record()], 'gunflint', '2025-12-17.json'),
    /single record object/
  );
  assert.match(
    checkRecord(record({ date: 'not a date' }), 'gunflint', '2025-12-17.json'),
    /missing lake or valid date/
  );
  assert.match(
    checkRecord(record(), 'hague', '2025-12-17.json'),
    /does not match folder/
  );
});

test('loadRecords reports invalid JSON and keeps valid records', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortes-records-'));
  fs.mkdirSync(path.join(dir, 'gunflint'));
  fs.writeFileSync(
    path.join(dir, 'gunflint', '2025-12-17.json'),
    JSON.stringify(record())
  );
  fs.writeFileSync(path.join(dir, 'gunflint', '2025-12-18.json'), '{"lake": }');

  const { records, errors } = loadRecords(dir);

  assert.deepStrictEqual(
    records.map((r) => r.label),
    ['gunflint/2025-12-17.json']
  );
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /^gunflint\/2025-12-18\.json: /);

  fs.rmSync(dir, { recursive: true });
});
