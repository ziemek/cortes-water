// Data loading and management
import { config } from './config.js';
import { dateToValidId } from './utils.js';

class DataLoader {
    constructor() {
        this.data = [];
        this.allSeries = [];
        this.visibleSeries = new Set();
    }

    async loadData() {
        try {
            // Load the main water data file
            const response = await fetch('./data/water-data.json');
            
            if (!response.ok) {
                throw new Error(`Failed to fetch water-data.json: ${response.status}`);
            }

            const fileData = await response.json();
            
            // Handle array or single object data
            if (Array.isArray(fileData)) {
                this.data = fileData;
            } else {
                this.data = [fileData];
            }

            this.initializeSeriesTracking();
            return this.data;
        } catch (error) {
            console.error('Error loading data:', error);
            d3.select('#chartsContainer').html(
                '<p style="text-align: center; color: red; font-size: 18px;">' +
                'Error loading water-data.json. Please make sure the file exists in the ./data directory.' +
                '</p>'
            );
            throw error;
        }
    }

    // Initialize series tracking and visibility controls
    initializeSeriesTracking() {
        this.allSeries = [];
        this.visibleSeries.clear();

        const lakes = [...new Set(this.data.map(d => d.lake))];

        lakes.forEach(lake => {
            const lakeData = this.data.filter(d => d.lake === lake)
                .sort((a, b) => new Date(a.date) - new Date(b.date));
            lakeData.forEach((dataset, i) => {
                const seriesId = `${lake}-${i}`;
                this.allSeries.push({
                    id: seriesId,
                    lake: lake,
                    date: dataset.date,
                    index: i,
                    dataset: dataset
                });
            });
        });

        // Show first maxVisibleDefault series by default
        this.allSeries.slice(0, config.maxVisibleDefault).forEach(series => {
            this.visibleSeries.add(series.id);
        });
    }

    // Get filtered data based on visibility
    getVisibleData() {
        return this.allSeries
            .filter(s => this.visibleSeries.has(s.id))
            .map(s => s.dataset);
    }

    // Toggle date visibility (applies to both lakes)
    toggleDateVisibility(date) {
        const seriesForDate = this.allSeries.filter(s => s.date === date);
        const allChecked = seriesForDate.every(s => this.visibleSeries.has(s.id));

        seriesForDate.forEach(s => {
            if (allChecked) {
                this.visibleSeries.delete(s.id);
            } else {
                this.visibleSeries.add(s.id);
            }
        });
    }

    // Toggle all dates
    toggleAllDates(show) {
        const uniqueDates = [...new Set(this.allSeries.map(s => s.date))];

        uniqueDates.forEach(date => {
            const seriesForDate = this.allSeries.filter(s => s.date === date);
            seriesForDate.forEach(s => {
                if (show) {
                    this.visibleSeries.add(s.id);
                } else {
                    this.visibleSeries.delete(s.id);
                }
            });

            // Update checkbox
            d3.select(`#vis-date-${dateToValidId(date)}`).property('checked', show);
        });
    }

    getData() {
        return this.data;
    }

    getAllSeries() {
        return this.allSeries;
    }

    getVisibleSeries() {
        return this.visibleSeries;
    }
}

export default DataLoader;
