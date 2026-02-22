import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toBoundedInt } from '$lib/server/apiValidation';
import { fetchNews } from '$lib/server/marketFeedService';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const limit = toBoundedInt(url.searchParams.get('limit'), 20, 1, 100);
    const records = await fetchNews(limit);

    return json(
      {
        ok: true,
        data: {
          records,
          source: records.length > 0 ? 'rss' : 'empty',
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

