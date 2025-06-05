// Enhanced Configuration for handling many data points
const config = {
  maxVisibleDefault: 12, // Show first 12 series by default
  baseColorPalettes: {
      'Gunflint': ['#FF6B6B', '#FF8E53', '#FF9F43'],
      'Hague': ['#4ECDC4', '#45B7D1', '#6C5CE7']
  }
};

// Global state
let data = [];
let currentParameter = 'temperature';
let currentView = 'time';
let visibleSeries = new Set();
let allSeries = [];

// Initialize tooltip
const tooltip = d3.select('body').append('div')
  .attr('class', 'tooltip')
  .style('opacity', 0);

// Dynamic color generation
function generateColorPalette(baseColors, count) {
  if (count <= baseColors.length) {
      return baseColors.slice(0, count);
  }

  const colors = [...baseColors];
  const hslBase = baseColors.map(hex => d3.hsl(hex));

  for (let i = baseColors.length; i < count; i++) {
      const baseIndex = i % baseColors.length;
      const variation = Math.floor(i / baseColors.length);

      const baseHsl = hslBase[baseIndex];
      const newHsl = d3.hsl(
          (baseHsl.h + variation * 25) % 360,
          Math.max(0.3, baseHsl.s - variation * 0.1),
          Math.max(0.3, Math.min(0.8, baseHsl.l + (variation % 2 === 0 ? 0.1 : -0.1)))
      );

      colors.push(newHsl.hex());
  }

  return colors;
}

// Generate season color
function getSeasonColor(date) {
  const month = new Date(date).getMonth();
  if (month >= 2 && month <= 4) return '#4CAF50'; // Spring - Green
  if (month >= 5 && month <= 7) return '#FF9800'; // Summer - Orange
  if (month >= 8 && month <= 10) return '#FF5722'; // Fall - Red-Orange
  return '#2196F3'; // Winter - Blue
}

// Generate time-based color gradient
function getTimeGradientColor(date, minDate, maxDate) {
  const totalTime = maxDate.getTime() - minDate.getTime();
  const currentTime = new Date(date).getTime() - minDate.getTime();
  const ratio = currentTime / totalTime;

  // Color gradient from blue (early) to red (late)
  const hue = 240 - (ratio * 120); // 240 = blue, 120 = red
  return d3.hsl(hue, 0.7, 0.5).hex();
}

// Load data and initialize
async function loadData() {
  try {
      // Get list of all JSON files in ./data directory
      const dataFiles = await getDataFiles();

      // Fetch and combine all JSON files
      const allData = [];
      for (const filename of dataFiles) {
          try {
              const response = await fetch(`./data/${filename}`);
              if (response.ok) {
                  const fileData = await response.json();
                  // Add filename metadata to each record if needed
                  if (Array.isArray(fileData)) {
                      fileData.forEach(record => record._sourceFile = filename);
                      allData.push(...fileData);
                  } else {
                      // Handle single object files
                      fileData._sourceFile = filename;
                      allData.push(fileData);
                  }
              } else {
                  console.warn(`Failed to fetch ${filename}: ${response.status}`);
              }
          } catch (fileError) {
              console.warn(`Error loading ${filename}:`, fileError);
          }
      }

      data = allData;
      initializeSeriesTracking();
      updateVisualization();

  } catch (error) {
      console.error('Error loading data:', error);
      d3.select('#chartsContainer').html('<p style="text-align: center; color: red; font-size: 18px;">Error loading data files. Please make sure JSON files exist in the ./data directory.</p>');
  }
}

async function getDataFiles() {
  // Method 1: Try to fetch a directory listing (works with some servers)
  try {
      const response = await fetch('./data/');
      const html = await response.text();

      // Parse HTML directory listing for water*.json files
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = Array.from(doc.querySelectorAll('a[href$=".json"]'))
          .filter(link => link.getAttribute('href').startsWith('water'));

      if (links.length > 0) {
          return links.map(link => link.getAttribute('href'));
      }
  } catch (e) {
      // Directory listing failed, fall back to known patterns
  }

  // Method 2: Try common filename patterns
  const commonPatterns = [
      'water-quality.json',
      'data.json',
      // Year patterns
      ...Array.from({length: 10}, (_, i) => `${2015 + i}.json`),
      ...Array.from({length: 10}, (_, i) => `water-quality-${2015 + i}.json`),
      // Month patterns for current/recent years
      ...generateMonthlyPatterns(['2023', '2024', '2025'])
  ];

  const existingFiles = [];
  for (const filename of commonPatterns) {
      try {
          const response = await fetch(`./data/${filename}`, { method: 'HEAD' });
          if (response.ok) {
              existingFiles.push(filename);
          }
      } catch (e) {
          // File doesn't exist, continue
      }
  }

  return existingFiles;
}

function generateMonthlyPatterns(years) {
  const patterns = [];
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

  for (const year of years) {
      for (const month of months) {
          patterns.push(`${year}-${month}.json`);
          patterns.push(`water-quality-${year}-${month}.json`);
      }
  }

  return patterns;
}

