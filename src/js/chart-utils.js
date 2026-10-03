// Shared D3 building blocks for the charts
import { chartDimensions } from './config.js';
import {
  formatDate,
  formatValue,
  getDateOnly,
  linearRegression,
} from './utils.js';

let tooltip = null;

function getTooltip() {
  if (!tooltip) {
    tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
  }
  return tooltip;
}

export function showTooltip(event, html) {
  getTooltip()
    .html(html)
    .style('left', event.pageX + 10 + 'px')
    .style('top', event.pageY - 28 + 'px')
    .transition()
    .duration(200)
    .style('opacity', 0.9);
}

export function hideTooltip() {
  getTooltip().transition().duration(500).style('opacity', 0);
}

// Tooltip lines shared by every chart: lake, date, then the given details,
// then the sampling conditions
export function samplingTooltip(dataset, details) {
  return [
    `<strong>${dataset.lake} Lake</strong>`,
    `Date: ${formatDate(dataset.date)}`,
    ...details,
    `Weather: ${formatValue(dataset.weather)}`,
    `Air Temp: ${formatValue(dataset.air_temperature, '°C')}`,
  ].join('<br/>');
}

/**
 * Appends an SVG of the given outer size with a plot group inset by the
 * standard margins.
 * @returns {{svg: d3.Selection, width: number, height: number}} the plot
 *   group and its inner size
 */
export function createChartSvg(container, { width, height }) {
  const { margin } = chartDimensions;
  const svg = container
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  return {
    svg,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
}

export function showNoData(container, message) {
  container.append('p').attr('class', 'no-data').text(message);
}

// Add grid to chart
export function addGrid(svg, xScale, yScale, width, height) {
  svg
    .append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).tickSize(-height).tickFormat(''));

  svg
    .append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(''));
}

function addAxisLabels(svg, width, height, xLabel, yLabel, offsets) {
  if (yLabel) {
    svg
      .append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', offsets.yLabel)
      .attr('x', -height / 2)
      .attr('dy', '1em')
      .text(yLabel);
  }

  if (xLabel) {
    svg
      .append('text')
      .attr('class', 'axis-label')
      .attr('transform', `translate(${width / 2}, ${height + offsets.xLabel})`)
      .text(xLabel);
  }
}

// Add axes to chart
export function addAxes(svg, xScale, yScale, height, xLabel, yLabel) {
  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale));

  svg.append('g').attr('class', 'axis').call(d3.axisLeft(yScale));

  addAxisLabels(svg, xScale.range()[1], height, xLabel, yLabel, {
    xLabel: 40,
    yLabel: -50,
  });
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

// Axes for a chart with dates on x, ticked to suit the date range
export function addTimeAxes(svg, xScale, yScale, height, yLabel) {
  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height})`)
    .call(
      d3
        .axisBottom(xScale)
        .ticks(getTimeTickInterval(xScale.domain()))
        .tickFormat(d3.timeFormat('%b %Y'))
    );

  svg.append('g').attr('class', 'axis').call(d3.axisLeft(yScale));

  addAxisLabels(svg, xScale.range()[1], height, 'Date', yLabel, {
    xLabel: 60,
    yLabel: -55,
  });
}

/**
 * Draws the least-squares line across the x domain, labelled with R² unless
 * compact. Nothing is drawn when the fit is undefined.
 * @param {{x: number, y: number}[]} data
 */
export function addTrendLine(
  svg,
  data,
  xScale,
  yScale,
  { compact = false } = {}
) {
  const fit = linearRegression(data);
  if (!fit) return;

  const [x1, x2] = xScale.domain();
  svg
    .append('line')
    .attr('class', compact ? 'trend-line compact' : 'trend-line')
    .attr('x1', xScale(x1))
    .attr('y1', yScale(fit.slope * x1 + fit.intercept))
    .attr('x2', xScale(x2))
    .attr('y2', yScale(fit.slope * x2 + fit.intercept));

  if (compact || !Number.isFinite(fit.rSquared)) return;

  svg
    .append('text')
    .attr('class', 'trend-label')
    .attr('x', xScale.range()[1] - 10)
    .attr('y', yScale.range()[1] + 20)
    .attr('text-anchor', 'end')
    .text(`R² = ${fit.rSquared.toFixed(3)}`);
}
