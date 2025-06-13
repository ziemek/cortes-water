#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function showUsage() {
  console.log('Usage: node lake-parser.js <lake-name> <input-file> <output-file>');
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
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
  const result = [];
  
  let currentEntry = null;
  let currentYear = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const columns = parseCSVLine(line);
    
    // Skip header row
    if (i === 0) continue;
    
    // Check if this is a year row
    if (columns[0] && !isNaN(columns[0]) && columns[0].toString().length === 4) {
      currentYear = parseInt(columns[0]);
      continue;
    }
    
    // Check if this is a station row (starts with station ID like "DWG", but not "March")
    if (columns[0] && typeof columns[0] === 'string' && columns[0].match(/^[A-Z]+$/) && columns[0] !== 'March') {
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
        measurements: []
      };
      
      // Add the first measurement
      if (columns[1] !== null && columns[1] !== undefined) {
        currentEntry.measurements.push({
          depth: parseFloat(columns[1]) || 0,
          water_temp: parseFloat(columns[2]) || null,
          dissolved_oxygen: cleanDOValue(columns[3]),
          spc: parseFloat(columns[4]) || null,
          tds: parseFloat(columns[5]) || null,
          ph: parseFloat(columns[6]) || null
        });
      }
      
      // Check for metadata in this row
      extractMetadata(columns, currentEntry);
    }
    // Check if this is a measurement row (starts with null/empty but has depth)
    else if (currentEntry && columns[1] !== null && columns[1] !== undefined && !isNaN(columns[1])) {
      currentEntry.measurements.push({
        depth: parseFloat(columns[1]),
        water_temp: parseFloat(columns[2]) || null,
        dissolved_oxygen: cleanDOValue(columns[3]),
        spc: parseFloat(columns[4]) || null,
        tds: parseFloat(columns[5]) || null,
        ph: parseFloat(columns[6]) || null
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
      entry.samplers = people.split(',').map(p => p.trim()).filter(p => p);
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
    if ((colStr.includes('phosphorus') || colStr.includes('phosporus')) && nextValue) {
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
  
  // Handle format like "03/28/2019 12:45 PM"
  const match1 = dateStr.toString().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i);
  if (match1) {
    const [, month, day, year, hour, minute, ampm] = match1;
    let hour24 = parseInt(hour);
    if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour24, parseInt(minute));
    return date.toISOString();
  }
  
  // Handle format like "2019/Mar/28 13:45" (original format)
  const match2 = dateStr.toString().match(/(\d{4})\/(\w+)\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (match2) {
    const [, year, monthStr, day, hour, minute] = match2;
    const monthMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const month = monthMap[monthStr];
    if (month !== undefined) {
      const date = new Date(parseInt(year), month, parseInt(day), parseInt(hour), parseInt(minute));
      return date.toISOString();
    }
  }
  
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
      console.log(`  Samplers: ${first.samplers.join(', ') || 'None specified'}`);
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
