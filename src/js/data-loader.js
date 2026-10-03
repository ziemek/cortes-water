// Loads the sampling data and tracks which samplings are shown
import { config } from './config.js';
import { getDateOnly, getYear } from './utils.js';

class DataLoader {
  constructor() {
    this.allSeries = [];
    this.visibleSeries = new Set();
  }

  async loadData() {
    const response = await fetch('./data/water-data.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch water-data.json: ${response.status}`);
    }

    const data = await response.json();
    this.initializeSeries(Array.isArray(data) ? data : [data]);
  }

  // One series per sampling, ordered by lake and then date
  initializeSeries(data) {
    const lakes = [...new Set(data.map((d) => d.lake))];

    this.allSeries = lakes.flatMap((lake) =>
      data
        .filter((d) => d.lake === lake)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((dataset, i) => ({
          id: `${lake}-${i}`,
          lake,
          date: dataset.date,
          dateOnly: getDateOnly(dataset.date),
          year: getYear(dataset.date),
          dataset,
        }))
    );

    this.visibleSeries.clear();
    this.selectRecentMonths(config.recentMonthsDefault);
  }

  // Show every series from the most recent N months of data
  selectRecentMonths(months) {
    const mostRecentDate = new Date(
      Math.max(...this.allSeries.map((s) => new Date(s.date)))
    );
    const cutoffDate = new Date(mostRecentDate);
    cutoffDate.setMonth(cutoffDate.getMonth() - months);

    this.allSeries
      .filter((series) => new Date(series.date) >= cutoffDate)
      .forEach((series) => this.visibleSeries.add(series.id));
  }

  getAllSeries() {
    return this.allSeries;
  }

  getVisibleData() {
    return this.allSeries
      .filter((s) => this.isVisible(s))
      .map((s) => s.dataset);
  }

  isVisible(series) {
    return this.visibleSeries.has(series.id);
  }

  setVisible(seriesList, visible) {
    seriesList.forEach((s) => {
      if (visible) {
        this.visibleSeries.add(s.id);
      } else {
        this.visibleSeries.delete(s.id);
      }
    });
  }

  // Hides the series if all of them are shown, otherwise shows them all
  toggleVisible(seriesList) {
    this.setVisible(seriesList, !seriesList.every((s) => this.isVisible(s)));
  }
}

export default DataLoader;
