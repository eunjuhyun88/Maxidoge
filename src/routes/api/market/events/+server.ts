import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { EVENTS } from '$lib/data/warroom';
import { fetchDerivatives, normalizePair, normalizeTimeframe } from '$lib/server/marketFeedService';

export const GET: RequestHandler = async ({ fetch, url }) => {
  try {
    const pair = normalizePair(url.searchParams.get('pair'));
    const timeframe = normalizeTimeframe(url.searchParams.get('timeframe'));

    const deriv = await fetchDerivatives(fetch, pair, timeframe).catch(() => null);

    const dynamic = deriv
      ? [
          {
            id: `deriv-${pair}-${timeframe}`,
            tag: 'DERIV',
            level: 'warning',
            text:
              `Funding ${deriv.funding == null ? 'n/a' : (deriv.funding * 100).toFixed(4) + '%'} · ` +
              `L/S ${deriv.lsRatio == null ? 'n/a' : deriv.lsRatio.toFixed(2)} · ` +
              `Liq L/S ${Math.round(deriv.liqLong24h).toLocaleString()}/${Math.round(deriv.liqShort24h).toLocaleString()}`,
            source: 'COINALYZE',
            createdAt: deriv.updatedAt,
          },
        ]
      : [];

    const mappedStatic = EVENTS.map((event, idx) => ({
      id: `event-${idx}`,
      tag: event.tag,
      level: event.tag === 'SOCIAL' ? 'info' : 'warning',
      text: event.text,
      source: event.src,
      createdAt: Date.now() - (idx + 1) * 300_000,
    }));

    return json(
      {
        ok: true,
        data: {
          pair,
          timeframe,
          records: [...dynamic, ...mappedStatic],
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=30',
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
    console.error('[market/events/get] unexpected error:', error);
    return json({ error: 'Failed to load market events' }, { status: 500 });
  }
};

