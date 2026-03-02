// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Binance API Service (Public Market Data)
// ═══════════════════════════════════════════════════════════════
// REST calls go through /api/binance proxy to bypass CORS/geo blocks.
// WebSocket connects directly to Binance (not subject to CORS),
// with fallback to REST polling when WS is unavailable.

import { toBinanceInterval } from '$lib/utils/timeframe';

const PROXY = '/api/binance';
const DIRECT_BASE = 'https://api.binance.com/api/v3';

// WS endpoints — tried in order. stream.binance.com is primary,
// fstream.binance.com is futures but same kline format for spot pairs.
const WS_ENDPOINTS = [
  'wss://stream.binance.com:9443',
  'wss://stream.binance.com:443',
];

// ─── Types ───────────────────────────────────────────────────
export interface BinanceKline {
  time: number;       // Open time (seconds for LWC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BinanceTicker {
  symbol: string;
  price: string;
}

export interface Binance24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

// ─── Interval mapping ────────────────────────────────────────
export const INTERVALS: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
  '1H': '1h',
  '4H': '4h',
  '1D': '1d',
  '1W': '1w',
};

// ─── Symbol mapping ──────────────────────────────────────────
export function pairToSymbol(pair: string): string {
  return pair.replace('/', '');
}

// ─── Internal: fetch via proxy, fallback to direct ───────────
async function proxyFetch(endpoint: string, params: Record<string, string>): Promise<Response> {
  const qs = new URLSearchParams({ endpoint, ...params }).toString();

  // Try server proxy first (bypasses CORS & geo-blocks)
  const proxyRes = await fetch(`${PROXY}?${qs}`);
  if (proxyRes.ok) return proxyRes;

  // Fallback: call Binance directly (works if CORS is allowed)
  const directQs = new URLSearchParams(params).toString();
  const directRes = await fetch(`${DIRECT_BASE}/${endpoint}?${directQs}`);
  if (directRes.ok) return directRes;

  throw new Error(`Binance ${endpoint} error: proxy=${proxyRes.status}, direct=${directRes.status}`);
}

