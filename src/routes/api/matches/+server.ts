// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Match History API
// GET /api/matches — Get match history
// POST /api/matches — Save a new match record
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Server-side in-memory match store (replace with real DB in production)
const matches: any[] = [];
const MAX_MATCHES = 500;

export const GET: RequestHandler = async ({ url }) => {
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const userId = url.searchParams.get('userId');

  let filtered = userId
    ? matches.filter(m => m.userId === userId)
    : matches;

  const total = filtered.length;
  const records = filtered.slice(offset, offset + limit);

  return json({
    success: true,
    total,
    records,
    pagination: {
      limit,
      offset,
      hasMore: offset + limit < total
    }
  });
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { matchN, win, lp, score, agents, hypothesis, battleResult, consensusType, userId } = body;

    if (matchN === undefined || win === undefined) {
      return json({ error: 'matchN and win are required' }, { status: 400 });
    }

    const record = {
      id: crypto.randomUUID(),
      userId: userId || null,
      matchN,
      win,
      lp: lp || 0,
      score: score || 0,
      agents: agents || [],
      hypothesis: hypothesis || null,
      battleResult: battleResult || null,
      consensusType: consensusType || null,
      createdAt: Date.now()
    };

    matches.unshift(record);

    // Auto-prune
    if (matches.length > MAX_MATCHES) {
      matches.length = MAX_MATCHES;
    }

    return json({
      success: true,
      record
    });
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }
};