// Initialize series tracking and visibility controls
function initializeSeriesTracking() {
  allSeries = [];
  visibleSeries.clear();

  const lakes = [...new Set(data.map(d => d.lake))];

  lakes.forEach(lake => {
      const lakeData = data.filter(d => d.lake === lake).sort((a, b) => new Date(a.date) - new Date(b.date));
      lakeData.forEach((dataset, i) => {
          const seriesId = `${lake}-${i}`;
          allSeries.push({
              id: seriesId,
              lake: lake,
              date: dataset.date,
              index: i,
              dataset: dataset
          });
      });
  });

  // Show first maxVisibleDefault series by default
  allSeries.slice(0, config.maxVisibleDefault).forEach(series => {
      visibleSeries.add(series.id);
  });

  createVisibilityControls();
}

// Create visibility controls
function createVisibilityControls() {
  // Remove existing controls
  d3.select('#visibilityControls').remove();

  if (allSeries.length <= 6) return; // Don't show controls for small datasets

  const controlsDiv = d3.select('.container')
      .append('div')
      .attr('id', 'visibilityControls')
      .style('background', '#f8f9fa')
      .style('padding', '20px')
      .style('border-radius', '10px')
      .style('margin-bottom', '30px')
      .style('margin-top', '20px');

  controlsDiv.append('h4')
      .style('color', '#2c3e50')
      .style('margin-bottom', '15px')
      .text(`Show/Hide Datasets by Date (${[...new Set(allSeries.map(s => s.date))].length} unique dates):`);

  // Add select all/none buttons
  const buttonDiv = controlsDiv.append('div')
      .style('margin-bottom', '15px');

  buttonDiv.append('button')
      .style('padding', '8px 16px')
      .style('margin-right', '10px')
      .style('border', '1px solid #ddd')
      .style('border-radius', '4px')
      .style('background', '#e8f4f8')
      .style('cursor', 'pointer')
      .text('Select All')
      .on('click', () => toggleAllDates(true));

  buttonDiv.append('button')
      .style('padding', '8px 16px')
      .style('border', '1px solid #ddd')
      .style('border-radius', '4px')
      .style('background', '#f8e8e8')
      .style('cursor', 'pointer')
      .text('Select None')
      .on('click', () => toggleAllDates(false));

  // Group by date
  const byDate = d3.group(allSeries, d => d.date);
  const uniqueDates = [...byDate.keys()].sort();

  // Add checkboxes for each date
  const checkboxContainer = controlsDiv.append('div')
      .style('display', 'grid')
      .style('grid-template-columns', 'repeat(auto-fit, minmax(200px, 1fr))')
      .style('gap', '10px')
      .style('max-height', '300px')
      .style('overflow-y', 'auto')
      .style('padding', '10px')
      .style('background', 'white')
      .style('border-radius', '8px')
      .style('box-shadow', '0 2px 5px rgba(0,0,0,0.1)');

  uniqueDates.forEach(date => {
      const seriesForDate = byDate.get(date);
      const allChecked = seriesForDate.every(s => visibleSeries.has(s.id));

      const item = checkboxContainer.append('div')
          .style('display', 'flex')
          .style('align-items', 'center')
          .style('padding', '5px')
          .style('border-radius', '4px')
          .style('transition', 'background 0.2s')
          .on('mouseover', function() {
              d3.select(this).style('background', '#f0f0f0');
          })
          .on('mouseout', function() {
              d3.select(this).style('background', 'transparent');
          });

      const checkbox = item.append('input')
          .attr('type', 'checkbox')
          .attr('id', `vis-date-${date}`)
          .property('checked', allChecked)
          .style('margin-right', '8px')
          .on('change', function() {
              toggleDateVisibility(date);
          });

      item.append('label')
          .attr('for', `vis-date-${date}`)
          .style('cursor', 'pointer')
          .style('font-size', '14px')
          .text(formatDate(date));
  });
}

// Toggle date visibility (applies to both lakes)
function toggleDateVisibility(date) {
  const seriesForDate = allSeries.filter(s => s.date === date);
  const allChecked = seriesForDate.every(s => visibleSeries.has(s.id));

  seriesForDate.forEach(s => {
      if (allChecked) {
          visibleSeries.delete(s.id);
      } else {
          visibleSeries.add(s.id);
      }
  });

  updateVisualization();
}

// Toggle all dates
function toggleAllDates(show) {
  const uniqueDates = [...new Set(allSeries.map(s => s.date))];

  uniqueDates.forEach(date => {
      const seriesForDate = allSeries.filter(s => s.date === date);
      seriesForDate.forEach(s => {
          if (show) {
              visibleSeries.add(s.id);
          } else {
              visibleSeries.delete(s.id);
          }
      });

      // Update checkbox
      d3.select(`#vis-date-${date}`).property('checked', show);
  });

  updateVisualization();
}

// Get filtered data based on visibility
function getVisibleData() {
  return allSeries
      .filter(s => visibleSeries.has(s.id))
      .map(s => s.dataset);
}

// Utility functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
  });
}

function getParameterLabel(param) {
  const labels = {
      'temperature': 'Temperature (°C)',
      'DO': 'Dissolved Oxygen (mg/L)',
      'SPC': 'Specific Conductance (μS/cm)',
      'TDS': 'Total Dissolved Solids (mg/L)',
      'PH': 'pH Level',
      'temp_oxygen': 'Temperature vs Oxygen Correlation',
      'conductivity_tds': 'Conductivity vs TDS Correlation',
      'ph_oxygen': 'pH vs Dissolved Oxygen Correlation',
      'secchi': 'Secchi Depth Analysis'
  };
  return labels[param] || param;
}

