// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Market Pulse API
// ═══════════════════════════════════════════════════════════════
// Returns Heat Score + Macro Regime in one call.
// Aggregates: Coinalyze, CryptoQuant proxy, Fear&Greed, Yahoo proxy
// Cache: 3 minutes (derivatives data is not real-time anyway)

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getErrorMessage } from '$lib/utils/errorUtils';
import { normalizeMarketPulsePair, type MarketPulseRaw } from '$lib/market/marketPulseModel';

const FNG_API = 'https://api.alternative.me/fng/';
const CACHE_TTL_MS = 3 * 60 * 1000;

const pulseCache = new Map<string, { cachedAt: number; data: MarketPulseRaw }>();

export const GET: RequestHandler = async ({ fetch, url }) => {
  const pair = normalizeMarketPulsePair(url.searchParams.get('pair'));

  // ── Cache check ──
  const now = Date.now();
  const cached = pulseCache.get(pair);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return json(
      { ok: true, data: cached.data, cached: true },
      {
        headers: { 'Cache-Control': 'public, max-age=180' },
      },
    );
  }

  try {
    // ── Parallel fetch all sources ──
    const [fngRes, macroRes, cqRes, derivRes] = await Promise.allSettled([
      fetchFearGreed(fetch),
      fetchMacro(fetch),
      fetchCryptoQuant(fetch, pair.startsWith('BTC') ? 'btc' : 'eth'),
      fetchDerivatives(fetch, pair),
    ]);

    const fng = fngRes.status === 'fulfilled' ? fngRes.value : null;
    const macro = macroRes.status === 'fulfilled' ? macroRes.value : null;
    const cq = cqRes.status === 'fulfilled' ? cqRes.value : null;
    const deriv = derivRes.status === 'fulfilled' ? derivRes.value : null;

    const result: MarketPulseRaw = {
      updatedAt: now,
      // Raw data for client-side engine computation
      fearGreed: fng?.value ?? null,
      fearGreedClassification: fng?.classification ?? null,
      // Macro
      dxy: macro?.dxy ?? null,
      spx: macro?.spx ?? null,
      us10y: macro?.us10y ?? null,
      // On-chain
      mvrv: cq?.onchainMetrics?.mvrv ?? null,
      nupl: cq?.onchainMetrics?.nupl ?? null,
      exchangeReserveChange7d: cq?.exchangeReserve?.change7dPct ?? null,
      exchangeNetflow24h: cq?.exchangeReserve?.netflow24h ?? null,
      // Derivatives
      fundingRate: deriv?.funding ?? null,
      oiChange24hPct: deriv?.oiChange24hPct ?? null,
      lsRatio: deriv?.lsRatio ?? null,
      liqLong24h: deriv?.liqLong24h ?? null,
      liqShort24h: deriv?.liqShort24h ?? null,
      // BTC Dominance (from CoinGecko global, or fallback)
      btcDominance: null as number | null, // TODO: add CoinGecko global endpoint
    };

    pulseCache.set(pair, { data: result, cachedAt: now });

    return json(
      { ok: true, data: result, cached: false },
      {
        headers: { 'Cache-Control': 'public, max-age=180' },
      },
    );
  } catch (error: unknown) {
    console.error('[market/pulse/get] unexpected error:', getErrorMessage(error));
    return json({ ok: false, error: 'Market pulse fetch failed' }, { status: 500 });
  }
};

// ─── Data Fetchers ──────────────────────────────────────────

async function fetchFearGreed(eventFetch: typeof globalThis.fetch): Promise<{ value: number; classification: string } | null> {
  try {
    const res = await eventFetch(FNG_API, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const payload = await res.json();
    if (!payload?.data?.[0]) return null;
    return {
      value: Number(payload.data[0].value),
      classification: payload.data[0].value_classification ?? 'Unknown',
    };
  } catch {
    return null;
  }
}

async function fetchMacro(svelteKitFetch: typeof globalThis.fetch) {
  try {
    const res = await svelteKitFetch('/api/macro/indicators', {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

async function fetchCryptoQuant(svelteKitFetch: typeof globalThis.fetch, token: string) {
  try {
    const res = await svelteKitFetch(`/api/onchain/cryptoquant?token=${token}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

async function fetchDerivatives(svelteKitFetch: typeof globalThis.fetch, pair: string) {
  try {
    const encoded = encodeURIComponent(pair);
    const res = await svelteKitFetch(`/api/market/derivatives/${encoded}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}
