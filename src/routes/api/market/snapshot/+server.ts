import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { collectMarketSnapshot } from '$lib/server/marketSnapshotService';

function toValidationMessage(error: any): string | null {
  const message = typeof error?.message === 'string' ? error.message : '';
  if (message.includes('pair must be like')) return message;
  if (message.includes('timeframe must be one of')) return message;
  return null;
}

export const GET: RequestHandler = async ({ fetch, url }) => {
  try {
    const pair = url.searchParams.get('pair');
    const timeframe = url.searchParams.get('timeframe');
    const persistRaw = (url.searchParams.get('persist') || 'true').trim().toLowerCase();
    const persist = !(persistRaw === '0' || persistRaw === 'false' || persistRaw === 'no');

    const snapshot = await collectMarketSnapshot(fetch, { pair, timeframe, persist });

    return json(
      {
        ok: true,
        data: {
          updated: snapshot.updated,
          pair: snapshot.pair,
          timeframe: snapshot.timeframe,
          at: new Date(snapshot.at).toISOString(),
          persisted: snapshot.persisted,
          warning: snapshot.warning,
          sources: snapshot.sources,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=30',
        },
      }
    );
  } catch (error: unknown) {
    const validationMessage = toValidationMessage(error);
    if (validationMessage) return json({ error: validationMessage }, { status: 400 });
    console.error('[market/snapshot/get] unexpected error:', error);
    return json({ error: 'Failed to build market snapshot' }, { status: 500 });
  }
};
