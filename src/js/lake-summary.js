// Latest-sampling cards, one per lake
import { formatDate, getYear } from './utils.js';
import { getLakeColor } from './theme.js';

const READINGS = [
  { key: 'temperature', label: 'Surface temp', unit: '°C', digits: 1 },
  { key: 'DO', label: 'Dissolved O₂', unit: 'mg/L', digits: 1 },
  { key: 'PH', label: 'pH', unit: '', digits: 1 },
];

export function renderLakeSummary(allSeries) {
  const container = d3.select('#lakeSummary');
  if (container.empty()) return;
  container.selectAll('*').remove();

  d3.group(allSeries, (s) => s.lake).forEach((series, lake) => {
    const latest = series[series.length - 1].dataset;
    const surface = latest.measurements?.find((m) => m.depth === 0);
    const secchi = d3.mean(latest.secchi_depth || []);
    const years = d3.extent(series, (s) => getYear(s.date));

    const card = container
      .append('article')
      .attr('class', 'lake-card')
      .style('--lake', getLakeColor(lake));

    const head = card.append('header').attr('class', 'lake-card-head');
    head.append('h2').text(`${lake} Lake`);
    head
      .append('span')
      .attr('class', 'lake-card-meta')
      .text(`${series.length} samplings · ${years[0]}–${years[1]}`);

    card
      .append('p')
      .attr('class', 'lake-card-date')
      .text(`Latest sampling ${formatDate(latest.date)}`);

    const stats = card.append('dl').attr('class', 'lake-stats');
    const addStat = (label, value) => {
      const stat = stats.append('div').attr('class', 'lake-stat');
      stat.append('dt').text(label);
      stat.append('dd').html(value);
    };

    READINGS.forEach(({ key, label, unit, digits }) => {
      const value = surface?.[key];
      addStat(
        label,
        value == null
          ? '—'
          : `${value.toFixed(digits)}${unit ? `<small>${unit}</small>` : ''}`
      );
    });
    addStat(
      'Secchi',
      secchi === undefined ? '—' : `${secchi.toFixed(1)}<small>m</small>`
    );
  });
}
