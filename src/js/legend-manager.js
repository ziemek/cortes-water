// Chart key shown above the charts
import { config } from './config.js';
import { formatDate } from './utils.js';
import {
  cssVar,
  fadedLakeColor,
  getLakeColor,
  timeGradientColor,
} from './theme.js';
import { FAINTEST } from './depth-profile-charts.js';

const SEASONS = ['spring', 'summer', 'fall', 'winter'];

function formatDateRange(datasets) {
  const [start, end] = d3.extent(datasets, (d) => new Date(d.date));
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
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

  appendNote(legend, text) {
    legend.append('p').attr('class', 'key-note').text(text);
  }

  // One entry per lake: a line swatch (or a faint-to-solid ramp for depth
  // profiles), the lake name and its visible sampling count and dates
  updateLakeLegend(note, { ramp = false } = {}) {
    const legend = this.clearLegend();
    const items = legend.append('div').attr('class', 'key-items');

    d3.group(this.dataLoader.getVisibleData(), (d) => d.lake).forEach(
      (lakeData, lake) => {
        const color = getLakeColor(lake);
        const item = items.append('div').attr('class', 'key-item');
        const swatch = item
          .append('span')
          .attr('class', ramp ? 'key-ramp' : 'key-line');
        if (ramp) {
          const faint = fadedLakeColor(lake, FAINTEST);
          swatch.style(
            'background',
            `linear-gradient(90deg, ${faint}, ${color})`
          );
        } else {
          swatch.style('--swatch', color);
        }

        const text = item.append('span').attr('class', 'key-text');
        text.append('strong').text(`${lake} Lake`);
        text
          .append('span')
          .attr('class', 'key-meta')
          .text(
            `${plural(lakeData.length, 'sampling')} · ${formatDateRange(lakeData)}`
          );
      }
    );

    this.appendNote(legend, note);
  }

  updateCorrelationLegend() {
    const legend = this.clearLegend();
    const visibleData = this.dataLoader.getVisibleData();
    const items = legend.append('div').attr('class', 'key-items');
    const item = items.append('div').attr('class', 'key-item');

    item
      .append('span')
      .attr('class', 'key-ramp wide')
      .style(
        'background',
        `linear-gradient(90deg, ${timeGradientColor(0)}, ${timeGradientColor(1)})`
      );
    const text = item.append('span').attr('class', 'key-text');
    text.append('strong').text('Sampling date');
    if (visibleData.length > 0) {
      text
        .append('span')
        .attr('class', 'key-meta')
        .text(`Earlier → later · ${formatDateRange(visibleData)}`);
    }

    this.appendNote(
      legend,
      'Each dot is one depth reading from either lake; the dashed line is the least-squares fit.'
    );
  }

  updateSecchiLegend() {
    const legend = this.clearLegend();
    const items = legend.append('div').attr('class', 'key-items');

    SEASONS.forEach((season) => {
      const item = items.append('div').attr('class', 'key-item');
      item
        .append('span')
        .attr('class', 'key-dot')
        .style('background', cssVar(config.seasonColorVars[season]));
      item
        .append('span')
        .attr('class', 'key-text')
        .append('strong')
        .text(season[0].toUpperCase() + season.slice(1));
    });

    Object.keys(config.lakeColorVars).forEach((lake) => {
      const item = items.append('div').attr('class', 'key-item');
      item
        .append('span')
        .attr('class', 'key-dot ring')
        .style('border-color', getLakeColor(lake));
      item
        .append('span')
        .attr('class', 'key-text')
        .append('strong')
        .text(`${lake} Lake`);
    });

    this.appendNote(
      legend,
      'Dot fill is the season of the sampling; the ring is the lake. Surface charts use the 0 m reading.'
    );
  }
}