// Create Temperature-Oxygen Scatter Plot
function createTemperatureOxygenScatter() {
  const container = d3.select('#chartsContainer');
  container.selectAll('*').remove();

  const visibleData = getVisibleData();

  // Create depth-grouped charts
  const depthRanges = [
      {name: 'Surface (0-2m)', min: 0, max: 2},
      {name: 'Mid-depth (3-8m)', min: 3, max: 8},
      {name: 'Deep (9m+)', min: 9, max: 50}
  ];

  depthRanges.forEach(range => {
      const chartDiv = container.append('div')
          .attr('class', 'chart-container');

      chartDiv.append('h3')
          .attr('class', 'chart-title')
          .text(`Temperature vs Dissolved Oxygen - ${range.name}`);

      createScatterChart(chartDiv, visibleData, 'temperature', 'DO', range);
  });

  updateCorrelationLegend();
}

// Create Conductivity-TDS Scatter Plot
function createConductivityTDSScatter() {
  const container = d3.select('#chartsContainer');
  container.selectAll('*').remove();

  const visibleData = getVisibleData();

  const chartDiv = container.append('div')
      .attr('class', 'chart-container');

  chartDiv.append('h3')
      .attr('class', 'chart-title')
      .text('Specific Conductance vs Total Dissolved Solids');

  createScatterChart(chartDiv, visibleData, 'SPC', 'TDS');
  updateCorrelationLegend();
}

// Create pH-Oxygen Scatter Plot
function createPHOxygenScatter() {
  const container = d3.select('#chartsContainer');
  container.selectAll('*').remove();

  const visibleData = getVisibleData();

  // Create depth-grouped charts
  const depthRanges = [
      {name: 'Surface (0-2m)', min: 0, max: 2},
      {name: 'Mid-depth (3-8m)', min: 3, max: 8},
      {name: 'Deep (9m+)', min: 9, max: 50}
  ];

  depthRanges.forEach(range => {
      const chartDiv = container.append('div')
          .attr('class', 'chart-container');

      chartDiv.append('h3')
          .attr('class', 'chart-title')
          .text(`pH vs Dissolved Oxygen - ${range.name}`);

      createScatterChart(chartDiv, visibleData, 'PH', 'DO', range);
  });

  updateCorrelationLegend();
}

// Generic scatter plot creation
function createScatterChart(container, datasets, xParam, yParam, depthRange = null) {
  const margin = {top: 20, right: 30, bottom: 80, left: 60};
  const width = 550 - margin.left - margin.right;
  const height = 400 - margin.bottom - margin.top;

  const svg = container.append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

  // Process data points
  const scatterData = [];
  datasets.forEach(dataset => {
      let measurements = dataset.measurements;

      // Filter by depth range if specified
      if (depthRange) {
          measurements = measurements.filter(m =>
              m.depth >= depthRange.min && m.depth <= depthRange.max
          );
      }

      measurements.forEach(m => {
          if (m[xParam] !== null && m[yParam] !== null &&
              m[xParam] !== undefined && m[yParam] !== undefined) {
              scatterData.push({
                  x: m[xParam],
                  y: m[yParam],
                  depth: m.depth,
                  lake: dataset.lake,
                  date: dataset.date,
                  weather: dataset.weather,
                  airTemp: dataset.air_temperature
              });
          }
      });
  });

  if (scatterData.length === 0) {
      container.append('p')
          .style('text-align', 'center')
          .style('color', '#666')
          .text(`No data available for ${xParam} vs ${yParam} correlation`);
      return;
  }

  // Set up scales
  const xScale = d3.scaleLinear()
      .domain(d3.extent(scatterData, d => d.x))
      .range([0, width]);

  const yScale = d3.scaleLinear()
      .domain(d3.extent(scatterData, d => d.y))
      .range([height, 0]);

  // Get date range for time gradient
  const dateRange = d3.extent(scatterData, d => new Date(d.date));

  // Add grid
  svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale)
          .tickSize(-height)
          .tickFormat('')
      );

  svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale)
          .tickSize(-width)
          .tickFormat('')
      );

  // Add axes
  svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale));

  svg.append('g')
      .attr('class', 'axis')
      .call(d3.axisLeft(yScale));

  // Add axis labels
  svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#666')
      .text(getParameterLabel(yParam));

  svg.append('text')
      .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 10})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#666')
      .text(getParameterLabel(xParam));

  // Add scatter points
  svg.selectAll('.scatter-dot')
      .data(scatterData)
      .enter().append('circle')
      .attr('class', 'scatter-dot')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', 4)
      .style('fill', d => getTimeGradientColor(d.date, dateRange[0], dateRange[1]))
      .style('stroke', 'white')
      .style('stroke-width', 1)
      .style('opacity', 0.7)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
          d3.select(this).style('opacity', 1).attr('r', 6);

          tooltip.transition()
              .duration(200)
              .style('opacity', .9);
          tooltip.html(`
              <strong>${d.lake} Lake</strong><br/>
              Date: ${formatDate(d.date)}<br/>
              Depth: ${d.depth}m<br/>
              ${getParameterLabel(xParam)}: ${d.x}<br/>
              ${getParameterLabel(yParam)}: ${d.y}<br/>
              Weather: ${d.weather || 'N/A'}<br/>
              Air Temp: ${d.airTemp || 'N/A'}°C
          `)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function(d) {
          d3.select(this).style('opacity', 0.7).attr('r', 4);

          tooltip.transition()
              .duration(500)
              .style('opacity', 0);
      });

  // Add trend line
  addTrendLine(svg, scatterData, xScale, yScale, xParam, yParam);
}

