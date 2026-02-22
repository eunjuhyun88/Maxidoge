// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — CoinMarketCap server client
// ═══════════════════════════════════════════════════════════════

import { env } from '$env/dynamic/private';

const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1';

export type CoinMarketCapQuote = {
  symbol: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24hPct: number;
  updatedAt: number;
};

export function hasCoinMarketCapApiKey(): boolean {
  return Boolean(env.COINMARKETCAP_API_KEY?.trim());
}

export async function fetchCoinMarketCapQuote(symbol: string): Promise<CoinMarketCapQuote | null> {
  const apiKey = env.COINMARKETCAP_API_KEY?.trim();
  if (!apiKey) return null;

  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) return null;

  const endpoint = `${CMC_BASE}/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(normalizedSymbol)}&convert=USD`;
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'X-CMC_PRO_API_KEY': apiKey,
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 429) return null;
    throw new Error(`coinmarketcap ${response.status}`);
  }

  const json = await response.json();
  const asset = json?.data?.[normalizedSymbol];
  const usd = asset?.quote?.USD;
  if (!usd) return null;

  const updatedAtRaw = Date.parse(String(usd.last_updated || ''));

  return {
    symbol: normalizedSymbol,
    price: Number(usd.price ?? 0),
    marketCap: Number(usd.market_cap ?? 0),
    volume24h: Number(usd.volume_24h ?? 0),
    change24hPct: Number(usd.percent_change_24h ?? 0),
    updatedAt: Number.isFinite(updatedAtRaw) ? updatedAtRaw : Date.now(),
  };
}

