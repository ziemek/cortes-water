// Date, formatting and statistics helpers. Nothing here touches the DOM or
// uses d3, so it can be tested under Node.
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

// Season of a sampling by its Pacific calendar month
export function getSeason(date) {
  const month = Number(getDateOnly(date).slice(5, 7));
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
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
