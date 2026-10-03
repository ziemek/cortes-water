#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadRecords } = require('./merge-data');

const KNOWN_ISSUES_FILE = path.join(__dirname, 'known-data-issues.json');

const KNOWN_LAKES = ['Gunflint', 'Hague'];

// Inclusive [min, max] bounds for plausible values; null means "not measured"
const RECORD_RANGES = {
  air_temperature: [-20, 45],
};
const SECCHI_RANGE = [0, 30];
const MEASUREMENT_RANGES = {
  depth: [0, 50],
  temperature: [-1, 35],
  DO: [0, 20],
  SPC: [0, 500],
  TDS: [0, 500],
  PH: [0, 14],
};

// Returns a description of what's wrong with a value, or null if it's fine
function valueProblem(value, [min, max]) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || Number.isNaN(value)) return 'not a number';
  if (value < min || value > max) return `outside ${min}..${max}`;
  return null;
}

/**
 * Checks the contents of one record that already passed merge-data's
 * checkRecord (single object, lake and date match its path).
 * @returns {string[]} problems, each prefixed with label
 */
function validateRecord(label, record) {
  const issues = [];
  const report = (message) => issues.push(`${label}: ${message}`);

  if (!KNOWN_LAKES.includes(record.lake)) {
    report(`unknown lake ${JSON.stringify(record.lake)}`);
  }
  if (typeof record.source !== 'string' || !record.source.trim()) {
    report('missing source');
  }

  Object.entries(RECORD_RANGES).forEach(([field, range]) => {
    const problem = valueProblem(record[field], range);
    if (problem) report(`${field}=${JSON.stringify(record[field])} ${problem}`);
  });
  (record.secchi_depth || []).forEach((value) => {
    const problem = valueProblem(value, SECCHI_RANGE);
    if (problem) report(`secchi_depth=${JSON.stringify(value)} ${problem}`);
  });

  if (!Array.isArray(record.measurements)) {
    report('measurements is not an array');
    return issues;
  }

  const seenDepths = new Set();
  const repeatedDepths = new Set();
  const badValues = {};
  record.measurements.forEach((m) => {
    if (typeof m.depth !== 'number') {
      report('measurement without numeric depth');
      return;
    }
    if (seenDepths.has(m.depth)) repeatedDepths.add(m.depth);
    seenDepths.add(m.depth);
    Object.entries(MEASUREMENT_RANGES).forEach(([field, range]) => {
      const problem = valueProblem(m[field], range);
      if (!problem) return;
      const key = `${field} ${problem}`;
      (badValues[key] = badValues[key] || []).push(
        `${m.depth}m=${JSON.stringify(m[field])}`
      );
    });
  });

  // Grouped per record so one bad profile is one issue, not one per depth
  if (repeatedDepths.size > 0) {
    report(`repeated depths ${[...repeatedDepths].join(', ')}`);
  }
  Object.entries(badValues).forEach(([key, values]) => {
    report(`${key} at ${values.join(', ')}`);
  });

  return issues;
}

/**
 * Returns every problem in the records directory: files merge-data would
 * reject, plus implausible contents of the files it accepts.
 */
function validateRecords(recordsDir) {
  const { records, errors } = loadRecords(recordsDir);
  return [
    ...errors,
    ...records.flatMap(({ label, record }) => validateRecord(label, record)),
  ];
}

function loadKnownIssues() {
  if (!fs.existsSync(KNOWN_ISSUES_FILE)) return [];
  return JSON.parse(fs.readFileSync(KNOWN_ISSUES_FILE, 'utf8'));
}

function main() {
  const issues = validateRecords();

  if (process.argv.includes('--update-known-issues')) {
    fs.writeFileSync(
      KNOWN_ISSUES_FILE,
      JSON.stringify(issues, null, 2) + '\n',
      'utf8'
    );
    console.log(
      `Recorded ${issues.length} known issues in ${KNOWN_ISSUES_FILE}`
    );
    return;
  }

  const known = new Set(loadKnownIssues());
  const newIssues = issues.filter((issue) => !known.has(issue));
  const resolved = [...known].filter((issue) => !issues.includes(issue));

  if (resolved.length > 0) {
    console.log(
      `${resolved.length} known issue(s) no longer occur; run with --update-known-issues to remove them:`
    );
    resolved.forEach((issue) => console.log(`  ${issue}`));
  }

  if (newIssues.length > 0) {
    console.error(`Found ${newIssues.length} data issue(s):`);
    newIssues.forEach((issue) => console.error(`  ${issue}`));
    process.exit(1);
  }

  console.log(`Data OK (${known.size} known issues ignored)`);
}

if (require.main === module) {
  main();
}

module.exports = { validateRecord, validateRecords };
