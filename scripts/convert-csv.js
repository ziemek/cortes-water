#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function showUsage() {
  console.log(
    'Usage: node scripts/convert-csv.js <lake-name> <input-file> <output-file>'
  );
  console.log('');
  console.log('Arguments:');
  console.log('  lake-name    Name of the lake (e.g., "Hague")');
  console.log('  input-file   Path to the CSV input file');
  console.log('  output-file  Path to the JSON output file');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/convert-csv.js "Hague" "data.csv" "output.json"');
}

const DATE_LABEL = /^date(\/time)?:$/i;
const TIME_LABEL = /^time:?$/i;
const STATION = /^D[A-Z]{2}$/;

function parseLakeData(csvContent, lakeName = 'Unknown') {
  const lines = csvContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line);
  const result = [];

  let currentEntry = null;
  let station = null;

  for (let i = 1; i < lines.length; i++) {
    const columns = parseCSVLine(lines[i]);
    const hasDepth = columns[1] !== null && !isNaN(columns[1]);

    // A sampling starts on the row carrying its date label, which is not
    // always the depth-0 row and whose first cell may be a month or lake name.
    if (columns.some((col) => col && DATE_LABEL.test(col))) {
      if (currentEntry) result.push(finishEntry(currentEntry, result));
      currentEntry = {
        lake: lakeName,
        station: null,
        date: null,
        samplers: [],
        weather: null,
        air_temperature: null,
        secchi_depth: [null, null],
        nitrogen: null,
        phosphorus: null,
        data_notes: null,
        measurements: [],
        rawDate: null,
        rawTime: null,
      };
    }

    if (!currentEntry) continue;

    if (columns[0] && STATION.test(columns[0])) {
      station = columns[0];
      currentEntry.station = columns[0];
    }

    if (hasDepth) {
      const measurement = {
        depth: parseFloat(columns[1]),
        temperature: toNumber(columns[2]),
        DO: toNumber(columns[3]),
        SPC: toNumber(columns[4]),
        TDS: toNumber(columns[5]),
        PH: toNumber(columns[6]),
      };
      const { depth, ...values } = measurement;
      if (Object.values(values).some((v) => v !== null)) {
        currentEntry.measurements.push(measurement);
      }
    }

    extractMetadata(columns, currentEntry);
    if (!currentEntry.station) currentEntry.station = station;
  }

  if (currentEntry) result.push(finishEntry(currentEntry, result));

  return result;
}

function finishEntry(entry, previousEntries) {
  const { rawDate, rawTime, ...record } = entry;
  const previous = previousEntries[previousEntries.length - 1];
  const parsed = parseDate(rawDate, rawTime, previous && previous.date);
  record.date = parsed.date;
  if (parsed.date && !parsed.hasTime && !/time not/i.test(record.data_notes)) {
    record.data_notes = [record.data_notes, 'Time not recorded.']
      .filter(Boolean)
      .join(' ');
  }
  return record;
}

// Parses a number, dropping the "x" suffix that marks DO recorded in %.
function toNumber(value) {
  if (value === null || value === undefined) return null;
  const number = parseFloat(value.toString().replace(/x$/i, ''));
  return isNaN(number) ? null : number;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim() === '' ? null : current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim() === '' ? null : current.trim());
  return result;
}

function extractMetadata(columns, entry) {
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (!col) continue;

    const colStr = col.toString().toLowerCase();

    // Check both old and new CSV column formats for metadata
    let nextValue = null;

    // New CSV format: metadata labels in "Row Hight = 11", values in "Column = 8"
    if (i < columns.length - 1 && columns[i + 1]) {
      nextValue = columns[i + 1];
    }

    if (DATE_LABEL.test(colStr) && nextValue) {
      entry.rawDate = nextValue.toString();
    }
    if (TIME_LABEL.test(colStr) && nextValue) {
      entry.rawTime = nextValue.toString();
    }

    // Weather
    if (colStr.includes('weather:') && nextValue) {
      entry.weather = nextValue.toString();
    }

    // People/samplers
    if (colStr.includes('people:') && nextValue) {
      const people = nextValue.toString();
      entry.samplers = people
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p);
    }

    // Air temperature
    if (colStr.includes('air temp') && nextValue) {
      const temp = parseFloat(nextValue);
      if (!isNaN(temp)) entry.air_temperature = temp;
    }

    // Secchi depth
    if (colStr.includes('secchi 1') && nextValue) {
      const depth = parseFloat(nextValue);
      if (!isNaN(depth)) entry.secchi_depth[0] = depth;
    }
    if (colStr.includes('secchi 2') && nextValue) {
      const depth = parseFloat(nextValue);
      if (!isNaN(depth)) entry.secchi_depth[1] = depth;
    }

    // Nitrogen
    if (colStr.includes('nitrogen') && nextValue) {
      const nitrogen = parseFloat(nextValue);
      if (!isNaN(nitrogen)) entry.nitrogen = nitrogen;
    }

    // Phosphorus (also check for "phosporus" typo)
    if (
      (colStr.includes('phosphorus') || colStr.includes('phosporus')) &&
      nextValue
    ) {
      const phosphorus = parseFloat(nextValue);
      if (!isNaN(phosphorus)) entry.phosphorus = phosphorus;
    }

    // Data notes
    if (colStr.includes('data notes') && nextValue) {
      entry.data_notes = nextValue.toString();
    }
  }
}

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

