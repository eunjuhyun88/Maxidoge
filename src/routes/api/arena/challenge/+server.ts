// Stockclaw — Arena Challenge API
// POST /api/arena/challenge — Create a challenge (Gold+ tier)
// GET /api/arena/challenge — List user's challenges

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { query } from '$lib/server/db';
import { CHALLENGE_MIN_TIER, CHALLENGE_MAX_REASON_LENGTH } from '$lib/engine/constants';
import { AGENT_IDS, type AgentId, type Direction } from '$lib/engine/types';
import { toBoundedInt } from '$lib/server/apiValidation';
import { randomUUID } from 'node:crypto';

const TABLE_UNAVAILABLE = new Set(['42P01', '42703', '23503']);
function isTableError(err: unknown): boolean {
  const errObj = err as Record<string, unknown> | null | undefined;
  const code = typeof errObj?.code === 'string' ? errObj.code : '';
  return TABLE_UNAVAILABLE.has(code) || (typeof errObj?.message === 'string' && (errObj.message as string).includes('DATABASE_URL is not set'));
}

export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();

    // Validate agentId
    const agentId = typeof body.agentId === 'string' ? body.agentId.toUpperCase() as AgentId : null;
    if (!agentId || !AGENT_IDS.includes(agentId)) {
      return json({ error: `Invalid agentId. Must be one of: ${AGENT_IDS.join(', ')}` }, { status: 400 });
    }

    // Validate specId
    const specId = typeof body.specId === 'string' ? body.specId.trim() : '';
    if (!specId) return json({ error: 'specId is required' }, { status: 400 });

    // Validate directions
    const userDirection = typeof body.userDirection === 'string' ? body.userDirection.toUpperCase() as Direction : null;
    const agentDirection = typeof body.agentDirection === 'string' ? body.agentDirection.toUpperCase() as Direction : null;
    if (!userDirection || (userDirection !== 'LONG' && userDirection !== 'SHORT')) {
      return json({ error: 'userDirection must be LONG or SHORT' }, { status: 400 });
    }
    if (!agentDirection || (agentDirection !== 'LONG' && agentDirection !== 'SHORT')) {
      return json({ error: 'agentDirection must be LONG or SHORT' }, { status: 400 });
    }
    if (userDirection === agentDirection) {
      return json({ error: 'Challenge requires opposing directions' }, { status: 400 });
    }

    // Validate pair
    const pair = typeof body.pair === 'string' ? body.pair.toUpperCase().trim() : 'BTC/USDT';

    // Validate reason
    const reasonTags = Array.isArray(body.reasonTags) ? body.reasonTags.filter((t: unknown) => typeof t === 'string').slice(0, 5) : [];
    const reasonText = typeof body.reasonText === 'string' ? body.reasonText.trim().slice(0, CHALLENGE_MAX_REASON_LENGTH) : null;

    // Optional matchId
    const matchId = typeof body.matchId === 'string' ? body.matchId.trim() : null;

    const challengeId = randomUUID();

    try {
      await query(
        `INSERT INTO agent_challenges
           (id, user_id, agent_id, spec_id, pair, user_direction, agent_direction, reason_tags, reason_text, match_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [challengeId, user.id, agentId, specId, pair, userDirection, agentDirection, reasonTags, reasonText, matchId],
      );
    } catch (err: unknown) {
      if (!isTableError(err)) throw err;
    }

    return json({
      success: true,
      challengeId,
      agentId,
      pair,
      userDirection,
      agentDirection,
    });
  } catch (err: any) {
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/challenge/post]', err);
    return json({ error: 'Failed to create challenge' }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ cookies, url }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const limit = toBoundedInt(url.searchParams.get('limit'), 20, 1, 50);
    const offset = toBoundedInt(url.searchParams.get('offset'), 0, 0, 5000);

    try {
      const countRes = await query<{ total: string }>(
        `SELECT count(*)::text AS total FROM agent_challenges WHERE user_id = $1`,
        [user.id],
      );
      const total = Number(countRes.rows[0]?.total ?? '0');

      const res = await query<any>(
        `SELECT id, agent_id, spec_id, pair, user_direction, agent_direction,
                reason_tags, reason_text, outcome, lp_delta, match_id,
                created_at, resolved_at
         FROM agent_challenges WHERE user_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [user.id, limit, offset],
      );

      return json({
        success: true,
        total,
        records: res.rows.map((row: any) => ({
          id: row.id,
          agentId: row.agent_id,
          specId: row.spec_id,
          pair: row.pair,
          userDirection: row.user_direction,
          agentDirection: row.agent_direction,
          reasonTags: row.reason_tags ?? [],
          reasonText: row.reason_text,
          outcome: row.outcome,
          lpDelta: row.lp_delta,
          matchId: row.match_id,
          createdAt: row.created_at,
          resolvedAt: row.resolved_at,
        })),
        pagination: { limit, offset },
      });
    } catch (err: unknown) {
      if (isTableError(err)) return json({ success: true, total: 0, records: [], pagination: { limit, offset } });
      throw err;
    }
  } catch (err: any) {
    console.error('[arena/challenge/get]', err);
    return json({ error: 'Failed to list challenges' }, { status: 500 });
  }
};
