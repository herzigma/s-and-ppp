import {
  INDICES, CURRENCIES, TIMEFRAMES, PRESIDENTIAL_TERMS,
  COMPARE_MODES, PPP_COUNTRIES, PPP_COUNTRIES_BY_CURRENCY, DEFAULT_PPP_COUNTRY,
} from '../utils/constants.js';

/**
 * Controls panel — builds all sidebar UI and wires change events.
 * Calls onStateChange(newState) whenever any control changes.
 */
export function initControls(onStateChange) {
  // ── Default state ─────────────────────────────────────────────
  const defaultState = {
    indexId: 'SP500',
    currency: 'USD',
    pppEnabled: false,
    pppCountry: DEFAULT_PPP_COUNTRY['EUR'], // only relevant when EUR selected
    timeframe: '5y',
    presidentialTermId: PRESIDENTIAL_TERMS[PRESIDENTIAL_TERMS.length - 1].id,
    compareMode: 'none',
    compareIndexId: 'DJIA',
    compareCurrency: 'GBP',
    comparePPP: false,
    comparePPPCountry: DEFAULT_PPP_COUNTRY['EUR'],
    compareTermId: PRESIDENTIAL_TERMS[PRESIDENTIAL_TERMS.length - 2]?.id,
  };

  // ── Load state from URL ───────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const state = { ...defaultState };
  for (const key of Object.keys(state)) {
    if (params.has(key)) {
      let val = params.get(key);
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      state[key] = val;
    }
  }

  // ── Build UI ─────────────────────────────────────────────────
  buildIndexSelector(state);
  buildCurrencySelector(state);
  buildPPPControls(state);
  buildTimeframeSelector(state);
  buildPresidentialTermSelector(state);
  buildCompareSection(state);

  function emit() {
    // ── Sync to URL ──────────────────────────────────────────────
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (v !== defaultState[k]) {
        params.set(k, v);
      }
    }
    const newUrl = `${window.location.pathname}${params.size > 0 ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);

    onStateChange(state);
  }

  // ── Index Selector ────────────────────────────────────────────
  function buildIndexSelector(state) {
    const container = document.getElementById('index-options');
    INDICES.forEach(idx => {
      const btn = document.createElement('button');
      btn.className = 'pill-btn' + (idx.id === state.indexId ? ' active' : '');
      btn.dataset.id = idx.id;
      btn.innerHTML = `<span class="pill-dot" style="background:${idx.color}"></span>${idx.shortLabel}`;
      btn.title = idx.label;
      btn.addEventListener('click', () => {
        state.indexId = idx.id;
        container.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        emit();
      });
      container.appendChild(btn);
    });
  }

  // ── Currency Selector ─────────────────────────────────────────
  function buildCurrencySelector(state) {
    const container = document.getElementById('currency-options');
    CURRENCIES.forEach(cur => {
      const btn = document.createElement('button');
      btn.className = 'pill-btn' + (cur.code === state.currency ? ' active' : '');
      btn.dataset.code = cur.code;
      btn.innerHTML = `${cur.flag} ${cur.code}`;
      btn.title = cur.label;
      btn.addEventListener('click', () => {
        state.currency = cur.code;
        container.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updatePPPSection(state);
        emit();
      });
      container.appendChild(btn);
    });
  }

  // ── PPP Controls ──────────────────────────────────────────────
  function buildPPPControls(state) {
    const toggle = document.getElementById('ppp-toggle');
    const countryRow = document.getElementById('ppp-country-row');
    const countrySelect = document.getElementById('ppp-country-select');

    toggle.checked = state.pppEnabled;
    toggle.addEventListener('change', () => {
      state.pppEnabled = toggle.checked;
      updatePPPSection(state);
      emit();
    });

    function updateCountryOptions() {
      countrySelect.innerHTML = '';
      const cur = state.currency;
      const countries = PPP_COUNTRIES_BY_CURRENCY[cur] || [];
      if (countries.length === 0) {
        countryRow.style.display = 'none';
        return;
      }
      countries.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = `${c.flag} ${c.name}`;
        countrySelect.appendChild(opt);
      });
      // Set default
      const def = DEFAULT_PPP_COUNTRY[cur];
      if (def) countrySelect.value = def;
      state.pppCountry = countrySelect.value;
      countryRow.style.display = state.pppEnabled && countries.length > 0 ? 'flex' : 'none';
    }

    countrySelect.addEventListener('change', () => {
      state.pppCountry = countrySelect.value;
      emit();
    });

    window._updatePPPSection = function updatePPPSection(s) {
      const cur = s.currency;
      const hasPPP = cur !== 'USD';
      document.getElementById('ppp-section').style.display = hasPPP ? 'block' : 'none';
      if (!hasPPP) s.pppEnabled = false;
      toggle.checked = s.pppEnabled;
      updateCountryOptions();
    };
    window._updatePPPSection(state);
  }

  function updatePPPSection(s) {
    window._updatePPPSection?.(s);
  }

  // ── Timeframe Selector ────────────────────────────────────────
  function buildTimeframeSelector(state) {
    const container = document.getElementById('timeframe-options');
    TIMEFRAMES.forEach(tf => {
      const btn = document.createElement('button');
      btn.className = 'pill-btn' + (tf.id === state.timeframe ? ' active' : '');
      btn.dataset.id = tf.id;
      btn.textContent = tf.label;
      btn.addEventListener('click', () => {
        state.timeframe = tf.id;
        container.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const presRow = document.getElementById('presidential-term-row');
        presRow.style.display = tf.id === 'presidential' ? 'block' : 'none';
        updateCompareSection(state);
        emit();
      });
      container.appendChild(btn);
    });
  }

  // ── Presidential Term Selector ────────────────────────────────
  function buildPresidentialTermSelector(state) {
    const select = document.getElementById('presidential-term-select');
    const row = document.getElementById('presidential-term-row');
    row.style.display = state.timeframe === 'presidential' ? 'block' : 'none';

    PRESIDENTIAL_TERMS.slice().reverse().forEach(term => {
      const opt = document.createElement('option');
      opt.value = term.id;
      const partyBadge = term.party === 'D' ? '🔵' : '🔴';
      opt.textContent = `${partyBadge} ${term.label} (${term.start.slice(0, 4)}–${term.end ? term.end.slice(0, 4) : 'now'})`;
      select.appendChild(opt);
    });
    select.value = state.presidentialTermId;
    select.addEventListener('change', () => {
      state.presidentialTermId = select.value;
      emit();
    });
  }

  // ── Compare Section ───────────────────────────────────────────
  function buildCompareSection(state) {
    const container = document.getElementById('compare-mode-options');
    COMPARE_MODES.forEach(mode => {
      const btn = document.createElement('button');
      btn.className = 'pill-btn sm' + (mode.id === state.compareMode ? ' active' : '');
      btn.dataset.id = mode.id;
      btn.textContent = mode.label;
      btn.addEventListener('click', () => {
        state.compareMode = mode.id;
        container.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateCompareSection(state);
        emit();
      });
      container.appendChild(btn);
    });

    // Compare index sub-selector
    const cmpIndexSel = document.getElementById('compare-index-select');
    INDICES.forEach(idx => {
      const opt = document.createElement('option');
      opt.value = idx.id;
      opt.textContent = idx.label;
      cmpIndexSel.appendChild(opt);
    });
    cmpIndexSel.value = state.compareIndexId;
    cmpIndexSel.addEventListener('change', () => { state.compareIndexId = cmpIndexSel.value; emit(); });

    // Compare currency sub-selector
    const cmpCurSel = document.getElementById('compare-currency-select');
    CURRENCIES.forEach(cur => {
      const opt = document.createElement('option');
      opt.value = cur.code;
      opt.textContent = `${cur.flag} ${cur.label}`;
      cmpCurSel.appendChild(opt);
    });
    cmpCurSel.value = state.compareCurrency;
    cmpCurSel.addEventListener('change', () => { state.compareCurrency = cmpCurSel.value; emit(); });

    // Compare term sub-selector
    const cmpTermSel = document.getElementById('compare-term-select');
    PRESIDENTIAL_TERMS.slice().reverse().forEach(term => {
      const opt = document.createElement('option');
      opt.value = term.id;
      const partyBadge = term.party === 'D' ? '🔵' : '🔴';
      opt.textContent = `${partyBadge} ${term.label}`;
      cmpTermSel.appendChild(opt);
    });
    if (state.compareTermId) cmpTermSel.value = state.compareTermId;
    cmpTermSel.addEventListener('change', () => { state.compareTermId = cmpTermSel.value; emit(); });

    // Compare PPP toggle
    const cmpPPPToggle = document.getElementById('compare-ppp-toggle');
    cmpPPPToggle.checked = state.comparePPP;
    cmpPPPToggle.addEventListener('change', () => { 
      state.comparePPP = cmpPPPToggle.checked; 
      updateCompareSection(state);
      emit(); 
    });

    // Compare PPP Country selector
    const cmpPPPCountrySel = document.getElementById('compare-ppp-country-select');
    cmpPPPCountrySel.addEventListener('change', () => {
      state.comparePPPCountry = cmpPPPCountrySel.value;
      emit();
    });

    updateCompareSection(state);
  }

  function updateCompareSection(state) {
    const indexRow = document.getElementById('compare-index-row');
    const currencyRow = document.getElementById('compare-currency-row');
    const pppRow = document.getElementById('compare-ppp-row');
    const pppCountryRow = document.getElementById('compare-ppp-country-row');
    const termRow = document.getElementById('compare-term-row');

    indexRow.style.display    = state.compareMode === 'index'    ? 'block' : 'none';
    currencyRow.style.display = state.compareMode === 'currency'  ? 'block' : 'none';
    pppRow.style.display      = (state.compareMode === 'ppp' || state.compareMode === 'currency') ? 'block' : 'none';
    termRow.style.display     = (state.compareMode === 'prior' && state.timeframe === 'presidential') ? 'block' : 'none';

    const showComparePPPCountry = state.compareMode === 'currency' && state.comparePPP && state.compareCurrency === 'EUR';
    pppCountryRow.style.display = showComparePPPCountry ? 'block' : 'none';

    if (showComparePPPCountry) {
      const sel = document.getElementById('compare-ppp-country-select');
      const currentVal = state.comparePPPCountry || sel.value;
      sel.innerHTML = '';
      (PPP_COUNTRIES_BY_CURRENCY['EUR'] || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = `${c.flag} ${c.name} (PPP)`;
        sel.appendChild(opt);
      });
      if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) {
        sel.value = currentVal;
      }
      state.comparePPPCountry = sel.value; // sync state
    }

    // Update PPP row label depending on mode
    const pppRowLabel = document.querySelector('#compare-ppp-row .toggle-label');
    if (pppRowLabel) {
      pppRowLabel.textContent = state.compareMode === 'currency'
        ? 'Also apply PPP to comparison'
        : 'Compare with PPP on';
    }
  }

  // Initial emit
  emit();

  return { getState: () => ({ ...state }) };
}
