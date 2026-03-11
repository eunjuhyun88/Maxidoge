import type { AnalyzeResponse } from '$lib/api/arenaApi';
import { buildArenaRewardState, type ArenaRewardState } from '$lib/arena/reward/arenaRewardRuntime';
import type { ArenaResultState } from '$lib/arena/state/arenaTypes';
import {
  calculateLP,
  computeFBS,
  determineActualDirection,
  determineConsensus,
} from '$lib/engine/scoring';
import type { FBScore, GuardianViolation, OrpoOutput } from '$lib/engine/types';
import type { MatchRecord } from '$lib/stores/matchHistoryStore';
import type { Direction, Hypothesis } from '$lib/stores/gameState';

interface ArenaResultAgentInput {
  id: string;
  name: string;
  icon: string;
  color: string;
  dir: string;
  conf: number;
}

interface BuildArenaResolvedResultOptions<TAgent extends ArenaResultAgentInput> {
  battleResult: string | null;
  currentPrice: number;
  basePrice: number;
  score: number;
  fallbackOpponentScore: number;
  matchN: number;
  streak: number;
  selectedAgents: string[];
  activeAgents: ReadonlyArray<TAgent>;
  hypothesis: Hypothesis | null;
  orpoOutput: OrpoOutput | null;
  guardianViolations: GuardianViolation[];
  serverAnalysis: AnalyzeResponse | null;
  pickWinMotto: () => string;
  pickLoseMotto: () => string;
}

export interface ArenaResolvedResultPayload {
  win: boolean;
  resultTag: string;
  lpChange: number;
  consensus: {
    type: 'consensus' | 'partial' | 'dissent' | 'override';
    lpMult: number;
    badge: string;
  };
  fbsResult: FBScore;
  nextMatchN: number;
  nextStreak: number;
  resultData: ArenaResultState;
  rewardState: ArenaRewardState;
  localHistoryEntry: {
    n: number;
    win: boolean;
    lp: number;
    score: number;
    streak: number;
  };
  matchRecord: Omit<MatchRecord, 'id' | 'timestamp'>;
  pnlSummary: string;
  resultFeed: {
    icon: string;
    name: string;
    color: string;
    text: string;
  };
}

