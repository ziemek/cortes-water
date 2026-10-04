// Time Series Chart Visualization
import { chartDimensions, config } from './config.js';
import { getParameterLabel } from './utils.js';
import { getLakeColor } from './theme.js';
import {
  addGrid,
  addTimeAxes,
  createChartSvg,
  hideTooltip,
  samplingTooltip,
  showNoData,
  showTooltip,
} from './chart-utils.js';

export class TimeSeriesCharts {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  // One chart per depth range, one line per lake
  createTimeSeriesView(parameter) {
    const container = d3.select('#chartsContainer');
    container.selectAll('*').remove();

    config.depthRanges.forEach((range) => {
      const chartDiv = container.append('div').attr('class', 'chart-container');
      chartDiv.append('h3').attr('class', 'chart-title').text(range.name);
      this.createTimeChart(chartDiv, range, parameter);
    });
  }

  createTimeChart(container, depthRange, parameter) {
    // Each sampling's mean value over the depth range
    const points = this.dataLoader.getVisibleData().flatMap((dataset) => {
      const values = dataset.measurements
        .filter((m) => m.depth >= depthRange.min && m.depth <= depthRange.max)
        .map((m) => m[parameter])
        .filter((value) => value !== null && value !== undefined);
      if (values.length === 0) return [];
      return [
        { dataset, date: new Date(dataset.date), value: d3.mean(values) },
      ];
    });

    if (points.length === 0) {
      showNoData(container, 'No visible data for this depth range');
      return;
    }

    const { svg, width, height } = createChartSvg(
      container,
      chartDimensions.timeSeries
    );

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(points, (d) => d.date))
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(points, (d) => d.value))
      .nice()
      .range([height, 0]);

    addGrid(svg, xScale, yScale, width, height);
    addTimeAxes(svg, xScale, yScale, height, getParameterLabel(parameter));

    const line = d3
      .line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    d3.group(points, (d) => d.dataset.lake).forEach((lakePoints, lakeName) => {
      lakePoints.sort((a, b) => a.date - b.date);
      const color = getLakeColor(lakeName);

      svg
        .append('path')
        .datum(lakePoints)
        .attr('class', 'line')
        .attr('d', line)
        .style('stroke', color)
        .style('stroke-width', '2');

      svg
        .append('g')
        .selectAll('circle')
        .data(lakePoints)
        .join('circle')
        .attr('class', 'dot')
        .attr('r', 4)
        .attr('cx', (d) => xScale(d.date))
        .attr('cy', (d) => yScale(d.value))
        .style('fill', color)
        .style('stroke', 'var(--chart-surface)')
        .style('stroke-width', 2)
        .on('mouseover', (event, d) =>
          showTooltip(
            event,
            samplingTooltip(d.dataset, [
              `Depth Range: ${depthRange.name}`,
              `Avg ${getParameterLabel(parameter)}: ${d.value.toFixed(2)}`,
            ])
          )
        )
        .on('mouseout', hideTooltip);
    });
  }
}
