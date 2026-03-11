import type { AnalyzeResponse } from '$lib/api/arenaApi';
import { sfx } from '$lib/audio/sfx';
import {
  buildArenaChartDecorations,
  buildArenaChartPositionFromHypothesis,
  createArenaChartBridgeState,
  type ArenaChartBridgeState,
} from '$lib/arena/adapters/arenaChartBridge';
import type { AnalysisProjectionPatch, ArenaGameStateBridge } from '$lib/arena/controllers/arenaGameStateBridge';
import {
  createArenaBattlePresentationRuntime,
  type ArenaBattleChatMessage,
} from '$lib/arena/battle/arenaBattlePresentationRuntime';
import type { BattleTickState } from '$lib/engine/battleResolver';
import type { BattleTurn, CharSpriteState } from '$lib/engine/arenaCharacters';
import { juice_flash, juice_shake } from '$lib/engine/arenaGameJuice';
import type { AgentDef } from '$lib/data/agents';
import type { Direction, GameState, Hypothesis, Position } from '$lib/stores/gameState';

import { createArenaAnalysisPresentationRuntime } from './arenaAnalysisPresentationRuntime';
import type { ArenaAgentUiState } from './arenaAgentRuntime';
import { createArenaBattleController } from './arenaBattleController';
import type { ArenaHypothesisSubmitInput } from './arenaPhaseController';
import { createArenaPhaseController } from './arenaPhaseController';
import { createArenaPhaseEffectsRuntime } from './arenaPhaseEffectsRuntime';

interface ArenaAgentRuntimeLike {
  appendChatMessage: (message: ArenaBattleChatMessage) => void;
  initAgentStates: () => void;
}

interface ArenaAgentBridgeLike {
  addChatMessage: (author: { id: string; name: string; icon: string; color: string }, text: string, isAction?: boolean) => void;
  addSystemChat: (icon: string, color: string, text: string, isAction?: boolean) => void;
  bindPresentationSync: (hooks: {
    syncAgentEnergy?: (agentId: string, energy: number) => void;
    syncAgentState?: (agentId: string, state: string) => void;
  }) => void;
  setAgentEnergy: (agentId: string, energy: number) => void;
  setAgentState: (agentId: string, state: string) => void;
  setSpeech: (agentId: string, text: string, duration?: number) => void;
  setVoteDir: (agentId: string, dir: string) => void;
}

interface ArenaBattleStateBridgeLike {
  getCharSprites: () => Record<string, CharSpriteState>;
  getEnemyHp: () => number;
  getVsMeterTarget: () => number;
  setBattleNarration: (value: string) => void;
  setBattlePhaseLabel: (value: string) => void;
  setBattleTurns: (value: BattleTurn[]) => void;
  setCharSprites: (value: Record<string, CharSpriteState>) => void;
  setComboCount: (value: number) => void;
  setCriticalText: (value: string) => void;
  setCurrentTurnIdx: (value: number) => void;
  setEnemyHp: (value: number) => void;
  setShowCombo: (value: boolean) => void;
  setShowCritical: (value: boolean) => void;
  setShowVsSplash: (value: boolean) => void;
  setVsMeter: (value: number) => void;
  setVsMeterTarget: (value: number) => void;
}

interface ArenaPageStateBridgeLike {
  getChartBridge: () => ArenaChartBridgeState;
  getHypothesisTimer: () => number;
  getServerMatchId: () => string | null;
  setChartBridge: (value: ArenaChartBridgeState) => void;
  setFloatDir: (value: 'LONG' | 'SHORT' | null) => void;
  setHypothesisTimer: (value: number) => void;
  setHypothesisVisible: (value: boolean) => void;
  setPreviewVisible: (value: boolean) => void;
  setPvpVisible: (value: boolean) => void;
  setResultVisible: (value: boolean) => void;
  setServerAnalysis: (value: AnalyzeResponse | null) => void;
}

type ArenaGameStateBridgeLike = Pick<
  ArenaGameStateBridge,
  | 'applyAnalysisProjection'
  | 'applyBattleBootstrapState'
  | 'applyBattleTick'
  | 'applyNeutralTimeoutSelection'
  | 'applyResolvedBattleState'
  | 'applySubmittedHypothesis'
  | 'clearBattleResultAndStop'
  | 'resetArenaView'
>;

