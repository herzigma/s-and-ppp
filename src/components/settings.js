/**
 * Settings modal — FRED API key management.
 */

import { PROXY_BASE } from '../utils/constants.js';

const LS_KEY = 'stock_tracker_fred_api_key';

export function getFREDApiKey() {
  return localStorage.getItem(LS_KEY) || '';
}

export function setFREDApiKey(key) {
  localStorage.setItem(LS_KEY, key.trim());
}

export function hasFREDApiKey() {
  return !!getFREDApiKey();
}

export function initSettingsModal(onKeySet) {
  const modal = document.getElementById('settings-modal');
  const overlay = document.getElementById('settings-overlay');
  const input = document.getElementById('fred-key-input');
  const saveBtn = document.getElementById('settings-save-btn');
  const cancelBtn = document.getElementById('settings-cancel-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const errorEl = document.getElementById('settings-error');

  function open() {
    input.value = getFREDApiKey();
    errorEl.textContent = '';
    modal.classList.add('visible');
    overlay.classList.add('visible');
    setTimeout(() => input.focus(), 100);
  }

  function close() {
    modal.classList.remove('visible');
    overlay.classList.remove('visible');
  }

  async function save() {
    const key = input.value.trim();
    if (!key) {
      errorEl.textContent = 'Please enter your FRED API key.';
      return;
    }
    // Quick validate by hitting the health endpoint with a known small series
    errorEl.textContent = 'Validating…';
    saveBtn.disabled = true;
    try {
      const res = await fetch(
        `${PROXY_BASE}/api/fred?seriesId=SP500&apiKey=${encodeURIComponent(key)}&startDate=2024-01-01&endDate=2024-01-10`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFREDApiKey(key);
      close();
      onKeySet(key);
    } catch (err) {
      errorEl.textContent = `Invalid key or proxy unavailable: ${err.message}`;
    } finally {
      saveBtn.disabled = false;
    }
  }

  settingsBtn?.addEventListener('click', open);
  saveBtn.addEventListener('click', save);
  cancelBtn?.addEventListener('click', close);
  overlay.addEventListener('click', close);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });

  // Auto-open on first load if no key set
  if (!hasFREDApiKey()) {
    setTimeout(open, 400);
  }

  return { open, close };
}
