import type { BattleTickState } from '$lib/engine/battleResolver';
import type { ArenaResolvedResultPayload } from '$lib/arena/result/arenaResultRuntime';
import type {
  ArenaView,
  GameState,
  Hypothesis,
  Position,
  SquadConfig,
  TournamentContext,
} from '$lib/stores/gameState';

import type { ArenaHypothesisSubmitInput } from './arenaPhaseController';

export interface AnalysisProjectionPatch {
  orpoOutput: GameState['orpoOutput'];
  ctxBeliefs: GameState['ctxBeliefs'];
  guardianCheck: GameState['guardianCheck'];
  commanderVerdict: GameState['commanderVerdict'];
}

interface CreateArenaGameStateBridgeOptions {
  updateGameState: (updater: (state: GameState) => GameState) => void;
  createLobbyTournamentSeed: () => TournamentContext;
}

type HypothesisLevels = Pick<Hypothesis, 'entry' | 'tp' | 'sl' | 'dir' | 'rr'>;

function buildPositionFromHypothesis(hypothesis: HypothesisLevels): Position {
  return {
    entry: hypothesis.entry,
    tp: hypothesis.tp,
    sl: hypothesis.sl,
    dir: hypothesis.dir,
    rr: hypothesis.rr,
    size: 0,
    lev: 0,
  };
}

function buildNeutralHypothesis(price: number): Hypothesis {
  return {
    dir: 'NEUTRAL',
    conf: 1,
    tags: new Set(),
    tf: '1h',
    vmode: 'tpsl',
    closeN: 3,
    entry: price,
    tp: price * 1.02,
    sl: price * 0.985,
    rr: 1.3,
  };
}

function buildSubmittedHypothesis(input: ArenaHypothesisSubmitInput): Hypothesis {
  return {
    dir: input.dir,
    conf: input.conf,
    tags: new Set(),
    tf: input.tf,
    vmode: input.vmode,
    closeN: input.closeN,
    entry: input.entry,
    tp: input.tp,
    sl: input.sl,
    rr: input.rr,
  };
}

export interface ArenaGameStateBridge {
  applyAnalysisProjection: (patch: AnalysisProjectionPatch) => void;
  applyBattleBootstrapState: (entryTime: number) => void;
  applyBattleTick: (tick: BattleTickState) => void;
  applyNeutralTimeoutSelection: (price: number) => Hypothesis;
  applyResolvedBattleState: (result: string, exitTime: number, exitPrice: number) => void;
  applyResolvedGameState: (resolved: ArenaResolvedResultPayload) => void;
  applySquadConfig: (config: SquadConfig) => void;
  applySubmittedHypothesis: (input: ArenaHypothesisSubmitInput) => Hypothesis;
  clearBattleResultAndStop: () => void;
  enterLobby: () => void;
  resetArenaView: () => void;
  setArenaView: (view: ArenaView) => void;
  setHypothesis: (next: Hypothesis) => void;
  stopRunning: () => void;
}

export function createArenaGameStateBridge(
  options: CreateArenaGameStateBridgeOptions
): ArenaGameStateBridge {
  function applySquadConfig(config: SquadConfig) {
    options.updateGameState((state) => ({ ...state, squadConfig: config }));
  }

  function stopRunning() {
    options.updateGameState((state) => ({ ...state, running: false }));
  }

  function enterLobby() {
    options.updateGameState((state) => ({
      ...state,
      inLobby: true,
      running: false,
      phase: 'DRAFT',
      timer: 0,
      tournament: options.createLobbyTournamentSeed(),
    }));
  }

  function setArenaView(view: ArenaView) {
    options.updateGameState((state) => ({ ...state, arenaView: view }));
  }

  function resetArenaView() {
    setArenaView('arena');
  }

  function applyResolvedGameState(resolved: ArenaResolvedResultPayload) {
    options.updateGameState((state) => ({
      ...state,
      matchN: resolved.nextMatchN,
      wins: resolved.win ? state.wins + 1 : state.wins,
      losses: resolved.win ? state.losses : state.losses + 1,
      streak: resolved.nextStreak,
      lp: Math.max(0, state.lp + resolved.lpChange),
      fbScore: resolved.fbsResult,
      running: false,
      timer: 0,
    }));
  }

  function clearBattleResultAndStop() {
    options.updateGameState((state) => ({
      ...state,
      battleResult: null,
      running: false,
    }));
  }

  function applyBattleBootstrapState(entryTime: number) {
    options.updateGameState((state) => ({
      ...state,
      battleTick: null,
      battlePriceHistory: [],
      battleEntryTime: entryTime,
      battleExitTime: 0,
      battleExitPrice: 0,
    }));
  }

  function applyBattleTick(tick: BattleTickState) {
    options.updateGameState((state) => ({
      ...state,
      battleTick: tick,
      battlePriceHistory: tick.priceHistory,
    }));
  }

  function applyResolvedBattleState(result: string, exitTime: number, exitPrice: number) {
    options.updateGameState((state) => ({
      ...state,
      battleResult: result,
      battleExitTime: exitTime,
      battleExitPrice: exitPrice,
    }));
  }

  function setHypothesis(next: Hypothesis) {
    // Keep battle resolver input synced with chart-edited hypothesis levels.
    options.updateGameState((state) => ({
      ...state,
      hypothesis: next,
      pos: buildPositionFromHypothesis(next),
    }));
  }

  function applyAnalysisProjection(patch: AnalysisProjectionPatch) {
    options.updateGameState((state) => ({
      ...state,
      orpoOutput: patch.orpoOutput,
      ctxBeliefs: patch.ctxBeliefs,
      guardianCheck: patch.guardianCheck,
      commanderVerdict: patch.commanderVerdict,
    }));
  }

  function applyNeutralTimeoutSelection(price: number) {
    const nextHypothesis = buildNeutralHypothesis(price);
    options.updateGameState((state) => ({
      ...state,
      hypothesis: nextHypothesis,
      pos: buildPositionFromHypothesis(nextHypothesis),
    }));
    return nextHypothesis;
  }

  function applySubmittedHypothesis(input: ArenaHypothesisSubmitInput) {
    const nextHypothesis = buildSubmittedHypothesis(input);
    options.updateGameState((state) => ({
      ...state,
      hypothesis: nextHypothesis,
      pos: buildPositionFromHypothesis(nextHypothesis),
    }));
    return nextHypothesis;
  }

  return {
    applyAnalysisProjection,
    applyBattleBootstrapState,
    applyBattleTick,
    applyNeutralTimeoutSelection,
    applyResolvedBattleState,
    applyResolvedGameState,
    applySquadConfig,
    applySubmittedHypothesis,
    clearBattleResultAndStop,
    enterLobby,
    resetArenaView,
    setArenaView,
    setHypothesis,
    stopRunning,
  };
}
