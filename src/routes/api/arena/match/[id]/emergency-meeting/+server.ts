// Stockclaw — Arena Emergency Meeting API
// POST /api/arena/match/[id]/emergency-meeting — Generate LLM agent debate

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { getMatch, storeEmergencyMeetingData } from '$lib/server/arenaService';
import { generateEmergencyMeeting } from '$lib/server/agentPersonaService';
import { emergencyMeetingLimiter } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ cookies, params, getClientAddress }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    // Rate limit (LLM calls are expensive)
    const ip = getClientAddress();
    if (!emergencyMeetingLimiter.check(ip)) {
      return json({ error: 'Emergency meeting rate limit exceeded. Try again later.' }, { status: 429 });
    }

    const matchId = params.id;
    if (!matchId) return json({ error: 'matchId is required' }, { status: 400 });

    // Get match state
    const match = await getMatch(user.id, matchId);
    if (!match) return json({ error: 'Match not found' }, { status: 404 });

    // Must be in ANALYSIS or HYPOTHESIS phase (agent outputs available)
    if (!match.analysisResults || match.analysisResults.length === 0) {
      return json({ error: 'Analysis results not available yet. Complete ANALYSIS phase first.' }, { status: 400 });
    }

    // Check if emergency meeting already cached
    if (match.emergencyMeetingData) {
      return json({
        success: true,
        cached: true,
        emergencyMeeting: match.emergencyMeetingData,
      });
    }

    // Generate emergency meeting
    const emergencyMeeting = await generateEmergencyMeeting(
      matchId,
      match.analysisResults,
      match.pair ?? 'BTC/USDT',
    );

    // Store in match
    await storeEmergencyMeetingData(matchId, emergencyMeeting);

    return json({
      success: true,
      cached: false,
      emergencyMeeting,
    });
  } catch (err: any) {
    console.error('[arena/match/emergency-meeting/post]', err);
    return json({ error: 'Failed to generate emergency meeting' }, { status: 500 });
  }
};
