import { test } from 'node:test';
import assert from 'node:assert';
import {
  formatDate,
  formatDateOnly,
  formatValue,
  getDateOnly,
  getSeasonColor,
  getYear,
  linearRegression,
} from '../src/js/utils.js';
import { config } from '../src/js/config.js';

test('dates use the Pacific calendar date, not UTC', () => {
  // 17:30 Pacific on Dec 31 is 01:30 UTC on Jan 1
  const evening = '2024-12-31T17:30:00-08:00';
  assert.strictEqual(getDateOnly(evening), '2024-12-31');
  assert.strictEqual(getYear(evening), 2024);
  assert.strictEqual(formatDate(evening), 'Dec 31, 2024');
  assert.strictEqual(getSeasonColor(evening), config.seasonColors.winter);
});

test('formatDateOnly shows the given calendar date', () => {
  assert.strictEqual(formatDateOnly('2025-03-01'), 'Mar 1, 2025');
});

test('formatValue shows N/A for missing values but keeps zero', () => {
  assert.strictEqual(formatValue(null, '°C'), 'N/A');
  assert.strictEqual(formatValue(undefined), 'N/A');
  assert.strictEqual(formatValue(0, '°C'), '0°C');
  assert.strictEqual(formatValue('calm'), 'calm');
});

test('linearRegression fits a line and reports R²', () => {
  const fit = linearRegression([
    { x: 0, y: 1 },
    { x: 1, y: 3 },
    { x: 2, y: 5 },
  ]);
  assert.strictEqual(fit.slope, 2);
  assert.strictEqual(fit.intercept, 1);
  assert.strictEqual(fit.rSquared, 1);
});

test('linearRegression returns null when the line is undefined', () => {
  assert.strictEqual(linearRegression([]), null);
  assert.strictEqual(linearRegression([{ x: 1, y: 2 }]), null);
  assert.strictEqual(
    linearRegression([
      { x: 1, y: 2 },
      { x: 1, y: 5 },
    ]),
    null
  );
});

test('linearRegression gives NaN R² when y has no spread', () => {
  const fit = linearRegression([
    { x: 0, y: 4 },
    { x: 1, y: 4 },
  ]);
  assert.strictEqual(fit.slope, 0);
  assert.ok(Number.isNaN(fit.rSquared));
});
