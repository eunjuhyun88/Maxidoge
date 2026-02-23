// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Unified Trending API
// ═══════════════════════════════════════════════════════════════
// Combines: CoinMarketCap (trending/gainers/most-visited)
//           + LunarCrush (social volume/sentiment)
//           + DexScreener (DEX hot tokens/boosts)

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  fetchCMCTrending,
  fetchCMCGainersLosers,
  fetchCMCMostVisited,
  type CMCTrendingCoin,
  type CMCGainerLoser,
} from '$lib/server/coinmarketcap';
import { fetchDexTokenBoostsTop, fetchDexTokenProfilesLatest } from '$lib/server/dexscreener';
import { fetchTopicSocial, hasLunarCrushKey } from '$lib/server/lunarcrush';

// ─── Types ────────────────────────────────────────────────────

interface TrendingCoin {
  rank: number;
  symbol: string;
  name: string;
  slug: string;
  price: number;
  change1h: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
  // LunarCrush social overlay
  sentiment?: number | null;
  socialVolume?: number | null;
  galaxyScore?: number | null;
}

interface DexTrendingToken {
  chainId: string;
  tokenAddress: string;
  url: string;
  description: string | null;
  icon: string | null;
}

interface TrendingResponse {
  trending: TrendingCoin[];
  gainers: CMCGainerLoser[];
  losers: CMCGainerLoser[];
  mostVisited: TrendingCoin[];
  dexHot: DexTrendingToken[];
  updatedAt: number;
}

// ─── Social Enrichment ────────────────────────────────────────

const SYMBOL_TO_TOPIC: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple',
  DOGE: 'dogecoin', ADA: 'cardano', AVAX: 'avalanche', DOT: 'polkadot',
  LINK: 'chainlink', MATIC: 'polygon', SHIB: 'shiba-inu', UNI: 'uniswap',
  NEAR: 'near-protocol', APT: 'aptos', SUI: 'sui', OP: 'optimism',
  ARB: 'arbitrum', PEPE: 'pepe', WIF: 'dogwifhat', BONK: 'bonk',
};

async function enrichWithSocial(coins: CMCTrendingCoin[]): Promise<TrendingCoin[]> {
  if (!hasLunarCrushKey()) {
    return coins.map(c => ({ ...c, sentiment: null, socialVolume: null, galaxyScore: null }));
  }

  // Only enrich top 10 to avoid rate limits
  const top10 = coins.slice(0, 10);
  const socialPromises = top10.map(c => {
    const topic = SYMBOL_TO_TOPIC[c.symbol] ?? c.slug ?? c.name.toLowerCase();
    return fetchTopicSocial(topic).catch(() => null);
  });

  const socialResults = await Promise.allSettled(socialPromises);

  return coins.map((c, i) => {
    const social = i < socialResults.length && socialResults[i].status === 'fulfilled'
      ? socialResults[i].value
      : null;

    return {
      ...c,
      sentiment: social?.sentiment ?? null,
      socialVolume: social?.interactions ?? null,
      galaxyScore: social?.galaxyScore ?? null,
    };
  });
}

// ─── Handler ──────────────────────────────────────────────────

export const GET: RequestHandler = async ({ url }) => {
  const limitParam = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50);
  const section = url.searchParams.get('section') ?? 'all'; // all, trending, gainers, dex

  try {
    const results: Partial<TrendingResponse> = {};

    // Launch ALL sections in parallel when section=all
    const wantTrending = section === 'all' || section === 'trending';
    const wantGainers = section === 'all' || section === 'gainers';
    const wantDex = section === 'all' || section === 'dex';

    const [trendingBatch, gainersBatch, dexBatch] = await Promise.allSettled([
      wantTrending
        ? Promise.allSettled([fetchCMCTrending(limitParam), fetchCMCMostVisited(limitParam)])
        : Promise.resolve(null),
      wantGainers
        ? fetchCMCGainersLosers(Math.min(limitParam, 15))
        : Promise.resolve(null),
      wantDex
        ? Promise.allSettled([fetchDexTokenBoostsTop(10), fetchDexTokenProfilesLatest(10)])
        : Promise.resolve(null),
    ]);

    // Process trending results
    if (wantTrending && trendingBatch.status === 'fulfilled' && trendingBatch.value) {
      const [trendingRaw, mostVisitedRaw] = trendingBatch.value as PromiseSettledResult<CMCTrendingCoin[]>[];
      const trending = trendingRaw.status === 'fulfilled' ? trendingRaw.value : [];
      const mostVisited = mostVisitedRaw.status === 'fulfilled' ? mostVisitedRaw.value : [];

      results.trending = await enrichWithSocial(trending);
      results.mostVisited = mostVisited.map(c => ({
        ...c, sentiment: null, socialVolume: null, galaxyScore: null,
      }));
    }

    // Process gainers/losers results
    if (wantGainers && gainersBatch.status === 'fulfilled' && gainersBatch.value) {
      const glRes = gainersBatch.value as { gainers: CMCGainerLoser[]; losers: CMCGainerLoser[] };
      results.gainers = glRes.gainers;
      results.losers = glRes.losers;
    }

    // Process DEX results
    if (wantDex && dexBatch.status === 'fulfilled' && dexBatch.value) {
      const [boostsRaw, profilesRaw] = dexBatch.value as PromiseSettledResult<any[]>[];

      const boosts = boostsRaw.status === 'fulfilled' ? (boostsRaw.value ?? []) : [];
      const profiles = profilesRaw.status === 'fulfilled' ? (profilesRaw.value ?? []) : [];

      // Merge and deduplicate DEX trending
      const dexMap = new Map<string, DexTrendingToken>();
      for (const t of [...boosts, ...profiles]) {
        const key = `${t.chainId}:${t.tokenAddress}`;
        if (!dexMap.has(key)) {
          dexMap.set(key, {
            chainId: t.chainId,
            tokenAddress: t.tokenAddress,
            url: t.url,
            description: t.description ?? null,
            icon: t.icon ?? null,
          });
        }
      }
      results.dexHot = Array.from(dexMap.values()).slice(0, 15);
    }

    return json(
      {
        ok: true,
        data: {
          trending: results.trending ?? [],
          gainers: results.gainers ?? [],
          losers: results.losers ?? [],
          mostVisited: results.mostVisited ?? [],
          dexHot: results.dexHot ?? [],
          updatedAt: Date.now(),
        } satisfies TrendingResponse,
      },
      { headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  } catch (error: unknown) {
    console.error('[api/market/trending] error:', error);
    return json({ error: 'Failed to fetch trending data' }, { status: 500 });
  }
};
