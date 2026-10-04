// Chart colors, read from the page's CSS custom properties so the
// stylesheet owns the palette
import { config } from './config.js';
import { getSeason } from './utils.js';

export function cssVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

export function getLakeColor(lake) {
  return cssVar(config.lakeColorVars[lake]) || '#888';
}

export function getSeasonColor(date) {
  return cssVar(config.seasonColorVars[getSeason(date)]);
}

// Color for a position (0 = earliest, 1 = latest) on the single-hue time ramp
export function timeGradientColor(ratio) {
  return d3.interpolateLab(cssVar('--time-start'), cssVar('--time-end'))(ratio);
}

export function getTimeGradientColor(date, minDate, maxDate) {
  const totalTime = maxDate.getTime() - minDate.getTime();
  const currentTime = new Date(date).getTime() - minDate.getTime();
  return timeGradientColor(totalTime > 0 ? currentTime / totalTime : 0);
}

// The lake's color faded toward the chart background; ratio 0 is the
// background, 1 the full lake color
export function fadedLakeColor(lake, ratio) {
  return d3.interpolateLab(
    cssVar('--chart-surface'),
    getLakeColor(lake)
  )(ratio);
}