// Add trend line to scatter plot
function addTrendLine(svg, data, xScale, yScale, xParam, yParam) {
  // Calculate linear regression
  const n = data.length;
  const sumX = d3.sum(data, d => d.x);
  const sumY = d3.sum(data, d => d.y);
  const sumXY = d3.sum(data, d => d.x * d.y);
  const sumXX = d3.sum(data, d => d.x * d.x);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const totalSumSquares = d3.sum(data, d => Math.pow(d.y - yMean, 2));
  const residualSumSquares = d3.sum(data, d => Math.pow(d.y - (slope * d.x + intercept), 2));
  const rSquared = 1 - (residualSumSquares / totalSumSquares);

  // Draw trend line
  const xDomain = xScale.domain();
  const trendLineData = [
      {x: xDomain[0], y: slope * xDomain[0] + intercept},
      {x: xDomain[1], y: slope * xDomain[1] + intercept}
  ];

  const line = d3.line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y));

  svg.append('path')
      .datum(trendLineData)
      .attr('class', 'trend-line')
      .attr('d', line)
      .style('stroke', '#333')
      .style('stroke-width', 2)
      .style('stroke-dasharray', '5,5')
      .style('fill', 'none')
      .style('opacity', 0.8);

  // Add R-squared label
  svg.append('text')
      .attr('x', xScale.range()[1] - 10)
      .attr('y', yScale.range()[1] + 20)
      .attr('text-anchor', 'end')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(`R² = ${rSquared.toFixed(3)}`);
}

// Enhanced depth profile visualization
function createDepthProfiles() {
  const container = d3.select('#chartsContainer');
  container.selectAll('*').remove();

  const visibleData = getVisibleData();
  const lakes = [...new Set(visibleData.map(d => d.lake))];

  lakes.forEach(lake => {
      const lakeData = visibleData.filter(d => d.lake === lake);
      if (lakeData.length === 0) return;

      const chartDiv = container.append('div')
          .attr('class', 'chart-container');

      chartDiv.append('h3')
          .attr('class', 'chart-title')
          .text(`${lake} Lake`);

      createDepthChart(chartDiv, lakeData, lake);
  });

  updateLegend();
}

function createDepthChart(container, lakeData, lakeName) {
  const margin = {top: 20, right: 30, bottom: 50, left: 60};
  const width = 550 - margin.left - margin.right;
  const height = 400 - margin.bottom - margin.top;

  const svg = container.append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

  // Get value range for the parameter
  const allValues = lakeData.flatMap(d =>
      d.measurements.map(m => m[currentParameter])
  );
  const maxDepth = Math.max(...lakeData.flatMap(d =>
      d.measurements.map(m => m.depth)
  ));

  const xScale = d3.scaleLinear()
      .domain(d3.extent(allValues))
      .range([0, width]);

  const yScale = d3.scaleLinear()
      .domain([0, maxDepth])
      .range([0, height]);

  // Add grid
  svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale)
          .tickSize(-height)
          .tickFormat('')
      );

  svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale)
          .tickSize(-width)
          .tickFormat('')
      );

  // Add axes
  svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale));

  svg.append('g')
      .attr('class', 'axis')
      .call(d3.axisLeft(yScale));

  // Add axis labels
  svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#666')
      .text('Depth (m)');

  svg.append('text')
      .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 10})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#666')
      .text(getParameterLabel(currentParameter));

  // Line generator
  const line = d3.line()
      .x(d => xScale(d[currentParameter]))
      .y(d => yScale(d.depth))
      .curve(d3.curveMonotoneY);

  // Generate colors for this lake's data
  const allLakeData = data.filter(d => d.lake === lakeName);
  const colors = generateColorPalette(config.baseColorPalettes[lakeName], allLakeData.length);

  // Add lines for each visible dataset
  lakeData.forEach((dataset) => {
      const datasetIndex = allLakeData.findIndex(d => d.date === dataset.date);
      const color = colors[datasetIndex];

      svg.append('path')
          .datum(dataset.measurements)
          .attr('class', 'line')
          .attr('d', line)
          .style('stroke', color)
          .style('stroke-width', '2')
          .style('fill', 'none')
          .style('opacity', 0.8);

      // Add dots
      svg.selectAll(`.dot-${datasetIndex}`)
          .data(dataset.measurements)
          .enter().append('circle')
          .attr('class', `dot dot-${datasetIndex}`)
          .attr('cx', d => xScale(d[currentParameter]))
          .attr('cy', d => yScale(d.depth))
          .attr('r', 3)
          .style('fill', color)
          .style('stroke', 'white')
          .style('stroke-width', 1)
          .style('cursor', 'pointer')
          .on('mouseover', function(event, d) {
              tooltip.transition()
                  .duration(200)
                  .style('opacity', .9);
              tooltip.html(`
                  <strong>${lakeName} Lake</strong><br/>
                  Date: ${formatDate(dataset.date)}<br/>
                  Depth: ${d.depth}m<br/>
                  ${getParameterLabel(currentParameter)}: ${d[currentParameter]}<br/>
                  Weather: ${dataset.weather}<br/>
                  Air Temp: ${dataset.air_temperature}°C
              `)
                  .style('left', (event.pageX + 10) + 'px')
                  .style('top', (event.pageY - 28) + 'px');
          })
          .on('mouseout', function(d) {
              tooltip.transition()
                  .duration(500)
                  .style('opacity', 0);
          });
  });
}

