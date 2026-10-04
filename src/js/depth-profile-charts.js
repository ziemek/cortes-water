// Depth Profile Chart Visualization
import { chartDimensions } from './config.js';
import { getParameterLabel } from './utils.js';
import { fadedLakeColor, getLakeColor } from './theme.js';
import {
  addAxes,
  addGrid,
  createChartSvg,
  hideTooltip,
  samplingTooltip,
  showNoData,
  showTooltip,
} from './chart-utils.js';

// How far toward the lake color the earliest sampling's line is faded
export const FAINTEST = 0.3;

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

      chartDiv.append('h3').attr('class', 'chart-title').text(`${lake} Lake`);

      this.createDepthChart(chartDiv, lakeData, parameter, horizontal);
    });
  }

  // Samplings shade from faint (earliest shown) to the full lake color
  // (latest shown)
  getSamplingColors(lakeData) {
    const { lake } = lakeData[0];
    const ramp = d3.interpolateLab(
      fadedLakeColor(lake, FAINTEST),
      getLakeColor(lake)
    );
    const sorted = [...lakeData].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
    return new Map(
      sorted.map((d, i) => [
        d,
        ramp(sorted.length > 1 ? i / (sorted.length - 1) : 1),
      ])
    );
  }

  createDepthChart(container, lakeData, parameter, horizontal) {
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

    const colors = this.getSamplingColors(lakeData);

    // Latest sampling drawn last so it sits on top
    [...lakeData]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach((dataset) => {
        const measurements = dataset.measurements.filter(hasValue);
        if (measurements.length === 0) return;
        const color = colors.get(dataset);

        svg
          .append('path')
          .datum(measurements)
          .attr('class', 'line')
          .attr('d', line)
          .style('stroke', color)
          .style('stroke-width', '2');

        svg
          .append('g')
          .selectAll('circle')
          .data(measurements)
          .join('circle')
          .attr('class', 'dot')
          .attr('r', 4)
          .attr('cx', x)
          .attr('cy', y)
          .style('fill', color)
          .style('stroke', 'var(--chart-surface)')
          .style('stroke-width', 2)
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
