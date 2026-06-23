import { PRESIDENTIAL_TERMS } from './constants.js';

/**
 * Given a timeframe id and optionally a presidential term id,
 * returns { startDate, endDate } as ISO date strings.
 */
export function timeframeToDateRange(timeframeId, presidentialTermId = null) {
  const today = new Date();
  const todayStr = toISO(today);

  switch (timeframeId) {
    case '7d':
      return { startDate: toISO(daysAgo(today, 7)), endDate: todayStr };
    case '30d':
      return { startDate: toISO(daysAgo(today, 30)), endDate: todayStr };
    case 'ytd': {
      const jan1 = new Date(today.getFullYear(), 0, 1);
      return { startDate: toISO(jan1), endDate: todayStr };
    }
    case '1y':
      return { startDate: toISO(yearsAgo(today, 1)), endDate: todayStr };
    case '5y':
      return { startDate: toISO(yearsAgo(today, 5)), endDate: todayStr };
    case '10y':
      return { startDate: toISO(yearsAgo(today, 10)), endDate: todayStr };
    case '20y':
      return { startDate: toISO(yearsAgo(today, 20)), endDate: todayStr };
    case 'presidential': {
      const term = PRESIDENTIAL_TERMS.find(t => t.id === presidentialTermId)
        || PRESIDENTIAL_TERMS[PRESIDENTIAL_TERMS.length - 1];
      return {
        startDate: term.start,
        endDate: term.end || todayStr,
      };
    }
    default:
      return { startDate: toISO(yearsAgo(today, 1)), endDate: todayStr };
  }
}

/**
 * Compute the "prior period" for a given date range.
 * For presidential terms, returns the previous term.
 */
export function priorPeriod(timeframeId, startDate, endDate, presidentialTermId) {
  if (timeframeId === 'presidential') {
    const idx = PRESIDENTIAL_TERMS.findIndex(t => t.id === presidentialTermId);
    if (idx > 0) {
      const prev = PRESIDENTIAL_TERMS[idx - 1];
      return { startDate: prev.start, endDate: prev.end || endDate, termId: prev.id };
    }
    return null;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const rangeDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  const priorEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const priorStart = new Date(priorEnd.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  return { startDate: toISO(priorStart), endDate: toISO(priorEnd) };
}

// ─── Helpers ─────────────────────────────────────────────────────

export function toISO(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(from, n) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

function yearsAgo(from, n) {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() - n);
  return d;
}

/**
 * Format a date string for axis labels depending on timeframe.
 */
export function formatDateForTimeframe(dateStr, timeframeId) {
  const d = new Date(dateStr);
  if (timeframeId === '7d' || timeframeId === '30d') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (timeframeId === 'ytd' || timeframeId === '1y') {
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  return d.getFullYear().toString();
}

/**
 * Get years for start and end dates.
 */
export function getYearRange(startDate, endDate) {
  return {
    startYear: new Date(startDate).getFullYear(),
    endYear: new Date(endDate).getFullYear(),
  };
}
