// Main Application Controller
import DataLoader from './data-loader.js';
import { ControlsManager } from './controls-manager.js';
import { TimeSeriesCharts } from './time-series-charts.js';
import { DepthProfileCharts } from './depth-profile-charts.js';
import { HorizontalDepthCharts } from './horizontal-depth-charts.js';
import { CorrelationCharts } from './correlation-charts.js';
import { SecchiAnalysis } from './secchi-analysis.js';
import { LegendManager } from './legend-manager.js';

class WaterQualityApp {
    constructor() {
        // Initialize components
        this.dataLoader = new DataLoader();
        this.controlsManager = new ControlsManager(this.dataLoader);
        this.timeSeriesCharts = new TimeSeriesCharts(this.dataLoader);
        this.depthProfileCharts = new DepthProfileCharts(this.dataLoader);
        this.horizontalDepthCharts = new HorizontalDepthCharts(this.dataLoader);
        this.correlationCharts = new CorrelationCharts(this.dataLoader);
        this.secchiAnalysis = new SecchiAnalysis(this.dataLoader);
        this.legendManager = new LegendManager(this.dataLoader);

        // State
        this.currentParameter = 'temperature';
        this.currentView = 'time';
        
        // Make app globally available for controls
        window.app = this;
    }

    async initialize() {
        try {
            // Load data
            await this.dataLoader.loadData();
            
            // Create visibility controls
            this.controlsManager.createVisibilityControls();
            
            // Initial visualization
            this.updateVisualization();
            
            // Setup event listeners
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
        }
    }

    setupEventListeners() {
        // Parameter button listeners
        document.querySelectorAll('.param-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.param-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentParameter = e.target.getAttribute('data-param');
                this.updateVisualization();
            });
        });

        // View dropdown listener
        const viewDropdown = document.getElementById('viewType');
        viewDropdown.addEventListener('change', (e) => {
            const selectedView = e.target.value;
            if (selectedView === 'depthProfiles') {
                this.currentView = 'depth';
            } else if (selectedView === 'horizontalDepth') {
                this.currentView = 'horizontal';
            } else {
                this.currentView = 'time';
            }
            this.updateVisualization();
        });
    }

    updateVisualization() {
        // Update view toggle availability based on current parameter
        this.currentView = this.controlsManager.updateViewToggleVisibility(this.currentParameter);
        
        // Create appropriate visualization
        if (this.currentView === 'depth') {
            this.depthProfileCharts.createDepthProfiles(this.currentParameter);
            this.legendManager.updateLegend('depth');
        } else if (this.currentView === 'horizontal') {
            this.horizontalDepthCharts.createHorizontalDepthProfiles(this.currentParameter);
            this.legendManager.updateLegend('horizontal');
        } else if (this.currentParameter === 'temp_oxygen') {
            this.correlationCharts.createTemperatureOxygenScatter();
            this.legendManager.updateCorrelationLegend();
        } else if (this.currentParameter === 'conductivity_tds') {
            this.correlationCharts.createConductivityTDSScatter();
            this.legendManager.updateCorrelationLegend();
        } else if (this.currentParameter === 'ph_oxygen') {
            this.correlationCharts.createPHOxygenScatter();
            this.legendManager.updateCorrelationLegend();
        } else if (this.currentParameter === 'secchi') {
            this.secchiAnalysis.createSecchiDepthAnalysis();
            this.legendManager.updateSecchiLegend();
        } else {
            this.timeSeriesCharts.createTimeSeriesView(this.currentParameter);
            this.legendManager.updateLegend('time');
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const app = new WaterQualityApp();
    app.initialize();
});