interface ArenaPhaseTimerRuntimeLike {
  clearHypothesisInterval: () => void;
  clearPreviewAutoTimer: () => void;
  setHypothesisInterval: (interval: ReturnType<typeof setInterval> | null) => void;
  setPreviewAutoTimer: (timer: ReturnType<typeof setTimeout> | null) => void;
}

interface ArenaVisualEffectsRuntimeLike {
  emitDogeFloatBurst: () => void;
  seedArenaParticles: () => void;
}

interface CreateArenaPhaseRuntimeBundleOptions {
  getActiveAgents: () => AgentDef[];
  getAgentStates: () => Record<string, ArenaAgentUiState>;
  getCurrentPrice: () => number;
  getHypothesis: () => Hypothesis | null;
  getPosition: () => Position | null;
  getSpeed: () => number;
  isDestroyed: () => boolean;
  safeTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  addFeed: (icon: string, name: string, color: string, text: string, dir?: string | null) => void;
  advancePhase: () => void;
  clearArenaDynamics: () => void;
  liveEventStart: (phase: 'ANALYSIS' | 'HYPOTHESIS' | 'BATTLE') => void;
  onAnalysisError: (error: unknown) => void;
  onHypothesisSyncError: (error: unknown) => void;
  onResultEnter: () => void;
  runAnalysisSync?: (matchId: string) => Promise<AnalyzeResponse>;
  submitHypothesisSync?: (dir: 'LONG' | 'SHORT' | 'NEUTRAL', conf: number) => Promise<void>;
  mapAnalysisToProjection: (analysis: AnalyzeResponse) => AnalysisProjectionPatch;
  clearChatMessages: () => void;
  agentRuntime: ArenaAgentRuntimeLike;
  agentBridge: ArenaAgentBridgeLike;
  battleStateBridge: ArenaBattleStateBridgeLike;
  pageStateBridge: ArenaPageStateBridgeLike;
  gameStateBridge: ArenaGameStateBridgeLike;
  phaseTimerRuntime: ArenaPhaseTimerRuntimeLike;
  visualEffectsRuntime: ArenaVisualEffectsRuntimeLike;
}

