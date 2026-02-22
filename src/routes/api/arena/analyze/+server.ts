// MAXI⚡DOGE — Arena Analysis
// POST /api/arena/analyze — Run agent pipeline for a match

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { getMatch, storeAnalysisResults } from '$lib/server/arenaService';
import { runAgentPipeline } from '$lib/engine/agentPipeline';
import { collectMarketSnapshot } from '$lib/server/marketSnapshotService';
import { computeExitStrategy } from '$lib/engine/exitOptimizer';

export const POST: RequestHandler = async ({ cookies, request, fetch: eventFetch }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const matchId = typeof body.matchId === 'string' ? body.matchId.trim() : '';
    if (!matchId) return json({ error: 'matchId is required' }, { status: 400 });

    const match = await getMatch(user.id, matchId);
    if (!match) return json({ error: 'Match not found' }, { status: 404 });
    if (!match.userADraft) return json({ error: 'Draft not submitted yet' }, { status: 400 });

    // Collect market data
    const snapshot = await collectMarketSnapshot(eventFetch, {
      pair: match.pair,
      timeframe: match.timeframe,
      persist: false,
    });

    // Run agent pipeline
    const pipelineResult = await runAgentPipeline({
      draft: match.userADraft,
      marketContext: snapshot.context,
      userId: user.id,
      matchId,
    });

    const entryPrice = snapshot.context.klines[snapshot.context.klines.length - 1]?.close ?? 0;

    // Detect market regime from trend
    const closes = snapshot.context.klines.map(k => k.close);
    const regime = detectRegime(closes);

    // Compute exit strategy for each agent
    const exitRec = computeExitStrategy(
      pipelineResult.prediction.direction,
      pipelineResult.prediction.confidence,
      snapshot.context,
      pipelineResult.agentOutputs,
      regime,
    );

    // Store results
    await storeAnalysisResults(matchId, pipelineResult.agentOutputs, entryPrice, regime);

    return json({
      success: true,
      agentOutputs: pipelineResult.agentOutputs.map(a => ({
        agentId: a.agentId,
        specId: a.specId,
        direction: a.direction,
        confidence: a.confidence,
        thesis: a.thesis,
        bullScore: a.bullScore,
        bearScore: a.bearScore,
      })),
      prediction: pipelineResult.prediction,
      exitRecommendation: exitRec,
      entryPrice,
      regime,
      meta: pipelineResult.meta,
    });
  } catch (err: any) {
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/analyze/post]', err);
    return json({ error: 'Failed to run analysis' }, { status: 500 });
  }
};

// Simple regime detection from price closes
function detectRegime(closes: number[]): 'trending_up' | 'trending_down' | 'ranging' | 'volatile' {
  if (closes.length < 20) return 'ranging';

  const recent = closes.slice(-20);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const changePct = ((last - first) / first) * 100;

  // Volatility: stddev of returns
  const returns = [];
  for (let i = 1; i < recent.length; i++) {
    returns.push((recent[i] - recent[i - 1]) / recent[i - 1]);
  }
  const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
  const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length;
  const volatility = Math.sqrt(variance) * 100;

  if (volatility > 3) return 'volatile';
  if (changePct > 5) return 'trending_up';
  if (changePct < -5) return 'trending_down';
  return 'ranging';
}
