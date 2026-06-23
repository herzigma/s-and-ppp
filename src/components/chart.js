import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { formatValue, computeReturn, rebaseTo100 } from '../services/transformService.js';
import { INDICES, CURRENCIES } from '../utils/constants.js';

Chart.register(...registerables);

let chartInstance = null;
let currentCompareMode = 'none';

/**
 * Initialize the chart canvas.
 */
export function initChart() {
  const canvas = document.getElementById('main-chart');
  const ctx = canvas.getContext('2d');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,14,26,0.95)',
          borderColor: 'rgba(129,140,248,0.3)',
          borderWidth: 1,
          titleColor: '#94a3b8',
          bodyColor: '#e2e8f0',
          padding: 14,
          callbacks: {
            title: (items) => {
              const d = new Date(items[0].parsed.x);
              return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            },
            label: (item) => {
              const ds = item.dataset;
              const val = item.parsed.y;
              if (ds.isRebased) {
                return ` ${ds.label}: ${val.toFixed(2)} (rebased)`;
              }
              return ` ${ds.label}: ${formatValue(val, ds.currency || 'USD')}`;
            },
            afterBody: (items) => {
              // Show % return from start
              const lines = [];
              items.forEach(item => {
                const ds = item.dataset;
                if (ds.data && ds.data.length > 0) {
                  const first = ds.data[0].y;
                  const curr = item.parsed.y;
                  if (first) {
                    const pct = ((curr - first) / first * 100).toFixed(1);
                    const sign = pct >= 0 ? '+' : '';
                    lines.push(`  ${ds.label} from start: ${sign}${pct}%`);
                  }
                }
              });
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: { tooltipFormat: 'MMM d, yyyy' },
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#475569', maxTicksLimit: 10, font: { size: 11 } },
          border: { color: 'rgba(255,255,255,0.08)' },
        },
        y: {
          position: 'right',
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#475569',
            font: { size: 11 },
            callback: function (val) {
              const ds = chartInstance?.data?.datasets?.[0];
              const cur = ds?.currency || 'USD';
              const sym = { USD: '$', GBP: '£', EUR: '€', CNY: '¥' }[cur] || '';
              if (ds?.isRebased) return val.toFixed(0);
              if (val >= 1_000_000) return `${sym}${(val / 1_000_000).toFixed(1)}M`;
              if (val >= 1_000) return `${sym}${(val / 1000).toFixed(0)}k`;
              return `${sym}${val.toFixed(0)}`;
            },
          },
          border: { color: 'rgba(255,255,255,0.08)' },
        },
        y2: {
          position: 'left',
          display: false,
          grid: { drawOnChartArea: false },
          ticks: { color: '#475569', font: { size: 11 } },
          border: { color: 'rgba(255,255,255,0.08)' },
        },
      },
      animation: {
        duration: 600,
        easing: 'easeInOutQuart',
      },
      elements: {
        point: { radius: 0, hoverRadius: 0 },
        line: { tension: 0.2, borderWidth: 2 },
      },
    },
  });

  return chartInstance;
}

/**
 * Update the chart with primary and optional comparison series.
 *
 * @param {Object} params
 * @param {Array<{date,value}>} params.primarySeries
 * @param {Array<{date,value}>} params.compSeries  (optional)
 * @param {string} params.indexId
 * @param {string} params.currency
 * @param {boolean} params.pppEnabled
 * @param {string} params.compareMode
 * @param {string} params.compareLabel
 * @param {string} params.compareCurrency
 */
