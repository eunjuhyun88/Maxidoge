import type { AnalyzeResponse } from '$lib/api/arenaApi';
import { runArenaResultPresentation } from '$lib/arena/battle/arenaResultPresentationRuntime';
import type { ArenaRewardState } from '$lib/arena/reward/arenaRewardRuntime';
import {
  applyArenaResultPersistence,
  buildArenaResolvedResult,
  type ArenaResolvedResultPayload,
} from '$lib/arena/result/arenaResultRuntime';
import type { ArenaResultState } from '$lib/arena/state/arenaTypes';
import type { CharState } from '$lib/engine/arenaCharacters';
import type { GuardianViolation, OrpoOutput } from '$lib/engine/types';
import type { MatchRecord } from '$lib/stores/matchHistoryStore';
import type { Hypothesis } from '$lib/stores/gameState';

interface ArenaResultAgentLike {
  id: string;
  name: string;
  icon: string;
  color: string;
  dir: string;
  conf: number;
}

interface ArenaResultSnapshot<TAgent extends ArenaResultAgentLike> {
  score: number;
  battleResult: string | null;
  currentPrice: number;
  basePrice: number;
  matchN: number;
  streak: number;
  selectedAgents: string[];
  activeAgents: ReadonlyArray<TAgent>;
  hypothesis: Hypothesis | null;
  orpoOutput: OrpoOutput | null;
  guardianViolations: GuardianViolation[];
  serverAnalysis: AnalyzeResponse | null;
  serverMatchId: string | null;
}

interface CreateArenaResultControllerOptions<TAgent extends ArenaResultAgentLike> {
  getSnapshot: () => ArenaResultSnapshot<TAgent>;
  getRewardState: () => ArenaRewardState;
  clearLiveEvents: () => void;
  clearBattleTurnTimers: () => void;
  applyResolvedGameState: (resolved: ArenaResolvedResultPayload) => void;
  setResultData: (resultData: ArenaResultState) => void;
  setRewardState: (rewardState: ArenaRewardState) => void;
  setResultVisible: (value: boolean) => void;
  revealPvpResult: () => void;
  addFeed: (icon: string, name: string, color: string, text: string) => void;
  recordWalletMatch: (win: boolean, lpChange: number) => void;
  recordAgentMatch: (
    agentId: string,
    payload: { matchN: number; dir: string; conf: number; win: boolean; lp: number },
  ) => void;
  addMatchRecord: (record: Omit<MatchRecord, 'id' | 'timestamp'>) => string;
  addPnLEntry: (source: 'arena' | 'predict', refId: string, delta: number, summary: string) => void;
  resolveServerMatch: (matchId: string, currentPrice: number) => Promise<unknown>;
  onResolveError: (error: unknown) => void;
  onWinEffects: () => void;
  onLoseEffects: () => void;
  setBattleNarration: (text: string) => void;
  addSystemChat: (icon: string, color: string, text: string) => void;
  setAgentState: (agentId: string, state: string) => void;
  setCharState: (agentId: string, state: CharState) => void;
  showCharAction: (agentId: string, emoji: string, label: string) => void;
  setSpeech: (agentId: string, text: string, duration: number) => void;
  pickOpponentScore: () => number;
  pickWinMotto: () => string;
  pickLoseMotto: () => string;
  pickWinSpeech: () => string;
  pickLoseSpeech: () => string;
}

export function createArenaResultController<TAgent extends ArenaResultAgentLike>(
  options: CreateArenaResultControllerOptions<TAgent>,
) {
  function initResult() {
    options.clearLiveEvents();
    options.clearBattleTurnTimers();

    const snapshot = options.getSnapshot();
    const resolvedResult = buildArenaResolvedResult({
      battleResult: snapshot.battleResult,
      currentPrice: snapshot.currentPrice,
      basePrice: snapshot.basePrice,
      score: snapshot.score,
      fallbackOpponentScore: options.pickOpponentScore(),
      matchN: snapshot.matchN,
      streak: snapshot.streak,
      selectedAgents: snapshot.selectedAgents,
      activeAgents: snapshot.activeAgents,
      hypothesis: snapshot.hypothesis,
      orpoOutput: snapshot.orpoOutput,
      guardianViolations: snapshot.guardianViolations,
      serverAnalysis: snapshot.serverAnalysis,
      pickWinMotto: options.pickWinMotto,
      pickLoseMotto: options.pickLoseMotto,
    });

    options.applyResolvedGameState(resolvedResult);

    applyArenaResultPersistence({
      resolved: resolvedResult,
      activeAgents: snapshot.activeAgents,
      recordWalletMatch: options.recordWalletMatch,
      recordAgentMatch: options.recordAgentMatch,
      addMatchRecord: options.addMatchRecord,
      addPnLEntry: options.addPnLEntry,
      resolveServerMatch: snapshot.serverMatchId
        ? () => options.resolveServerMatch(snapshot.serverMatchId!, snapshot.currentPrice)
        : undefined,
      onResolveError: options.onResolveError,
    });

    options.setResultData(resolvedResult.resultData);
    options.setRewardState(resolvedResult.rewardState);
    options.setResultVisible(true);

    runArenaResultPresentation({
      win: resolvedResult.win,
      lpChange: resolvedResult.lpChange,
      resultTag: resolvedResult.resultTag,
      battleResult: snapshot.battleResult,
      currentPrice: snapshot.currentPrice,
      hypothesisTp: snapshot.hypothesis?.tp || null,
      activeAgents: snapshot.activeAgents,
      onWinEffects: options.onWinEffects,
      onLoseEffects: options.onLoseEffects,
      setBattleNarration: options.setBattleNarration,
      addSystemChat: options.addSystemChat,
      setAgentState: options.setAgentState,
      setCharState: options.setCharState,
      showCharAction: options.showCharAction,
      setSpeech: options.setSpeech,
      pickWinSpeech: options.pickWinSpeech,
      pickLoseSpeech: options.pickLoseSpeech,
    });

    options.addFeed(
      resolvedResult.resultFeed.icon,
      resolvedResult.resultFeed.name,
      resolvedResult.resultFeed.color,
      resolvedResult.resultFeed.text,
    );
    options.revealPvpResult();
  }

  return {
    closeReward: () => {
      options.setRewardState({
        ...options.getRewardState(),
        visible: false,
      });
    },
    initResult,
  };
}
