// Date, formatting, color and statistics helpers. Nothing here touches the
// DOM, and d3 is only used inside the color functions.
import { config } from './config.js';

const SAMPLING_TIME_ZONE = 'America/Vancouver';

// en-CA formats dates as YYYY-MM-DD
const pacificDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAMPLING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Calendar date (YYYY-MM-DD) of a sampling in the lakes' local time,
// independent of the viewer's timezone
export function getDateOnly(date) {
  return pacificDateFormat.format(new Date(date));
}

export function getYear(date) {
  return Number(getDateOnly(date).slice(0, 4));
}

// Format date for display
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: SAMPLING_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format date-only string for display
export function formatDateOnly(dateOnlyString) {
  const date = new Date(dateOnlyString + 'T12:00:00Z');
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Get parameter label
export function getParameterLabel(param) {
  return config.parameterLabels[param] || param;
}

// Display text for an optional value, "N/A" when it wasn't recorded
export function formatValue(value, unit = '') {
  return value === null || value === undefined ? 'N/A' : `${value}${unit}`;
}

// Dynamic color generation
export function generateColorPalette(baseColors, count) {
  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  const colors = [...baseColors];
  const hslBase = baseColors.map((hex) => d3.hsl(hex));

  for (let i = baseColors.length; i < count; i++) {
    const baseIndex = i % baseColors.length;
    const variation = Math.floor(i / baseColors.length);

    const baseHsl = hslBase[baseIndex];
    const newHsl = d3.hsl(
      (baseHsl.h + variation * 25) % 360,
      Math.max(0.3, baseHsl.s - variation * 0.1),
      Math.max(
        0.3,
        Math.min(0.8, baseHsl.l + (variation % 2 === 0 ? 0.1 : -0.1))
      )
    );

    colors.push(newHsl.hex());
  }

  return colors;
}

// Generate season color
export function getSeasonColor(date) {
  const month = Number(getDateOnly(date).slice(5, 7)) - 1;
  if (month >= 2 && month <= 4) return config.seasonColors.spring;
  if (month >= 5 && month <= 7) return config.seasonColors.summer;
  if (month >= 8 && month <= 10) return config.seasonColors.fall;
  return config.seasonColors.winter;
}

// Color for a position (0 = earliest, 1 = latest) on the blue-to-green
// time gradient
export function timeGradientColor(ratio) {
  const hue = 240 - ratio * 120; // 240 = blue, 120 = green
  return d3.hsl(hue, 0.7, 0.5).hex();
}

export function getTimeGradientColor(date, minDate, maxDate) {
  const totalTime = maxDate.getTime() - minDate.getTime();
  const currentTime = new Date(date).getTime() - minDate.getTime();
  return timeGradientColor(totalTime > 0 ? currentTime / totalTime : 0);
}

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

/**
 * Least-squares fit of y on x.
 * @param {{x: number, y: number}[]} points
 * @returns {{slope: number, intercept: number, rSquared: number} | null}
 *   null when the line is undefined (fewer than 2 points or no spread in x);
 *   rSquared is NaN when every y is the same.
 */
export function linearRegression(points) {
  if (points.length < 2) return null;

  const xMean = mean(points.map((d) => d.x));
  const yMean = mean(points.map((d) => d.y));
  let sxx = 0;
  let sxy = 0;
  let totalSumSquares = 0;
  points.forEach(({ x, y }) => {
    sxx += (x - xMean) ** 2;
    sxy += (x - xMean) * (y - yMean);
    totalSumSquares += (y - yMean) ** 2;
  });
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  const residualSumSquares = points.reduce(
    (sum, { x, y }) => sum + (y - (slope * x + intercept)) ** 2,
    0
  );

  return {
    slope,
    intercept,
    rSquared: 1 - residualSumSquares / totalSumSquares,
  };
}
