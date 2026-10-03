// Utility functions for charts and data processing
import { config } from './config.js';

const SAMPLING_TIME_ZONE = 'America/Vancouver';

// en-CA formats dates as YYYY-MM-DD
const pacificDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAMPLING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Dynamic color generation
export function generateColorPalette(baseColors, count) {
  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  const colors = [...baseColors];
  const hslBase = baseColors.map((hex) => d3.hsl(hex));

  for (let i = baseColors.length; i < count; i++) {
    const baseIndex = i % baseColors.length;
    const variation = Math.floor(i / baseColors.length);

    const baseHsl = hslBase[baseIndex];
    const newHsl = d3.hsl(
      (baseHsl.h + variation * 25) % 360,
      Math.max(0.3, baseHsl.s - variation * 0.1),
      Math.max(
        0.3,
        Math.min(0.8, baseHsl.l + (variation % 2 === 0 ? 0.1 : -0.1))
      )
    );

    colors.push(newHsl.hex());
  }

  return colors;
}

// Generate season color
export function getSeasonColor(date) {
  const month = Number(getDateOnly(date).slice(5, 7)) - 1;
  if (month >= 2 && month <= 4) return config.seasonColors.spring;
  if (month >= 5 && month <= 7) return config.seasonColors.summer;
  if (month >= 8 && month <= 10) return config.seasonColors.fall;
  return config.seasonColors.winter;
}

// Generate time-based color gradient
export function getTimeGradientColor(date, minDate, maxDate) {
  const totalTime = maxDate.getTime() - minDate.getTime();
  const currentTime = new Date(date).getTime() - minDate.getTime();
  const ratio = totalTime > 0 ? currentTime / totalTime : 0;

  // Color gradient from blue (early) to green (late)
  const hue = 240 - ratio * 120; // 240 = blue, 120 = green
  return d3.hsl(hue, 0.7, 0.5).hex();
}

// Format date for display
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    timeZone: SAMPLING_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Get parameter label
export function getParameterLabel(param) {
  return config.parameterLabels[param] || param;
}

// Display text for an optional value, "N/A" when it wasn't recorded
export function formatValue(value, unit = '') {
  return value === null || value === undefined ? 'N/A' : `${value}${unit}`;
}

// Tick interval for a time axis, based on the number of Pacific calendar
// months the extent spans
export function getTimeTickInterval([startDate, endDate]) {
  const months = (date) => {
    const [year, month] = getDateOnly(date).split('-').map(Number);
    return year * 12 + month;
  };
  const span = months(endDate) - months(startDate);

  if (span <= 6) return d3.timeMonth.every(1);
  if (span <= 12) return d3.timeMonth.every(2);
  if (span <= 24) return d3.timeMonth.every(3);
  if (span <= 48) return d3.timeMonth.every(6);
  return d3.timeYear.every(1);
}

// Initialize global tooltip
export const tooltip = d3
  .select('body')
  .append('div')
  .attr('class', 'tooltip')
  .style('opacity', 0);

// Add grid to chart
export function addGrid(svg, xScale, yScale, width, height) {
  // X grid
  svg
    .append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).tickSize(-height).tickFormat(''));

  // Y grid
  svg
    .append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(''));
}

// Add axes to chart
export function addAxes(svg, xScale, yScale, height, xLabel, yLabel) {
  // X axis
  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale));

  // Y axis
  svg.append('g').attr('class', 'axis').call(d3.axisLeft(yScale));

  // Y axis label
  if (yLabel) {
    svg
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -50)
      .attr('x', -height / 2)
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#666')
      .text(yLabel);
  }

  // X axis label
  if (xLabel) {
    svg
      .append('text')
      .attr('transform', `translate(${xScale.range()[1] / 2}, ${height + 40})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#666')
      .text(xLabel);
  }
}

/**
 * Least-squares fit of y on x.
 * @param {{x: number, y: number}[]} points
 * @returns {{slope: number, intercept: number, rSquared: number} | null}
 *   null when the line is undefined (fewer than 2 points or no spread in x);
 *   rSquared is NaN when every y is the same.
 */
export function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;

  const xMean = d3.mean(points, (d) => d.x);
  const yMean = d3.mean(points, (d) => d.y);
  const sxx = d3.sum(points, (d) => (d.x - xMean) ** 2);
  if (sxx === 0) return null;

  const sxy = d3.sum(points, (d) => (d.x - xMean) * (d.y - yMean));
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;

  const totalSumSquares = d3.sum(points, (d) => (d.y - yMean) ** 2);
  const residualSumSquares = d3.sum(
    points,
    (d) => (d.y - (slope * d.x + intercept)) ** 2
  );
  const rSquared = 1 - residualSumSquares / totalSumSquares;

  return { slope, intercept, rSquared };
}

// Add trend line to scatter plot
export function addTrendLine(svg, data, xScale, yScale) {
  const fit = linearRegression(data);
  if (!fit) return;
  const { slope, intercept, rSquared } = fit;

  // Draw trend line
  const xDomain = xScale.domain();
  const trendLineData = [
    { x: xDomain[0], y: slope * xDomain[0] + intercept },
    { x: xDomain[1], y: slope * xDomain[1] + intercept },
  ];

  const line = d3
    .line()
    .x((d) => xScale(d.x))
    .y((d) => yScale(d.y));

  svg
    .append('path')
    .datum(trendLineData)
    .attr('class', 'trend-line')
    .attr('d', line)
    .style('stroke', '#333')
    .style('stroke-width', 2)
    .style('stroke-dasharray', '5,5')
    .style('fill', 'none')
    .style('opacity', 0.8);

  if (!Number.isFinite(rSquared)) return;

  // Add R-squared label
  svg
    .append('text')
    .attr('x', xScale.range()[1] - 10)
    .attr('y', yScale.range()[1] + 20)
    .attr('text-anchor', 'end')
    .style('font-size', '12px')
    .style('fill', '#666')
    .text(`R² = ${rSquared.toFixed(3)}`);
}

// Convert date string to valid CSS ID
export function dateToValidId(dateString) {
  return dateString.replace(/[:.]/g, '-');
}

// Calendar date (YYYY-MM-DD) of a sampling in the lakes' local time,
// independent of the viewer's timezone
export function getDateOnly(dateString) {
  return pacificDateFormat.format(new Date(dateString));
}

export function getYear(dateString) {
  return Number(getDateOnly(dateString).slice(0, 4));
}

// Format date-only string for display
export function formatDateOnly(dateOnlyString) {
  const date = new Date(dateOnlyString + 'T12:00:00Z');
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
