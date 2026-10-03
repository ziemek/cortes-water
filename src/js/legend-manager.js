// Legend Management
import { config } from './config.js';
import { formatDate, timeGradientColor } from './utils.js';

const SEASONS = [
  { name: 'Spring', color: config.seasonColors.spring },
  { name: 'Summer', color: config.seasonColors.summer },
  { name: 'Fall', color: config.seasonColors.fall },
  { name: 'Winter', color: config.seasonColors.winter },
];

function formatDateRange(datasets) {
  const [start, end] = d3.extent(datasets, (d) => new Date(d.date));
  return `${formatDate(start)} - ${formatDate(end)}`;
}

export class LegendManager {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  clearLegend() {
    const legend = d3.select('#legend');
    legend.selectAll('*').remove();
    return legend;
  }

  // Summary of the visible samplings for each lake, under a short
  // explanation of the chart
  updateLakeLegend(title, description) {
    const legend = this.clearLegend();
    const visibleData = this.dataLoader.getVisibleData();

    const summary = legend.append('div').attr('class', 'legend-summary');
    summary.append('strong').text(title);
    summary.append('br');
    summary
      .append('span')
      .attr('class', 'legend-note')
      .text(`${description} Hover over data points for detailed information.`);

    d3.group(visibleData, (d) => d.lake).forEach((lakeData, lake) => {
      const legendItem = legend.append('div').attr('class', 'legend-item');

      const legendHeader = legendItem
        .append('div')
        .attr('class', 'legend-header');
      legendHeader
        .append('div')
        .attr('class', 'legend-color')
        .style('background-color', config.baseColorPalettes[lake][0]);
      legendHeader.append('span').text(`${lake} Lake`);

      const metadata = legendItem
        .append('div')
        .attr('class', 'legend-metadata');
      metadata.append('div').text(`${lakeData.length} datasets`);
      metadata.append('div').text(formatDateRange(lakeData));
    });
  }

  updateCorrelationLegend() {
    const legend = this.clearLegend();

    const section = legend.append('div').attr('class', 'legend-section');
    section.append('h4').text('Time Gradient');

    const gradientRow = section.append('div').attr('class', 'legend-row');
    const gradientSvg = gradientRow
      .append('svg')
      .attr('width', 200)
      .attr('height', 20);

    const gradient = gradientSvg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'timeGradient')
      .attr('x1', '0%')
      .attr('x2', '100%');
    gradient
      .append('stop')
      .attr('offset', '0%')
      .style('stop-color', timeGradientColor(0));
    gradient
      .append('stop')
      .attr('offset', '100%')
      .style('stop-color', timeGradientColor(1));

    gradientSvg
      .append('rect')
      .attr('width', 200)
      .attr('height', 20)
      .style('fill', 'url(#timeGradient)');

    gradientRow
      .append('span')
      .attr('class', 'gradient-label')
      .text('Earlier → Later');

    this.appendDataOverview(legend);
  }

  updateSecchiLegend() {
    const legend = this.clearLegend();

    const section = legend.append('div').attr('class', 'legend-section');
    section.append('h4').text('Seasonal Color Coding');

    SEASONS.forEach((season) => {
      const row = section.append('div').attr('class', 'legend-row');
      row
        .append('div')
        .attr('class', 'season-swatch')
        .style('background-color', season.color);
      row.append('span').text(season.name);
    });

    this.appendDataOverview(legend);
  }

  // Lakes, sampling count and date range of the visible samplings
  appendDataOverview(legend) {
    const visibleData = this.dataLoader.getVisibleData();
    if (visibleData.length === 0) return;

    const lakes = [...new Set(visibleData.map((d) => d.lake))];
    const overview = legend.append('div').attr('class', 'data-overview');
    overview.append('strong').text('Data Overview:');
    [
      `Lakes: ${lakes.join(', ')}`,
      `Datasets: ${visibleData.length}`,
      `Date Range: ${formatDateRange(visibleData)}`,
    ].forEach((line) => overview.append('div').text(line));
  }
}
