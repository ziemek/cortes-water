// Main Application Controller
import DataLoader from './data-loader.js';
import { ControlsManager } from './controls-manager.js';
import { TimeSeriesCharts } from './time-series-charts.js';
import { DepthProfileCharts } from './depth-profile-charts.js';
import {
  CorrelationCharts,
  correlationParameters,
} from './correlation-charts.js';
import { SecchiAnalysis } from './secchi-analysis.js';
import { LegendManager } from './legend-manager.js';

class WaterQualityApp {
  constructor() {
    this.dataLoader = new DataLoader();
    this.controlsManager = new ControlsManager(this.dataLoader, () =>
      this.updateVisualization()
    );
    this.timeSeriesCharts = new TimeSeriesCharts(this.dataLoader);
    this.depthProfileCharts = new DepthProfileCharts(this.dataLoader);
    this.correlationCharts = new CorrelationCharts(this.dataLoader);
    this.secchiAnalysis = new SecchiAnalysis(this.dataLoader);
    this.legendManager = new LegendManager(this.dataLoader);

    this.currentParameter = 'temperature';
    this.viewDropdown = document.getElementById('viewType');
  }

  async initialize() {
    try {
      await this.dataLoader.loadData();
    } catch (error) {
      console.error('Error loading data:', error);
      d3.select('#chartsContainer')
        .append('p')
        .attr('class', 'load-error')
        .text(
          'Could not load data/water-data.json. Run `npm run merge-data` to generate it.'
        );
      return;
    }

    this.controlsManager.createVisibilityControls();
    this.updateVisualization();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.querySelectorAll('.param-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('.param-btn')
          .forEach((b) => b.classList.toggle('active', b === btn));
        this.currentParameter = btn.dataset.param;
        this.updateVisualization();
      });
    });

    this.viewDropdown.addEventListener('change', () =>
      this.updateVisualization()
    );
  }

  // Analysis views have their own layout, so the view dropdown only applies
  // to single parameters
  isAnalysisParameter(parameter) {
    return correlationParameters.includes(parameter) || parameter === 'secchi';
  }

  updateVisualization() {
    const parameter = this.currentParameter;
    const isAnalysis = this.isAnalysisParameter(parameter);

    this.viewDropdown.disabled = isAnalysis;
    this.viewDropdown.parentElement.classList.toggle('disabled', isAnalysis);
    if (isAnalysis) this.viewDropdown.value = 'timeSeries';
    const view = this.viewDropdown.value;

    if (correlationParameters.includes(parameter)) {
      this.correlationCharts.createCorrelationView(parameter);
      this.legendManager.updateCorrelationLegend();
    } else if (parameter === 'secchi') {
      this.secchiAnalysis.createSecchiDepthAnalysis();
      this.legendManager.updateSecchiLegend();
    } else if (view === 'depthProfiles' || view === 'horizontalDepth') {
      this.depthProfileCharts.createDepthProfiles(parameter, {
        horizontal: view === 'horizontalDepth',
      });
      this.legendManager.updateLakeLegend(
        'Depth Profile Summary',
        'Each line represents a different sampling date.'
      );
    } else {
      this.timeSeriesCharts.createTimeSeriesView(parameter);
      this.legendManager.updateLakeLegend(
        'Time Series Summary',
        'Each line represents a lake; each point is one sampling date, averaged over the depth range.'
      );
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new WaterQualityApp().initialize();
});
