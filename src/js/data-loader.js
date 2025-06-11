// Data loading and management
import { config } from './config.js';

class DataLoader {
    constructor() {
        this.data = [];
        this.allSeries = [];
        this.visibleSeries = new Set();
    }

    async loadData() {
        try {
            // Get list of all JSON files in ./data directory
            const dataFiles = await this.getDataFiles();

            // Fetch and combine all JSON files
            const allData = [];
            for (const filename of dataFiles) {
                try {
                    const response = await fetch(`./data/${filename}`);
                    if (response.ok) {
                        const fileData = await response.json();
                        // Add filename metadata to each record if needed
                        if (Array.isArray(fileData)) {
                            fileData.forEach(record => record._sourceFile = filename);
                            allData.push(...fileData);
                        } else {
                            // Handle single object files
                            fileData._sourceFile = filename;
                            allData.push(fileData);
                        }
                    } else {
                        console.warn(`Failed to fetch ${filename}: ${response.status}`);
                    }
                } catch (fileError) {
                    console.warn(`Error loading ${filename}:`, fileError);
                }
            }

            this.data = allData;
            this.initializeSeriesTracking();
            return this.data;
        } catch (error) {
            console.error('Error loading data:', error);
            d3.select('#chartsContainer').html(
                '<p style="text-align: center; color: red; font-size: 18px;">' +
                'Error loading data files. Please make sure JSON files exist in the ./data directory.' +
                '</p>'
            );
            throw error;
        }
    }

    async getDataFiles() {
        // Method 1: Try to fetch a directory listing (works with some servers)
        try {
            const response = await fetch('./data/');
            const html = await response.text();

            // Parse HTML directory listing for water*.json files
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a[href$=".json"]'))
                .filter(link => link.getAttribute('href').startsWith('water'));

            if (links.length > 0) {
                return links.map(link => link.getAttribute('href'));
            }
        } catch (e) {
            // Directory listing failed, fall back to known patterns
        }

        // Method 2: Try common filename patterns
        const commonPatterns = [
            'water-quality.json',
            'data.json',
            // Year patterns
            ...Array.from({length: 10}, (_, i) => `${2015 + i}.json`),
            ...Array.from({length: 10}, (_, i) => `water-quality-${2015 + i}.json`),
            // Month patterns for current/recent years
            ...this.generateMonthlyPatterns(['2023', '2024', '2025'])
        ];

        const existingFiles = [];
        for (const filename of commonPatterns) {
            try {
                const response = await fetch(`./data/${filename}`, { method: 'HEAD' });
                if (response.ok) {
                    existingFiles.push(filename);
                }
            } catch (e) {
                // File doesn't exist, continue
            }
        }

        return existingFiles;
    }

    generateMonthlyPatterns(years) {
        const patterns = [];
        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

        for (const year of years) {
            for (const month of months) {
                patterns.push(`${year}-${month}.json`);
                patterns.push(`water-quality-${year}-${month}.json`);
            }
        }

        return patterns;
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
            d3.select(`#vis-date-${date}`).property('checked', show);
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
