// Legend Management
import { config } from './config.js';
import { formatDate, generateColorPalette, getTimeGradientColor } from './utils.js';

export class LegendManager {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
    }

    // Update legend for correlation plots
    updateCorrelationLegend() {
        const legend = d3.select('#legend');
        legend.selectAll('*').remove();

        const visibleData = this.dataLoader.getVisibleData();

        // Time gradient legend
        const legendHeader = legend.append('div')
            .style('margin-bottom', '15px');

        legendHeader.append('h4')
            .style('color', '#2c3e50')
            .style('margin-bottom', '10px')
            .text('Time Gradient');

        const gradientDiv = legendHeader.append('div')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('margin-bottom', '10px');

        // Create gradient bar
        const gradientSvg = gradientDiv.append('svg')
            .attr('width', 200)
            .attr('height', 20);

        const gradient = gradientSvg.append('defs')
            .append('linearGradient')
            .attr('id', 'timeGradient')
            .attr('x1', '0%')
            .attr('x2', '100%');

        gradient.append('stop')
            .attr('offset', '0%')
            .style('stop-color', d3.hsl(240, 0.7, 0.5).hex());

        gradient.append('stop')
            .attr('offset', '100%')
            .style('stop-color', d3.hsl(120, 0.7, 0.5).hex());

        gradientSvg.append('rect')
            .attr('width', 200)
            .attr('height', 20)
            .style('fill', 'url(#timeGradient)');

        gradientDiv.append('span')
            .style('margin-left', '10px')
            .style('font-size', '12px')
            .text('Earlier → Later');

        // Data summary
        if (visibleData.length > 0) {
            const dateRange = d3.extent(visibleData, d => new Date(d.date));
            const lakes = [...new Set(visibleData.map(d => d.lake))];

            legend.append('div')
                .style('background', '#f8f9fa')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('margin-top', '10px')
                .html(`
                    <strong>Data Overview:</strong><br/>
                    Lakes: ${lakes.join(', ')}<br/>
                    Datasets: ${visibleData.length}<br/>
                    Date Range: ${formatDate(dateRange[0])} - ${formatDate(dateRange[1])}
                `);
        }
    }

    updateLegend(currentView) {
        const legend = d3.select('#legend');
        legend.selectAll('*').remove();

        const visibleData = this.dataLoader.getVisibleData();

        if (currentView === 'depth') {
            // Legend for depth profiles with enhanced metadata
            const lakes = [...new Set(visibleData.map(d => d.lake))];
            lakes.forEach(lake => {
                const lakeData = visibleData.filter(d => d.lake === lake);
                const allLakeData = this.dataLoader.getData().filter(d => d.lake === lake);
                const colors = generateColorPalette(config.baseColorPalettes[lake], allLakeData.length);

                lakeData.forEach((dataset) => {
                    const datasetIndex = allLakeData.findIndex(d => d.date === dataset.date);
                    const legendItem = legend.append('div')
                        .attr('class', 'legend-item');

                    const legendHeader = legendItem.append('div')
                        .attr('class', 'legend-header');

                    legendHeader.append('div')
                        .attr('class', 'legend-color')
                        .style('background-color', colors[datasetIndex]);

                    legendHeader.append('span')
                        .text(`${lake} - ${formatDate(dataset.date)}`);

                    // Add metadata
                    const metadata = [];
                    if (dataset.weather) metadata.push(`Weather: ${dataset.weather}`);
                    if (dataset.air_temperature) metadata.push(`Air Temp: ${dataset.air_temperature}°C`);
                    if (dataset.water_temperature) metadata.push(`Water Temp: ${dataset.water_temperature}°C`);
                    if (dataset.measurers) metadata.push(`Measurers: ${dataset.measurers}`);
                    if (dataset.time) metadata.push(`Time: ${dataset.time}`);

                    if (metadata.length > 0) {
                        legendItem.append('div')
                            .attr('class', 'legend-metadata')
                            .html(metadata.join('<br/>'));
                    }
                });
            });
        } else {
            // Legend for time series with metadata
            const lakes = [...new Set(visibleData.map(d => d.lake))];
            lakes.forEach(lake => {
                const lakeData = visibleData.filter(d => d.lake === lake);

                const legendItem = legend.append('div')
                    .attr('class', 'legend-item');

                const legendHeader = legendItem.append('div')
                    .attr('class', 'legend-header');

                legendHeader.append('div')
                    .attr('class', 'legend-color')
                    .style('background-color', config.baseColorPalettes[lake][0]);

                legendHeader.append('span')
                    .text(`${lake}`);

                // Add summary metadata
                const dateRange = d3.extent(lakeData, d => new Date(d.date));
                const weatherTypes = [...new Set(lakeData.map(d => d.weather).filter(w => w))];

                const metadata = [`Datasets: ${lakeData.length}`];
                if (dateRange[0] && dateRange[1]) {
                    metadata.push(`Period: ${formatDate(dateRange[0])} - ${formatDate(dateRange[1])}`);
                }

                legendItem.append('div')
                    .attr('class', 'legend-metadata')
                    .html(metadata.join('<br/>'));
            });
        }
    }

    updateSecchiLegend() {
        const legend = d3.select('#legend');
        legend.selectAll('*').remove();

        const visibleData = this.dataLoader.getVisibleData();

        // Season legend
        const legendHeader = legend.append('div')
            .style('margin-bottom', '15px');

        legendHeader.append('h4')
            .style('color', '#2c3e50')
            .style('margin-bottom', '10px')
            .text('Seasonal Color Coding');

        const seasons = [
            {name: 'Spring', color: config.seasonColors.spring},
            {name: 'Summer', color: config.seasonColors.summer},
            {name: 'Fall', color: config.seasonColors.fall},
            {name: 'Winter', color: config.seasonColors.winter}
        ];

        seasons.forEach(season => {
            const seasonDiv = legendHeader.append('div')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('margin-bottom', '5px');

            seasonDiv.append('div')
                .style('width', '20px')
                .style('height', '20px')
                .style('background-color', season.color)
                .style('margin-right', '10px')
                .style('border-radius', '50%');

            seasonDiv.append('span')
                .text(season.name);
        });

        // Data summary
        if (visibleData.length > 0) {
            const dateRange = d3.extent(visibleData, d => new Date(d.date));
            const lakes = [...new Set(visibleData.map(d => d.lake))];

            legend.append('div')
                .style('background', '#f8f9fa')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('margin-top', '10px')
                .html(`
                    <strong>Data Overview:</strong><br/>
                    Lakes: ${lakes.join(', ')}<br/>
                    Datasets: ${visibleData.length}<br/>
                    Date Range: ${formatDate(dateRange[0])} - ${formatDate(dateRange[1])}
                `);
        }
    }
}
