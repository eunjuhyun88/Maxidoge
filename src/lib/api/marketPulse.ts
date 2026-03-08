import {
  buildMarketPulseData,
  normalizeMarketPulsePair,
  type MarketPulseData,
  type MarketPulseRaw,
} from '$lib/market/marketPulseModel';

export type { MarketPulseData } from '$lib/market/marketPulseModel';

type MarketPulseTransport = {
  ok: boolean;
  data?: MarketPulseRaw;
};

const CLIENT_CACHE_TTL_MS = 60_000;

const pulseCache = new Map<string, { data: MarketPulseData; expiresAt: number }>();
const pulseInflight = new Map<string, Promise<MarketPulseData | null>>();

/** Fetch market pulse + compute scores client-side */
export async function fetchMarketPulse(pairRaw = 'BTC/USDT', force = false): Promise<MarketPulseData | null> {
  const pair = normalizeMarketPulsePair(pairRaw);
  const now = Date.now();
  const cached = pulseCache.get(pair);

  if (!force && cached && cached.expiresAt > now) {
    return cached.data;
  }

  const inflight = pulseInflight.get(pair);
  if (!force && inflight) {
    return inflight;
  }

  const request = (async () => {
    try {
      const res = await fetch(`/api/market/pulse?pair=${encodeURIComponent(pair)}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;

      const payload = (await res.json()) as MarketPulseTransport;
      if (!payload.ok || !payload.data) return null;

      const data = buildMarketPulseData(pair, payload.data);
      pulseCache.set(pair, {
        data,
        expiresAt: Date.now() + CLIENT_CACHE_TTL_MS,
      });
      return data;
    } catch {
      return null;
    } finally {
      pulseInflight.delete(pair);
    }
  })();

  pulseInflight.set(pair, request);
  return request;
}
