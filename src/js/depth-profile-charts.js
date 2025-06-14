// Depth Profile Chart Visualization
import { chartDimensions, config } from './config.js';
import {
  tooltip,
  formatDate,
  getParameterLabel,
  generateColorPalette,
  addGrid,
  addAxes,
} from './utils.js';

export class DepthProfileCharts {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  // Enhanced depth profile visualization
  createDepthProfiles(currentParameter) {
    const container = d3.select('#chartsContainer');
    container.selectAll('*').remove();

    const visibleData = this.dataLoader.getVisibleData();
    const lakes = [...new Set(visibleData.map((d) => d.lake))];

    lakes.forEach((lake) => {
      const lakeData = visibleData.filter((d) => d.lake === lake);
      if (lakeData.length === 0) return;

      const chartDiv = container.append('div').attr('class', 'chart-container');

      chartDiv.append('h3').attr('class', 'chart-title').text(`${lake}`);

      this.createDepthChart(chartDiv, lakeData, lake, currentParameter);
    });
  }

  createDepthChart(container, lakeData, lakeName, currentParameter) {
    const margin = chartDimensions.margin;
    const width = chartDimensions.width - margin.left - margin.right;
    const height = chartDimensions.height - margin.bottom - margin.top;

    const svg = container
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get value range for the parameter (filter out null values)
    const allValues = lakeData.flatMap((d) =>
      d.measurements
        .filter(
          (m) =>
            m[currentParameter] !== null && m[currentParameter] !== undefined
        )
        .map((m) => m[currentParameter])
    );
    const maxDepth = Math.max(
      ...lakeData.flatMap((d) => d.measurements.map((m) => m.depth))
    );

    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(allValues))
      .range([0, width]);

    const yScale = d3.scaleLinear().domain([0, maxDepth]).range([0, height]);

    // Add grid and axes
    addGrid(svg, xScale, yScale, width, height);
    addAxes(
      svg,
      xScale,
      yScale,
      height,
      getParameterLabel(currentParameter),
      'Depth (m)'
    );

    // Line generator
    const line = d3
      .line()
      .x((d) => xScale(d[currentParameter]))
      .y((d) => yScale(d.depth))
      .curve(d3.curveMonotoneY);

    // Generate colors for this lake's data
    const allLakeData = this.dataLoader
      .getData()
      .filter((d) => d.lake === lakeName);
    const colors = generateColorPalette(
      config.baseColorPalettes[lakeName],
      allLakeData.length
    );

    // Add lines for each visible dataset
    lakeData.forEach((dataset) => {
      const datasetIndex = allLakeData.findIndex(
        (d) => d.date === dataset.date
      );
      const color = colors[datasetIndex];

      // Filter out null values for the line
      const validMeasurements = dataset.measurements.filter(
        (m) => m[currentParameter] !== null && m[currentParameter] !== undefined
      );

      if (validMeasurements.length > 0) {
        svg
          .append('path')
          .datum(validMeasurements)
          .attr('class', 'line')
          .attr('d', line)
          .style('stroke', color)
          .style('stroke-width', '2')
          .style('fill', 'none')
          .style('opacity', 0.8);

        // Add dots only for valid measurements
        svg
          .selectAll(`.dot-${datasetIndex}`)
          .data(validMeasurements)
          .enter()
          .append('circle')
          .attr('class', `dot dot-${datasetIndex}`)
          .attr('cx', (d) => xScale(d[currentParameter]))
          .attr('cy', (d) => yScale(d.depth))
          .attr('r', 3)
          .style('fill', color)
          .style('stroke', 'white')
          .style('stroke-width', 1)
          .style('cursor', 'pointer')
          .on('mouseover', function (event, d) {
            tooltip.transition().duration(200).style('opacity', 0.9);
            tooltip
              .html(
                `
                            <strong>${lakeName} Lake</strong><br/>
                            Date: ${formatDate(dataset.date)}<br/>
                            Depth: ${d.depth}m<br/>
                            ${getParameterLabel(currentParameter)}: ${d[currentParameter]}<br/>
                            Weather: ${dataset.weather}<br/>
                            Air Temp: ${dataset.air_temperature}°C
                        `
              )
              .style('left', event.pageX + 10 + 'px')
              .style('top', event.pageY - 28 + 'px');
          })
          .on('mouseout', function (d) {
            tooltip.transition().duration(500).style('opacity', 0);
          });
      }
    });
  }
}
