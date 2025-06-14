// UI Controls Management
import { formatDate, dateToValidId, getDateOnly, formatDateOnly } from './utils.js';

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
            .text(`Show/Hide Datasets by Year and Date:`);

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
            .on('click', () => {
                this.toggleAllDates(true);
                this.dataLoader.updateAllYearCheckboxStates();
            });

        buttonDiv.append('button')
            .style('padding', '8px 16px')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .style('background', '#f8e8e8')
            .style('cursor', 'pointer')
            .text('Select None')
            .on('click', () => {
                this.toggleAllDates(false);
                this.dataLoader.updateAllYearCheckboxStates();
            });

        // Create year selectors section
        this.createYearSelectors(controlsDiv, allSeries);

        // Create date selectors section
        this.createDateSelectors(controlsDiv, allSeries);
    }

    createYearSelectors(parentDiv, allSeries) {
        // Group by year
        const byYear = d3.group(allSeries, d => new Date(d.date).getFullYear());
        const uniqueYears = [...byYear.keys()].sort();

        // Year selectors header
        parentDiv.append('h5')
            .style('color', '#2c3e50')
            .style('margin-bottom', '10px')
            .style('margin-top', '20px')
            .text('Select by Year:');

        // Year checkboxes container
        const yearContainer = parentDiv.append('div')
            .style('display', 'grid')
            .style('grid-template-columns', 'repeat(auto-fit, minmax(120px, 1fr))')
            .style('gap', '10px')
            .style('margin-bottom', '20px')
            .style('padding', '10px')
            .style('background', 'white')
            .style('border-radius', '8px')
            .style('box-shadow', '0 2px 5px rgba(0,0,0,0.1)');

        const visibleSeries = this.dataLoader.getVisibleSeries();

        uniqueYears.forEach(year => {
            const seriesForYear = byYear.get(year);
            const visibleCount = seriesForYear.filter(s => visibleSeries.has(s.id)).length;
            
            let checkboxState = 0; // 0 = none, 1 = some, 2 = all
            if (visibleCount === seriesForYear.length) checkboxState = 2;
            else if (visibleCount > 0) checkboxState = 1;

            const item = yearContainer.append('div')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('padding', '8px')
                .style('border-radius', '4px')
                .style('transition', 'background 0.2s')
                .style('background', 'rgba(30, 58, 138, 0.05)')
                .on('mouseover', function() {
                    d3.select(this).style('background', 'rgba(30, 58, 138, 0.1)');
                })
                .on('mouseout', function() {
                    d3.select(this).style('background', 'rgba(30, 58, 138, 0.05)');
                });

            const checkbox = item.append('input')
                .attr('type', 'checkbox')
                .attr('id', `vis-year-${year}`)
                .style('margin-right', '8px')
                .style('transform', 'scale(1.1)')
                .property('checked', checkboxState === 2)
                .property('indeterminate', checkboxState === 1)
                .on('change', () => this.toggleYearVisibility(year));

            item.append('label')
                .attr('for', `vis-year-${year}`)
                .style('cursor', 'pointer')
                .style('font-size', '14px')
                .style('font-weight', '600')
                .style('color', '#1e3a8a')
                .text(`${year} (${seriesForYear.length})`);
        });
    }

    createDateSelectors(parentDiv, allSeries) {
        // Date selectors header
        parentDiv.append('h5')
            .style('color', '#2c3e50')
            .style('margin-bottom', '10px')
            .text('Select by Date:');

        // Group by date-only (without time)
        const byDateOnly = d3.group(allSeries, d => getDateOnly(d.date));
        const uniqueDateOnlys = [...byDateOnly.keys()].sort();

        // Add checkboxes for each date
        const checkboxContainer = parentDiv.append('div')
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

        uniqueDateOnlys.forEach(dateOnly => {
            const seriesForDateOnly = byDateOnly.get(dateOnly);
            const allChecked = seriesForDateOnly.every(s => visibleSeries.has(s.id));

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
                .attr('id', `vis-date-${dateToValidId(dateOnly)}`)
                .property('checked', allChecked)
                .style('margin-right', '8px')
                .on('change', () => this.toggleDateOnlyVisibility(dateOnly));

            item.append('label')
                .attr('for', `vis-date-${dateToValidId(dateOnly)}`)
                .style('cursor', 'pointer')
                .style('font-size', '14px')
                .text(`${formatDateOnly(dateOnly)} (${seriesForDateOnly.length})`);
        });
    }

    toggleDateVisibility(date) {
        this.dataLoader.toggleDateVisibility(date);
        // Trigger visualization update
        if (window.app) {
            window.app.updateVisualization();
        }
    }

    toggleDateOnlyVisibility(dateOnly) {
        this.dataLoader.toggleDateOnlyVisibility(dateOnly);
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

    toggleYearVisibility(year) {
        this.dataLoader.toggleYearVisibility(year);
        
        // Update date checkboxes for this year
        const allSeries = this.dataLoader.getAllSeries();
        const visibleSeries = this.dataLoader.getVisibleSeries();
        const datesInYear = [...new Set(allSeries.filter(s => new Date(s.date).getFullYear() === year).map(s => getDateOnly(s.date)))];
        
        datesInYear.forEach(dateOnly => {
            const seriesForDateOnly = allSeries.filter(s => getDateOnly(s.date) === dateOnly);
            const allChecked = seriesForDateOnly.every(s => visibleSeries.has(s.id));
            d3.select(`#vis-date-${dateToValidId(dateOnly)}`).property('checked', allChecked);
        });

        // Trigger visualization update
        if (window.app) {
            window.app.updateVisualization();
        }
    }

    toggleAllYears(show) {
        this.dataLoader.toggleAllYears(show);
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

    // Refresh visibility controls (called when visualization changes)
    refreshVisibilityControls() {
        if (d3.select('#visibilityControls').node()) {
            this.createVisibilityControls();
        }
    }
}
