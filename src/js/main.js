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
import { renderLakeSummary } from './lake-summary.js';

const MEASURE_NAMES = {
  temperature: 'Temperature',
  DO: 'Dissolved oxygen',
  SPC: 'Specific conductance',
  TDS: 'Total dissolved solids',
  PH: 'pH',
};

const ANALYSIS_HEADINGS = {
  temp_oxygen: [
    'Temperature vs dissolved oxygen',
    'Every depth reading, split by depth range.',
  ],
  conductivity_tds: [
    'Specific conductance vs total dissolved solids',
    'Every depth reading across the whole profile.',
  ],
  ph_oxygen: [
    'pH vs dissolved oxygen',
    'Every depth reading, split by depth range.',
  ],
  secchi: [
    'Water clarity (Secchi depth)',
    'How far down a Secchi disk stays visible, and how that tracks surface conditions.',
  ],
};

const VIEW_SUBTITLES = {
  timeSeries:
    'Each point is one sampling, averaged over the depth range. One line per lake.',
  depthProfiles:
    'One line per sampling, reading down from the surface. Faint lines are earlier; the latest is full color.',
  horizontalDepth:
    'One line per sampling, with depth across the bottom. Faint lines are earlier; the latest is full color.',
};

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
    this.currentView = 'timeSeries';
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

    renderLakeSummary(this.dataLoader.getAllSeries());
    this.controlsManager.createVisibilityControls();
    this.updateVisualization();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.querySelectorAll('.param-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.currentParameter = btn.dataset.param;
        this.updateVisualization();
      });
    });

    document.querySelectorAll('.view-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.currentView = btn.dataset.view;
        this.updateVisualization();
      });
    });

    // Charts size to their containers, so redraw when the width changes
    const chartsContainer = document.getElementById('chartsContainer');
    let lastWidth = Math.round(chartsContainer.getBoundingClientRect().width);
    let pending = null;
    new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width === lastWidth) return;
      lastWidth = width;
      clearTimeout(pending);
      pending = setTimeout(() => this.updateVisualization(), 120);
    }).observe(chartsContainer);

    // The sampling filters popover closes on an outside click or Escape
    const filters = document.getElementById('filtersPopover');
    document.addEventListener('click', (event) => {
      if (!filters.contains(event.target)) filters.open = false;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') filters.open = false;
    });
  }

  // Analysis views have their own layout, so the view choice only applies
  // to single measures
  isAnalysisParameter(parameter) {
    return correlationParameters.includes(parameter) || parameter === 'secchi';
  }

  syncControls(isAnalysis) {
    document.querySelectorAll('.param-btn').forEach((btn) => {
      const active = btn.dataset.param === this.currentParameter;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active);
    });
    document.querySelectorAll('.view-btn').forEach((btn) => {
      const active = btn.dataset.view === this.currentView;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active);
      btn.disabled = isAnalysis;
    });
    document
      .getElementById('viewGroup')
      ?.classList.toggle('disabled', isAnalysis);
  }

  setHeading(title, subtitle) {
    d3.select('#viewTitle').text(title);
    d3.select('#viewSubtitle').text(subtitle);
  }

  updateVisualization() {
    const parameter = this.currentParameter;
    const isAnalysis = this.isAnalysisParameter(parameter);
    const view = isAnalysis ? parameter : this.currentView;

    this.syncControls(isAnalysis);
    d3.select('#chartsContainer').attr('data-view', view);

    if (isAnalysis) {
      this.setHeading(...ANALYSIS_HEADINGS[parameter]);
    } else {
      this.setHeading(MEASURE_NAMES[parameter], VIEW_SUBTITLES[view]);
    }

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
        'Hover a point for its sampling details.',
        { ramp: true }
      );
    } else {
      this.timeSeriesCharts.createTimeSeriesView(parameter);
      this.legendManager.updateLakeLegend(
        'Hover a point for its sampling details.'
      );
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new WaterQualityApp().initialize();
});
