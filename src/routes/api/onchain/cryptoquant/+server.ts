// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — CryptoQuant On-chain Data API
// ═══════════════════════════════════════════════════════════════
// Exchange reserves, MVRV, NUPL, whale + miner data

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchCryptoQuantData, hasCryptoQuantKey } from '$lib/server/cryptoquant';

export const GET: RequestHandler = async ({ url }) => {
  if (!hasCryptoQuantKey()) {
    return json({ error: 'CryptoQuant API key not configured' }, { status: 503 });
  }

  const token = (url.searchParams.get('token') ?? 'btc').toLowerCase() as 'btc' | 'eth';
  if (token !== 'btc' && token !== 'eth') {
    return json({ error: 'Invalid token. Use btc or eth.' }, { status: 400 });
  }

  try {
    const data = await fetchCryptoQuantData(token);
    return json(
      { ok: true, data },
      { headers: { 'Cache-Control': 'public, max-age=120' } }
    );
  } catch (error: unknown) {
    console.error('[api/onchain/cryptoquant] error:', error);
    return json({ error: 'Failed to fetch CryptoQuant data' }, { status: 500 });
  }
};
