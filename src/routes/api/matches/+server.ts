// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Match History API
// GET /api/matches — Get match history
// POST /api/matches — Save a new match record
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface MatchRow {
  id: string;
  user_id: string | null;
  match_n: number;
  win: boolean;
  lp: number;
  score: number;
  streak: number;
  agents: string[];
  agent_votes: unknown;
  hypothesis: unknown;
  battle_result: string | null;
  consensus_type: string | null;
  lp_mult: number;
  signals: unknown;
  created_at: string;
}

function toSafeInt(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeLimit(value: string | null): number {
  const parsed = toSafeInt(value, 50);
  return Math.min(200, Math.max(1, parsed));
}

function normalizeOffset(value: string | null): number {
  const parsed = toSafeInt(value, 0);
  return Math.max(0, parsed);
}

function mapMatch(row: MatchRow) {
  return {
    id: row.id,
    userId: row.user_id,
    matchN: row.match_n,
    win: row.win,
    lp: Number(row.lp ?? 0),
    score: Number(row.score ?? 0),
    streak: Number(row.streak ?? 0),
    agents: Array.isArray(row.agents) ? row.agents : [],
    agentVotes: row.agent_votes ?? null,
    hypothesis: row.hypothesis ?? null,
    battleResult: row.battle_result,
    consensusType: row.consensus_type,
    lpMult: Number(row.lp_mult ?? 1),
    signals: row.signals ?? [],
    createdAt: new Date(row.created_at).getTime(),
  };
}

export const GET: RequestHandler = async ({ url }) => {
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const offset = normalizeOffset(url.searchParams.get('offset'));
  const userId = url.searchParams.get('userId');

  if (userId && !UUID_RE.test(userId)) {
    return json({ error: 'Invalid userId format' }, { status: 400 });
  }

  try {
    const whereClause = userId ? 'WHERE user_id = $1' : '';
    const countParams = userId ? [userId] : [];
    const dataParams = userId ? [userId, limit, offset] : [limit, offset];

    const totalResult = await query<{ total: string }>(
      `SELECT count(*)::text AS total FROM matches ${whereClause}`,
      countParams
    );
    const total = Number(totalResult.rows[0]?.total ?? '0');

    const recordsResult = await query<MatchRow>(
      `
        SELECT
          id,
          user_id,
          match_n,
          win,
          lp,
          score,
          streak,
          agents,
          agent_votes,
          hypothesis,
          battle_result,
          consensus_type,
          lp_mult,
          signals,
          created_at
        FROM matches
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${userId ? 2 : 1}
        OFFSET $${userId ? 3 : 2}
      `,
      dataParams
    );

    return json({
      success: true,
      total,
      records: recordsResult.rows.map(mapMatch),
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[matches/get] unexpected error:', error);
    return json({ error: 'Failed to load matches' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      matchN,
      win,
      lp,
      score,
      streak,
      agents,
      agentVotes,
      hypothesis,
      battleResult,
      consensusType,
      lpMult,
      signals,
      userId,
    } = body;

    if (matchN === undefined || typeof win !== 'boolean') {
      return json({ error: 'matchN and win are required' }, { status: 400 });
    }
    if (!Number.isFinite(matchN) || Math.trunc(matchN) < 0) {
      return json({ error: 'matchN must be a non-negative number' }, { status: 400 });
    }
    if (userId && !UUID_RE.test(userId)) {
      return json({ error: 'Invalid userId format' }, { status: 400 });
    }

    const parsedLp = Number.isFinite(lp) ? Number(lp) : 0;
    const parsedScore = Number.isFinite(score) ? Math.trunc(score) : 0;
    const parsedStreak = Number.isFinite(streak) ? Math.trunc(streak) : 0;
    const parsedLpMult = Number.isFinite(lpMult) ? Number(lpMult) : 1;
    const parsedAgents = Array.isArray(agents) ? agents.filter((v) => typeof v === 'string') : [];

    const result = await query<MatchRow>(
      `
        INSERT INTO matches (
          user_id,
          match_n,
          win,
          lp,
          score,
          streak,
          agents,
          agent_votes,
          hypothesis,
          battle_result,
          consensus_type,
          lp_mult,
          signals
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8::jsonb, $9::jsonb, $10, $11, $12, $13::jsonb)
        RETURNING
          id,
          user_id,
          match_n,
          win,
          lp,
          score,
          streak,
          agents,
          agent_votes,
          hypothesis,
          battle_result,
          consensus_type,
          lp_mult,
          signals,
          created_at
      `,
      [
        userId || null,
        Math.trunc(matchN),
        win,
        parsedLp,
        parsedScore,
        parsedStreak,
        parsedAgents,
        agentVotes ?? null,
        hypothesis ?? null,
        battleResult ?? null,
        consensusType ?? null,
        parsedLpMult,
        signals ?? [],
      ]
    );

    return json({
      success: true,
      record: mapMatch(result.rows[0]),
    });
  } catch (error: any) {
    if (error?.code === '23503') {
      return json({ error: 'User does not exist' }, { status: 409 });
    }
    if (typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) {
      return json({ error: 'Invalid request body' }, { status: 400 });
    }
    console.error('[matches/post] unexpected error:', error);
    return json({ error: 'Failed to save match' }, { status: 500 });
  }
};
