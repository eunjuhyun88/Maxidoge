// ═══════════════════════════════════════════════════════════════
// Stockclaw — Social Sentiment Proxy (LunarCrush)
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchTopicSocial, hasLunarCrushKey } from '$lib/server/lunarcrush';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const token = (url.searchParams.get('token') || 'bitcoin').toLowerCase();

    // Map common symbols to LunarCrush topic names
    const topicMap: Record<string, string> = {
      btc: 'bitcoin', eth: 'ethereum', sol: 'solana',
      doge: 'dogecoin', xrp: 'ripple', bnb: 'bnb',
      ada: 'cardano', avax: 'avalanche', dot: 'polkadot',
      matic: 'polygon', link: 'chainlink', uni: 'uniswap',
    };
    const topic = topicMap[token] ?? token;

    if (!hasLunarCrushKey()) {
      return json({ ok: false, error: 'LunarCrush API key not configured' }, { status: 503 });
    }

    const data = await fetchTopicSocial(topic);
    if (!data) {
      return json({ ok: false, error: 'Failed to fetch social data' }, { status: 502 });
    }

    return json(
      { ok: true, data },
      { headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  } catch (error: unknown) {
    console.error('[senti/social] error:', error);
    return json({ error: 'Failed to fetch social sentiment' }, { status: 500 });
  }
};
