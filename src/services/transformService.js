/**
 * Transform service — currency conversion, PPP adjustment, series alignment.
 * All series are { date: string (ISO), value: number }[].
 */

// ─── Currency Conversion ──────────────────────────────────────────

/**
 * Convert index values (USD) to target currency using daily FX rates.
 * For dates where no FX rate exists (weekends/holidays), uses the most
 * recent prior rate (forward-fill).
 *
 * @param {Array<{date,value}>} indexSeries
 * @param {Object} fxRates  { "YYYY-MM-DD": { GBP: x, EUR: y, CNY: z } }
 * @param {string} currency  e.g. 'GBP'
 * @returns {Array<{date,value}>}
 */
export function convertToCurrency(indexSeries, fxRates, currency) {
  if (currency === 'USD') return indexSeries;

  // Build sorted date array for forward-fill lookup
  const fxDates = Object.keys(fxRates).sort();
  let lastRate = null;
  let fxIdx = 0;

  const result = [];
  for (const point of indexSeries) {
    // Advance fxIdx to the latest date <= point.date
    while (fxIdx < fxDates.length - 1 && fxDates[fxIdx + 1] <= point.date) {
      fxIdx++;
    }
    if (fxDates[fxIdx] <= point.date && fxRates[fxDates[fxIdx]]?.[currency]) {
      lastRate = fxRates[fxDates[fxIdx]][currency];
    }
    if (lastRate !== null) {
      result.push({ date: point.date, value: point.value * lastRate });
    }
  }
  return result;
}

// ─── PPP Adjustment ───────────────────────────────────────────────

/**
 * Apply PPP correction to a series already denominated in the target currency.
 *
 * PPP adjustment concept:
 *   The index is in USD. Its FX-converted value reflects market exchange rates.
 *   PPP adjustment scales it to reflect purchasing power parity instead.
 *
 *   pppAdjustedValue = fxValue * (usPPP / foreignPPP)
 *   But since usPPP is always 1.0 (reference), the formula simplifies:
 *   pppAdjustedValue = marketValue_USD / foreignPPPfactor
 *   (where foreignPPPfactor is in LCU per international dollar)
 *
 *   Effectively: we redenominate at PPP exchange rate rather than market rate.
 *
 * @param {Array<{date,value}>} fxSeries  Already in target currency via market FX
 * @param {Array<{date,value}>} indexSeriesUSD  Original USD series
 * @param {Object} pppByYear  { year: pppFactor } for target country
 * @param {string} currency  target currency code
 * @param {Object} fxRates  market FX rates (to get market USD→currency rate)
 * @returns {Array<{date,value}>}
 */
export function applyPPP(indexSeriesUSD, pppByYear, fxRates, currency) {
  if (currency === 'USD') return indexSeriesUSD; // USD is the reference, no PPP change

  // Build sorted fx dates for forward-fill
  const fxDates = Object.keys(fxRates).sort();
  let fxIdx = 0;

  const result = [];
  for (const point of indexSeriesUSD) {
    const year = parseInt(point.date.slice(0, 4), 10);

    // Get PPP factor for this year (or extrapolate using nearest year)
    const pppFactor = getNearestPPP(pppByYear, year);
    if (pppFactor == null) continue; // No PPP data for this year

    // Get market FX rate for this date (forward-fill)
    while (fxIdx < fxDates.length - 1 && fxDates[fxIdx + 1] <= point.date) {
      fxIdx++;
    }
    const marketFX = fxDates[fxIdx] <= point.date ? fxRates[fxDates[fxIdx]]?.[currency] : null;
    if (!marketFX) continue;

    // Actually we want: Real buying power (in international $) = Value in LCU / pppFactor
    // Value in LCU = index_USD * marketFX
    // So pppAdjusted = index_USD * (marketFX / pppFactor)
    const pppAdjusted = point.value * (marketFX / pppFactor);
    result.push({ date: point.date, value: pppAdjusted });
  }
  return result;
}

function getNearestPPP(pppByYear, year) {
  if (!pppByYear) return null;
  if (pppByYear[year] != null) return pppByYear[year];
  // Look for nearest available year
  const years = Object.keys(pppByYear).map(Number).sort((a, b) => a - b);
  if (years.length === 0) return null;
  // Use most recent year before, otherwise first year after
  const before = years.filter(y => y <= year);
  if (before.length) return pppByYear[before[before.length - 1]];
  return pppByYear[years[0]];
}

// ─── Series Alignment & Rebasing ─────────────────────────────────

/**
 * Align two series to their common date range, interpolating gaps.
 * Returns [series1Aligned, series2Aligned] with matching date arrays.
 */
export function alignSeries(series1, series2) {
  if (!series1.length || !series2.length) return [series1, series2];

  const map1 = new Map(series1.map(p => [p.date, p.value]));
  const map2 = new Map(series2.map(p => [p.date, p.value]));

  // Union of all dates
  const allDates = [...new Set([...map1.keys(), ...map2.keys()])].sort();

  // Forward-fill for each series
  let last1 = null, last2 = null;
  const aligned1 = [], aligned2 = [];
  for (const date of allDates) {
    if (map1.has(date)) last1 = map1.get(date);
    if (map2.has(date)) last2 = map2.get(date);
    if (last1 !== null && last2 !== null) {
      aligned1.push({ date, value: last1 });
      aligned2.push({ date, value: last2 });
    }
  }
  return [aligned1, aligned2];
}

/**
 * Rebase a series so the first value = 100 (index base).
 * Useful for % return comparisons.
 */
export function rebaseTo100(series) {
  if (!series.length) return series;
  const base = series[0].value;
  if (!base) return series;
  return series.map(p => ({ date: p.date, value: (p.value / base) * 100 }));
}

/**
 * Compute percentage change between series start and end.
 */
export function computeReturn(series) {
  if (series.length < 2) return null;
  const first = series[0].value;
  const last = series[series.length - 1].value;
  return ((last - first) / first) * 100;
}

/**
 * Format a number as a currency string.
 */
export function formatValue(value, currency) {
  const symbols = { USD: '$', GBP: '£', EUR: '€', CNY: '¥' };
  const sym = symbols[currency] || '';
  if (value >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${sym}${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  return `${sym}${value.toFixed(2)}`;
}
