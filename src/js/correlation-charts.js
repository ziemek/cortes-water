// Correlation Scatter Plot Charts
import { chartDimensions, config } from './config.js';
import { getParameterLabel } from './utils.js';
import { getTimeGradientColor } from './theme.js';
import {
  addAxes,
  addGrid,
  addTrendLine,
  createChartSvg,
  hideTooltip,
  samplingTooltip,
  showNoData,
  showTooltip,
} from './chart-utils.js';

// Correlation views by parameter button; byDepth draws one chart per depth
// range instead of one for the whole profile
const CORRELATIONS = {
  temp_oxygen: {
    title: 'Temperature vs Dissolved Oxygen',
    x: 'temperature',
    y: 'DO',
    byDepth: true,
  },
  conductivity_tds: {
    title: 'Specific Conductance vs Total Dissolved Solids',
    x: 'SPC',
    y: 'TDS',
    byDepth: false,
  },
  ph_oxygen: {
    title: 'pH vs Dissolved Oxygen',
    x: 'PH',
    y: 'DO',
    byDepth: true,
  },
};

export const correlationParameters = Object.keys(CORRELATIONS);

export class CorrelationCharts {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  createCorrelationView(parameter) {
    const { title, x, y, byDepth } = CORRELATIONS[parameter];
    const container = d3.select('#chartsContainer');
    container.selectAll('*').remove();

    const visibleData = this.dataLoader.getVisibleData();
    const ranges = byDepth ? config.depthRanges : [null];

    ranges.forEach((range) => {
      const chartDiv = container.append('div').attr('class', 'chart-container');

      chartDiv
        .append('h3')
        .attr('class', 'chart-title')
        .text(range ? range.name : 'All depths');

      this.createScatterChart(chartDiv, visibleData, x, y, range);
    });
  }

  createScatterChart(container, datasets, xParam, yParam, depthRange) {
    const hasValue = (value) => value !== null && value !== undefined;
    const inRange = (m) =>
      !depthRange || (m.depth >= depthRange.min && m.depth <= depthRange.max);

    const scatterData = datasets.flatMap((dataset) =>
      dataset.measurements
        .filter((m) => inRange(m) && hasValue(m[xParam]) && hasValue(m[yParam]))
        .map((m) => ({ x: m[xParam], y: m[yParam], depth: m.depth, dataset }))
    );

    const xLabel = getParameterLabel(xParam);
    const yLabel = getParameterLabel(yParam);

    if (scatterData.length === 0) {
      showNoData(container, `No data available for ${xLabel} vs ${yLabel}`);
      return;
    }

    const { svg, width, height } = createChartSvg(
      container,
      chartDimensions.scatter
    );

    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(scatterData, (d) => d.x))
      .nice()
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(scatterData, (d) => d.y))
      .nice()
      .range([height, 0]);

    const [minDate, maxDate] = d3.extent(
      scatterData,
      (d) => new Date(d.dataset.date)
    );

    addGrid(svg, xScale, yScale, width, height);
    addAxes(svg, xScale, yScale, height, xLabel, yLabel);

    svg
      .append('g')
      .selectAll('circle')
      .data(scatterData)
      .join('circle')
      .attr('class', 'scatter-dot')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', 4.5)
      .style('fill', (d) =>
        getTimeGradientColor(d.dataset.date, minDate, maxDate)
      )
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget).attr('r', 6.5);
        showTooltip(
          event,
          samplingTooltip(d.dataset, [
            `Depth: ${d.depth}m`,
            `${xLabel}: ${d.x}`,
            `${yLabel}: ${d.y}`,
          ])
        );
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget).attr('r', 4.5);
        hideTooltip();
      });

    addTrendLine(svg, scatterData, xScale, yScale);
  }
}
