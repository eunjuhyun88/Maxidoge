// Stockclaw — Arena Memories API
// GET /api/arena/memories — List user's RAG memories

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { searchSimilarMemories, getAgentMemoryStats } from '$lib/server/ragMemoryService';
import type { MemorySearchMode } from '$lib/server/ragMemoryService';
import { toBoundedInt } from '$lib/server/apiValidation';
import type { AgentId } from '$lib/engine/types';
import { AGENT_IDS } from '$lib/engine/types';

const VALID_MODES: MemorySearchMode[] = ['similar_all', 'similar_failures', 'cross_agent', 'spec_agnostic'];

export const GET: RequestHandler = async ({ cookies, url }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const limit = toBoundedInt(url.searchParams.get('limit'), 10, 1, 50);
    const agentId = url.searchParams.get('agentId') as AgentId | null;
    const pair = url.searchParams.get('pair');
    const outcomeParam = url.searchParams.get('outcome');
    const queryText = url.searchParams.get('q') ?? undefined;
    const modeParam = url.searchParams.get('mode') as MemorySearchMode | null;

    // Validate agentId if provided
    if (agentId && !AGENT_IDS.includes(agentId)) {
      return json({ error: `Invalid agentId. Must be one of: ${AGENT_IDS.join(', ')}` }, { status: 400 });
    }

    // Validate mode if provided
    const mode = modeParam && VALID_MODES.includes(modeParam) ? modeParam : undefined;

    const outcomeFilter = outcomeParam === 'win' ? true : outcomeParam === 'loss' ? false : undefined;

    const result = await searchSimilarMemories({
      userId: user.id,
      agentId: agentId ?? undefined,
      pair: pair ?? undefined,
      outcomeFilter,
      limit,
      queryText,
      mode,
    });

    // If specific agent requested, include stats
    let agentStats = null;
    if (agentId) {
      agentStats = await getAgentMemoryStats(user.id, agentId);
    }

    return json({
      success: true,
      ...result,
      agentStats,
    });
  } catch (err: any) {
    console.error('[arena/memories/get]', err);
    return json({ error: 'Failed to fetch memories' }, { status: 500 });
  }
};
