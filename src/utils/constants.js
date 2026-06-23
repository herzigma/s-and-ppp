// ─── Stock Indices ───────────────────────────────────────────────
export const INDICES = [
  { id: 'SP500',          label: 'S&P 500',      shortLabel: 'S&P',   color: '#818cf8', colorDim: 'rgba(129,140,248,0.15)' },
  { id: 'DJIA',           label: 'Dow Jones',    shortLabel: 'DOW',   color: '#f59e0b', colorDim: 'rgba(245,158,11,0.15)'  },
  { id: 'NASDAQCOM',      label: 'NASDAQ',       shortLabel: 'NDQ',   color: '#34d399', colorDim: 'rgba(52,211,153,0.15)'  },
  { id: 'WILL5000INDFC',  label: 'Wilshire 5000',shortLabel: 'W5000', color: '#f472b6', colorDim: 'rgba(244,114,182,0.15)' },
];

// ─── Currencies ──────────────────────────────────────────────────
export const CURRENCIES = [
  { code: 'USD', label: 'US Dollar',        symbol: '$',  flag: '🇺🇸' },
  { code: 'GBP', label: 'British Pound',    symbol: '£',  flag: '🇬🇧' },
  { code: 'EUR', label: 'Euro',             symbol: '€',  flag: '🇪🇺' },
  { code: 'CNY', label: 'Chinese Renminbi', symbol: '¥',  flag: '🇨🇳' },
];

// ─── PPP Countries ───────────────────────────────────────────────
// World Bank country codes (ISO 3-letter) for PPP data.
// USA is always the reference (PPP factor = 1.0), included for completeness.
export const PPP_COUNTRIES = [
  // GBP countries
  { code: 'GBR', name: 'United Kingdom', currency: 'GBP', flag: '🇬🇧', wbCode: 'GB' },
  // CNY countries
  { code: 'CHN', name: 'China',          currency: 'CNY', flag: '🇨🇳', wbCode: 'CN' },
  // EUR countries
  { code: 'DEU', name: 'Germany',        currency: 'EUR', flag: '🇩🇪', wbCode: 'DE' },
  { code: 'FRA', name: 'France',         currency: 'EUR', flag: '🇫🇷', wbCode: 'FR' },
  { code: 'ITA', name: 'Italy',          currency: 'EUR', flag: '🇮🇹', wbCode: 'IT' },
  { code: 'ESP', name: 'Spain',          currency: 'EUR', flag: '🇪🇸', wbCode: 'ES' },
  { code: 'NLD', name: 'Netherlands',    currency: 'EUR', flag: '🇳🇱', wbCode: 'NL' },
  { code: 'POL', name: 'Poland',         currency: 'EUR', flag: '🇵🇱', wbCode: 'PL' },
  { code: 'GRC', name: 'Greece',         currency: 'EUR', flag: '🇬🇷', wbCode: 'GR' },
  { code: 'IRL', name: 'Ireland',        currency: 'EUR', flag: '🇮🇪', wbCode: 'IE' },
  { code: 'SWE', name: 'Sweden',         currency: 'EUR', flag: '🇸🇪', wbCode: 'SE' },
];

export const PPP_COUNTRIES_BY_CURRENCY = {
  GBP: PPP_COUNTRIES.filter(c => c.currency === 'GBP'),
  EUR: PPP_COUNTRIES.filter(c => c.currency === 'EUR'),
  CNY: PPP_COUNTRIES.filter(c => c.currency === 'CNY'),
};

export const DEFAULT_PPP_COUNTRY = {
  GBP: 'GBR',
  EUR: 'DEU',
  CNY: 'CHN',
};

// ─── Timeframes ──────────────────────────────────────────────────
export const TIMEFRAMES = [
  { id: '7d',         label: '7D'    },
  { id: '30d',        label: '30D'   },
  { id: 'ytd',        label: 'YTD'   },
  { id: '1y',         label: '1Y'    },
  { id: '5y',         label: '5Y'    },
  { id: '10y',        label: '10Y'   },
  { id: '20y',        label: '20Y'   },
  { id: 'presidential', label: 'Pres' },
];

// ─── Presidential Terms ──────────────────────────────────────────
// Exchange rate / currency data starts 1999-01-04. Terms before that are included
// but data will be USD-only for the years before 1999.
export const PRESIDENTIAL_TERMS = [
  { id: 'clinton1',  label: 'Clinton I',     president: 'Clinton',  start: '1993-01-20', end: '1997-01-19', party: 'D' },
  { id: 'clinton2',  label: 'Clinton II',    president: 'Clinton',  start: '1997-01-20', end: '2001-01-19', party: 'D' },
  { id: 'bush1',     label: 'Bush I',        president: 'G.W. Bush',start: '2001-01-20', end: '2005-01-19', party: 'R' },
  { id: 'bush2',     label: 'Bush II',       president: 'G.W. Bush',start: '2005-01-20', end: '2009-01-19', party: 'R' },
  { id: 'obama1',    label: 'Obama I',       president: 'Obama',    start: '2009-01-20', end: '2013-01-19', party: 'D' },
  { id: 'obama2',    label: 'Obama II',      president: 'Obama',    start: '2013-01-20', end: '2017-01-19', party: 'D' },
  { id: 'trump1',    label: 'Trump I',       president: 'Trump',    start: '2017-01-20', end: '2021-01-19', party: 'R' },
  { id: 'biden',     label: 'Biden',         president: 'Biden',    start: '2021-01-20', end: '2025-01-19', party: 'D' },
  { id: 'trump2',    label: 'Trump II',      president: 'Trump',    start: '2025-01-20', end: null,         party: 'R' },
];

// ─── Comparison Modes ────────────────────────────────────────────
export const COMPARE_MODES = [
  { id: 'none',         label: 'No Comparison'   },
  { id: 'prior',        label: 'Prior Period'     },
  { id: 'index',        label: 'Different Index'  },
  { id: 'currency',     label: 'Different Currency' },
  { id: 'ppp',          label: 'PPP On / Off'     },
];

// ─── API Configuration ───────────────────────────────────────────
export const PROXY_BASE = 'http://localhost:3001';
export const FRANKFURTER_BASE = 'https://api.frankfurter.dev/v1';
