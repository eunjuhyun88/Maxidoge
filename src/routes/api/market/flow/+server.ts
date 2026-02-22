import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AGENT_SIGNALS } from '$lib/data/warroom';
import { fetch24hr, pairToSymbol } from '$lib/api/binance';
import { fetchDerivatives, normalizePair, normalizeTimeframe } from '$lib/server/marketFeedService';

function pickBias(funding: number | null, lsRatio: number | null, liqLong: number, liqShort: number): 'LONG' | 'SHORT' | 'NEUTRAL' {
  let score = 0;
  if (funding != null) score += funding > 0.0006 ? -1 : funding < -0.0006 ? 1 : 0;
  if (lsRatio != null) score += lsRatio > 1.1 ? -1 : lsRatio < 0.9 ? 1 : 0;
  if (liqLong + liqShort > 0) score += liqShort > liqLong ? 1 : liqLong > liqShort ? -1 : 0;
  if (score > 0) return 'LONG';
  if (score < 0) return 'SHORT';
  return 'NEUTRAL';
}

export const GET: RequestHandler = async ({ fetch, url }) => {
  try {
    const pair = normalizePair(url.searchParams.get('pair'));
    const timeframe = normalizeTimeframe(url.searchParams.get('timeframe'));
    const token = pair.split('/')[0];

    const [tickerRes, derivRes] = await Promise.allSettled([
      fetch24hr(pairToSymbol(pair)),
      fetchDerivatives(fetch, pair, timeframe),
    ]);

    const ticker = tickerRes.status === 'fulfilled' ? tickerRes.value : null;
    const deriv = derivRes.status === 'fulfilled' ? derivRes.value : null;

    const records = AGENT_SIGNALS.filter((s) => s.pair === pair && (s.agentId === 'flow' || s.agentId === 'deriv')).map(
      (s) => ({
        id: s.id,
        pair: s.pair,
        token: s.token,
        agentId: s.agentId,
        agent: s.name,
        vote: s.vote.toUpperCase(),
        confidence: s.conf,
        text: s.text,
        source: s.src,
        createdAt: Date.now(),
      })
    );

    const bias = pickBias(
      deriv?.funding ?? null,
      deriv?.lsRatio ?? null,
      deriv?.liqLong24h ?? 0,
      deriv?.liqShort24h ?? 0
    );

    return json(
      {
        ok: true,
        data: {
          pair,
          timeframe,
          token,
          bias,
          snapshot: {
            priceChangePct: ticker ? Number(ticker.priceChangePercent) : null,
            quoteVolume24h: ticker ? Number(ticker.quoteVolume) : null,
            funding: deriv?.funding ?? null,
            lsRatio: deriv?.lsRatio ?? null,
            liqLong24h: deriv?.liqLong24h ?? null,
            liqShort24h: deriv?.liqShort24h ?? null,
          },
          records,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=15',
        },
      }
    );
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('pair must be like')) {
      return json({ error: error.message }, { status: 400 });
    }
    if (typeof error?.message === 'string' && error.message.includes('timeframe must be one of')) {
      return json({ error: error.message }, { status: 400 });
    }
    console.error('[market/flow/get] unexpected error:', error);
    return json({ error: 'Failed to load flow data' }, { status: 500 });
  }
};