// Enhanced time series visualization
function createTimeSeriesView() {
  const container = d3.select('#chartsContainer');
  container.selectAll('*').remove();

  // Group data by depth ranges
  const depthRanges = [
      {name: 'Surface (0-2m)', min: 0, max: 2},
      {name: 'Mid-depth (3-8m)', min: 3, max: 8},
      {name: 'Deep (9m+)', min: 9, max: 50}
  ];

  depthRanges.forEach(range => {
      const chartDiv = container.append('div')
          .attr('class', 'chart-container');

      chartDiv.append('h3')
          .attr('class', 'chart-title')
          .text(`${range.name}`);

      createTimeChart(chartDiv, range);
  });

  updateLegend();
}

function createTimeChart(container, depthRange) {
  const margin = {top: 20, right: 30, bottom: 80, left: 60};
  const width = 550 - margin.left - margin.right;
  const height = 300 - margin.bottom - margin.top;

  const svg = container.append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

  // Process visible data for time series
  const visibleData = getVisibleData();
  const timeSeriesData = [];

  visibleData.forEach(dataset => {
      const relevantMeasurements = dataset.measurements.filter(m =>
          m.depth >= depthRange.min && m.depth <= depthRange.max
      );

      if (relevantMeasurements.length > 0) {
          const avgValue = d3.mean(relevantMeasurements, d => d[currentParameter]);
          timeSeriesData.push({
              lake: dataset.lake,
              date: new Date(dataset.date),
              value: avgValue,
              weather: dataset.weather,
              airTemp: dataset.air_temperature
          });
      }
  });

  if (timeSeriesData.length === 0) {
      container.append('p')
          .style('text-align', 'center')
          .style('color', '#666')
          .text('No visible data for this depth range');
      return;
  }

  // Group by lake
  const dataByLake = d3.group(timeSeriesData, d => d.lake);

  const xScale = d3.scaleTime()
      .domain(d3.extent(timeSeriesData, d => d.date))
      .range([0, width]);

  const yScale = d3.scaleLinear()
      .domain(d3.extent(timeSeriesData, d => d.value))
      .range([height, 0]);

  // Add grid
  svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale)
          .tickSize(-height)
          .tickFormat('')
      );

  svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale)
          .tickSize(-width)
          .tickFormat('')
      );

  // Add axes
  svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale)
          .ticks(d3.timeMonth.every(3))
          .tickFormat(d3.timeFormat('%B %Y')));

  svg.append('g')
      .attr('class', 'axis')
      .call(d3.axisLeft(yScale));

  // Add axis labels
  svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#666')
      .text(getParameterLabel(currentParameter));

  svg.append('text')
      .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 10})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#666')
      .text('Date');

  // Line generator
  const line = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

  // Add lines for each lake
  dataByLake.forEach((lakeData, lakeName) => {
      const sortedData = lakeData.sort((a, b) => a.date - b.date);
      const color = config.baseColorPalettes[lakeName][0];

      svg.append('path')
          .datum(sortedData)
          .attr('class', 'line')
          .attr('d', line)
          .style('stroke', color)
          .style('stroke-width', '2')
          .style('fill', 'none')
          .style('opacity', 0.8);

      // Add dots
      svg.selectAll(`.dot-${lakeName}`)
          .data(sortedData)
          .enter().append('circle')
          .attr('class', `dot dot-${lakeName}`)
          .attr('cx', d => xScale(d.date))
          .attr('cy', d => yScale(d.value))
          .attr('r', 3)
          .style('fill', color)
          .style('stroke', 'white')
          .style('stroke-width', 1)
          .style('cursor', 'pointer')
          .on('mouseover', function(event, d) {
              tooltip.transition()
                  .duration(200)
                  .style('opacity', .9);
              tooltip.html(`
                  <strong>${d.lake} Lake</strong><br/>
                  Date: ${formatDate(d.date)}<br/>
                  Depth Range: ${depthRange.name}<br/>
                  Avg ${getParameterLabel(currentParameter)}: ${d.value.toFixed(2)}<br/>
                  Weather: ${d.weather}<br/>
                  Air Temp: ${d.airTemp}°C
              `)
                  .style('left', (event.pageX + 10) + 'px')
                  .style('top', (event.pageY - 28) + 'px');
          })
          .on('mouseout', function(d) {
              tooltip.transition()
                  .duration(500)
                  .style('opacity', 0);
          });
  });
}

