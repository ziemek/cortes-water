// UI Controls Management
import { formatDate } from './utils.js';

export class ControlsManager {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
    }

    // Create visibility controls
    createVisibilityControls() {
        // Remove existing controls
        d3.select('#visibilityControls').remove();

        const allSeries = this.dataLoader.getAllSeries();
        if (allSeries.length <= 6) return; // Don't show controls for small datasets

        const controlsDiv = d3.select('.container')
            .append('div')
            .attr('id', 'visibilityControls')
            .style('background', '#f8f9fa')
            .style('padding', '20px')
            .style('border-radius', '10px')
            .style('margin-bottom', '30px')
            .style('margin-top', '20px');

        controlsDiv.append('h4')
            .style('color', '#2c3e50')
            .style('margin-bottom', '15px')
            .text(`Show/Hide Datasets by Date:`);

        // Add select all/none buttons
        const buttonDiv = controlsDiv.append('div')
            .style('margin-bottom', '15px');

        buttonDiv.append('button')
            .style('padding', '8px 16px')
            .style('margin-right', '10px')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .style('background', '#e8f4f8')
            .style('cursor', 'pointer')
            .text('Select All')
            .on('click', () => this.toggleAllDates(true));

        buttonDiv.append('button')
            .style('padding', '8px 16px')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .style('background', '#f8e8e8')
            .style('cursor', 'pointer')
            .text('Select None')
            .on('click', () => this.toggleAllDates(false));

        // Group by date
        const byDate = d3.group(allSeries, d => d.date);
        const uniqueDates = [...byDate.keys()].sort();

        // Add checkboxes for each date
        const checkboxContainer = controlsDiv.append('div')
            .style('display', 'grid')
            .style('grid-template-columns', 'repeat(auto-fit, minmax(200px, 1fr))')
            .style('gap', '10px')
            .style('max-height', '300px')
            .style('overflow-y', 'auto')
            .style('padding', '10px')
            .style('background', 'white')
            .style('border-radius', '8px')
            .style('box-shadow', '0 2px 5px rgba(0,0,0,0.1)');

        const visibleSeries = this.dataLoader.getVisibleSeries();

        uniqueDates.forEach(date => {
            const seriesForDate = byDate.get(date);
            const allChecked = seriesForDate.every(s => visibleSeries.has(s.id));

            const item = checkboxContainer.append('div')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('padding', '5px')
                .style('border-radius', '4px')
                .style('transition', 'background 0.2s')
                .on('mouseover', function() {
                    d3.select(this).style('background', '#f0f0f0');
                })
                .on('mouseout', function() {
                    d3.select(this).style('background', 'transparent');
                });

            const checkbox = item.append('input')
                .attr('type', 'checkbox')
                .attr('id', `vis-date-${date}`)
                .property('checked', allChecked)
                .style('margin-right', '8px')
                .on('change', () => this.toggleDateVisibility(date));

            item.append('label')
                .attr('for', `vis-date-${date}`)
                .style('cursor', 'pointer')
                .style('font-size', '14px')
                .text(formatDate(date));
        });
    }

    toggleDateVisibility(date) {
        this.dataLoader.toggleDateVisibility(date);
        // Trigger visualization update
        if (window.app) {
            window.app.updateVisualization();
        }
    }

    toggleAllDates(show) {
        this.dataLoader.toggleAllDates(show);
        // Trigger visualization update
        if (window.app) {
            window.app.updateVisualization();
        }
    }

    updateViewToggleVisibility(currentParameter) {
        const correlationParams = ['temp_oxygen', 'conductivity_tds', 'ph_oxygen', 'secchi'];
        const viewDropdown = document.getElementById('viewType');
        
        if (correlationParams.includes(currentParameter)) {
            // Disable dropdown
            viewDropdown.disabled = true;
            viewDropdown.parentElement.classList.add('disabled');
            // Force time series view when showing correlations
            viewDropdown.value = 'timeSeries';
            return 'time';
        } else {
            // Enable dropdown
            viewDropdown.disabled = false;
            viewDropdown.parentElement.classList.remove('disabled');
            
            // Return current view selection
            const selectedValue = viewDropdown.value;
            if (selectedValue === 'depthProfiles') {
                return 'depth';
            } else if (selectedValue === 'horizontalDepth') {
                return 'horizontal';
            } else {
                return 'time';
            }
        }
    }
}
