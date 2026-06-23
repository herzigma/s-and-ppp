import { PROXY_BASE, FRANKFURTER_BASE } from '../utils/constants.js';

const LOCALSTORAGE_PREFIX = 'stock_tracker_v1_';
const CACHE_TTL_RECENT = 15 * 60 * 1000;        // 15 min
const CACHE_TTL_HISTORICAL = 12 * 60 * 60 * 1000; // 12 h

// ─── LocalStorage Cache ───────────────────────────────────────────

function lsGet(key) {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    const ttl = entry.historical ? CACHE_TTL_HISTORICAL : CACHE_TTL_RECENT;
    if (Date.now() - entry.ts > ttl) {
      localStorage.removeItem(LOCALSTORAGE_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch { return null; }
}

function lsSet(key, data, historical = false) {
  try {
    localStorage.setItem(LOCALSTORAGE_PREFIX + key, JSON.stringify({ data, ts: Date.now(), historical }));
  } catch {
    // Storage full — prune old entries
    pruneCache();
    try { localStorage.setItem(LOCALSTORAGE_PREFIX + key, JSON.stringify({ data, ts: Date.now(), historical })); }
    catch { /* give up */ }
  }
}

function pruneCache() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(LOCALSTORAGE_PREFIX));
  keys.forEach(k => localStorage.removeItem(k));
}

// ─── FRED (via proxy) ─────────────────────────────────────────────

/**
 * Fetch a FRED series and return normalized [{date, value}] array.
 * @param {string} seriesId
 * @param {string} startDate ISO date
 * @param {string} endDate ISO date
 * @param {string} apiKey FRED API key
 */
export async function fetchFREDSeries(seriesId, startDate, endDate, apiKey) {
  const cacheKey = `fred_${seriesId}_${startDate}_${endDate}`;
  const cached = lsGet(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ seriesId, apiKey, startDate, endDate });
  const res = await fetch(`${PROXY_BASE}/api/fred?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`FRED error for ${seriesId}: ${err.error || res.statusText}`);
  }
  const json = await res.json();
  const normalized = (json.observations || []).map(o => ({
    date: o.date,
    value: parseFloat(o.value),
  }));

  const today = new Date().toISOString().slice(0, 10);
  const isHistorical = endDate < today;
  lsSet(cacheKey, normalized, isHistorical);
  return normalized;
}

// ─── Frankfurter (direct — CORS enabled) ─────────────────────────

/**
 * Fetch USD→{currencies} exchange rates for a date range.
 * Returns { date: { GBP: x, EUR: y, CNY: z } }
 * @param {string[]} symbols e.g. ['GBP','EUR','CNY']
 * @param {string} startDate
 * @param {string} endDate
 */
export async function fetchExchangeRates(symbols, startDate, endDate) {
  if (!symbols || symbols.length === 0) return {};
  const nonUSD = symbols.filter(s => s !== 'USD');
  if (nonUSD.length === 0) return {};

  const cacheKey = `fx_${nonUSD.join(',')}_${startDate}_${endDate}`;
  const cached = lsGet(cacheKey);
  if (cached) return cached;

  // Frankfurter limits: large ranges may need chunking
  // For 20y of data (~5200 trading days), a single request works fine in practice.
  const url = `${FRANKFURTER_BASE}/${startDate}..${endDate}?base=USD&symbols=${nonUSD.join(',')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Frankfurter error: ${res.statusText}`);
  const json = await res.json();

  // json.rates: { "2000-01-03": { GBP: 0.62, EUR: 1.00, CNY: 8.28 }, ... }
  const rates = json.rates || {};
  const today = new Date().toISOString().slice(0, 10);
  const isHistorical = endDate < today;
  lsSet(cacheKey, rates, isHistorical);
  return rates;
}

// ─── World Bank PPP (via proxy) ───────────────────────────────────

/**
 * Fetch PPP conversion factors for given country codes.
 * Returns { countryCode: { year: pppFactor } }
 * The US PPP factor is always 1.0.
 * @param {string[]} countryCodes World Bank 3-letter codes e.g. ['GBR','DEU','CHN']
 * @param {number} startYear
 * @param {number} endYear
 */
export async function fetchPPPData(countryCodes, startYear, endYear) {
  if (!countryCodes || countryCodes.length === 0) return {};

  const cacheKey = `ppp_${countryCodes.sort().join(';')}_${startYear}_${endYear}`;
  const cached = lsGet(cacheKey);
  if (cached) return cached;

  const countriesParam = countryCodes.join(';');
  const params = new URLSearchParams({ countries: countriesParam, startYear, endYear });
  const res = await fetch(`${PROXY_BASE}/api/ppp?${params}`);
  if (!res.ok) throw new Error(`PPP proxy error: ${res.statusText}`);
  const json = await res.json();

  // World Bank returns [ metadata, [observations...] ]
  const observations = Array.isArray(json) ? (json[1] || []) : [];
  const result = {};
  for (const obs of observations) {
    if (!obs.value) continue;
    const code = obs.countryiso3code;
    const year = parseInt(obs.date, 10);
    if (!result[code]) result[code] = {};
    result[code][year] = obs.value;
  }

  lsSet(cacheKey, result, true);
  return result;
}
