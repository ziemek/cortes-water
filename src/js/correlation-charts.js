// Correlation Scatter Plot Charts
import { chartDimensions, config } from './config.js';
import {
  tooltip,
  formatDate,
  getParameterLabel,
  getTimeGradientColor,
  addGrid,
  addAxes,
  addTrendLine,
} from './utils.js';

export class CorrelationCharts {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  // Create Temperature-Oxygen Scatter Plot
  createTemperatureOxygenScatter() {
    const container = d3.select('#chartsContainer');
    container.selectAll('*').remove();

    const visibleData = this.dataLoader.getVisibleData();

    // Create depth-grouped charts
    config.depthRanges.forEach((range) => {
      const chartDiv = container.append('div').attr('class', 'chart-container');

      chartDiv
        .append('h3')
        .attr('class', 'chart-title')
        .text(`Temperature vs Dissolved Oxygen - ${range.name}`);

      this.createScatterChart(
        chartDiv,
        visibleData,
        'temperature',
        'DO',
        range
      );
    });
  }

  // Create Conductivity-TDS Scatter Plot
  createConductivityTDSScatter() {
    const container = d3.select('#chartsContainer');
    container.selectAll('*').remove();

    const visibleData = this.dataLoader.getVisibleData();

    const chartDiv = container.append('div').attr('class', 'chart-container');

    chartDiv
      .append('h3')
      .attr('class', 'chart-title')
      .text('Specific Conductance vs Total Dissolved Solids');

    this.createScatterChart(chartDiv, visibleData, 'SPC', 'TDS');
  }

  // Create pH-Oxygen Scatter Plot
  createPHOxygenScatter() {
    const container = d3.select('#chartsContainer');
    container.selectAll('*').remove();

    const visibleData = this.dataLoader.getVisibleData();

    // Create depth-grouped charts
    config.depthRanges.forEach((range) => {
      const chartDiv = container.append('div').attr('class', 'chart-container');

      chartDiv
        .append('h3')
        .attr('class', 'chart-title')
        .text(`pH vs Dissolved Oxygen - ${range.name}`);

      this.createScatterChart(chartDiv, visibleData, 'PH', 'DO', range);
    });
  }

  // Generic scatter plot creation
  createScatterChart(container, datasets, xParam, yParam, depthRange = null) {
    const margin = chartDimensions.margin;
    const width = chartDimensions.scatter.width - margin.left - margin.right;
    const height = chartDimensions.scatter.height - margin.bottom - margin.top;

    const svg = container
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Process data points
    const scatterData = [];
    datasets.forEach((dataset) => {
      let measurements = dataset.measurements;

      // Filter by depth range if specified
      if (depthRange) {
        measurements = measurements.filter(
          (m) => m.depth >= depthRange.min && m.depth <= depthRange.max
        );
      }

      measurements.forEach((m) => {
        if (
          m[xParam] !== null &&
          m[yParam] !== null &&
          m[xParam] !== undefined &&
          m[yParam] !== undefined
        ) {
          scatterData.push({
            x: m[xParam],
            y: m[yParam],
            depth: m.depth,
            lake: dataset.lake,
            date: dataset.date,
            weather: dataset.weather,
            airTemp: dataset.air_temperature,
          });
        }
      });
    });

    if (scatterData.length === 0) {
      container
        .append('p')
        .style('text-align', 'center')
        .style('color', '#666')
        .text(`No data available for ${xParam} vs ${yParam} correlation`);
      return;
    }

    // Set up scales
    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(scatterData, (d) => d.x))
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(scatterData, (d) => d.y))
      .range([height, 0]);

    // Get date range for time gradient
    const dateRange = d3.extent(scatterData, (d) => new Date(d.date));

    // Add grid and axes
    addGrid(svg, xScale, yScale, width, height);
    addAxes(
      svg,
      xScale,
      yScale,
      height,
      getParameterLabel(xParam),
      getParameterLabel(yParam)
    );

    // Add scatter points
    svg
      .selectAll('.scatter-dot')
      .data(scatterData)
      .enter()
      .append('circle')
      .attr('class', 'scatter-dot')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', 4)
      .style('fill', (d) =>
        getTimeGradientColor(d.date, dateRange[0], dateRange[1])
      )
      .style('stroke', 'white')
      .style('stroke-width', 1)
      .style('opacity', 0.7)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).style('opacity', 1).attr('r', 6);

        tooltip.transition().duration(200).style('opacity', 0.9);
        tooltip
          .html(
            `
                    <strong>${d.lake} Lake</strong><br/>
                    Date: ${formatDate(d.date)}<br/>
                    Depth: ${d.depth}m<br/>
                    ${getParameterLabel(xParam)}: ${d.x}<br/>
                    ${getParameterLabel(yParam)}: ${d.y}<br/>
                    Weather: ${d.weather || 'N/A'}<br/>
                    Air Temp: ${d.airTemp || 'N/A'}°C
                `
          )
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 28 + 'px');
      })
      .on('mouseout', function (d) {
        d3.select(this).style('opacity', 0.7).attr('r', 4);

        tooltip.transition().duration(500).style('opacity', 0);
      });

    // Add trend line
    addTrendLine(svg, scatterData, xScale, yScale, xParam, yParam);
  }
}
