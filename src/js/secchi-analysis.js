// Secchi Depth Analysis Charts
import { chartDimensions } from './config.js';
import { getLakeColor, getSeasonColor } from './theme.js';
import {
  addAxes,
  addGrid,
  addTimeAxes,
  addTrendLine,
  createChartSvg,
  hideTooltip,
  samplingTooltip,
  showNoData,
  showTooltip,
} from './chart-utils.js';

const SURFACE_PARAMETERS = [
  { param: 'temperature', label: 'Surface Temperature (°C)' },
  { param: 'DO', label: 'Surface Dissolved Oxygen (mg/L)' },
  { param: 'PH', label: 'Surface pH' },
];

/**
 * Visible samplings that have at least one Secchi reading.
 * @returns {{dataset: object, date: Date, secchi: number, surface: object|undefined}[]}
 *   secchi is the mean reading; surface is the 0 m measurement, undefined
 *   when the profile doesn't include one
 */
function getSecchiSamplings(datasets) {
  return datasets
    .map((dataset) => ({
      dataset,
      date: new Date(dataset.date),
      secchi: d3.mean(dataset.secchi_depth || []),
      surface: (dataset.measurements || []).find((m) => m.depth === 0),
    }))
    .filter((s) => s.secchi !== undefined);
}

export class SecchiAnalysis {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  createSecchiDepthAnalysis() {
    const container = d3.select('#chartsContainer');
    container.selectAll('*').remove();

    const samplings = getSecchiSamplings(this.dataLoader.getVisibleData());

    const chartDiv = container.append('div').attr('class', 'chart-container');
    chartDiv
      .append('h3')
      .attr('class', 'chart-title')
      .text('Secchi depth over time');
    this.createSecchiTimeSeriesChart(chartDiv, samplings);

    const surfaceParamsDiv = container
      .append('div')
      .attr('class', 'chart-container');
    surfaceParamsDiv
      .append('h3')
      .attr('class', 'chart-title')
      .text('Secchi depth vs surface conditions');

    const grid = surfaceParamsDiv.append('div').attr('class', 'secchi-grid');
    // Cells are all added before drawing so each is measured at its final
    // grid width
    const cells = SURFACE_PARAMETERS.map(() => grid.append('div'));
    SURFACE_PARAMETERS.forEach((param, i) => {
      this.createSecchiCorrelationChart(cells[i], samplings, param);
    });
  }

  createSecchiTimeSeriesChart(container, samplings) {
    if (samplings.length === 0) {
      showNoData(container, 'No Secchi depth data available');
      return;
    }

    const { svg, width, height } = createChartSvg(
      container,
      chartDimensions.secchiTimeSeries
    );

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(samplings, (d) => d.date))
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(samplings, (d) => d.secchi) * 1.1])
      .range([height, 0]);

    addGrid(svg, xScale, yScale, width, height);
    addTimeAxes(svg, xScale, yScale, height, 'Secchi Depth (m)');

    const line = d3
      .line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.secchi))
      .curve(d3.curveMonotoneX);

    const surfaceDetails = (surface) =>
      [
        surface?.temperature != null &&
          `Surface Temp: ${surface.temperature.toFixed(1)}°C`,
        surface?.DO != null && `Surface DO: ${surface.DO.toFixed(2)} mg/L`,
        surface?.PH != null && `Surface pH: ${surface.PH.toFixed(2)}`,
      ].filter(Boolean);

    d3.group(samplings, (d) => d.dataset.lake).forEach((lakeData, lakeName) => {
      lakeData.sort((a, b) => a.date - b.date);
      const lakeColor = getLakeColor(lakeName);

      svg
        .append('path')
        .datum(lakeData)
        .attr('class', 'line')
        .attr('d', line)
        .style('stroke', lakeColor)
        .style('stroke-width', '2');

      svg
        .append('g')
        .selectAll('circle')
        .data(lakeData)
        .join('circle')
        .attr('class', 'dot')
        .attr('r', 5)
        .attr('cx', (d) => xScale(d.date))
        .attr('cy', (d) => yScale(d.secchi))
        .style('fill', (d) => getSeasonColor(d.date))
        .style('stroke', lakeColor)
        .style('stroke-width', 2)
        .on('mouseover', (event, d) =>
          showTooltip(
            event,
            samplingTooltip(d.dataset, [
              `Secchi Depth: ${d.secchi.toFixed(2)}m`,
              ...surfaceDetails(d.surface),
            ])
          )
        )
        .on('mouseout', hideTooltip);
    });
  }

  createSecchiCorrelationChart(container, samplings, { param, label }) {
    const points = samplings
      .filter((s) => s.surface?.[param] != null)
      .map((s) => ({ ...s, x: s.surface[param], y: s.secchi }));

    if (points.length === 0) {
      showNoData(container, 'No data available');
      return;
    }

    const { svg, width, height } = createChartSvg(
      container,
      chartDimensions.secchiCorrelation
    );

    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(points, (d) => d.x))
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(points, (d) => d.y) * 1.1])
      .range([height, 0]);

    addGrid(svg, xScale, yScale, width, height);
    addAxes(svg, xScale, yScale, height, label, 'Secchi Depth (m)');

    svg
      .append('g')
      .selectAll('circle')
      .data(points)
      .join('circle')
      .attr('class', 'secchi-dot')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', 5)
      .style('fill', (d) => getSeasonColor(d.date))
      .style('stroke', (d) => getLakeColor(d.dataset.lake))
      .on('mouseover', (event, d) =>
        showTooltip(
          event,
          samplingTooltip(d.dataset, [
            `Secchi Depth: ${d.y.toFixed(2)}m`,
            `${label}: ${d.x.toFixed(2)}`,
          ])
        )
      )
      .on('mouseout', hideTooltip);

    addTrendLine(svg, points, xScale, yScale, { compact: true });
  }
}
