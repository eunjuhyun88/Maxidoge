// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Binance API Proxy
// Proxies public Binance endpoints to bypass CORS / geo-restrictions
// GET /api/binance?endpoint=klines&symbol=BTCUSDT&interval=4h&limit=1000
// GET /api/binance?endpoint=ticker/price&symbol=BTCUSDT
// GET /api/binance?endpoint=ticker/24hr&symbol=BTCUSDT
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BASE = 'https://api.binance.com/api/v3';
const DATA_BASE = 'https://data-api.binance.vision/api/v3';

const ALLOWED_ENDPOINTS = [
  'klines',
  'ticker/price',
  'ticker/24hr',
  'ping',
  'time'
];

export const GET: RequestHandler = async ({ url }) => {
  const endpoint = url.searchParams.get('endpoint');

  if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
    return json({ error: 'Invalid endpoint' }, { status: 400 });
  }

  // Forward all query params except 'endpoint'
  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key !== 'endpoint') params.set(key, value);
  }

  const qs = params.toString();
  const primaryUrl = `${BASE}/${endpoint}${qs ? `?${qs}` : ''}`;
  const fallbackUrl = `${DATA_BASE}/${endpoint}${qs ? `?${qs}` : ''}`;

  try {
    // Try primary Binance API first
    let res = await fetch(primaryUrl, {
      headers: { 'Accept': 'application/json' }
    });

    // If primary fails, try data-api fallback
    if (!res.ok && res.status !== 429) {
      res = await fetch(fallbackUrl, {
        headers: { 'Accept': 'application/json' }
      });
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return json(
        { error: `Binance ${res.status}`, detail: errText },
        { status: res.status === 429 ? 429 : 502 }
      );
    }

    const data = await res.json();
    return json(data, {
      headers: { 'Cache-Control': 'public, max-age=5' }
    });
  } catch (err) {
    // If both fail, return 502
    console.error('[Binance proxy]', err);
    return json({ error: 'Failed to fetch from Binance' }, { status: 502 });
  }
};