export function updateChart({
  primarySeries,
  compSeries = null,
  compPPPSeries = null,
  usdSeries = null,
  indexId,
  currency,
  pppEnabled,
  pppCountry,
  compareMode,
  compareLabel,
  compareCurrency,
  compPPPEnabled,
  compPPPCountryName,
}) {
  if (!chartInstance) return;
  currentCompareMode = compareMode;

  const indexMeta = INDICES.find(i => i.id === indexId) || INDICES[0];
  const currencyMeta = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];

  // Determine if we should rebase (normalize to 100)
  const shouldRebase = compareMode !== 'none' && compSeries;

  const primaryData = (shouldRebase ? rebaseTo100(primarySeries) : primarySeries)
    .map(p => ({ x: p.date, y: p.value }));

  const primaryLabel = buildPrimaryLabel(indexMeta, currency, pppEnabled);

  // Gradient for primary
  const canvas = document.getElementById('main-chart');
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.offsetHeight || 400);
  gradient.addColorStop(0, indexMeta.colorDim.replace('0.15', '0.35'));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  const datasets = [
    {
      label: primaryLabel,
      data: primaryData,
      borderColor: indexMeta.color,
      backgroundColor: gradient,
      fill: true,
      currency,
      isRebased: !!shouldRebase,
      yAxisID: 'y',
      tension: 0.2,
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 0,
    },
  ];

  if (compSeries && compareMode !== 'none') {
    const compData = (shouldRebase ? rebaseTo100(compSeries) : compSeries)
      .map(p => ({ x: p.date, y: p.value }));

    const compColor = '#94a3b8';
    datasets.push({
      label: compareLabel || 'Comparison',
      data: compData,
      borderColor: compColor,
      backgroundColor: 'rgba(148,163,184,0.05)',
      fill: false,
      currency: compareCurrency || currency,
      isRebased: !!shouldRebase,
      borderDash: [5, 4],
      borderWidth: 2,
      yAxisID: shouldRebase ? 'y' : 'y2',
      tension: 0.2,
      pointRadius: 0,
      pointHoverRadius: 0,
    });

    if (compPPPSeries) {
      const compPPPData = (shouldRebase ? rebaseTo100(compPPPSeries) : compPPPSeries)
        .map(p => ({ x: p.date, y: p.value }));
      
      datasets.push({
        label: `${truncLabel(compareLabel)} [PPP]`,
        data: compPPPData,
        borderColor: '#fbbf24',
        backgroundColor: 'rgba(251,191,36,0.05)',
        fill: false,
        currency: compareCurrency || currency,
        isRebased: !!shouldRebase,
        borderDash: [2, 2],
        borderWidth: 2,
        yAxisID: shouldRebase ? 'y' : 'y2',
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 0,
      });
    }

    // Enable y2 axis if not rebased and comparing different value scales
    chartInstance.options.scales.y2.display = !shouldRebase;
  } else {
    chartInstance.options.scales.y2.display = false;
  }

  chartInstance.data.datasets = datasets;
  chartInstance.update('active');

  // Update stat cards & insight
  updateStatCards({
    primary: primarySeries,
    comp: compSeries,
    compPPPSeries,
    usdSeries,
    currency,
    compareCurrency,
    indexMeta,
    compareLabel,
    compareMode,
    pppEnabled,
    pppCountry,
    compPPPEnabled,
    compPPPCountryName,
    shouldRebase,
  });
}

function buildPrimaryLabel(indexMeta, currency, pppEnabled) {
  let label = indexMeta.label;
  if (currency !== 'USD') label += ` (${currency})`;
  if (pppEnabled) label += ' [PPP]';
  return label;
}