export function buildArenaResolvedResult<TAgent extends ArenaResultAgentInput>(
  options: BuildArenaResolvedResultOptions<TAgent>,
): ArenaResolvedResultPayload {
  const battleResult = options.battleResult;
  const opponentScore = options.fallbackOpponentScore;
  let win = false;
  let resultTag = '';
  if (battleResult === 'tp') {
    win = true;
    resultTag = 'TP HIT! ✅';
  } else if (battleResult === 'sl') {
    win = false;
    resultTag = 'SL HIT ❌';
  } else if (battleResult === 'close_win' || battleResult === 'time_win') {
    win = true;
    resultTag = 'Profit ✅';
  } else if (battleResult === 'close_loss' || battleResult === 'time_loss') {
    win = false;
    resultTag = 'Loss ❌';
  } else {
    win = options.score > opponentScore;
    resultTag = 'Score';
  }

  const consensus = determineConsensus(
    options.hypothesis?.dir || 'LONG',
    options.activeAgents.map((agent) => agent.dir),
    false,
  );
  const lpChange = calculateLP(win, options.streak, consensus.lpMult);

  const entryPrice = options.hypothesis?.entry || options.basePrice;
  const priceChange = entryPrice > 0 ? (options.currentPrice - entryPrice) / entryPrice : 0;
  const actualDir = determineActualDirection(priceChange);

  const fbsResult = computeFBS({
    userDir: (options.hypothesis?.dir as Direction) || 'NEUTRAL',
    userConfidence: options.hypothesis?.conf || 50,
    userEntry: entryPrice,
    userTP: options.hypothesis?.tp || entryPrice * 1.02,
    userSL: options.hypothesis?.sl || entryPrice * 0.985,
    userRR: options.hypothesis?.rr || 1.5,
    orpoDir: (options.orpoOutput?.direction || 'NEUTRAL') as Direction,
    orpoKeyLevels: options.orpoOutput?.keyLevels,
    guardianViolations: options.guardianViolations,
    userOverrodeGuardian: false,
    actualDir,
    exitPrice: options.currentPrice,
    optimalEntry: options.serverAnalysis?.entryPrice,
  });

  const nextMatchN = options.matchN + 1;
  const nextStreak = win ? options.streak + 1 : 0;
  const rewardState = buildArenaRewardState({
    win,
    score: options.score,
    streak: nextStreak,
    consensusType: consensus.type,
    lpMult: consensus.lpMult,
  });

  const resultData: ArenaResultState = {
    win,
    lp: lpChange,
    tag: resultTag,
    motto: win ? options.pickWinMotto() : options.pickLoseMotto(),
    opponentScore,
  };

  return {
    win,
    resultTag,
    lpChange,
    consensus,
    fbsResult,
    nextMatchN,
    nextStreak,
    resultData,
    rewardState,
    localHistoryEntry: {
      n: nextMatchN,
      win,
      lp: lpChange,
      score: options.score,
      streak: nextStreak,
    },
    matchRecord: {
      matchN: nextMatchN,
      win,
      lp: lpChange,
      score: options.score,
      streak: nextStreak,
      agents: options.selectedAgents,
      agentVotes: options.activeAgents.map((agent) => ({
        agentId: agent.id,
        name: agent.name,
        icon: agent.icon,
        color: agent.color,
        dir: agent.dir,
        conf: agent.conf,
      })),
      hypothesis: options.hypothesis
        ? {
            dir: options.hypothesis.dir,
            conf: options.hypothesis.conf,
            tf: options.hypothesis.tf,
            entry: options.hypothesis.entry,
            tp: options.hypothesis.tp,
            sl: options.hypothesis.sl,
            rr: options.hypothesis.rr,
          }
        : null,
      battleResult,
      consensusType: consensus.type,
      lpMult: consensus.lpMult,
      signals: options.activeAgents.map((agent) => `${agent.name}: ${agent.dir} ${agent.conf}%`),
    },
    pnlSummary: `${win ? 'WIN' : 'LOSS'} · M${nextMatchN} · ${options.hypothesis?.dir || 'NEUTRAL'} · ${consensus.type}`,
    resultFeed: {
      icon: win ? '🏆' : '💀',
      name: 'RESULT',
      color: win ? '#00CC88' : '#FF5E7A',
      text: win ? `WIN! +${lpChange} LP [${resultTag}]` : `LOSE [${resultTag}] ${lpChange} LP`,
    },
  };
}

interface ApplyArenaResultPersistenceOptions<TAgent extends ArenaResultAgentInput> {
  resolved: ArenaResolvedResultPayload;
  activeAgents: ReadonlyArray<TAgent>;
  recordWalletMatch: (win: boolean, lpChange: number) => void;
  recordAgentMatch: (
    agentId: string,
    payload: { matchN: number; dir: string; conf: number; win: boolean; lp: number },
  ) => void;
  addMatchRecord: (record: Omit<MatchRecord, 'id' | 'timestamp'>) => string;
  addPnLEntry: (source: 'arena' | 'predict', refId: string, delta: number, summary: string) => void;
  resolveServerMatch?: () => Promise<unknown>;
  onResolveError?: (error: unknown) => void;
}

export function applyArenaResultPersistence<TAgent extends ArenaResultAgentInput>(
  options: ApplyArenaResultPersistenceOptions<TAgent>,
) {
  const { resolved } = options;

  options.recordWalletMatch(resolved.win, resolved.lpChange);
  options.activeAgents.forEach((agent) => {
    options.recordAgentMatch(agent.id, {
      matchN: resolved.nextMatchN,
      dir: agent.dir,
      conf: agent.conf,
      win: resolved.win,
      lp: resolved.lpChange,
    });
  });

  options.addMatchRecord(resolved.matchRecord);
  options.addPnLEntry(
    'arena',
    `match-${resolved.nextMatchN}`,
    resolved.lpChange,
    resolved.pnlSummary,
  );

  if (options.resolveServerMatch) {
    void options.resolveServerMatch().catch((error) => {
      options.onResolveError?.(error);
    });
  }
}