// Returns { date, hasTime } where date is Pacific wall time with its UTC
// offset, e.g. "2019-03-28T12:45:00-07:00". Unknown times default to noon.
function parseDate(dateStr, timeStr, previousDate) {
  if (!dateStr) return { date: null, hasTime: false };

  const clean = dateStr.toString().replace(/"/g, '').trim();
  const match =
    clean.match(/^(\d{4})\/([a-z]{3})\/(\d{1,2}),?\s*(.*)$/i) ||
    clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2}),?\s*(.*)$/) ||
    clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d),?\s*(.*)$/);
  if (!match) {
    console.warn(`Could not parse date format: "${clean}"`);
    return { date: null, hasTime: false };
  }

  let year, month, day;
  if (match[1].length === 4) {
    year = +match[1];
    month = isNaN(match[2])
      ? MONTHS.indexOf(match[2].toLowerCase()) + 1
      : +match[2];
    day = +match[3];
  } else {
    [year, month, day] = resolveSlashDate(
      +match[1],
      +match[2],
      match[3],
      previousDate
    );
  }

  const time = parseTime(match[4]) || parseTime(timeStr);
  const [hour, minute] = time || [12, 0];
  return {
    date: formatPacific(year, month, day, hour, minute),
    hasTime: Boolean(time),
  };
}

// Two-digit years are always M/D/YY. Four-digit years mix MM/DD and DD/MM;
// when both readings are valid, pick the earliest one after the previous
// sampling, since the sheets are in chronological order.
function resolveSlashDate(a, b, yearStr, previousDate) {
  const year = yearStr.length === 2 ? 2000 + +yearStr : +yearStr;
  if (yearStr.length === 2 || b > 12) return [year, a, b];
  if (a > 12) return [year, b, a];

  const candidates = [
    [year, a, b],
    [year, b, a],
  ];
  const after = previousDate
    ? candidates.filter(
        ([y, m, d]) => formatPacific(y, m, d, 12, 0) > previousDate
      )
    : candidates;
  after.sort(([, m1, d1], [, m2, d2]) => m1 - m2 || d1 - d2);
  return after[0] || candidates[0];
}

// Accepts "12:45 PM", "05: 00 PM", "14.50", "9:30", "03:00:00 PM" and the
// sheet's "16:00 PM" (24-hour time with a stray PM).
function parseTime(value) {
  if (!value) return null;
  const match = value
    .toString()
    .trim()
    .match(/^(\d{1,2})\s*[:.]\s*(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = +match[1];
  const ampm = (match[3] || '').toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return [hour, +match[2]];
}

function formatPacific(year, month, day, hour, minute) {
  const pad = (n) => String(n).padStart(2, '0');
  const offset = pacificOffset(year, month, day, hour);
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${offset}`;
}

function pacificOffset(year, month, day, hour) {
  const approxUtc = new Date(Date.UTC(year, month - 1, day, hour + 8));
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Vancouver',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(approxUtc)
    .find((part) => part.type === 'timeZoneName').value; // e.g. "GMT-7"
  const hours = Math.abs(parseInt(name.replace('GMT', ''), 10));
  return `-${String(hours).padStart(2, '0')}:00`;
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  if (args.length !== 3) {
    console.error('Error: Incorrect number of arguments.');
    showUsage();
    process.exit(1);
  }

  const [lakeName, inputFile, outputFile] = args;

  // Check if input file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file '${inputFile}' does not exist.`);
    process.exit(1);
  }

  try {
    // Read input file
    console.log(`Reading data from: ${inputFile}`);
    const csvContent = fs.readFileSync(inputFile, 'utf8');

    // Parse the data
    console.log(`Parsing lake data for: ${lakeName}`);
    const lakeData = parseLakeData(csvContent, lakeName);

    // Write output file
    console.log(`Writing ${lakeData.length} entries to: ${outputFile}`);
    fs.writeFileSync(outputFile, JSON.stringify(lakeData, null, 2));

    console.log('✓ Processing complete!');
    console.log(`✓ Parsed ${lakeData.length} sampling events`);

    // Show summary of first entry
    if (lakeData.length > 0) {
      const first = lakeData[0];
      console.log('\nFirst entry summary:');
      console.log(`  Lake: ${first.lake}`);
      console.log(`  Station: ${first.station}`);
      console.log(`  Date: ${first.date}`);
      console.log(`  Measurements: ${first.measurements.length} depth levels`);
      console.log(
        `  Samplers: ${first.samplers.join(', ') || 'None specified'}`
      );
    }
  } catch (error) {
    console.error(`Error processing file: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { parseLakeData, parseDate };