// Update legend for correlation plots
function updateCorrelationLegend() {
  const legend = d3.select('#legend');
  legend.selectAll('*').remove();

  const visibleData = getVisibleData();

  // Time gradient legend
  const legendHeader = legend.append('div')
      .style('margin-bottom', '15px');

  legendHeader.append('h4')
      .style('color', '#2c3e50')
      .style('margin-bottom', '10px')
      .text('Time Gradient');

  const gradientDiv = legendHeader.append('div')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('margin-bottom', '10px');

  // Create gradient bar
  const gradientSvg = gradientDiv.append('svg')
      .attr('width', 200)
      .attr('height', 20);

  const gradient = gradientSvg.append('defs')
      .append('linearGradient')
      .attr('id', 'timeGradient')
      .attr('x1', '0%')
      .attr('x2', '100%');

  gradient.append('stop')
      .attr('offset', '0%')
      .style('stop-color', d3.hsl(240, 0.7, 0.5).hex());

  gradient.append('stop')
      .attr('offset', '100%')
      .style('stop-color', d3.hsl(120, 0.7, 0.5).hex());

  gradientSvg.append('rect')
      .attr('width', 200)
      .attr('height', 20)
      .style('fill', 'url(#timeGradient)');

  gradientDiv.append('span')
      .style('margin-left', '10px')
      .style('font-size', '12px')
      .text('Earlier → Later');

  // Data summary
  if (visibleData.length > 0) {
      const dateRange = d3.extent(visibleData, d => new Date(d.date));
      const lakes = [...new Set(visibleData.map(d => d.lake))];

      legend.append('div')
          .style('background', '#f8f9fa')
          .style('padding', '10px')
          .style('border-radius', '5px')
          .style('margin-top', '10px')
          .html(`
              <strong>Data Overview:</strong><br/>
              Lakes: ${lakes.join(', ')}<br/>
              Datasets: ${visibleData.length}<br/>
              Date Range: ${formatDate(dateRange[0])} - ${formatDate(dateRange[1])}
          `);
  }
}

function updateLegend() {
  const legend = d3.select('#legend');
  legend.selectAll('*').remove();

  const visibleData = getVisibleData();

  if (currentView === 'depth') {
      // Legend for depth profiles with enhanced metadata
      const lakes = [...new Set(visibleData.map(d => d.lake))];
      lakes.forEach(lake => {
          const lakeData = visibleData.filter(d => d.lake === lake);
          const allLakeData = data.filter(d => d.lake === lake);
          const colors = generateColorPalette(config.baseColorPalettes[lake], allLakeData.length);

          lakeData.forEach((dataset) => {
              const datasetIndex = allLakeData.findIndex(d => d.date === dataset.date);
              const legendItem = legend.append('div')
                  .attr('class', 'legend-item');

              const legendHeader = legendItem.append('div')
                  .attr('class', 'legend-header');

              legendHeader.append('div')
                  .attr('class', 'legend-color')
                  .style('background-color', colors[datasetIndex]);

              legendHeader.append('span')
                  .text(`${lake} - ${formatDate(dataset.date)}`);

              // Add metadata
              const metadata = [];
              if (dataset.weather) metadata.push(`Weather: ${dataset.weather}`);
              if (dataset.air_temperature) metadata.push(`Air Temp: ${dataset.air_temperature}°C`);
              if (dataset.water_temperature) metadata.push(`Water Temp: ${dataset.water_temperature}°C`);
              if (dataset.measurers) metadata.push(`Measurers: ${dataset.measurers}`);
              if (dataset.time) metadata.push(`Time: ${dataset.time}`);

              if (metadata.length > 0) {
                  legendItem.append('div')
                      .attr('class', 'legend-metadata')
                      .html(metadata.join('<br/>'));
              }
          });
      });
  } else {
      // Legend for time series with metadata
      const lakes = [...new Set(visibleData.map(d => d.lake))];
      lakes.forEach(lake => {
          const lakeData = visibleData.filter(d => d.lake === lake);

          const legendItem = legend.append('div')
              .attr('class', 'legend-item');

          const legendHeader = legendItem.append('div')
              .attr('class', 'legend-header');

          legendHeader.append('div')
              .attr('class', 'legend-color')
              .style('background-color', config.baseColorPalettes[lake][0]);

          legendHeader.append('span')
              .text(`${lake} Lake`);

          // Add summary metadata
          const dateRange = d3.extent(lakeData, d => new Date(d.date));
          const weatherTypes = [...new Set(lakeData.map(d => d.weather).filter(w => w))];

          const metadata = [`Datasets: ${lakeData.length}`];
          if (dateRange[0] && dateRange[1]) {
              metadata.push(`Period: ${formatDate(dateRange[0])} - ${formatDate(dateRange[1])}`);
          }
          if (weatherTypes.length > 0) {
              metadata.push(`Weather: ${weatherTypes.join(', ')}`);
          }

          legendItem.append('div')
              .attr('class', 'legend-metadata')
              .html(metadata.join('<br/>'));
      });
  }
}

