import './styles/index.css';
import { initSettingsModal, getFREDApiKey, hasFREDApiKey } from './components/settings.js';
import { initControls } from './components/controls.js';
import { initChart, updateChart, setChartLoading, setChartError } from './components/chart.js';
import { fetchFREDSeries, fetchExchangeRates, fetchPPPData } from './services/dataService.js';
import { convertToCurrency, applyPPP, alignSeries } from './services/transformService.js';
import { timeframeToDateRange, priorPeriod, getYearRange } from './utils/dateUtils.js';
import { INDICES, CURRENCIES, PRESIDENTIAL_TERMS, PPP_COUNTRIES } from './utils/constants.js';

// ── App State ────────────────────────────────────────────────────
let currentState = null;
let updateTimer = null;

// ── Boot ─────────────────────────────────────────────────────────
async function boot() {
  initChart();

  // Settings modal
  initSettingsModal((key) => {
    if (currentState) loadData(currentState);
  });

  // Controls — emits state on every change
  initControls((state) => {
    currentState = state;
    scheduleUpdate(state);
  });

  // Update header badge date
  updateHeaderDate();
}

/** Debounce rapid control changes */
function scheduleUpdate(state) {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => loadData(state), 120);
}

// ── Main Data Loading ─────────────────────────────────────────────
async function loadData(state) {
  if (!hasFREDApiKey()) {
    setChartError('Please enter your FRED API key to load data.');
    return;
  }

  const apiKey = getFREDApiKey();
  setChartLoading(true);

  try {
    const { indexId, currency, pppEnabled, pppCountry,
            timeframe, presidentialTermId, compareMode,
            compareIndexId, compareCurrency, comparePPP, comparePPPCountry, compareTermId } = state;

    // ── Date ranges ─────────────────────────────────────────────
    const { startDate, endDate } = timeframeToDateRange(timeframe, presidentialTermId);
    let compStart = startDate, compEnd = endDate;
    let compTermId = compareTermId;

    if (compareMode === 'prior') {
      const prior = priorPeriod(timeframe, startDate, endDate, presidentialTermId);
      if (prior) {
        compStart = prior.startDate;
        compEnd = prior.endDate;
        compTermId = prior.termId;
      }
    }

    // ── Determine what needs fetching ────────────────────────────
    const needFX = currency !== 'USD' || compareCurrency !== 'USD';
    const currencies = [...new Set([currency, compareCurrency])].filter(c => c !== 'USD');

    const needPPP = pppEnabled || comparePPP;
    const pppCountries = [];
    if (pppEnabled && pppCountry) pppCountries.push(pppCountry);
    const { DEFAULT_PPP_COUNTRY, PPP_COUNTRIES } = await import('./utils/constants.js');
    
    let validComparePPPCountry = comparePPPCountry;
    if (validComparePPPCountry) {
      const meta = PPP_COUNTRIES.find(c => c.code === validComparePPPCountry);
      if (!meta || meta.currency !== compareCurrency) validComparePPPCountry = null;
    }

    // For currency comparison with PPP, use the user's selected comparePPPCountry
    // fallback to the default PPP country for the compare currency if none selected
    const compPPPCountry = compareMode === 'currency' && comparePPP
      ? (validComparePPPCountry || DEFAULT_PPP_COUNTRY[compareCurrency] || null)
      : pppCountry;
    if (comparePPP && compPPPCountry) pppCountries.push(compPPPCountry);
    const uniquePPPCountries = [...new Set(pppCountries)];

    // Expand date range for FX/PPP to cover comparison period too
    const allStartDate = compareMode !== 'none' && compStart < startDate ? compStart : startDate;
    const allEndDate = endDate;
    const { startYear, endYear } = getYearRange(allStartDate, allEndDate);

    // ── Fetch in parallel ────────────────────────────────────────
    const [
      primaryIndexData,
      compIndexData,
      fxRates,
      pppData,
    ] = await Promise.all([
      fetchFREDSeries(indexId, allStartDate, allEndDate, apiKey),
      (compareMode === 'index')
        ? fetchFREDSeries(compareIndexId, allStartDate, allEndDate, apiKey)
        : Promise.resolve(null),
      needFX
        ? fetchExchangeRates(currencies, allStartDate, allEndDate)
        : Promise.resolve({}),
      needPPP && uniquePPPCountries.length
        ? fetchPPPData(uniquePPPCountries, startYear, endYear)
        : Promise.resolve({}),
    ]);

    // ── Build primary series ─────────────────────────────────────
    const primaryFiltered = filterByDateRange(primaryIndexData, startDate, endDate);
    let primarySeries = currency === 'USD'
      ? primaryFiltered
      : convertToCurrency(primaryFiltered, fxRates, currency);

    if (pppEnabled && pppCountry && pppData[pppCountry]) {
      primarySeries = applyPPP(primaryFiltered, pppData[pppCountry], fxRates, currency);
    }

    // ── Build comparison series ──────────────────────────────────
    let compSeries = null;
    let compPPPSeries = null;
    let compareLabel = '';
    let compPPPEnabled = false;
    let compPPPCountryName = null;

    if (compareMode !== 'none') {
      let compSourceData = primaryIndexData;
      let compCurrency = currency;
      compPPPEnabled = pppEnabled;
      // for currency mode, use comparePPPCountry (validated); for other modes default to primary pppCountry
      let resolvedCompPPPCountry = pppCountry;
      if (compareMode === 'currency') {
        resolvedCompPPPCountry = validComparePPPCountry || DEFAULT_PPP_COUNTRY[compareCurrency] || null;
      }

      switch (compareMode) {
        case 'prior': {
          compSourceData = filterByDateRange(primaryIndexData, compStart, compEnd);
          compareLabel = buildPriorLabel(timeframe, compStart, compTermId);
          break;
        }
        case 'index': {
          compSourceData = filterByDateRange(compIndexData || [], startDate, endDate);
          const cmpIdx = INDICES.find(i => i.id === compareIndexId);
          compareLabel = cmpIdx?.label || compareIndexId;
          break;
        }
        case 'currency': {
          compCurrency = compareCurrency;
          resolvedCompPPPCountry = compPPPCountry; // the one computed in outer scope
          compPPPEnabled = comparePPP;
          compSourceData = filterByDateRange(primaryIndexData, startDate, endDate);
          const pppSuffix = comparePPP ? ' [PPP]' : '';
          compareLabel = `${INDICES.find(i=>i.id===indexId)?.shortLabel} in ${compareCurrency}${pppSuffix}`;
          break;
        }
        case 'ppp': {
          compPPPEnabled = !pppEnabled; // toggle PPP
          compSourceData = filterByDateRange(primaryIndexData, startDate, endDate);
          compareLabel = pppEnabled ? 'Without PPP' : 'With PPP';
          break;
        }
      }

      // Convert comparison series
      let baseCompSeries = compareMode === 'prior'
        ? (currency === 'USD' ? compSourceData : convertToCurrency(compSourceData, fxRates, currency))
        : (compCurrency === 'USD' ? compSourceData : convertToCurrency(compSourceData, fxRates, compCurrency));

      if (compPPPEnabled && resolvedCompPPPCountry && pppData[resolvedCompPPPCountry]) {
        const pppSeries = applyPPP(compSourceData, pppData[resolvedCompPPPCountry], fxRates, compCurrency);
        if (compareMode === 'currency') {
          compPPPSeries = pppSeries;
          compareLabel = `${INDICES.find(i=>i.id===indexId)?.shortLabel} in ${compareCurrency}`;
          const { PPP_COUNTRIES } = await import('./utils/constants.js');
          compPPPCountryName = PPP_COUNTRIES.find(c => c.code === resolvedCompPPPCountry)?.name || resolvedCompPPPCountry;
        } else {
          baseCompSeries = pppSeries;
        }
      }

      compSeries = baseCompSeries;
    }

    // ── Calculate PPP extrapolation state ────────────────────────
    let pppExtrapolatedEntirely = false;
    let maxPPPYear = null;
    const activePPPCountry = (compareMode === 'currency' && compPPPSeries) ? resolvedCompPPPCountry : ( (pppEnabled || compPPPEnabled) ? pppCountry : null );
    
    if (activePPPCountry && pppData[activePPPCountry]) {
      const availableYears = Object.keys(pppData[activePPPCountry]).map(Number);
      if (availableYears.length > 0) {
        maxPPPYear = Math.max(...availableYears);
        const chartStartYear = new Date(allStartDate).getFullYear();
        if (chartStartYear > maxPPPYear) {
          pppExtrapolatedEntirely = true;
        }
      }
    }

    // ── Update chart ─────────────────────────────────────────────
    const indexMeta = INDICES.find(i => i.id === indexId);
    const compCurrencyForChart = compareMode === 'currency' ? compareCurrency : currency;

    updateChart({
      primarySeries,
      compSeries,
      compPPPSeries,
      usdSeries: primaryFiltered,
      indexId,
      currency,
      pppEnabled,
      pppCountry,
      compareMode,
      compareLabel,
      compareCurrency: compCurrencyForChart,
      compPPPEnabled: compareMode !== 'none' ? compPPPEnabled : false,
      compPPPCountryName,
      pppExtrapolatedEntirely,
      maxPPPYear,
    });

    // Update header summary
    updateHeaderBadge(indexMeta, currency, pppEnabled, pppCountry, timeframe, presidentialTermId);

  } catch (err) {
    console.error('Data load error:', err);
    setChartError(`Error loading data: ${err.message}`);
  } finally {
    setChartLoading(false);
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function filterByDateRange(series, startDate, endDate) {
  return series.filter(p => p.date >= startDate && p.date <= endDate);
}

function buildPriorLabel(timeframe, startDate, termId) {
  if (timeframe === 'presidential' && termId) {
    const term = PRESIDENTIAL_TERMS.find(t => t.id === termId);
    if (term) return term.label;
  }
  const year = new Date(startDate).getFullYear();
  const labels = { ytd: `YTD ${year}`, '7d': `Prev 7D`, '30d': `Prev 30D`,
                   '1y': `${year}–${year+1}`, '5y': `${year}–`, '10y': `${year}s`, '20y': `${year}s` };
  return labels[timeframe] || `Prior Period`;
}

function updateHeaderBadge(indexMeta, currency, pppEnabled, pppCountry, timeframe, presId) {
  const badge = document.getElementById('header-badge');
  if (!badge) return;
  const pppLabel = pppEnabled ? ` · PPP (${pppCountry})` : '';
  const tfLabel = timeframe === 'presidential'
    ? PRESIDENTIAL_TERMS.find(t => t.id === presId)?.label || 'Pres'
    : TIMEFRAMES_MAP[timeframe] || timeframe;
  badge.textContent = `${indexMeta?.label} · ${currency}${pppLabel} · ${tfLabel}`;
}

const TIMEFRAMES_MAP = {
  '7d': '7 Day', '30d': '30 Day', ytd: 'YTD', '1y': '1 Year',
  '5y': '5 Year', '10y': '10 Year', '20y': '20 Year',
};

function updateHeaderDate() {
  const el = document.getElementById('header-date');
  if (el) {
    el.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
    });
  }
}

// ── Start ─────────────────────────────────────────────────────────
boot();
