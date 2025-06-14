// Secchi Depth Analysis Charts
import { chartDimensions, config } from './config.js';
import { tooltip, formatDate, getSeasonColor, addGrid, addAxes } from './utils.js';

export class SecchiAnalysis {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
    }

    // Create Secchi Depth Time Series
    createSecchiDepthAnalysis() {
        const container = d3.select('#chartsContainer');
        container.selectAll('*').remove();

        const visibleData = this.dataLoader.getVisibleData();
        
        // Create main chart container
        const chartDiv = container.append('div')
            .attr('class', 'chart-container');

        chartDiv.append('h3')
            .attr('class', 'chart-title')
            .text('Secchi Depth Time Series Analysis');

        this.createSecchiTimeSeriesChart(chartDiv, visibleData);
        
        // Create correlation charts for surface parameters
        const surfaceParamsDiv = container.append('div')
            .attr('class', 'chart-container');

        surfaceParamsDiv.append('h3')
            .attr('class', 'chart-title')
            .text('Secchi Depth vs Surface Parameters');

        this.createSecchiCorrelationCharts(surfaceParamsDiv, visibleData);
    }

    createSecchiTimeSeriesChart(container, datasets) {
        const margin = chartDimensions.margin;
        const width = chartDimensions.timeSeries.width - margin.left - margin.right;
        const height = chartDimensions.timeSeries.height - margin.bottom - margin.top;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Process data
        const timeSeriesData = datasets.map(dataset => {
            const avgSecchi = d3.mean(dataset.secchi_depth.filter(d => d !== null && d !== undefined));
            const surfaceMeasurement = dataset.measurements && dataset.measurements[0];
            return {
                lake: dataset.lake,
                date: new Date(dataset.date),
                value: avgSecchi,
                weather: dataset.weather,
                airTemp: dataset.air_temperature,
                surfaceTemp: surfaceMeasurement ? surfaceMeasurement.temperature : null,
                surfaceDO: surfaceMeasurement ? surfaceMeasurement.DO : null,
                surfacePH: surfaceMeasurement ? surfaceMeasurement.PH : null
            };
        }).filter(d => d.value !== undefined && d.value !== null);

        if (timeSeriesData.length === 0) {
            container.append('p')
                .style('text-align', 'center')
                .style('color', '#666')
                .text('No Secchi depth data available');
            return;
        }

        // Group by lake
        const dataByLake = d3.group(timeSeriesData, d => d.lake);

        const xScale = d3.scaleTime()
            .domain(d3.extent(timeSeriesData, d => d.date))
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([
                0,
                d3.max(timeSeriesData, d => d.value) * 1.1
            ])
            .range([height, 0]);

        // Add grid and axes
        addGrid(svg, xScale, yScale, width, height);
        
        // Add axes with time formatting
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale)
                .ticks(d3.timeMonth.every(2))
                .tickFormat(d3.timeFormat('%b %Y')));

        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale));

        // Add axis labels
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', -50)
            .attr('x', -height / 2)
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('fill', '#666')
            .text('Secchi Depth (m)');

        svg.append('text')
            .attr('transform', `translate(${width / 2}, ${height + 60})`)
            .style('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('fill', '#666')
            .text('Date');

        // Line generator
        const line = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        // Add lines and points for each lake
        dataByLake.forEach((lakeData, lakeName) => {
            const sortedData = lakeData.sort((a, b) => a.date - b.date);

            // Add line
            svg.append('path')
                .datum(sortedData)
                .attr('class', 'line')
                .attr('d', line)
                .style('stroke', config.baseColorPalettes[lakeName][0])
                .style('stroke-width', '2')
                .style('fill', 'none')
                .style('opacity', 0.8);

            // Add points
            svg.selectAll(`.dot-${lakeName}`)
                .data(sortedData)
                .enter().append('circle')
                .attr('class', `dot dot-${lakeName}`)
                .attr('cx', d => xScale(d.date))
                .attr('cy', d => yScale(d.value))
                .attr('r', 5)
                .style('fill', d => getSeasonColor(d.date))
                .style('stroke', config.baseColorPalettes[lakeName][0])
                .style('stroke-width', 2)
                .style('cursor', 'pointer')
                .on('mouseover', function(event, d) {
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', .9);
                    tooltip.html(`
                        <strong>${d.lake} Lake</strong><br/>
                        Date: ${formatDate(d.date)}<br/>
                        Secchi Depth: ${d.value.toFixed(2)}m<br/>
                        ${d.surfaceTemp !== null ? `Surface Temp: ${d.surfaceTemp.toFixed(1)}°C<br/>` : ''}
                        ${d.surfaceDO !== null ? `Surface DO: ${d.surfaceDO.toFixed(2)} mg/L<br/>` : ''}
                        ${d.surfacePH !== null ? `Surface pH: ${d.surfacePH.toFixed(2)}<br/>` : ''}
                        Weather: ${d.weather}<br/>
                        Air Temp: ${d.airTemp}°C
                    `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', function(d) {
                    tooltip.transition()
                        .duration(500)
                        .style('opacity', 0);
                });
        });
    }

    createSecchiCorrelationCharts(container, datasets) {
        const surfaceParams = [
            {param: 'temperature', label: 'Surface Temperature (°C)'},
            {param: 'DO', label: 'Surface Dissolved Oxygen (mg/L)'},
            {param: 'PH', label: 'Surface pH'}
        ];

        const chartsContainer = container.append('div')
            .style('display', 'grid')
            .style('grid-template-columns', 'repeat(auto-fit, minmax(300px, 1fr))')
            .style('gap', '20px')
            .style('margin-top', '20px');

        surfaceParams.forEach(param => {
            const chartDiv = chartsContainer.append('div');
            this.createSecchiCorrelationChart(chartDiv, datasets, param);
        });
    }

    createSecchiCorrelationChart(container, datasets, param) {
        const margin = chartDimensions.margin;
        const width = chartDimensions.correlation.width - margin.left - margin.right;
        const height = chartDimensions.correlation.height - margin.bottom - margin.top;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Process data
        const correlationData = datasets.map(dataset => {
            const avgSecchi = d3.mean(dataset.secchi_depth.filter(d => d !== null && d !== undefined));
            const surfaceMeasurement = dataset.measurements && dataset.measurements[0];
            const surfaceValue = surfaceMeasurement ? surfaceMeasurement[param.param] : null;
            return {
                lake: dataset.lake,
                date: new Date(dataset.date),
                secchi: avgSecchi,
                value: surfaceValue,
                weather: dataset.weather,
                airTemp: dataset.air_temperature
            };
        }).filter(d => d.secchi !== undefined && d.secchi !== null && 
                      d.value !== undefined && d.value !== null);

        if (correlationData.length === 0) {
            container.append('p')
                .style('text-align', 'center')
                .style('color', '#666')
                .text('No data available');
            return;
        }

        const xScale = d3.scaleLinear()
            .domain(d3.extent(correlationData, d => d.value))
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(correlationData, d => d.secchi) * 1.1])
            .range([height, 0]);

        // Add grid and axes
        addGrid(svg, xScale, yScale, width, height);
        addAxes(svg, xScale, yScale, height, param.label, 'Secchi Depth (m)');

        // Add points
        correlationData.forEach(d => {
            svg.append('circle')
                .attr('cx', xScale(d.value))
                .attr('cy', yScale(d.secchi))
                .attr('r', 5)
                .style('fill', getSeasonColor(d.date))
                .style('stroke', config.baseColorPalettes[d.lake][0])
                .style('stroke-width', 2)
                .style('cursor', 'pointer')
                .on('mouseover', function(event) {
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', .9);
                    tooltip.html(`
                        <strong>${d.lake} Lake</strong><br/>
                        Date: ${formatDate(d.date)}<br/>
                        Secchi Depth: ${d.secchi.toFixed(2)}m<br/>
                        ${param.label}: ${d.value.toFixed(2)}<br/>
                        Weather: ${d.weather}<br/>
                        Air Temp: ${d.airTemp}°C
                    `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', function() {
                    tooltip.transition()
                        .duration(500)
                        .style('opacity', 0);
                });
        });

        // Add trend line
        const xValues = correlationData.map(d => d.value);
        const yValues = correlationData.map(d => d.secchi);
        
        const xMean = d3.mean(xValues);
        const yMean = d3.mean(yValues);
        
        const slope = d3.sum(xValues.map((x, i) => (x - xMean) * (yValues[i] - yMean))) /
                      d3.sum(xValues.map(x => Math.pow(x - xMean, 2)));
        
        const intercept = yMean - slope * xMean;
        
        const x1 = d3.min(xValues);
        const x2 = d3.max(xValues);
        const y1 = slope * x1 + intercept;
        const y2 = slope * x2 + intercept;
        
        svg.append('line')
            .attr('x1', xScale(x1))
            .attr('y1', yScale(y1))
            .attr('x2', xScale(x2))
            .attr('y2', yScale(y2))
            .style('stroke', '#666')
            .style('stroke-width', 1)
            .style('stroke-dasharray', '4,4');
    }
}