export function createArenaPhaseRuntimeBundle(options: CreateArenaPhaseRuntimeBundleOptions) {
  const battlePresentationRuntime = createArenaBattlePresentationRuntime({
    getActiveAgents: options.getActiveAgents,
    getHypothesisDir: () => options.getHypothesis()?.dir,
    getCharSprites: options.battleStateBridge.getCharSprites,
    getVsMeterTarget: options.battleStateBridge.getVsMeterTarget,
    getEnemyHP: options.battleStateBridge.getEnemyHp,
    getAgentEnergy: (agentId) => options.getAgentStates()[agentId]?.energy || 0,
    setCharSprites: options.battleStateBridge.setCharSprites,
    setAgentState: options.agentBridge.setAgentState,
    setAgentEnergy: options.agentBridge.setAgentEnergy,
    setBattleTurns: options.battleStateBridge.setBattleTurns,
    setCurrentTurnIdx: options.battleStateBridge.setCurrentTurnIdx,
    clearChatMessages: options.clearChatMessages,
    appendChatMessage: options.agentRuntime.appendChatMessage,
    setBattleNarration: options.battleStateBridge.setBattleNarration,
    setBattlePhaseLabel: options.battleStateBridge.setBattlePhaseLabel,
    setVsMeter: options.battleStateBridge.setVsMeter,
    setVsMeterTarget: options.battleStateBridge.setVsMeterTarget,
    setEnemyHP: options.battleStateBridge.setEnemyHp,
    setComboCount: options.battleStateBridge.setComboCount,
    setShowCombo: options.battleStateBridge.setShowCombo,
    setShowCritical: options.battleStateBridge.setShowCritical,
    setCriticalText: options.battleStateBridge.setCriticalText,
    setShowVsSplash: options.battleStateBridge.setShowVsSplash,
    runChargeEffect: () => {
      sfx.charge();
    },
    runSplashEffect: () => {
      juice_shake('heavy');
      sfx.enter();
      options.visualEffectsRuntime.seedArenaParticles();
    },
    runImpactEffect: (variant) => {
      if (variant === 'critical') {
        juice_shake('heavy');
        juice_flash('gold');
        sfx.verdict();
        return;
      }
      if (variant === 'super') {
        juice_shake('medium');
        juice_flash('white');
        sfx.impact();
        return;
      }
      if (variant === 'weak') {
        sfx.step();
        return;
      }
      juice_shake('light');
      sfx.impact();
    },
    isDestroyed: options.isDestroyed,
  });
  options.agentBridge.bindPresentationSync({
    syncAgentState: battlePresentationRuntime.syncAgentState,
    syncAgentEnergy: battlePresentationRuntime.syncAgentEnergy,
  });

  const arenaAnalysisPresentationRuntime = createArenaAnalysisPresentationRuntime({
    getActiveAgents: options.getActiveAgents,
    getSpeed: options.getSpeed,
    safeTimeout: options.safeTimeout,
    addFeed: options.addFeed,
    setBattleNarration: options.battleStateBridge.setBattleNarration,
    addChatMessage: options.agentBridge.addChatMessage,
    setAgentState: options.agentBridge.setAgentState,
    setAgentEnergy: options.agentBridge.setAgentEnergy,
    setSpeech: options.agentBridge.setSpeech,
    setVoteDir: options.agentBridge.setVoteDir,
    showCharAction: battlePresentationRuntime.showCharAction,
    moveChar: battlePresentationRuntime.moveChar,
    applyScoutDecorations: () => {
      options.pageStateBridge.setChartBridge({
        ...options.pageStateBridge.getChartBridge(),
        ...buildArenaChartDecorations(options.getActiveAgents()),
      });
    },
    playScanSound: () => {
      sfx.scan();
    },
    playChargeSound: () => {
      sfx.charge();
    },
    playVoteSound: () => {
      sfx.vote();
    },
  });

  const arenaPhaseEffectsRuntime = createArenaPhaseEffectsRuntime({
    getActiveAgents: options.getActiveAgents,
    safeTimeout: options.safeTimeout,
    addFeed: (icon, name, color, text) => {
      options.addFeed(icon, name, color, text);
    },
    clearArenaDynamics: options.clearArenaDynamics,
    setResultVisible: options.pageStateBridge.setResultVisible,
    setPvpVisible: options.pageStateBridge.setPvpVisible,
    setHypothesisVisible: options.pageStateBridge.setHypothesisVisible,
    setPreviewVisible: options.pageStateBridge.setPreviewVisible,
    setFloatDir: options.pageStateBridge.setFloatDir,
    resetArenaView: options.gameStateBridge.resetArenaView,
    resetChartBridge: () => {
      options.pageStateBridge.setChartBridge(createArenaChartBridgeState());
    },
    initAgentStates: options.agentRuntime.initAgentStates,
    emitDogeFloatBurst: options.visualEffectsRuntime.emitDogeFloatBurst,
    liveEventStart: options.liveEventStart,
    initCharSprites: battlePresentationRuntime.initCharSprites,
    seedArenaParticles: options.visualEffectsRuntime.seedArenaParticles,
    runScoutSequence: arenaAnalysisPresentationRuntime.runScoutSequence,
    runGatherSequence: arenaAnalysisPresentationRuntime.runGatherSequence,
    runCouncilSequence: arenaAnalysisPresentationRuntime.runCouncilSequence,
    setBattleNarration: options.battleStateBridge.setBattleNarration,
    addSystemChat: options.agentBridge.addSystemChat,
    setAgentState: options.agentBridge.setAgentState,
    setSpeech: options.agentBridge.setSpeech,
    startBattleTurnSequence: battlePresentationRuntime.startBattleTurnSequence,
  });

  const battleController = createArenaBattleController({
    getSnapshot: () => ({
      activeAgents: options.getActiveAgents(),
      speed: options.getSpeed(),
      pos: options.getPosition(),
      hypothesis: options.getHypothesis(),
    }),
    isDestroyed: options.isDestroyed,
    onBattleEnter: arenaPhaseEffectsRuntime.runBattleEnter,
    onMissingPosition: () => {
      options.gameStateBridge.clearBattleResultAndStop();
      options.safeTimeout(() => {
        options.advancePhase();
      }, 3000);
    },
    applyBattleBootstrapState: () => {
      options.gameStateBridge.applyBattleBootstrapState(Date.now());
    },
    applyBattleTick: options.gameStateBridge.applyBattleTick,
    applyResolvedBattleState: options.gameStateBridge.applyResolvedBattleState,
    setAgentState: options.agentBridge.setAgentState,
    setSpeech: options.agentBridge.setSpeech,
    setVsMeter: options.battleStateBridge.setVsMeter,
    setVsMeterTarget: options.battleStateBridge.setVsMeterTarget,
    setEnemyHP: options.battleStateBridge.setEnemyHp,
    addFeed: (icon, name, color, text) => {
      options.addFeed(icon, name, color, text);
    },
    advancePhase: options.advancePhase,
    safeTimeout: options.safeTimeout,
  });

  const phaseController = createArenaPhaseController({
    onDraftEnter: arenaPhaseEffectsRuntime.runDraftEnter,
    getSpeed: options.getSpeed,
    getCurrentPrice: options.getCurrentPrice,
    getServerMatchId: options.pageStateBridge.getServerMatchId,
    runAnalysisSync: options.runAnalysisSync,
    setServerAnalysis: (analysis) => {
      options.pageStateBridge.setServerAnalysis(analysis);
    },
    applyAnalysisProjection: (analysis) => {
      options.gameStateBridge.applyAnalysisProjection(options.mapAnalysisToProjection(analysis));
    },
    onAnalysisEnter: arenaPhaseEffectsRuntime.runAnalysisEnter,
    onAnalysisError: options.onAnalysisError,
    onHypothesisEnter: arenaPhaseEffectsRuntime.runHypothesisEnter,
    setHypothesisVisible: options.pageStateBridge.setHypothesisVisible,
    setFloatDir: options.pageStateBridge.setFloatDir,
    getHypothesisTimer: options.pageStateBridge.getHypothesisTimer,
    setHypothesisTimer: options.pageStateBridge.setHypothesisTimer,
    clearHypothesisInterval: options.phaseTimerRuntime.clearHypothesisInterval,
    setHypothesisInterval: options.phaseTimerRuntime.setHypothesisInterval,
    applyNeutralTimeoutSelection: (price) => {
      const nextHypothesis = options.gameStateBridge.applyNeutralTimeoutSelection(price);
      options.pageStateBridge.setChartBridge({
        ...options.pageStateBridge.getChartBridge(),
        position: buildArenaChartPositionFromHypothesis(nextHypothesis),
      });
      options.addFeed('⏰', 'TIMEOUT', '#93A699', 'Time expired — auto-skip');
    },
    applySubmittedHypothesis: (hypothesis) => {
      const nextHypothesis = options.gameStateBridge.applySubmittedHypothesis(hypothesis);
      options.pageStateBridge.setChartBridge({
        ...options.pageStateBridge.getChartBridge(),
        position: buildArenaChartPositionFromHypothesis(nextHypothesis),
      });
      options.addFeed(
        '🐕',
        'YOU',
        '#E8967D',
        `${hypothesis.dir} · TP $${hypothesis.tp.toLocaleString()} · SL $${hypothesis.sl.toLocaleString()} · R:R 1:${hypothesis.rr}`,
        hypothesis.dir,
      );
      sfx.vote();
    },
    submitHypothesisSync: options.submitHypothesisSync,
    onHypothesisSyncError: options.onHypothesisSyncError,
    advancePhase: options.advancePhase,
    setPreviewVisible: options.pageStateBridge.setPreviewVisible,
    onPreviewEnter: () => {
      const hypothesis = options.getHypothesis();
      arenaPhaseEffectsRuntime.runPreviewEnter(
        `Position: ${hypothesis?.dir || 'NEUTRAL'} · Entry $${(hypothesis?.entry || 0).toLocaleString()} · R:R 1:${(hypothesis?.rr || 1).toFixed(1)}`,
      );
    },
    clearPreviewAutoTimer: options.phaseTimerRuntime.clearPreviewAutoTimer,
    setPreviewAutoTimer: options.phaseTimerRuntime.setPreviewAutoTimer,
    onPreviewConfirm: arenaPhaseEffectsRuntime.runPreviewConfirm,
    onBattleEnter: () => {
      battleController.initBattle();
    },
    onResultEnter: options.onResultEnter,
  });

  function clearBattleSession() {
    battleController.clearBattleSession();
    battlePresentationRuntime.clearTurnTimers();
  }

  function destroy() {
    battleController.destroy();
    battlePresentationRuntime.destroy();
  }

  return {
    battlePresentationRuntime,
    clearBattleSession,
    destroy,
    phaseController,
  };
}
