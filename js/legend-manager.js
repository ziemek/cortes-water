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

        if (currentView === 'depth' || currentView === 'horizontal') {
            // Compact summary legend for depth profiles to avoid overcrowding
            const lakes = [...new Set(visibleData.map(d => d.lake))];
            
            // Add a header explaining the compact view
            legend.append('div')
                .style('margin-bottom', '15px')
                .style('padding', '20px')
                .style('background', 'linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85))')
                .style('border-radius', '20px')
                .style('font-size', '14px')
                .style('backdrop-filter', 'blur(15px)')
                .style('border', '1px solid rgba(255, 255, 255, 0.2)')
                .style('box-shadow', '0 15px 35px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.8)')
                .html(`
                    <strong>Depth Profile Summary</strong><br/>
                    <span style="font-size: 12px; color: #666;">
                        Each line represents a different sampling date. 
                        Hover over data points for detailed information.
                    </span>
                `);

            lakes.forEach(lake => {
                const lakeData = visibleData.filter(d => d.lake === lake);
                const dateRange = d3.extent(lakeData, d => new Date(d.date));
                
                const legendItem = legend.append('div')
                    .attr('class', 'legend-item')
                    .style('margin-bottom', '10px');

                const legendHeader = legendItem.append('div')
                    .attr('class', 'legend-header')
                    .style('display', 'flex')
                    .style('align-items', 'center')
                    .style('margin-bottom', '5px');

                legendHeader.append('div')
                    .attr('class', 'legend-color')
                    .style('background-color', config.baseColorPalettes[lake][0])
                    .style('width', '20px')
                    .style('height', '20px')
                    .style('margin-right', '10px')
                    .style('border-radius', '3px');

                legendHeader.append('span')
                    .style('font-weight', 'bold')
                    .text(`${lake} Lake`);

                // Add compact summary metadata
                const metadata = [`${lakeData.length} datasets`];
                if (dateRange[0] && dateRange[1]) {
                    metadata.push(`${formatDate(dateRange[0])} - ${formatDate(dateRange[1])}`);
                }

                legendItem.append('div')
                    .attr('class', 'legend-metadata')
                    .style('font-size', '12px')
                    .style('color', '#666')
                    .style('margin-left', '30px')
                    .html(metadata.join('<br/>'));
            });
        } else {
            // Compact summary legend for time series
            const lakes = [...new Set(visibleData.map(d => d.lake))];
            
            // Add a header explaining the compact view
            legend.append('div')
                .style('margin-bottom', '15px')
                .style('padding', '20px')
                .style('background', 'linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85))')
                .style('border-radius', '20px')
                .style('font-size', '14px')
                .style('backdrop-filter', 'blur(15px)')
                .style('border', '1px solid rgba(255, 255, 255, 0.2)')
                .style('box-shadow', '0 15px 35px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.8)')
                .html(`
                    <strong>Time Series Summary</strong><br/>
                    <span style="font-size: 12px; color: #666;">
                        Each line represents a different sampling date. 
                        Hover over data points for detailed information.
                    </span>
                `);

            lakes.forEach(lake => {
                const lakeData = visibleData.filter(d => d.lake === lake);
                const dateRange = d3.extent(lakeData, d => new Date(d.date));
                
                const legendItem = legend.append('div')
                    .attr('class', 'legend-item')
                    .style('margin-bottom', '10px');

                const legendHeader = legendItem.append('div')
                    .attr('class', 'legend-header')
                    .style('display', 'flex')
                    .style('align-items', 'center')
                    .style('margin-bottom', '5px');

                legendHeader.append('div')
                    .attr('class', 'legend-color')
                    .style('background-color', config.baseColorPalettes[lake][0])
                    .style('width', '20px')
                    .style('height', '20px')
                    .style('margin-right', '10px')
                    .style('border-radius', '3px');

                legendHeader.append('span')
                    .style('font-weight', 'bold')
                    .text(`${lake} Lake`);

                // Add compact summary metadata
                const metadata = [`${lakeData.length} datasets`];
                if (dateRange[0] && dateRange[1]) {
                    metadata.push(`${formatDate(dateRange[0])} - ${formatDate(dateRange[1])}`);
                }

                legendItem.append('div')
                    .attr('class', 'legend-metadata')
                    .style('font-size', '12px')
                    .style('color', '#666')
                    .style('margin-left', '30px')
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
