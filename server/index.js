import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory cache: key → { data, fetchedAt }
const cache = new Map();
const CACHE_TTL_HISTORICAL = 24 * 60 * 60 * 1000; // 24h for historical
const CACHE_TTL_RECENT = 15 * 60 * 1000;           // 15min for recent data

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

function getCached(key, ttl) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.fetchedAt < ttl) return entry.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, fetchedAt: Date.now() });
}

// ─── FRED Proxy ─────────────────────────────────────────────────
// GET /api/fred?seriesId=SP500&apiKey=...&startDate=2000-01-01&endDate=2024-12-31
app.get('/api/fred', async (req, res) => {
  const { seriesId, apiKey, startDate, endDate } = req.query;
  if (!seriesId || !apiKey) {
    return res.status(400).json({ error: 'seriesId and apiKey are required' });
  }

  const cacheKey = `fred:${seriesId}:${startDate || ''}:${endDate || ''}`;
  // Use short TTL if endDate is today or not set
  const isRecent = !endDate || endDate >= new Date().toISOString().slice(0, 10);
  const ttl = isRecent ? CACHE_TTL_RECENT : CACHE_TTL_HISTORICAL;
  const cached = getCached(cacheKey, ttl);
  if (cached) return res.json(cached);

  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: 'json',
    limit: '100000',
    sort_order: 'asc',
  });
  if (startDate) params.set('observation_start', startDate);
  if (endDate) params.set('observation_end', endDate);

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?${params}`;
    console.log(`[FRED] Fetching ${seriesId} (${startDate} → ${endDate})`);
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      console.error(`[FRED] Error ${response.status}: ${text}`);
      return res.status(response.status).json({ error: text });
    }
    const data = await response.json();
    // Filter out non-numeric values (FRED uses "." for missing)
    if (data.observations) {
      data.observations = data.observations.filter(o => o.value !== '.');
    }
    setCache(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error('[FRED] Network error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── World Bank PPP Proxy ────────────────────────────────────────
// GET /api/ppp?countries=GBR;DEU;CHN&startYear=2000&endYear=2024
app.get('/api/ppp', async (req, res) => {
  const { countries, startYear, endYear } = req.query;
  if (!countries) return res.status(400).json({ error: 'countries is required' });

  const cacheKey = `ppp:${countries}:${startYear || ''}:${endYear || ''}`;
  const cached = getCached(cacheKey, CACHE_TTL_HISTORICAL);
  if (cached) return res.json(cached);

  // PA.NUS.PPP = PPP conversion factor, GDP (LCU per international $)
  const indicator = 'PA.NUS.PPP';
  const dateParam = startYear && endYear ? `date=${startYear}:${endYear}&` : '';
  const url = `https://api.worldbank.org/v2/country/${countries}/indicator/${indicator}?${dateParam}format=json&per_page=1000`;

  try {
    console.log(`[PPP] Fetching PPP for ${countries}`);
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }
    const data = await response.json();
    setCache(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error('[PPP] Network error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', cacheSize: cache.size });
});

// ─── Serve Frontend (Production) ─────────────────────────────────
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Proxy server running at http://0.0.0.0:${PORT}`);
  console.log('   Routes:');
  console.log('   GET /api/fred   — FRED stock index data');
  console.log('   GET /api/ppp    — World Bank PPP data');
  console.log('   GET /api/health — Server health\n');
});
