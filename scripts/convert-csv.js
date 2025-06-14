#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function showUsage() {
  console.log(
    'Usage: node lake-parser.js <lake-name> <input-file> <output-file>'
  );
  console.log('');
  console.log('Arguments:');
  console.log('  lake-name    Name of the lake (e.g., "Hague")');
  console.log('  input-file   Path to the CSV input file');
  console.log('  output-file  Path to the JSON output file');
  console.log('');
  console.log('Example:');
  console.log('  node lake-parser.js "Hague" "data.csv" "output.json"');
}

function parseLakeData(csvContent, lakeName = 'Unknown') {
  const lines = csvContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line);
  const result = [];

  let currentEntry = null;
  let currentYear = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const columns = parseCSVLine(line);

    // Skip header row
    if (i === 0) continue;

    // Check if this is a year row
    if (
      columns[0] &&
      !isNaN(columns[0]) &&
      columns[0].toString().length === 4
    ) {
      currentYear = parseInt(columns[0]);
      continue;
    }

    // Check if this is a station row (starts with station ID like "DWG", but not "March")
    if (
      columns[0] &&
      typeof columns[0] === 'string' &&
      columns[0].match(/^[A-Z]+$/) &&
      columns[0] !== 'March'
    ) {
      // Save previous entry if it exists
      if (currentEntry) {
        result.push(currentEntry);
      }

      // Start new entry
      currentEntry = {
        lake: lakeName,
        station: columns[0],
        date: null,
        samplers: [],
        weather: null,
        air_temperature: null,
        secchi_depth: [null, null],
        nitrogen: null,
        phosphorus: null,
        data_notes: null,
        measurements: [],
      };

      // Add the first measurement
      if (columns[1] !== null && columns[1] !== undefined) {
        currentEntry.measurements.push({
          depth: parseFloat(columns[1]) || 0,
          temperature: parseFloat(columns[2]) || null,
          DO: cleanDOValue(columns[3]),
          SPC: parseFloat(columns[4]) || null,
          TDS: parseFloat(columns[5]) || null,
          PH: parseFloat(columns[6]) || null,
        });
      }

      // Check for metadata in this row
      extractMetadata(columns, currentEntry);
    }
    // Check if this is a measurement row (starts with null/empty but has depth)
    else if (
      currentEntry &&
      columns[1] !== null &&
      columns[1] !== undefined &&
      !isNaN(columns[1])
    ) {
      currentEntry.measurements.push({
        depth: parseFloat(columns[1]),
        temperature: parseFloat(columns[2]) || null,
        DO: cleanDOValue(columns[3]),
        SPC: parseFloat(columns[4]) || null,
        TDS: parseFloat(columns[5]) || null,
        PH: parseFloat(columns[6]) || null,
      });

      // Check for metadata in this row
      extractMetadata(columns, currentEntry);
    }
    // Check if this is a metadata-only row
    else if (currentEntry) {
      extractMetadata(columns, currentEntry);
    }
  }

  // Add the last entry
  if (currentEntry) {
    result.push(currentEntry);
  }

  return result;
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

    // Date/time parsing
    if (colStr.includes('date/time:') && nextValue) {
      entry.date = parseDate(nextValue);
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

function parseDate(dateStr) {
  if (!dateStr) return null;

  // Remove quotes if present
  const cleanDateStr = dateStr.toString().replace(/^"|"$/g, '');

  // Helper function to create Pacific timezone date
  function createPacificDate(year, month, day, hour = 0, minute = 0) {
    // Create date as if it's Pacific time, then convert to UTC for ISO string
    const date = new Date();
    date.setFullYear(year, month - 1, day); // month is 0-indexed
    date.setHours(hour, minute, 0, 0);

    // Assume Pacific timezone (UTC-8 or UTC-7 depending on DST)
    // For simplicity, we'll use UTC-8 (PST) offset
    const utcTime = date.getTime() + 8 * 60 * 60 * 1000; // Add 8 hours for UTC
    return new Date(utcTime).toISOString();
  }

  // Format: MM/dd/yyyy hh:mm AM/PM (US format like "03/28/2019 12:45 PM")
  let match = cleanDateStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i
  );
  if (match) {
    const [, month, day, year, hour, minute, ampm] = match;
    let hour24 = parseInt(hour);
    if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    return createPacificDate(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      hour24,
      parseInt(minute)
    );
  }

  // Format: dd/MM/yyyy hh:mm AM/PM (European format like "16/07/2019 05: 00 PM")
  match = cleanDateStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):\s*(\d{2})\s+(AM|PM)$/i
  );
  if (match) {
    const [, day, month, year, hour, minute, ampm] = match;
    let hour24 = parseInt(hour);
    if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    return createPacificDate(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      hour24,
      parseInt(minute)
    );
  }

  // Format: yyyy/MMM/dd hh:mm (original Hague format like "2019/Mar/28 13:45")
  match = cleanDateStr.match(/^(\d{4})\/(\w+)\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (match) {
    const [, year, monthStr, day, hour, minute] = match;
    const monthMap = {
      Jan: 1,
      Feb: 2,
      Mar: 3,
      Apr: 4,
      May: 5,
      Jun: 6,
      Jul: 7,
      Aug: 8,
      Sep: 9,
      Oct: 10,
      Nov: 11,
      Dec: 12,
    };
    const month = monthMap[monthStr];
    if (month !== undefined) {
      return createPacificDate(
        parseInt(year),
        month,
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
      );
    }
  }

  // Format: M/d/yy h:mm (short format like "3/31/21 4:10")
  match = cleanDateStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/
  );
  if (match) {
    const [, month, day, year, hour, minute] = match;
    const fullYear = parseInt(year) + (parseInt(year) < 50 ? 2000 : 1900); // Assume 21st century for years < 50
    return createPacificDate(
      fullYear,
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
  }

  // Format: M/d/yy h:mm (another variant like "5/10/22 13:20")
  match = cleanDateStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/
  );
  if (match) {
    const [, month, day, year, hour, minute] = match;
    const fullYear = parseInt(year) + 2000;
    return createPacificDate(
      fullYear,
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
  }

  // Format: dd/MM/yyyy hh.mm (with periods like "06/16/2019 14.50")
  match = cleanDateStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})\.(\d{2})$/
  );
  if (match) {
    const [, day, month, year, hour, minute] = match;
    return createPacificDate(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
  }

  // Format: dd/MM/yyyy hh:mm (24-hour without AM/PM like "16/07/2019 18:00")
  match = cleanDateStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/
  );
  if (match) {
    const [, day, month, year, hour, minute] = match;
    // Determine if this is US (MM/dd) or European (dd/MM) format by checking if day > 12
    if (parseInt(day) > 12) {
      // Must be European format (dd/MM/yyyy)
      return createPacificDate(
        parseInt(year),
        parseInt(month),
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
      );
    } else if (parseInt(month) > 12) {
      // Must be US format (MM/dd/yyyy)
      return createPacificDate(
        parseInt(year),
        parseInt(day),
        parseInt(month),
        parseInt(hour),
        parseInt(minute)
      );
    } else {
      // Ambiguous - could be either format. Default to US format for consistency
      return createPacificDate(
        parseInt(year),
        parseInt(day),
        parseInt(month),
        parseInt(hour),
        parseInt(minute)
      );
    }
  }

  // Format: yyyy-MM-dd (ISO date like "2025-03-02")
  match = cleanDateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return createPacificDate(parseInt(year), parseInt(month), parseInt(day));
  }

  // Format: M/d/yy (date only like "10/18/22")
  match = cleanDateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (match) {
    const [, month, day, year] = match;
    const fullYear = parseInt(year) + 2000;
    return createPacificDate(fullYear, parseInt(month), parseInt(day));
  }

  // Format: dd/MM/yyyy hh:mm (time only like "16:00 PM" - handle malformed)
  match = cleanDateStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+PM$/i
  );
  if (match) {
    const [, day, month, year, hour, minute] = match;
    let hour24 = parseInt(hour);
    if (hour24 !== 12) hour24 += 12; // Add 12 for PM
    return createPacificDate(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      hour24,
      parseInt(minute)
    );
  }

  // Format: dd/MM/yyyy hh:mm (simple 24-hour like "15/12/2019 12:47")
  match = cleanDateStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/
  );
  if (match) {
    const [, day, month, year, hour, minute] = match;
    return createPacificDate(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
  }

  // Format: dd/MM/yyyy hh:mm (time without minutes like "16/02/2021 11:30")
  match = cleanDateStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/
  );
  if (match) {
    const [, day, month, year, hour, minute] = match;
    return createPacificDate(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
  }

  // Format: time only (like "10:30")
  match = cleanDateStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const [, hour, minute] = match;
    // Use current date with provided time - this might need adjustment based on context
    const now = new Date();
    return createPacificDate(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
      parseInt(hour),
      parseInt(minute)
    );
  }

  console.warn(`Could not parse date format: "${cleanDateStr}"`);
  return null;
}

function cleanDOValue(value) {
  if (!value) return null;

  // Remove 'x' suffix if present (indicates percentage)
  const cleanValue = value.toString().replace(/x$/, '');
  const numValue = parseFloat(cleanValue);

  return isNaN(numValue) ? null : numValue;
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

module.exports = { parseLakeData };
