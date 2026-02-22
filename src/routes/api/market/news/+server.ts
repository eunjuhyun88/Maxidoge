import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { HEADLINES } from '$lib/data/warroom';
import { toBoundedInt } from '$lib/server/apiValidation';
import { fetchNews } from '$lib/server/marketFeedService';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const limit = toBoundedInt(url.searchParams.get('limit'), 20, 1, 100);
    const records = await fetchNews(limit);

    const fallback = HEADLINES.slice(0, limit).map((row, idx) => {
      const mins = Number.parseInt(String(row.time).replace(/[^0-9]/g, ''), 10);
      return {
        id: `fallback-${idx}`,
        source: 'MAXI_FEED',
        title: row.text,
        summary: row.text,
        link: '',
        publishedAt: Date.now() - (Number.isFinite(mins) ? mins : idx + 1) * 60_000,
        sentiment: row.bull ? 'bullish' : 'bearish',
      };
    });

    return json(
      {
        ok: true,
        data: {
          records: records.length > 0 ? records : fallback,
          source: records.length > 0 ? 'rss' : 'fallback',
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60',
        },
      }
    );
  } catch (error) {
    console.error('[market/news/get] unexpected error:', error);
    return json({ error: 'Failed to load market news' }, { status: 500 });
  }
};