// ─── Fetch Klines (Candlestick Data) ─────────────────────────
export async function fetchKlines(
  symbol: string,
  interval: string = '4h',
  limit: number = 1000,
  endTime?: number // ms timestamp — fetch candles BEFORE this time
): Promise<BinanceKline[]> {
  const normalizedInterval = toBinanceInterval(interval);
  const params: Record<string, string> = {
    symbol,
    interval: normalizedInterval,
    limit: String(limit),
  };
  if (endTime) params.endTime = String(endTime);

  const res = await proxyFetch('klines', params);
  const data: any[][] = await res.json();

  return data.map((k) => ({
    time: Math.floor(k[0] / 1000), // ms → seconds for LightweightCharts
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// ─── Fetch Current Price ─────────────────────────────────────
export async function fetchPrice(symbol: string): Promise<number> {
  const res = await proxyFetch('ticker/price', { symbol });
  const data: BinanceTicker = await res.json();
  return parseFloat(data.price);
}

// ─── Fetch Multiple Prices ───────────────────────────────────
export async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  const res = await proxyFetch('ticker/price', { symbols: `[${symbols.map(s => `"${s}"`).join(',')}]` });
  const data: BinanceTicker[] = await res.json();

  const result: Record<string, number> = {};
  for (const t of data) {
    result[t.symbol] = parseFloat(t.price);
  }
  return result;
}

// ─── Fetch 24hr Ticker ───────────────────────────────────────
export async function fetch24hr(symbol: string): Promise<Binance24hr> {
  const res = await proxyFetch('ticker/24hr', { symbol });
  return await res.json();
}

// ─── Fetch Multiple 24hr Tickers ─────────────────────────────
export async function fetch24hrMulti(symbols: string[]): Promise<Binance24hr[]> {
  const res = await proxyFetch('ticker/24hr', { symbols: `[${symbols.map(s => `"${s}"`).join(',')}]` });
  return await res.json();
}

// ─── WebSocket for Real-time Klines (with auto-reconnect + WS fallback) ───
export function subscribeKlines(
  symbol: string,
  interval: string,
  onKline: (kline: BinanceKline) => void
): () => void {
  const wsSymbol = symbol.toLowerCase();
  const wsInterval = toBinanceInterval(interval);
  let wsEndpointIdx = 0;

  let ws: WebSocket | null = null;
  let destroyed = false;
  let retryDelay = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let wsFailCount = 0;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function connect() {
    if (destroyed) return;

    // After 3 consecutive WS failures, fall back to REST polling
    if (wsFailCount >= 3) {
      startPolling();
      return;
    }

    const base = WS_ENDPOINTS[wsEndpointIdx % WS_ENDPOINTS.length];
    const url = `${base}/ws/${wsSymbol}@kline_${wsInterval}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      retryDelay = 1000;
      wsFailCount = 0;
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.e === 'kline') {
        const k = msg.k;
        onKline({
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        });
      }
    };

    ws.onerror = () => {
      wsFailCount++;
    };

    ws.onclose = () => {
      if (destroyed) return;
      wsEndpointIdx++;
      retryTimer = setTimeout(() => {
        retryDelay = Math.min(retryDelay * 2, 30000);
        connect();
      }, retryDelay);
    };
  }

  // REST polling fallback — fetches latest candle every 5s via proxy
  function startPolling() {
    if (destroyed || pollTimer) return;
    console.warn('[Binance] WebSocket unavailable, falling back to REST polling');
    pollTimer = setInterval(async () => {
      if (destroyed) return;
      try {
        const klines = await fetchKlines(symbol, interval, 1);
        if (klines.length > 0) onKline(klines[klines.length - 1]);
      } catch { /* silent — will retry next interval */ }
    }, 5000);
  }

  connect();

  return () => {
    destroyed = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (pollTimer) clearInterval(pollTimer);
    if (ws) ws.close();
  };
}

// ─── WebSocket for Real-time Mini Ticker (with auto-reconnect + fallback) ─
export function subscribeMiniTicker(
  symbols: string[],
  onUpdate: (prices: Record<string, number>) => void
): () => void {
  const streams = symbols.map(s => `${s.toLowerCase()}@miniTicker`).join('/');
  let wsEndpointIdx = 0;

  let ws: WebSocket | null = null;
  let destroyed = false;
  let retryDelay = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let wsFailCount = 0;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function connect() {
    if (destroyed) return;

    if (wsFailCount >= 3) {
      startPolling();
      return;
    }

    const base = WS_ENDPOINTS[wsEndpointIdx % WS_ENDPOINTS.length];
    const url = `${base}/stream?streams=${streams}`;
    ws = new WebSocket(url);

    ws.onopen = () => { retryDelay = 1000; wsFailCount = 0; };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.data && msg.data.e === '24hrMiniTicker') {
        onUpdate({ [msg.data.s]: parseFloat(msg.data.c) });
      }
    };

    ws.onerror = () => { wsFailCount++; };

    ws.onclose = () => {
      if (destroyed) return;
      wsEndpointIdx++;
      retryTimer = setTimeout(() => {
        retryDelay = Math.min(retryDelay * 2, 30000);
        connect();
      }, retryDelay);
    };
  }

  // REST polling fallback — fetches ticker prices every 5s via proxy
  function startPolling() {
    if (destroyed || pollTimer) return;
    console.warn('[Binance] Ticker WS unavailable, falling back to REST polling');
    pollTimer = setInterval(async () => {
      if (destroyed) return;
      try {
        const prices = await fetchPrices(symbols);
        onUpdate(prices);
      } catch { /* silent — will retry next interval */ }
    }, 5000);
  }

  connect();

  return () => {
    destroyed = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (pollTimer) clearInterval(pollTimer);
    if (ws) ws.close();
  };
}
