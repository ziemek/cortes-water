#!/usr/bin/env node

// Usage: node check-record.js [--format | --format-only] <record.json>...
//
// Checks sampling records more strictly than validate-data: lake-specific
// depths, TDS against SPC, single-depth spikes and time zone offset. Also
// prints the lake's previous sampling and the other lake's same-day sampling
// for comparison. Errors exit 1; warnings are readings to recheck against the sheet.
// --format first rewrites each file in the repository's record layout;
// --format-only rewrites without checking, for raw OCR files.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const { checkRecord, loadRecords } = require(
  path.join(REPO_ROOT, 'scripts/merge-data')
);
const { validateRecord } = require(
  path.join(REPO_ROOT, 'scripts/validate-data')
);

const RAW_DIR = path.join(REPO_ROOT, 'data/raw');
const RECORDS_DIR = path.join(REPO_ROOT, 'data/records');

const LAKES = {
  Gunflint: { station: 'DWG', maxDepth: 17 },
  Hague: { station: 'DWH', maxDepth: 16 },
};

const KEY_ORDER = [
  'lake',
  'date',
  'source',
  'station',
  'samplers',
  'weather',
  'air_temperature',
  'secchi_depth',
  'nitrogen',
  'phosphorus',
  'data_notes',
  'measurements',
];
const MEASUREMENT_KEYS = ['depth', 'temperature', 'DO', 'SPC', 'TDS', 'PH'];

// A reading that differs from both neighbours in the same direction by more
// than this is more likely a misread than a real feature of the profile.
const SPIKE_THRESHOLDS = { temperature: 1.5, DO: 2, SPC: 4, TDS: 3, PH: 0.4 };
// The meter reports TDS as a whole-number conductivity times this constant,
// so TDS readings are almost always multiples of it.
const TDS_FACTOR = 0.65;
const TDS_TOLERANCE = 2;
const DAYLIGHT_HOURS = [8, 20];

const isNumber = (value) => typeof value === 'number' && !Number.isNaN(value);

function orderKeys(object, order) {
  const known = order.filter((key) => key in object);
  const rest = Object.keys(object).filter((key) => !order.includes(key));
  // Unknown keys go before measurements so the profile stays last
  const measurementsAt = known.indexOf('measurements');
  if (measurementsAt === -1) return [...known, ...rest];
  return [
    ...known.slice(0, measurementsAt),
    ...rest,
    ...known.slice(measurementsAt),
  ];
}

