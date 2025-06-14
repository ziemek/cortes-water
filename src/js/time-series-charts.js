// Time Series Chart Visualization
import { chartDimensions, config } from './config.js';
import {
  tooltip,
  formatDate,
  getParameterLabel,
  addGrid,
  addAxes,
} from './utils.js';

export class TimeSeriesCharts {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  // Calculate optimal tick interval based on date range
  getOptimalTickInterval(dateExtent) {
    const [startDate, endDate] = dateExtent;
    const timeDiffMonths =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());

    // Choose tick interval based on total time span
    if (timeDiffMonths <= 6) {
      return d3.timeMonth.every(1); // Monthly ticks for 6 months or less
    } else if (timeDiffMonths <= 12) {
      return d3.timeMonth.every(2); // Every 2 months for up to 1 year
    } else if (timeDiffMonths <= 24) {
      return d3.timeMonth.every(3); // Every 3 months for up to 2 years
    } else if (timeDiffMonths <= 48) {
      return d3.timeMonth.every(6); // Every 6 months for up to 4 years
    } else {
      return d3.timeYear.every(1); // Yearly ticks for longer periods
    }
  }

  // Enhanced time series visualization
  createTimeSeriesView(currentParameter) {
    const container = d3.select('#chartsContainer');
    container.selectAll('*').remove();

    // Group data by depth ranges
    config.depthRanges.forEach((range) => {
      const chartDiv = container.append('div').attr('class', 'chart-container');

      chartDiv.append('h3').attr('class', 'chart-title').text(`${range.name}`);

      this.createTimeChart(chartDiv, range, currentParameter);
    });
  }

  createTimeChart(container, depthRange, currentParameter) {
    const margin = chartDimensions.margin;
    const width = chartDimensions.timeSeries.width - margin.left - margin.right;
    const height =
      chartDimensions.timeSeries.height - margin.bottom - margin.top;

    const svg = container
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Process visible data for time series
    const visibleData = this.dataLoader.getVisibleData();
    const timeSeriesData = [];

    visibleData.forEach((dataset) => {
      const relevantMeasurements = dataset.measurements.filter(
        (m) =>
          m.depth >= depthRange.min &&
          m.depth <= depthRange.max &&
          m[currentParameter] !== null &&
          m[currentParameter] !== undefined
      );

      if (relevantMeasurements.length > 0) {
        const avgValue = d3.mean(
          relevantMeasurements,
          (d) => d[currentParameter]
        );
        if (avgValue !== undefined && avgValue !== null) {
          timeSeriesData.push({
            lake: dataset.lake,
            date: new Date(dataset.date),
            value: avgValue,
            weather: dataset.weather,
            airTemp: dataset.air_temperature,
          });
        }
      }
    });

    if (timeSeriesData.length === 0) {
      container
        .append('p')
        .style('text-align', 'center')
        .style('color', '#666')
        .text('No visible data for this depth range');
      return;
    }

    // Group by lake
    const dataByLake = d3.group(timeSeriesData, (d) => d.lake);

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(timeSeriesData, (d) => d.date))
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(timeSeriesData, (d) => d.value))
      .range([height, 0]);

    // Add grid and axes
    addGrid(svg, xScale, yScale, width, height);

    // Calculate optimal tick interval based on date range
    const dateExtent = d3.extent(timeSeriesData, (d) => d.date);
    const tickInterval = this.getOptimalTickInterval(dateExtent);

    // Add axes with dynamic time formatting
    svg
      .append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(tickInterval)
          .tickFormat(d3.timeFormat('%b %Y'))
      );

    svg.append('g').attr('class', 'axis').call(d3.axisLeft(yScale));

    // Add axis labels
    svg
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -55)
      .attr('x', -height / 2)
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#666')
      .text(getParameterLabel(currentParameter));

    svg
      .append('text')
      .attr('transform', `translate(${width / 2}, ${height + 60})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#666')
      .text('Date');

    // Line generator
    const line = d3
      .line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Add lines for each lake
    dataByLake.forEach((lakeData, lakeName) => {
      const sortedData = lakeData.sort((a, b) => a.date - b.date);
      const color = config.baseColorPalettes[lakeName][0];

      svg
        .append('path')
        .datum(sortedData)
        .attr('class', 'line')
        .attr('d', line)
        .style('stroke', color)
        .style('stroke-width', '2')
        .style('fill', 'none')
        .style('opacity', 0.8);

      // Add dots
      svg
        .selectAll(`.dot-${lakeName}`)
        .data(sortedData)
        .enter()
        .append('circle')
        .attr('class', `dot dot-${lakeName}`)
        .attr('cx', (d) => xScale(d.date))
        .attr('cy', (d) => yScale(d.value))
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
                        <strong>${d.lake} Lake</strong><br/>
                        Date: ${formatDate(d.date)}<br/>
                        Depth Range: ${depthRange.name}<br/>
                        Avg ${getParameterLabel(currentParameter)}: ${d.value.toFixed(2)}<br/>
                        Weather: ${d.weather}<br/>
                        Air Temp: ${d.airTemp}°C
                    `
            )
            .style('left', event.pageX + 10 + 'px')
            .style('top', event.pageY - 28 + 'px');
        })
        .on('mouseout', function (d) {
          tooltip.transition().duration(500).style('opacity', 0);
        });
    });
  }
}
