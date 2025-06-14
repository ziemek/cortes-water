// Utility functions for charts and data processing
import { config } from './config.js';

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
  const month = new Date(date).getMonth();
  if (month >= 2 && month <= 4) return config.seasonColors.spring;
  if (month >= 5 && month <= 7) return config.seasonColors.summer;
  if (month >= 8 && month <= 10) return config.seasonColors.fall;
  return config.seasonColors.winter;
}

// Generate time-based color gradient
export function getTimeGradientColor(date, minDate, maxDate) {
  const totalTime = maxDate.getTime() - minDate.getTime();
  const currentTime = new Date(date).getTime() - minDate.getTime();
  const ratio = currentTime / totalTime;

  // Color gradient from blue (early) to red (late)
  const hue = 240 - ratio * 120; // 240 = blue, 120 = red
  return d3.hsl(hue, 0.7, 0.5).hex();
}

// Format date for display
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Get parameter label
export function getParameterLabel(param) {
  return config.parameterLabels[param] || param;
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

// Add trend line to scatter plot
export function addTrendLine(svg, data, xScale, yScale, xParam, yParam) {
  // Calculate linear regression
  const n = data.length;
  const sumX = d3.sum(data, (d) => d.x);
  const sumY = d3.sum(data, (d) => d.y);
  const sumXY = d3.sum(data, (d) => d.x * d.y);
  const sumXX = d3.sum(data, (d) => d.x * d.x);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const totalSumSquares = d3.sum(data, (d) => Math.pow(d.y - yMean, 2));
  const residualSumSquares = d3.sum(data, (d) =>
    Math.pow(d.y - (slope * d.x + intercept), 2)
  );
  const rSquared = 1 - residualSumSquares / totalSumSquares;

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

// Extract date-only string (YYYY-MM-DD) from datetime string
export function getDateOnly(dateString) {
  return new Date(dateString).toISOString().split('T')[0];
}

// Format date-only string for display
export function formatDateOnly(dateOnlyString) {
  const date = new Date(dateOnlyString + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
