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
 * Appends an SVG as wide as the container, with its height from the given
 * aspect ratio, and a plot group inset by the standard margins.
 * @returns {{svg: d3.Selection, width: number, height: number}} the plot
 *   group and its inner size
 */
export function createChartSvg(container, { aspect, minHeight, maxHeight }) {
  const { margin } = chartDimensions;
  const node = container.node();
  const style = getComputedStyle(node);
  const contentWidth =
    node.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight);
  const outerWidth = Math.max(260, Math.floor(contentWidth));
  const outerHeight = Math.round(
    Math.min(maxHeight, Math.max(minHeight, outerWidth * aspect))
  );
  const svg = container
    .append('svg')
    .attr('class', 'chart-svg')
    .attr('width', outerWidth)
    .attr('height', outerHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  return {
    svg,
    width: outerWidth - margin.left - margin.right,
    height: outerHeight - margin.top - margin.bottom,
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
    .call(
      d3
        .axisBottom(xScale)
        .ticks(Math.max(2, Math.floor(width / 80)))
        .tickSize(-height)
        .tickFormat('')
    );

  svg
    .append('g')
    .attr('class', 'grid')
    .call(
      d3
        .axisLeft(yScale)
        .ticks(Math.max(4, Math.floor(height / 40)))
        .tickSize(-width)
        .tickFormat('')
    );
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
    .call(
      d3
        .axisBottom(xScale)
        .ticks(Math.max(2, Math.floor(xScale.range()[1] / 80)))
    );

  svg
    .append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(Math.max(4, Math.floor(height / 40))));

  addAxisLabels(svg, xScale.range()[1], height, xLabel, yLabel, {
    xLabel: 42,
    yLabel: -58,
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

// Axes for a chart with dates on x, ticked to suit the date range and
// thinned so labels don't collide at narrow widths
export function addTimeAxes(svg, xScale, yScale, height, yLabel) {
  const width = xScale.range()[1];
  const ticks = xScale.ticks(getTimeTickInterval(xScale.domain()));
  const step = Math.max(1, Math.ceil((ticks.length * 72) / width));

  svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height})`)
    .call(
      d3
        .axisBottom(xScale)
        .tickValues(ticks.filter((_, i) => i % step === 0))
        .tickFormat(d3.timeFormat('%b %Y'))
    );

  svg
    .append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(Math.max(4, Math.floor(height / 40))));

  addAxisLabels(svg, width, height, null, yLabel, { xLabel: 0, yLabel: -58 });
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
    .attr('y', yScale.range()[1] + 16)
    .attr('text-anchor', 'end')
    .text(`R² = ${fit.rSquared.toFixed(3)}`);
}