// Create Secchi Depth Time Series
function createSecchiDepthAnalysis() {
    const container = d3.select('#chartsContainer');
    container.selectAll('*').remove();

    const visibleData = getVisibleData();
    
    // Create main chart container
    const chartDiv = container.append('div')
        .attr('class', 'chart-container');

    chartDiv.append('h3')
        .attr('class', 'chart-title')
        .text('Secchi Depth Time Series Analysis');

    createSecchiTimeSeriesChart(chartDiv, visibleData);
    
    // Create correlation charts for surface parameters
    const surfaceParamsDiv = container.append('div')
        .attr('class', 'chart-container');

    surfaceParamsDiv.append('h3')
        .attr('class', 'chart-title')
        .text('Secchi Depth vs Surface Parameters');

    createSecchiCorrelationCharts(surfaceParamsDiv, visibleData);
    
    updateSecchiLegend();
}

function createSecchiTimeSeriesChart(container, datasets) {
    const margin = {top: 20, right: 30, bottom: 80, left: 60};
    const width = 550 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Process data
    const timeSeriesData = datasets.map(dataset => {
        const avgSecchi = d3.mean(dataset.secchi_depth);
        return {
            lake: dataset.lake,
            date: new Date(dataset.date),
            value: avgSecchi,
            weather: dataset.weather,
            airTemp: dataset.air_temperature,
            surfaceTemp: dataset.measurements[0].temperature,
            surfaceDO: dataset.measurements[0].DO,
            surfacePH: dataset.measurements[0].PH
        };
    }).filter(d => d.value !== undefined);

    if (timeSeriesData.length === 0) {
        container.append('p')
            .style('text-align', 'center')
            .style('color', '#666')
            .text('No Secchi depth data available');
        return;
    }

    // Group by lake
    const dataByLake = d3.group(timeSeriesData, d => d.lake);

    const xScale = d3.scaleTime()
        .domain(d3.extent(timeSeriesData, d => d.date))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([
            0,
            d3.max(timeSeriesData, d => d.value) * 1.1
        ])
        .range([height, 0]);

    // Add grid
    svg.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale)
            .tickSize(-height)
            .tickFormat('')
        );

    svg.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale)
            .tickSize(-width)
            .tickFormat('')
        );

    // Add axes
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale)
            .ticks(d3.timeMonth.every(2))
            .tickFormat(d3.timeFormat('%b %Y')));

    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale));

    // Add axis labels
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', '#666')
        .text('Secchi Depth (m)');

    svg.append('text')
        .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 10})`)
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', '#666')
        .text('Date');

    // Line generator
    const line = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX);

    // Add lines and points for each lake
    dataByLake.forEach((lakeData, lakeName) => {
        const sortedData = lakeData.sort((a, b) => a.date - b.date);

        // Add seasonal background bands
        const seasons = d3.group(sortedData, d => {
            const month = d.date.getMonth();
            if (month >= 2 && month <= 4) return 'spring';
            if (month >= 5 && month <= 7) return 'summer';
            if (month >= 8 && month <= 10) return 'fall';
            return 'winter';
        });

        // Add line
        svg.append('path')
            .datum(sortedData)
            .attr('class', 'line')
            .attr('d', line)
            .style('stroke', config.baseColorPalettes[lakeName][0])
            .style('stroke-width', '2')
            .style('fill', 'none')
            .style('opacity', 0.8);

        // Add points
        svg.selectAll(`.dot-${lakeName}`)
            .data(sortedData)
            .enter().append('circle')
            .attr('class', `dot dot-${lakeName}`)
            .attr('cx', d => xScale(d.date))
            .attr('cy', d => yScale(d.value))
            .attr('r', 5)
            .style('fill', d => getSeasonColor(d.date))
            .style('stroke', config.baseColorPalettes[lakeName][0])
            .style('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                tooltip.html(`
                    <strong>${d.lake} Lake</strong><br/>
                    Date: ${formatDate(d.date)}<br/>
                    Secchi Depth: ${d.value.toFixed(2)}m<br/>
                    Surface Temp: ${d.surfaceTemp.toFixed(1)}°C<br/>
                    Surface DO: ${d.surfaceDO.toFixed(2)} mg/L<br/>
                    Surface pH: ${d.surfacePH.toFixed(2)}<br/>
                    Weather: ${d.weather}<br/>
                    Air Temp: ${d.airTemp}°C
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function(d) {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });
    });
}

function createSecchiCorrelationCharts(container, datasets) {
    const surfaceParams = [
        {param: 'temperature', label: 'Surface Temperature (°C)'},
        {param: 'DO', label: 'Surface Dissolved Oxygen (mg/L)'},
        {param: 'PH', label: 'Surface pH'}
    ];

    const chartsContainer = container.append('div')
        .style('display', 'grid')
        .style('grid-template-columns', 'repeat(auto-fit, minmax(300px, 1fr))')
        .style('gap', '20px')
        .style('margin-top', '20px');

    surfaceParams.forEach(param => {
        const chartDiv = chartsContainer.append('div');
        createSecchiCorrelationChart(chartDiv, datasets, param);
    });
}

