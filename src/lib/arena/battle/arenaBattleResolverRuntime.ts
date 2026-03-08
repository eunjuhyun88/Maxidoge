import type { BattleTickState } from '$lib/engine/battleResolver';

interface ArenaBattleResolverReactionAgent {
  id: string;
}

export interface ArenaBattleResolvedFeed {
  icon: string;
  name: string;
  color: string;
  text: string;
}

interface ApplyArenaBattleResolverEffectsOptions<TAgent extends ArenaBattleResolverReactionAgent> {
  tick: BattleTickState;
  activeAgents: ReadonlyArray<TAgent>;
  setAgentState: (agentId: string, state: string) => void;
  setSpeech: (agentId: string, text: string, duration: number) => void;
  setVsMeter: (value: number) => void;
  setVsMeterTarget: (value: number) => void;
  setEnemyHP: (value: number) => void;
}

export function applyArenaBattleResolverEffects<TAgent extends ArenaBattleResolverReactionAgent>(
  options: ApplyArenaBattleResolverEffectsOptions<TAgent>,
) {
  const { tick, activeAgents } = options;

  if (tick.pnlPercent > 0) {
    const topAgent = activeAgents[Math.floor(Math.random() * activeAgents.length)];
    if (topAgent && tick.distToTP > 50 && Math.random() < 0.15) {
      options.setAgentState(topAgent.id, 'jump');
      options.setSpeech(topAgent.id, tick.distToTP > 80 ? 'Almost there!' : 'Looking good!', 300);
    }
  } else if (tick.pnlPercent < -0.3) {
    const worriedAgent = activeAgents[Math.floor(Math.random() * activeAgents.length)];
    if (worriedAgent && tick.distToSL > 50 && Math.random() < 0.1) {
      options.setAgentState(worriedAgent.id, 'sad');
      options.setSpeech(worriedAgent.id, tick.distToSL > 80 ? 'Danger zone!' : 'Hold steady...', 300);
    }
  }

  const tpWeight = tick.distToTP;
  const slWeight = tick.distToSL;
  const total = tpWeight + slWeight;
  if (total > 0) {
    const nextVsMeter = 50 + ((tpWeight - slWeight) / total) * 45;
    options.setVsMeter(nextVsMeter);
    options.setVsMeterTarget(nextVsMeter);
  }

  options.setEnemyHP(Math.max(0, 100 - tick.distToTP));
}

export function resolveArenaBattleOutcome(tick: BattleTickState): {
  result: string;
  feed: ArenaBattleResolvedFeed;
} | null {
  if (tick.status === 'running' || !tick.result) {
    return null;
  }

  const result = tick.result === 'timeout_win'
    ? 'time_win'
    : tick.result === 'timeout_loss'
      ? 'time_loss'
      : tick.result;
  const exitLabel = `$${Math.round(tick.exitPrice || 0).toLocaleString()}`;

  return {
    result,
    feed: {
      icon: result === 'tp' ? '🎯' : result === 'sl' ? '🛑' : '⏱',
      name: 'RESULT',
      color: result === 'tp' || result === 'time_win' ? '#00ff88' : '#ff5e7a',
      text: result === 'tp'
        ? `TP HIT at ${exitLabel}`
        : result === 'sl'
          ? `SL HIT at ${exitLabel}`
          : `Time expired at ${exitLabel}`,
    },
  };
}
