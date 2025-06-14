#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../src/data');
const OUTPUT_FILE = path.join(DATA_DIR, 'water-data.json');

function getDateKey(dateString) {
  // Parse the date and return just the date part (YYYY-MM-DD)
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

function getMergeKey(record) {
  // Create merge key: <lake-name>-<date without time>
  const lakeName = record.lake.toLowerCase();
  const dateKey = getDateKey(record.date);
  return `${lakeName}-${dateKey}`;
}

function mergeWaterData() {
  console.log('Starting water data merge...');

  // Check if data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Error: Data directory ${DATA_DIR} does not exist`);
    process.exit(1);
  }

  // Get all JSON files in the data directory
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.endsWith('.json') && file !== 'water-data.json') // Exclude the output file
    .map((file) => path.join(DATA_DIR, file));

  console.log(
    `Found ${files.length} JSON files to process:`,
    files.map((f) => path.basename(f))
  );

  // Map to store merged data by key
  const mergedData = new Map();

  // Process each file
  files.forEach((filePath) => {
    const fileName = path.basename(filePath);
    console.log(`Processing ${fileName}...`);

    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(fileContent);

      if (!Array.isArray(data)) {
        console.warn(
          `Warning: ${fileName} does not contain an array, skipping.`
        );
        return;
      }

      // Process each record in the file
      data.forEach((record) => {
        if (!record.lake || !record.date) {
          console.warn(
            `Warning: Record missing lake or date in ${fileName}, skipping:`,
            record
          );
          return;
        }

        const mergeKey = getMergeKey(record);

        // If we already have data for this key, skip it (keep first occurrence)
        if (mergedData.has(mergeKey)) {
          console.log(
            `Duplicate key found: ${mergeKey}, keeping first occurrence`
          );
          return; // Skip this record
        }

        mergedData.set(mergeKey, record);
      });

      console.log(`Processed ${data.length} records from ${fileName}`);
    } catch (error) {
      console.error(`Error processing ${fileName}:`, error.message);
    }
  });

  // Convert Map to array and sort by lake and date
  const finalData = Array.from(mergedData.values()).sort((a, b) => {
    // First sort by lake name
    const lakeCompare = a.lake.localeCompare(b.lake);
    if (lakeCompare !== 0) return lakeCompare;

    // Then sort by date
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });

  console.log(`Merged data contains ${finalData.length} unique records`);

  // Write the merged data to the output file
  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2), 'utf8');
    console.log(`Successfully wrote merged data to ${OUTPUT_FILE}`);

    // Log summary by lake
    const summary = finalData.reduce((acc, record) => {
      acc[record.lake] = (acc[record.lake] || 0) + 1;
      return acc;
    }, {});

    console.log('Summary by lake:');
    Object.entries(summary).forEach(([lake, count]) => {
      console.log(`  ${lake}: ${count} records`);
    });
  } catch (error) {
    console.error('Error writing merged data:', error.message);
    process.exit(1);
  }
}

// Run the merge if this script is executed directly
if (require.main === module) {
  mergeWaterData();
}

module.exports = { mergeWaterData };
