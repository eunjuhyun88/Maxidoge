// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Server-side Binance REST Client (B-02)
// ═══════════════════════════════════════════════════════════════
// Public endpoints — no API key. Server-side caching via LRU cache.

import { getCached, setCache } from './providers/cache';
import type { BinanceKline } from '$lib/api/binance';
import { toBinanceInterval } from '$lib/utils/timeframe';

const BASE = 'https://api.binance.com';
const FETCH_TIMEOUT = 8_000;
const KLINE_CACHE_TTL = 60_000;    // 1min — klines change fast
const TICKER_CACHE_TTL = 30_000;   // 30s

// Re-export the shared type
export type { BinanceKline } from '$lib/api/binance';

// ─── Klines ──────────────────────────────────────────────────

export async function fetchKlinesServer(
  symbol: string,
  interval: string = '4h',
  limit: number = 200
): Promise<BinanceKline[]> {
  const normalizedInterval = toBinanceInterval(interval);
  const cacheKey = `binance:klines:${symbol}:${normalizedInterval}:${limit}`;
  const cached = getCached<BinanceKline[]>(cacheKey);
  if (cached) return cached;

  const url = `${BASE}/api/v3/klines?symbol=${symbol}&interval=${normalizedInterval}&limit=${limit}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);

  const data: any[][] = await res.json();
  const klines: BinanceKline[] = data.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));

  setCache(cacheKey, klines, KLINE_CACHE_TTL);
  return klines;
}

// ─── 24hr Ticker ─────────────────────────────────────────────

export interface ServerBinance24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export async function fetch24hrServer(symbol: string): Promise<ServerBinance24hr> {
  const cacheKey = `binance:24hr:${symbol}`;
  const cached = getCached<ServerBinance24hr>(cacheKey);
  if (cached) return cached;

  const url = `${BASE}/api/v3/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`Binance 24hr ${res.status}`);

  const data: ServerBinance24hr = await res.json();
  setCache(cacheKey, data, TICKER_CACHE_TTL);
  return data;
}

// ─── Symbol mapping ──────────────────────────────────────────

export function pairToSymbol(pair: string): string {
  return pair.replace('/', '');
}
