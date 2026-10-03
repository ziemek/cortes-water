// Depth Profile Chart Visualization
import { chartDimensions, config } from './config.js';
import { generateColorPalette, getParameterLabel } from './utils.js';
import {
  addAxes,
  addGrid,
  createChartSvg,
  hideTooltip,
  samplingTooltip,
  showNoData,
  showTooltip,
} from './chart-utils.js';

export class DepthProfileCharts {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  /**
   * One chart per lake, one line per sampling.
   * @param {boolean} [options.horizontal] depth on the x axis instead of
   *   down the y axis
   */
  createDepthProfiles(parameter, { horizontal = false } = {}) {
    const container = d3.select('#chartsContainer');
    container.selectAll('*').remove();

    const dataByLake = d3.group(
      this.dataLoader.getVisibleData(),
      (d) => d.lake
    );

    dataByLake.forEach((lakeData, lake) => {
      const chartDiv = container.append('div').attr('class', 'chart-container');

      chartDiv
        .append('h3')
        .attr('class', 'chart-title')
        .text(horizontal ? `${lake} - Horizontal Depth View` : lake);

      this.createDepthChart(chartDiv, lakeData, lake, parameter, horizontal);
    });
  }

  // Each sampling keeps the same color whichever samplings are visible
  getSamplingColors(lakeName) {
    const lakeSeries = this.dataLoader
      .getAllSeries()
      .filter((s) => s.lake === lakeName);
    const colors = generateColorPalette(
      config.baseColorPalettes[lakeName],
      lakeSeries.length
    );
    return new Map(lakeSeries.map((s, i) => [s.dataset, colors[i]]));
  }

  createDepthChart(container, lakeData, lakeName, parameter, horizontal) {
    const hasValue = (m) => m[parameter] !== null && m[parameter] !== undefined;
    const allValues = lakeData.flatMap((d) =>
      d.measurements.filter(hasValue).map((m) => m[parameter])
    );

    if (allValues.length === 0) {
      showNoData(container, `No ${getParameterLabel(parameter)} data`);
      return;
    }

    const { svg, width, height } = createChartSvg(
      container,
      chartDimensions.depthProfile
    );

    const maxDepth = d3.max(lakeData, (d) =>
      d3.max(d.measurements, (m) => m.depth)
    );
    const valueExtent = d3.extent(allValues);
    const parameterLabel = getParameterLabel(parameter);

    // Vertical profiles read downward from the surface; horizontal ones put
    // depth on x and the value on y
    const xScale = d3
      .scaleLinear()
      .domain(horizontal ? [0, maxDepth] : valueExtent)
      .range([0, width]);
    const yScale = d3
      .scaleLinear()
      .domain(horizontal ? valueExtent : [0, maxDepth])
      .range(horizontal ? [height, 0] : [0, height]);
    const x = horizontal ? (m) => xScale(m.depth) : (m) => xScale(m[parameter]);
    const y = horizontal ? (m) => yScale(m[parameter]) : (m) => yScale(m.depth);

    addGrid(svg, xScale, yScale, width, height);
    addAxes(
      svg,
      xScale,
      yScale,
      height,
      horizontal ? 'Depth (m)' : parameterLabel,
      horizontal ? parameterLabel : 'Depth (m)'
    );

    const line = d3
      .line()
      .x(x)
      .y(y)
      .curve(horizontal ? d3.curveMonotoneX : d3.curveMonotoneY);

    const colors = this.getSamplingColors(lakeName);

    lakeData.forEach((dataset) => {
      const measurements = dataset.measurements.filter(hasValue);
      if (measurements.length === 0) return;
      const color = colors.get(dataset);

      svg
        .append('path')
        .datum(measurements)
        .attr('class', 'line')
        .attr('d', line)
        .style('stroke', color)
        .style('stroke-width', '2')
        .style('opacity', 0.8);

      svg
        .append('g')
        .selectAll('circle')
        .data(measurements)
        .join('circle')
        .attr('class', 'dot')
        .attr('r', 3)
        .attr('cx', x)
        .attr('cy', y)
        .style('fill', color)
        .style('stroke', 'white')
        .style('stroke-width', 1)
        .on('mouseover', (event, m) =>
          showTooltip(
            event,
            samplingTooltip(dataset, [
              `Depth: ${m.depth}m`,
              `${parameterLabel}: ${m[parameter]}`,
            ])
          )
        )
        .on('mouseout', hideTooltip);
    });
  }
}