function createSecchiCorrelationChart(container, datasets, param) {
    const margin = {top: 20, right: 30, bottom: 60, left: 60};
    const width = 300 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Process data
    const correlationData = datasets.map(dataset => {
        const avgSecchi = d3.mean(dataset.secchi_depth);
        const surfaceValue = dataset.measurements[0][param.param];
        return {
            lake: dataset.lake,
            date: new Date(dataset.date),
            secchi: avgSecchi,
            value: surfaceValue,
            weather: dataset.weather,
            airTemp: dataset.air_temperature
        };
    }).filter(d => d.secchi !== undefined && d.value !== undefined);

    if (correlationData.length === 0) {
        container.append('p')
            .style('text-align', 'center')
            .style('color', '#666')
            .text('No data available');
        return;
    }

    const xScale = d3.scaleLinear()
        .domain(d3.extent(correlationData, d => d.value))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(correlationData, d => d.secchi) * 1.1])
        .range([height, 0]);

    // Add grid
    svg.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale)
            .tickSize(-height)
            .tickFormat('')
        );

    svg.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale)
            .tickSize(-width)
            .tickFormat('')
        );

    // Add axes
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale));

    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale));

    // Add axis labels
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#666')
        .text('Secchi Depth (m)');

    svg.append('text')
        .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 10})`)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#666')
        .text(param.label);

    // Add points
    correlationData.forEach(d => {
        svg.append('circle')
            .attr('cx', xScale(d.value))
            .attr('cy', yScale(d.secchi))
            .attr('r', 5)
            .style('fill', getSeasonColor(d.date))
            .style('stroke', config.baseColorPalettes[d.lake][0])
            .style('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseover', function(event) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                tooltip.html(`
                    <strong>${d.lake} Lake</strong><br/>
                    Date: ${formatDate(d.date)}<br/>
                    Secchi Depth: ${d.secchi.toFixed(2)}m<br/>
                    ${param.label}: ${d.value.toFixed(2)}<br/>
                    Weather: ${d.weather}<br/>
                    Air Temp: ${d.airTemp}°C
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });
    });

    // Add trend line
    const xValues = correlationData.map(d => d.value);
    const yValues = correlationData.map(d => d.secchi);
    
    const xMean = d3.mean(xValues);
    const yMean = d3.mean(yValues);
    
    const slope = d3.sum(xValues.map((x, i) => (x - xMean) * (yValues[i] - yMean))) /
                  d3.sum(xValues.map(x => Math.pow(x - xMean, 2)));
    
    const intercept = yMean - slope * xMean;
    
    const x1 = d3.min(xValues);
    const x2 = d3.max(xValues);
    const y1 = slope * x1 + intercept;
    const y2 = slope * x2 + intercept;
    
    svg.append('line')
        .attr('x1', xScale(x1))
        .attr('y1', yScale(y1))
        .attr('x2', xScale(x2))
        .attr('y2', yScale(y2))
        .style('stroke', '#666')
        .style('stroke-width', 1)
        .style('stroke-dasharray', '4,4');
}

function updateSecchiLegend() {
    const legend = d3.select('#legend');
    legend.selectAll('*').remove();

    const visibleData = getVisibleData();

    // Season legend
    const legendHeader = legend.append('div')
        .style('margin-bottom', '15px');

    legendHeader.append('h4')
        .style('color', '#2c3e50')
        .style('margin-bottom', '10px')
        .text('Seasonal Color Coding');

    const seasons = [
        {name: 'Spring', color: '#4CAF50'},
        {name: 'Summer', color: '#FF9800'},
        {name: 'Fall', color: '#FF5722'},
        {name: 'Winter', color: '#2196F3'}
    ];

    seasons.forEach(season => {
        const seasonDiv = legendHeader.append('div')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('margin-bottom', '5px');

        seasonDiv.append('div')
            .style('width', '20px')
            .style('height', '20px')
            .style('background-color', season.color)
            .style('margin-right', '10px')
            .style('border-radius', '50%');

        seasonDiv.append('span')
            .text(season.name);
    });

    // Data summary
    if (visibleData.length > 0) {
        const dateRange = d3.extent(visibleData, d => new Date(d.date));
        const lakes = [...new Set(visibleData.map(d => d.lake))];

        legend.append('div')
            .style('background', '#f8f9fa')
            .style('padding', '10px')
            .style('border-radius', '5px')
            .style('margin-top', '10px')
            .html(`
                <strong>Data Overview:</strong><br/>
                Lakes: ${lakes.join(', ')}<br/>
                Datasets: ${visibleData.length}<br/>
                Date Range: ${formatDate(dateRange[0])} - ${formatDate(dateRange[1])}
            `);
    }
}

function updateVisualization() {
    if (currentView === 'depth') {
        createDepthProfiles();
    } else if (currentParameter === 'temp_oxygen') {
        createTemperatureOxygenScatter();
    } else if (currentParameter === 'conductivity_tds') {
        createConductivityTDSScatter();
    } else if (currentParameter === 'ph_oxygen') {
        createPHOxygenScatter();
    } else if (currentParameter === 'secchi') {
        createSecchiDepthAnalysis();
    } else {
        createTimeSeriesView();
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  // Parameter button listeners
  document.querySelectorAll('.param-btn').forEach(btn => {
      btn.addEventListener('click', function() {
          document.querySelectorAll('.param-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          currentParameter = this.getAttribute('data-param');
          updateVisualization();
      });
  });

  // View toggle listener
  document.querySelectorAll('input[name="viewType"]').forEach(radio => {
      radio.addEventListener('change', function() {
          const isDepthProfile = this.value === 'depthProfiles';
          currentView = isDepthProfile ? 'depth': 'time';
          updateVisualization();
      });
  });

  // Initialize data loading
  loadData();
});
