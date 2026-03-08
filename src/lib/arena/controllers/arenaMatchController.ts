import { createArenaMatch, submitArenaDraft } from '$lib/api/arenaApi';
import { normalizeAgentId } from '$lib/engine/agents';
import { type DraftSelection } from '$lib/engine/types';
import type { SquadConfig } from '$lib/stores/gameState';
import { formatTimeframeLabel } from '$lib/utils/timeframe';

interface ArenaMatchSnapshot {
  pair: string;
  selectedAgents: string[];
}

interface CreateArenaMatchControllerOptions {
  getCurrentState: () => ArenaMatchSnapshot;
  applySquadConfig: (config: SquadConfig) => void;
  clearFeed: () => void;
  pushSystemFeed: (text: string) => void;
  setServerMatchId: (matchId: string | null) => void;
  clearServerAnalysis: () => void;
  setApiError: (message: string | null) => void;
  startAnalysis: () => void;
}

export function createArenaMatchController(options: CreateArenaMatchControllerOptions) {
  async function deploySquad(config: SquadConfig) {
    options.applySquadConfig(config);
    options.clearFeed();
    options.pushSystemFeed(
      `Squad configured! Risk: ${config.riskLevel.toUpperCase()} · TF: ${formatTimeframeLabel(config.timeframe)} · Analysis starting...`,
    );

    options.setServerMatchId(null);
    options.clearServerAnalysis();
    options.setApiError(null);

    const currentState = options.getCurrentState();

    try {
      const matchRes = await createArenaMatch(currentState.pair, config.timeframe);
      options.setServerMatchId(matchRes.matchId);

      const agentCount = currentState.selectedAgents.length;
      if (agentCount <= 0) throw new Error('No agents selected for draft');

      const weight = Math.round(100 / agentCount);
      const draft: DraftSelection[] = currentState.selectedAgents.map((agentId, index) => ({
        agentId: normalizeAgentId(agentId),
        specId: 'base',
        weight: index === agentCount - 1 ? 100 - weight * (agentCount - 1) : weight,
      }));

      await submitArenaDraft(matchRes.matchId, draft);
    } catch (error) {
      console.warn('[Arena] Server sync failed (match continues locally):', error);
      options.setApiError(error instanceof Error ? error.message : 'Unknown arena sync error');
    }

    options.startAnalysis();
  }

  function clearServerSyncState() {
    options.setServerMatchId(null);
    options.clearServerAnalysis();
    options.setApiError(null);
  }

  return {
    clearServerSyncState,
    deploySquad,
  };
}
