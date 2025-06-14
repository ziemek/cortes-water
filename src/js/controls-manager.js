// UI Controls Management
import {
  formatDate,
  dateToValidId,
  getDateOnly,
  formatDateOnly,
} from './utils.js';

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

    const controlsDiv = d3
      .select('.container')
      .append('div')
      .attr('id', 'visibilityControls')
      .style('background', '#f8f9fa')
      .style('padding', '20px')
      .style('border-radius', '10px')
      .style('margin-bottom', '30px')
      .style('margin-top', '20px');

    controlsDiv
      .append('h4')
      .style('color', '#2c3e50')
      .style('margin-bottom', '15px')
      .text(`Select Datasets`);

    // Create year selectors section
    this.createYearSelectors(controlsDiv, allSeries);

    // Create date selectors section
    this.createDateSelectors(controlsDiv, allSeries);
  }

  createYearSelectors(parentDiv, allSeries) {
    // Group by year
    const byYear = d3.group(allSeries, (d) => new Date(d.date).getFullYear());
    const uniqueYears = [...byYear.keys()].sort();

    // Year checkboxes container
    const yearContainer = parentDiv
      .append('div')
      .style('display', 'grid')
      .style('grid-template-columns', 'repeat(auto-fit, minmax(120px, 1fr))')
      .style('gap', '10px')
      .style('margin-bottom', '20px')
      .style('padding', '10px')
      .style('background', 'white')
      .style('border-radius', '8px')
      .style('box-shadow', '0 2px 5px rgba(0,0,0,0.1)');

    const visibleSeries = this.dataLoader.getVisibleSeries();

    // Add master "All Years" checkbox first
    const totalSeries = allSeries.length;
    const visibleCount = allSeries.filter((s) => visibleSeries.has(s.id)).length;
    
    let masterCheckboxState = 0; // 0 = none, 1 = some, 2 = all
    if (visibleCount === totalSeries) masterCheckboxState = 2;
    else if (visibleCount > 0) masterCheckboxState = 1;

    const masterItem = yearContainer
      .append('div')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('transition', 'background 0.2s')
      .style('background', 'rgba(30, 58, 138, 0.05)')
      .on('mouseover', function () {
        d3.select(this).style('background', 'rgba(30, 58, 138, 0.1)');
      })
      .on('mouseout', function () {
        d3.select(this).style('background', 'rgba(30, 58, 138, 0.05)');
      });

    const masterCheckbox = masterItem
      .append('input')
      .attr('type', 'checkbox')
      .attr('id', 'vis-all-years')
      .style('margin-right', '8px')
      .style('transform', 'scale(1.2)')
      .property('checked', masterCheckboxState === 2)
      .property('indeterminate', masterCheckboxState === 1)
      .on('change', () => this.toggleMasterVisibility());

    masterItem
      .append('label')
      .attr('for', 'vis-all-years')
      .style('cursor', 'pointer')
      .style('font-size', '14px')
      .style('font-weight', '700')
      .style('color', '#1e3a8a')
      .text(`All Years (${totalSeries})`);

    uniqueYears.forEach((year) => {
      const seriesForYear = byYear.get(year);
      const visibleCount = seriesForYear.filter((s) =>
        visibleSeries.has(s.id)
      ).length;

      let checkboxState = 0; // 0 = none, 1 = some, 2 = all
      if (visibleCount === seriesForYear.length) checkboxState = 2;
      else if (visibleCount > 0) checkboxState = 1;

      const item = yearContainer
        .append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('padding', '8px')
        .style('border-radius', '4px')
        .style('transition', 'background 0.2s')
        .style('background', 'rgba(30, 58, 138, 0.05)')
        .on('mouseover', function () {
          d3.select(this).style('background', 'rgba(30, 58, 138, 0.1)');
        })
        .on('mouseout', function () {
          d3.select(this).style('background', 'rgba(30, 58, 138, 0.05)');
        });

      const checkbox = item
        .append('input')
        .attr('type', 'checkbox')
        .attr('id', `vis-year-${year}`)
        .style('margin-right', '8px')
        .style('transform', 'scale(1.1)')
        .property('checked', checkboxState === 2)
        .property('indeterminate', checkboxState === 1)
        .on('change', () => this.toggleYearVisibility(year));

      item
        .append('label')
        .attr('for', `vis-year-${year}`)
        .style('cursor', 'pointer')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .style('color', '#1e3a8a')
        .text(`${year} (${seriesForYear.length})`);
    });
  }

  createDateSelectors(parentDiv, allSeries) {
    // Group by date-only (without time)
    const byDateOnly = d3.group(allSeries, (d) => getDateOnly(d.date));
    const uniqueDateOnlys = [...byDateOnly.keys()].sort();

    // Add checkboxes for each date
    const checkboxContainer = parentDiv
      .append('div')
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

    uniqueDateOnlys.forEach((dateOnly) => {
      const seriesForDateOnly = byDateOnly.get(dateOnly);
      const allChecked = seriesForDateOnly.every((s) =>
        visibleSeries.has(s.id)
      );

      const item = checkboxContainer
        .append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('padding', '5px')
        .style('border-radius', '4px')
        .style('transition', 'background 0.2s')
        .on('mouseover', function () {
          d3.select(this).style('background', '#f0f0f0');
        })
        .on('mouseout', function () {
          d3.select(this).style('background', 'transparent');
        });

      const checkbox = item
        .append('input')
        .attr('type', 'checkbox')
        .attr('id', `vis-date-${dateToValidId(dateOnly)}`)
        .property('checked', allChecked)
        .style('margin-right', '8px')
        .on('change', () => this.toggleDateOnlyVisibility(dateOnly));

      item
        .append('label')
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
    // Update master checkbox state
    this.updateMasterCheckboxState();
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

  toggleMasterVisibility() {
    const masterCheckbox = d3.select('#vis-all-years');
    const isChecked = masterCheckbox.property('checked');
    
    this.dataLoader.toggleAllDates(isChecked);
    
    // Update all year checkboxes to match master state
    this.updateAllYearCheckboxes();
    
    // Trigger visualization update
    if (window.app) {
      window.app.updateVisualization();
    }
  }

  updateMasterCheckboxState() {
    const allSeries = this.dataLoader.getAllSeries();
    const visibleSeries = this.dataLoader.getVisibleSeries();
    const visibleCount = allSeries.filter((s) => visibleSeries.has(s.id)).length;
    
    let masterCheckboxState = 0; // 0 = none, 1 = some, 2 = all
    if (visibleCount === allSeries.length) masterCheckboxState = 2;
    else if (visibleCount > 0) masterCheckboxState = 1;
    
    const masterCheckbox = d3.select('#vis-all-years');
    if (masterCheckbox.node()) {
      masterCheckbox
        .property('checked', masterCheckboxState === 2)
        .property('indeterminate', masterCheckboxState === 1);
    }
  }

  updateAllYearCheckboxes() {
    const allSeries = this.dataLoader.getAllSeries();
    const visibleSeries = this.dataLoader.getVisibleSeries();
    const byYear = d3.group(allSeries, (d) => new Date(d.date).getFullYear());
    
    byYear.forEach((seriesForYear, year) => {
      const visibleCount = seriesForYear.filter((s) => visibleSeries.has(s.id)).length;
      
      let checkboxState = 0;
      if (visibleCount === seriesForYear.length) checkboxState = 2;
      else if (visibleCount > 0) checkboxState = 1;
      
      const yearCheckbox = d3.select(`#vis-year-${year}`);
      if (yearCheckbox.node()) {
        yearCheckbox
          .property('checked', checkboxState === 2)
          .property('indeterminate', checkboxState === 1);
      }
    });
  }

  toggleYearVisibility(year) {
    this.dataLoader.toggleYearVisibility(year);

    // Update date checkboxes for this year
    const allSeries = this.dataLoader.getAllSeries();
    const visibleSeries = this.dataLoader.getVisibleSeries();
    const datesInYear = [
      ...new Set(
        allSeries
          .filter((s) => new Date(s.date).getFullYear() === year)
          .map((s) => getDateOnly(s.date))
      ),
    ];

    datesInYear.forEach((dateOnly) => {
      const seriesForDateOnly = allSeries.filter(
        (s) => getDateOnly(s.date) === dateOnly
      );
      const allChecked = seriesForDateOnly.every((s) =>
        visibleSeries.has(s.id)
      );
      d3.select(`#vis-date-${dateToValidId(dateOnly)}`).property(
        'checked',
        allChecked
      );
    });

    // Update master checkbox state
    this.updateMasterCheckboxState();

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
    const correlationParams = [
      'temp_oxygen',
      'conductivity_tds',
      'ph_oxygen',
      'secchi',
    ];
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