const inline = (value) =>
  Array.isArray(value)
    ? `[${value.map(inline).join(', ')}]`
    : value && typeof value === 'object'
      ? `{${Object.entries(value)
          .map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`)
          .join(', ')}}`
      : JSON.stringify(value);

/**
 * Serialises a record like the existing files: two-space indent, arrays and
 * objects on one line, one measurement per line.
 */
function formatRecord(record) {
  const lines = orderKeys(record, KEY_ORDER).map((key) => {
    const value = record[key];
    if (key === 'measurements' && Array.isArray(value)) {
      const rows = value.map((m) => {
        const ordered = Object.fromEntries(
          orderKeys(m, MEASUREMENT_KEYS).map((k) => [k, m[k]])
        );
        return `    ${inline(ordered)}`;
      });
      return rows.length
        ? `  "measurements": [\n${rows.join(',\n')}\n  ]`
        : '  "measurements": []';
    }
    return `  ${JSON.stringify(key)}: ${inline(value)}`;
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}

const pacificParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Vancouver',
  hour: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'longOffset',
});

// Hour of day and UTC offset ("-08:00") in Pacific time
function pacificTime(date) {
  const parts = Object.fromEntries(
    pacificParts.formatToParts(date).map((p) => [p.type, p.value])
  );
  return {
    hour: Number(parts.hour),
    offset: parts.timeZoneName.replace('GMT', '') || '+00:00',
  };
}

function findSpikes(measurements, field, threshold) {
  const spikes = [];
  for (let i = 1; i < measurements.length - 1; i++) {
    const [above, here, below] = [i - 1, i, i + 1].map(
      (j) => measurements[j][field]
    );
    if (![above, here, below].every(isNumber)) continue;
    const up = here - above;
    const down = here - below;
    if (
      Math.sign(up) === Math.sign(down) &&
      Math.abs(up) > threshold &&
      Math.abs(down) > threshold
    ) {
      spikes.push(measurements[i]);
    }
  }
  return spikes;
}

// The top and bottom readings have one neighbour, so they need a wider margin,
// and can't be judged against a neighbour that is itself a spike.
function findEndOutliers(measurements, field, threshold, spikes) {
  const ends = [
    [measurements[0], measurements[1]],
    [
      measurements[measurements.length - 1],
      measurements[measurements.length - 2],
    ],
  ];
  return ends
    .filter(
      ([end, next]) =>
        end &&
        next &&
        !spikes.includes(next) &&
        isNumber(end[field]) &&
        isNumber(next[field]) &&
        Math.abs(end[field] - next[field]) > 2 * threshold
    )
    .map(([end]) => end);
}

/**
 * Plausibility checks beyond validate-data's ranges.
 * @returns {string[]} warnings
 */
function sanityWarnings(record) {
  const warnings = [];
  const warn = (message) => warnings.push(message);
  const lake = LAKES[record.lake];
  const date = new Date(record.date);

  const offset = /([+-]\d{2}:\d{2}|Z)$/.exec(record.date)?.[1];
  if (!offset) {
    warn(`date ${record.date} has no UTC offset`);
  } else if (!isNaN(date)) {
    const pacific = pacificTime(date);
    if (offset !== pacific.offset) {
      warn(`date offset ${offset} should be ${pacific.offset} on that day`);
    }
    if (pacific.hour < DAYLIGHT_HOURS[0] || pacific.hour >= DAYLIGHT_HOURS[1]) {
      warn(
        `sampling time ${record.date.slice(11, 16)} is outside daylight hours`
      );
    }
    if (date > new Date()) warn(`date ${record.date} is in the future`);
  }

  if (lake && record.station !== undefined && record.station !== lake.station) {
    warn(
      `station ${JSON.stringify(record.station)} should be "${lake.station}"`
    );
  }

  (record.samplers || []).forEach((name) => {
    if (typeof name !== 'string' || /,| and |&/.test(name)) {
      warn(`samplers entry ${JSON.stringify(name)} should be one person`);
    }
  });

  const secchi = (record.secchi_depth || []).filter(isNumber);
  if (secchi.length === 2 && Math.abs(secchi[0] - secchi[1]) > 1.5) {
    warn(`secchi readings ${secchi.join(' and ')} differ by more than 1.5 m`);
  }

  const measurements = Array.isArray(record.measurements)
    ? record.measurements.filter((m) => isNumber(m.depth))
    : [];
  const depths = measurements.map((m) => m.depth);
  if (depths.length === 0) {
    warn('no measurements');
    return warnings;
  }
  if (depths[0] !== 0) warn(`profile starts at ${depths[0]}m, not 0m`);
  depths.slice(1).forEach((depth, i) => {
    if (depth <= depths[i]) warn(`depth ${depth}m follows ${depths[i]}m`);
    else if (depth - depths[i] > 1)
      warn(`no readings between ${depths[i]}m and ${depth}m`);
  });
  if (lake && Math.max(...depths) > lake.maxDepth) {
    warn(
      `depth ${Math.max(...depths)}m is deeper than ${record.lake} (${lake.maxDepth}m)`
    );
  }
  if (secchi.length && Math.max(...secchi) > Math.max(...depths) + 1) {
    warn(`secchi ${Math.max(...secchi)}m is deeper than the profile`);
  }

  const tdsOff = measurements
    .filter((m) => isNumber(m.SPC) && isNumber(m.TDS))
    .filter((m) => Math.abs(m.TDS - TDS_FACTOR * m.SPC) > TDS_TOLERANCE)
    .map((m) => `${m.depth}m SPC=${m.SPC} TDS=${m.TDS}`);
  if (tdsOff.length) {
    warn(`TDS is not about ${TDS_FACTOR} x SPC at ${tdsOff.join(', ')}`);
  }
  const tdsUneven = measurements
    .filter((m) => isNumber(m.TDS))
    .filter((m) => {
      const steps = m.TDS / TDS_FACTOR;
      return Math.abs(steps - Math.round(steps)) > 0.02;
    })
    .map((m) => `${m.depth}m=${m.TDS}`);
  if (tdsUneven.length) {
    warn(`TDS is not a multiple of ${TDS_FACTOR} at ${tdsUneven.join(', ')}`);
  }

  const doPercent = measurements.filter((m) => isNumber(m.DO) && m.DO > 20);
  if (doPercent.length) {
    warn(
      `DO above 20 at ${doPercent.map((m) => `${m.depth}m=${m.DO}`).join(', ')}; % saturation instead of mg/L?`
    );
  }

  Object.entries(SPIKE_THRESHOLDS).forEach(([field, threshold]) => {
    const spikes = findSpikes(measurements, field, threshold);
    const outliers = [
      ...spikes,
      ...findEndOutliers(measurements, field, threshold, spikes),
    ].map((m) => `${m.depth}m=${m[field]}`);
    if (outliers.length)
      warn(`${field} out of line with the profile at ${outliers.join(', ')}`);
  });

  return warnings;
}

function describe(label, record) {
  const ms = (record.measurements || []).filter((m) => isNumber(m.depth));
  const top = ms[0] || {};
  const bottom = ms[ms.length - 1] || {};
  const reading = (m) =>
    `${m.depth}m ${m.temperature}C DO ${m.DO} SPC ${m.SPC} pH ${m.PH}`;
  return [
    `${label} ${record.date}`,
    `air ${record.air_temperature}C, secchi ${JSON.stringify(record.secchi_depth)}`,
    `top ${reading(top)}`,
    `bottom ${reading(bottom)}`,
  ].join(' | ');
}

/**
 * Lines describing the lake's previous sampling and the other lake's sampling
 * on the same day, plus a warning if the two lakes were sampled hours apart.
 */
function comparisons(record, label, others) {
  const lines = [];
  const warnings = [];
  const time = new Date(record.date).getTime();
  const day = label.split('/')[1];

  const previous = others
    .filter(
      (o) =>
        o.record.lake === record.lake &&
        o.label !== label &&
        new Date(o.record.date).getTime() < time
    )
    .sort((a, b) => new Date(b.record.date) - new Date(a.record.date))[0];
  if (previous)
    lines.push(`previous: ${describe(previous.label, previous.record)}`);

  const sameDay = others.find(
    (o) => o.record.lake !== record.lake && o.label.endsWith(`/${day}`)
  );
  if (sameDay) {
    lines.push(`same day: ${describe(sameDay.label, sameDay.record)}`);
    const hours = Math.abs(time - new Date(sameDay.record.date)) / 36e5;
    if (hours > 3) {
      warnings.push(
        `sampled ${hours.toFixed(1)} h apart from ${sameDay.label}`
      );
    }
  }
  return { lines, warnings };
}

function checkFile(file, { format, others }) {
  const label = `${path.basename(path.dirname(file))}/${path.basename(file)}`;
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));

  if (format) fs.writeFileSync(file, formatRecord(record), 'utf8');

  const errors = [];
  const pathError = checkRecord(
    record,
    path.basename(path.dirname(file)),
    path.basename(file)
  );
  if (pathError) errors.push(pathError);
  else
    errors.push(
      ...validateRecord(label, record).map((e) => e.replace(`${label}: `, ''))
    );

  if (typeof record.source === 'string' && record.source.startsWith('ocr/')) {
    if (!fs.existsSync(path.join(RAW_DIR, record.source))) {
      errors.push(`source data/raw/${record.source} does not exist`);
    }
  }

  const warnings = sanityWarnings(record);
  const { lines, warnings: compareWarnings } = pathError
    ? { lines: [], warnings: [] }
    : comparisons(record, label, others);
  warnings.push(...compareWarnings);

  console.log(`\n${label}${format ? ' (formatted)' : ''}`);
  errors.forEach((e) => console.log(`  ERROR ${e}`));
  warnings.forEach((w) => console.log(`  WARN  ${w}`));
  if (!errors.length && !warnings.length) console.log('  OK');
  lines.forEach((line) => console.log(`  ${line}`));

  return errors.length;
}

function main() {
  const args = process.argv.slice(2);
  const format = args.includes('--format');
  const formatOnly = args.includes('--format-only');
  const files = args.filter((arg) => !arg.startsWith('--'));
  if (files.length === 0) {
    console.error(
      'Usage: check-record.js [--format | --format-only] <record.json>...'
    );
    process.exit(2);
  }

  if (formatOnly) {
    files.forEach((file) => {
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      fs.writeFileSync(file, formatRecord(record), 'utf8');
      console.log(`Formatted ${file}`);
    });
    return;
  }

  const { records: others } = loadRecords(RECORDS_DIR);
  const errorCount = files.reduce(
    (count, file) => count + checkFile(path.resolve(file), { format, others }),
    0
  );
  process.exit(errorCount ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { formatRecord, sanityWarnings };