function updateStatCards({
  primary, comp, compPPPSeries, usdSeries, currency, compareCurrency,
  indexMeta, compareLabel, compareMode, pppEnabled, pppCountry, compPPPEnabled, compPPPCountryName, shouldRebase,
}) {
  const ret = computeReturn(primary);
  const compRet = comp ? computeReturn(comp) : null;
  const compPPPRet = compPPPSeries ? computeReturn(compPPPSeries) : null;
  const usdRet = usdSeries ? computeReturn(usdSeries) : ret;

  const primaryCard = document.getElementById('stat-primary');
  const compCard = document.getElementById('stat-compare');
  const compPPPCard = document.getElementById('stat-compare-ppp');
  const fxCard = document.getElementById('stat-fx');
  const latestCard = document.getElementById('stat-latest');
  const insightEl = document.getElementById('insight-text');

  const curSym = { USD: '$', GBP: '£', EUR: '€', CNY: '¥' }[currency] || '';
  const curLabel = { USD: 'USD', GBP: 'GBP', EUR: 'EUR', CNY: 'CNY' }[currency] || currency;

  // ─── Latest value ───────────────────────────────────────────
  if (primary.length) {
    const latest = primary[primary.length - 1].value;
    latestCard.querySelector('.stat-value').textContent = formatValue(latest, currency);
    const pppTag = pppEnabled ? ' PPP' : '';
    latestCard.querySelector('.stat-label').textContent = `${indexMeta.shortLabel} · ${curLabel}${pppTag}`;
  }

  // ─── Primary return ─────────────────────────────────────────
  if (ret !== null) {
    const sign = ret >= 0 ? '+' : '';
    primaryCard.querySelector('.stat-value').textContent = `${sign}${ret.toFixed(1)}%`;
    primaryCard.querySelector('.stat-value').style.color = ret >= 0 ? '#34d399' : '#f87171';
    const returnLabel = pppEnabled
      ? `${curLabel} PPP Return`
      : currency !== 'USD'
        ? `${curLabel} Return`
        : 'USD Return';
    primaryCard.querySelector('.stat-label').textContent = returnLabel;
  }

  // ─── FX Impact card (when primary is non-USD) ───────────────
  if (currency !== 'USD' && usdRet !== null && ret !== null && !pppEnabled) {
    // FX impact = total return in foreign currency - return in USD
    // More precisely: (1 + fxRet) = (1 + totalRet) / (1 + usdRet)
    const fxImpact = ((1 + ret / 100) / (1 + usdRet / 100) - 1) * 100;
    const sign = fxImpact >= 0 ? '+' : '';
    fxCard.querySelector('.stat-value').textContent = `${sign}${fxImpact.toFixed(1)}%`;
    fxCard.querySelector('.stat-value').style.color = fxImpact >= 0 ? '#34d399' : '#f59e0b';
    fxCard.querySelector('.stat-label').textContent = `USD→${curLabel} FX`;
    fxCard.style.display = 'block';
  } else {
    fxCard.style.display = 'none';
  }

  // ─── Comparison return ──────────────────────────────────────
  if (compRet !== null) {
    const sign = compRet >= 0 ? '+' : '';
    compCard.querySelector('.stat-value').textContent = `${sign}${compRet.toFixed(1)}%`;
    compCard.querySelector('.stat-value').style.color = compRet >= 0 ? '#94a3b8' : '#f87171';
    compCard.querySelector('.stat-label').textContent = truncLabel(compareLabel) + (typeof compPPPRet === 'number' ? ' (Market)' : ' Return');
    compCard.style.display = 'block';
  } else {
    compCard.style.display = 'none';
  }

  // ─── Comparison PPP return ──────────────────────────────────
  if (compPPPRet !== null && compPPPCard) {
    const sign = compPPPRet >= 0 ? '+' : '';
    compPPPCard.querySelector('.stat-value').textContent = `${sign}${compPPPRet.toFixed(1)}%`;
    compPPPCard.querySelector('.stat-value').style.color = compPPPRet >= 0 ? '#fbbf24' : '#f87171';
    compPPPCard.querySelector('.stat-label').textContent = truncLabel(compareLabel) + ' (PPP)';
    compPPPCard.style.display = 'block';
  } else if (compPPPCard) {
    compPPPCard.style.display = 'none';
  }

  // ─── Insight narrative ──────────────────────────────────────
  insightEl.innerHTML = buildInsight({
    ret, compRet, compPPPRet, usdRet, currency, compareCurrency,
    indexMeta, compareLabel, compareMode, pppEnabled, pppCountry, compPPPEnabled, compPPPCountryName
  });
}

function truncLabel(label) {
  return label && label.length > 20 ? label.slice(0, 18) + '…' : (label || 'Compare');
}

