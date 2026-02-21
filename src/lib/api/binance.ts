// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Binance API Service (Public Market Data)
// ═══════════════════════════════════════════════════════════════
// Uses public endpoints — no API key required
// Base: https://api.binance.com or https://data-api.binance.vision

const BASE = 'https://api.binance.com';
const DATA_BASE = 'https://data-api.binance.vision';

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
  '1H': '1h',
  '4H': '4h',
  '1D': '1d',
  '1W': '1w',
};

// ─── Symbol mapping ──────────────────────────────────────────
export function pairToSymbol(pair: string): string {
  return pair.replace('/', '');
}

// ─── Fetch Klines (Candlestick Data) ─────────────────────────
export async function fetchKlines(
  symbol: string,
  interval: string = '4h',
  limit: number = 300
): Promise<BinanceKline[]> {
  const url = `${BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines error: ${res.status}`);

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
  const url = `${BASE}/api/v3/ticker/price?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance price error: ${res.status}`);
  const data: BinanceTicker = await res.json();
  return parseFloat(data.price);
}

// ─── Fetch Multiple Prices ───────────────────────────────────
export async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  const query = symbols.map(s => `"${s}"`).join(',');
  const url = `${BASE}/api/v3/ticker/price?symbols=[${query}]`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance prices error: ${res.status}`);
  const data: BinanceTicker[] = await res.json();

  const result: Record<string, number> = {};
  for (const t of data) {
    result[t.symbol] = parseFloat(t.price);
  }
  return result;
}

// ─── Fetch 24hr Ticker ───────────────────────────────────────
export async function fetch24hr(symbol: string): Promise<Binance24hr> {
  const url = `${BASE}/api/v3/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance 24hr error: ${res.status}`);
  return await res.json();
}

// ─── Fetch Multiple 24hr Tickers ─────────────────────────────
export async function fetch24hrMulti(symbols: string[]): Promise<Binance24hr[]> {
  const query = symbols.map(s => `"${s}"`).join(',');
  const url = `${BASE}/api/v3/ticker/24hr?symbols=[${query}]`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance 24hr multi error: ${res.status}`);
  return await res.json();
}

// ─── WebSocket for Real-time Klines ──────────────────────────
export function subscribeKlines(
  symbol: string,
  interval: string,
  onKline: (kline: BinanceKline) => void
): () => void {
  const wsSymbol = symbol.toLowerCase();
  const wsInterval = INTERVALS[interval] || interval;
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${wsInterval}`);

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

  ws.onerror = (err) => console.error('[Binance WS] Error:', err);

  // Return cleanup function
  return () => {
    ws.close();
  };
}

// ─── WebSocket for Real-time Mini Ticker (prices) ────────────
export function subscribeMiniTicker(
  symbols: string[],
  onUpdate: (prices: Record<string, number>) => void
): () => void {
  const streams = symbols.map(s => `${s.toLowerCase()}@miniTicker`).join('/');
  const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.data && msg.data.e === '24hrMiniTicker') {
      onUpdate({ [msg.data.s]: parseFloat(msg.data.c) });
    }
  };

  ws.onerror = (err) => console.error('[Binance WS Ticker] Error:', err);

  return () => {
    ws.close();
  };
}
