// Checkboxes for choosing which samplings are shown
import { formatDateOnly } from './utils.js';

// Below this many samplings every one is shown and there are no checkboxes
const MIN_SERIES_FOR_CONTROLS = 7;

export class ControlsManager {
  constructor(dataLoader, onChange) {
    this.dataLoader = dataLoader;
    this.onChange = onChange;
    // Each checkbox and the series it controls
    this.checkboxes = [];
  }

  createVisibilityControls() {
    d3.select('#visibilityControls').remove();
    this.checkboxes = [];

    const allSeries = this.dataLoader.getAllSeries();
    if (allSeries.length < MIN_SERIES_FOR_CONTROLS) return;

    const controlsDiv = d3
      .select('#samplingFilters')
      .append('div')
      .attr('id', 'visibilityControls')
      .attr('class', 'visibility-controls');

    const yearGrid = controlsDiv
      .append('div')
      .attr('class', 'checkbox-grid year-grid');

    this.addCheckbox(yearGrid, 'vis-all-years', `All`, allSeries).classed(
      'all-years',
      true
    );

    const byYear = d3.group(allSeries, (s) => s.year);
    [...byYear.keys()].sort().forEach((year) => {
      const series = byYear.get(year);
      this.addCheckbox(yearGrid, `vis-year-${year}`, `${year}`, series);
    });

    const dateDetails = controlsDiv
      .append('details')
      .attr('class', 'date-details');
    dateDetails.append('summary').text('Individual dates');
    const dateGrid = dateDetails
      .append('div')
      .attr('class', 'checkbox-grid date-grid');

    const byDate = d3.group(allSeries, (s) => s.dateOnly);
    [...byDate.keys()].sort().forEach((dateOnly) => {
      const series = byDate.get(dateOnly);
      this.addCheckbox(
        dateGrid,
        `vis-date-${dateOnly}`,
        formatDateOnly(dateOnly),
        series
      );
    });

    this.syncCheckboxes();
  }

  // Appends a checkbox that toggles the given series; returns its row
  addCheckbox(parent, id, label, series) {
    const item = parent.append('div').attr('class', 'checkbox-item');

    const input = item
      .append('input')
      .attr('type', 'checkbox')
      .attr('id', id)
      .on('change', () => {
        this.dataLoader.toggleVisible(series);
        this.syncCheckboxes();
        this.onChange();
      });

    item.append('label').attr('for', id).text(label);
    item.attr('title', `${series.length} samplings`);

    this.checkboxes.push({ input, series });
    return item;
  }

  // Checked when all of a checkbox's series are shown, indeterminate when
  // only some are
  syncCheckboxes() {
    const allSeries = this.dataLoader.getAllSeries();
    const shown = allSeries.filter((s) => this.dataLoader.isVisible(s));
    d3.select('#samplingCount').text(
      `${shown.length} of ${allSeries.length} samplings`
    );

    this.checkboxes.forEach(({ input, series }) => {
      const visibleCount = series.filter((s) =>
        this.dataLoader.isVisible(s)
      ).length;
      input
        .property('checked', visibleCount === series.length)
        .property(
          'indeterminate',
          visibleCount > 0 && visibleCount < series.length
        );
    });
  }
}