function buildInsight({ ret, compRet, compPPPRet, usdRet, currency, compareCurrency,
  indexMeta, compareLabel, compareMode, pppEnabled, pppCountry, compPPPEnabled, compPPPCountryName,
  pppExtrapolatedEntirely, maxPPPYear }) {

  if (ret === null) return '';
  const name = indexMeta.label;
  const fmt = (v) => {
    const sign = v >= 0 ? '+' : '';
    return `${sign}${v.toFixed(1)}%`;
  };
  const cls = (v) => v >= 0 ? 'gain' : 'loss';

  // ─── No comparison mode ─────────────────────────────────────
  if (compareMode === 'none' || compRet === null) {
    if (currency === 'USD') {
      return `The <span class="highlight">${name}</span> returned <span class="${cls(ret)}">${fmt(ret)}</span> in USD over this period.`;
    }

    if (pppEnabled) {
      return `The <span class="highlight">${name}</span> returned <span class="${cls(usdRet)}">${fmt(usdRet)}</span> in USD. ` +
        `Adjusting for purchasing power parity (${pppCountry || currency}), the real return is <span class="${cls(ret)}">${fmt(ret)}</span>. ` +
        (ret > usdRet
          ? `The USD is overvalued vs PPP — market FX understates buying power.`
          : `The USD is undervalued vs PPP — market FX overstates buying power.`);
    }

    // FX only
    const fxImpact = ((1 + ret / 100) / (1 + usdRet / 100) - 1) * 100;
    const absImpact = Math.abs(fxImpact);
    const verb = fxImpact < 0 ? 'weakened' : 'strengthened';
    return `The <span class="highlight">${name}</span> returned <span class="${cls(usdRet)}">${fmt(usdRet)}</span> in USD, ` +
      `but only <span class="${cls(ret)}">${fmt(ret)}</span> in ${currency}. ` +
      `The dollar ${verb} <span class="fx">${absImpact.toFixed(1)}%</span> against ${currency} — ` +
      (fxImpact < 0
        ? `eroding gains for non-US investors.`
        : `boosting returns for non-US investors.`);
  }

  // ─── Prior period ───────────────────────────────────────────
  if (compareMode === 'prior') {
    const diff = ret - compRet;
    const better = diff >= 0;
    return `Current period: <span class="${cls(ret)}">${fmt(ret)}</span> vs prior period (${compareLabel}): <span class="${cls(compRet)}">${fmt(compRet)}</span>. ` +
      `That's <span class="${better ? 'gain' : 'loss'}">${Math.abs(diff).toFixed(1)}pp ${better ? 'better' : 'worse'}</span>.`;
  }

  // ─── Different index ────────────────────────────────────────
  if (compareMode === 'index') {
    const diff = ret - compRet;
    return `<span class="highlight">${name}</span>: <span class="${cls(ret)}">${fmt(ret)}</span> vs ` +
      `<span class="highlight">${compareLabel}</span>: <span class="${cls(compRet)}">${fmt(compRet)}</span>. ` +
      `The ${name} ${diff >= 0 ? 'outperformed' : 'underperformed'} by <span class="${diff >= 0 ? 'gain' : 'loss'}">${Math.abs(diff).toFixed(1)}pp</span>.`;
  }

  // ─── Different currency ─────────────────────────────────────
  if (compareMode === 'currency') {
    const hasPPP = typeof compPPPRet === 'number';
    let narrative = `<span class="highlight">${name}</span> in ${currency}: <span class="${cls(ret)}">${fmt(ret)}</span> vs ` +
      `in ${compareCurrency}${hasPPP ? ' (Market)' : ''}: <span class="${cls(compRet)}">${fmt(compRet)}</span>`;
    
    if (hasPPP) {
      narrative += ` vs in ${compareCurrency} (PPP - ${compPPPCountryName || pppCountry}): <span class="${cls(compPPPRet)}">${fmt(compPPPRet)}</span>. `;
    } else {
      narrative += `. `;
    }
    
    if (currency === 'USD' || compareCurrency === 'USD') {
      const isBaseUSD = currency === 'USD';
      const usdVal = isBaseUSD ? ret : compRet;
      const fxVal = isBaseUSD ? compRet : ret;
      const fxPPP = hasPPP ? compPPPRet : null;
      const fxName = isBaseUSD ? compareCurrency : currency;

      if (!hasPPP) {
        if (fxVal > usdVal) {
          narrative += `The higher return in ${fxName} means the ${fxName} <span class="fx">weakened</span> against the USD. A weaker home currency boosts returns on US assets.`;
        } else {
          narrative += `The lower return in ${fxName} means the ${fxName} <span class="fx">strengthened</span> against the USD. A stronger home currency reduces returns on US assets.`;
        }
      } else {
        const countryName = compPPPCountryName || pppCountry || fxName;
        let statementDiff = fxVal - usdVal;
        let inflationDiff = fxPPP - fxVal;
        
        let statementText = '';
        let sawHigher = false;
        let sawLower = false;
        if (Math.abs(statementDiff) < 0.5) {
          statementText = `Investors in ${countryName} would have seen similar returns on their ${fxName}-denominated statements as US investors`;
        } else if (statementDiff < 0) {
          sawLower = true;
          statementText = `Investors in ${countryName} would have seen lower returns on their ${fxName}-denominated statements than US investors`;
        } else {
          sawHigher = true;
          statementText = `Investors in ${countryName} would have seen higher returns on their ${fxName}-denominated statements than US investors`;
        }

        let inflationText = '';
        if (pppExtrapolatedEntirely) {
          inflationText = `<em>Note: World Bank PPP data is currently only available up to ${maxPPPYear}. Because of this lag, the PPP numbers exactly mirror the Market FX numbers for this recent period since the remaining inflation differentials are held constant.</em>`;
        } else if (Math.abs(inflationDiff) < 0.5) {
          inflationText = `and since consumer price inflation was roughly similar in both regions, their real-world purchasing power grew in line with those statements.`;
        } else if (inflationDiff > 0) { // US inflation was higher
          const conjunction = sawLower ? 'but' : 'and';
          const degree = sawHigher ? 'even wealthier' : 'comparatively wealthier';
          inflationText = `${conjunction} since consumer price inflation was higher in the US over that same time period, the average investor in ${countryName} would have felt ${degree}.`;
        } else { // Foreign inflation was higher
          const conjunction = sawHigher ? 'but' : 'and';
          const degree = sawLower ? 'even less wealthy' : 'comparatively less wealthy';
          inflationText = `${conjunction} since consumer price inflation was higher in ${countryName} over that same time period, the average investor in ${countryName} would have felt ${degree}.`;
        }
        
        narrative += `<br><br><strong>What this means:</strong> ${statementText}, ${inflationText}`;
      }
    } else {
      narrative += `The gap reflects how the currencies moved relative to each other over this period.`;
    }
    return narrative;
  }

  // ─── PPP toggle ─────────────────────────────────────────────
  if (compareMode === 'ppp') {
    const pppVal = pppEnabled ? ret : compRet;
    const mktVal = pppEnabled ? compRet : ret;
    const diff = pppVal - mktVal;
    const countryName = pppCountry || currency;

    let inflationText = '';
    if (pppExtrapolatedEntirely) {
      inflationText = `<em>Note: World Bank PPP data is currently only available up to ${maxPPPYear}. Because of this lag, the PPP returns mathematically mirror the Market FX returns for this recent period since the remaining inflation differentials are held constant.</em>`;
    } else if (Math.abs(diff) < 0.5) {
      inflationText = `Consumer price inflation was roughly similar in both regions over that time period, so real-world purchasing power aligns closely with market exchange rates.`;
    } else if (diff > 0) {
      inflationText = `Since consumer price inflation was higher in the US over that time period, an investor in ${countryName} would have felt comparatively wealthier than their market returns suggest.`;
    } else {
      inflationText = `Since consumer price inflation was higher in ${countryName} over that time period, an investor in ${countryName} would have felt comparatively less wealthy than their market returns suggest.`;
    }

    return `Market FX return: <span class="${cls(mktVal)}">${fmt(mktVal)}</span>. ` +
      `PPP-adjusted: <span class="${cls(pppVal)}">${fmt(pppVal)}</span>. ` +
      `<br><br><strong>What this means:</strong> ${inflationText}`;
  }

  return '';
}

/**
 * Show/hide loading overlay on the chart.
 */
export function setChartLoading(loading) {
  const overlay = document.getElementById('chart-loading');
  if (overlay) overlay.style.display = loading ? 'flex' : 'none';
}

/**
 * Show an error message on the chart area.
 */
export function setChartError(message) {
  const overlay = document.getElementById('chart-loading');
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.innerHTML = `<div class="loading-content error">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <p>${message}</p>
    <button onclick="document.getElementById('settings-btn').click(); document.getElementById('chart-loading').style.display='none'">
      Enter API Key
    </button>
  </div>`;
}
