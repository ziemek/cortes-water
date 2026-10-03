#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RECORDS_DIR = path.resolve(__dirname, '../data/records');
const OUTPUT_FILE = path.resolve(__dirname, '../src/data/water-data.json');

// en-CA formats dates as YYYY-MM-DD
const pacificDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Vancouver',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Calendar date of the sampling in the lakes' local time
function getDateKey(dateString) {
  return pacificDateFormat.format(new Date(dateString));
}

// Each record file is data/records/<lake>/<YYYY-MM-DD>.json and must match
// the lake and Pacific date inside it.
function checkRecord(record, lakeDir, fileName) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return 'must contain a single record object';
  }
  if (!record.lake || !record.date || isNaN(new Date(record.date))) {
    return `missing lake or valid date (${record.lake}, ${record.date})`;
  }
  if (record.lake.toLowerCase() !== lakeDir) {
    return `lake "${record.lake}" does not match folder "${lakeDir}"`;
  }
  const expected = `${getDateKey(record.date)}.json`;
  if (fileName !== expected) {
    return `date ${record.date} should be in ${expected}`;
  }
  return null;
}

function mergeWaterData() {
  const records = [];
  const errors = [];

  const lakeDirs = fs
    .readdirSync(RECORDS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const lakeDir of lakeDirs) {
    const files = fs
      .readdirSync(path.join(RECORDS_DIR, lakeDir))
      .filter((file) => file.endsWith('.json'));

    for (const fileName of files) {
      const label = `${lakeDir}/${fileName}`;
      try {
        const record = JSON.parse(
          fs.readFileSync(path.join(RECORDS_DIR, lakeDir, fileName), 'utf8')
        );
        const error = checkRecord(record, lakeDir, fileName);
        if (error) {
          errors.push(`${label}: ${error}`);
          continue;
        }
        // source is provenance for editors, not app data
        const { source, ...appRecord } = record;
        records.push(appRecord);
      } catch (error) {
        errors.push(`${label}: ${error.message}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`Merge failed with ${errors.length} error(s):`);
    errors.forEach((error) => console.error(`  ${error}`));
    process.exit(1);
  }

  records.sort(
    (a, b) =>
      a.lake.localeCompare(b.lake) || new Date(a.date) - new Date(b.date)
  );

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(records, null, 2), 'utf8');

  const summary = records.reduce((acc, record) => {
    acc[record.lake] = (acc[record.lake] || 0) + 1;
    return acc;
  }, {});
  const counts = Object.entries(summary)
    .map(([lake, count]) => `${lake} ${count}`)
    .join(', ');
  console.log(
    `Wrote ${records.length} records to src/data/water-data.json (${counts})`
  );
}

if (require.main === module) {
  mergeWaterData();
}

module.exports = { mergeWaterData };
