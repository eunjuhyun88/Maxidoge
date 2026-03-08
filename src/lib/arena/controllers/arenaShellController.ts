import type { ArenaChartBridgeState } from '$lib/arena/adapters/arenaChartBridge';
import type { ArenaView, Phase, TournamentContext } from '$lib/stores/gameState';

export const ARENA_VIEW_KEYS: Record<string, ArenaView> = {
  '1': 'chart',
  '2': 'arena',
  '3': 'mission',
  '4': 'card',
};

export function createArenaLobbyTournamentSeed(): TournamentContext {
  return {
    tournamentId: null,
    round: null,
    type: null,
    pair: null,
    entryFeeLp: null,
  };
}

interface CreateArenaShellControllerOptions {
  getPhase: () => Phase;
  isInLobby: () => boolean;
  isPvpVisible: () => boolean;
  isResultVisible: () => boolean;
  isConfirmingExit: () => boolean;
  isMatchHistoryOpen: () => boolean;
  setConfirmingExit: (value: boolean) => void;
  setMatchHistoryOpen: (value: boolean) => void;
  safeTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearArenaDynamics: () => void;
  clearBattleSession: () => void;
  getChartBridge: () => ArenaChartBridgeState;
  setChartBridge: (next: ArenaChartBridgeState) => void;
  setResultVisible: (value: boolean) => void;
  setPreviewVisible: (value: boolean) => void;
  setPvpVisible: (value: boolean) => void;
  setHypothesisVisible: (value: boolean) => void;
  setFloatDir: (value: 'LONG' | 'SHORT' | null) => void;
  clearServerSyncState: () => void;
  clearHypothesisInterval: () => void;
  setAgentsIdle: () => void;
  stopRunning: () => void;
  enterLobby: () => void;
  restartMatch: () => void;
  setArenaView: (view: ArenaView) => void;
}

export function createArenaShellController(options: CreateArenaShellControllerOptions) {
  function armExitConfirm() {
    options.setConfirmingExit(true);
    options.safeTimeout(() => {
      options.setConfirmingExit(false);
    }, 3000);
  }

  function initCooldown() {
    options.clearArenaDynamics();
    options.clearBattleSession();
    options.setResultVisible(false);
    options.setMatchHistoryOpen(false);
    options.setPreviewVisible(false);
    options.setChartBridge({
      ...options.getChartBridge(),
      position: {
        ...options.getChartBridge().position,
        visible: false,
      },
    });
    options.setAgentsIdle();
    options.stopRunning();
  }

  function goLobby() {
    initCooldown();
    options.clearServerSyncState();
    options.setPvpVisible(false);
    options.setHypothesisVisible(false);
    options.setConfirmingExit(false);
    options.setFloatDir(null);
    options.clearHypothesisInterval();
    options.enterLobby();
  }

  function playAgain() {
    initCooldown();
    options.clearServerSyncState();
    options.setPvpVisible(false);
    options.setHypothesisVisible(false);
    options.setConfirmingExit(false);
    options.setFloatDir(null);
    options.restartMatch();
  }

  function confirmGoLobby() {
    if (options.getPhase() === 'RESULT' || options.isPvpVisible() || options.getPhase() === 'DRAFT') {
      goLobby();
      return;
    }
    if (options.isConfirmingExit()) {
      goLobby();
      return;
    }
    armExitConfirm();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !options.isInLobby()) {
      event.preventDefault();
      if (options.getPhase() === 'RESULT' || options.isPvpVisible() || options.isResultVisible()) {
        goLobby();
        return;
      }
      if (options.isConfirmingExit()) {
        options.setConfirmingExit(false);
        return;
      }
      armExitConfirm();
      return;
    }

    if (
      !options.isInLobby() &&
      options.getPhase() !== 'DRAFT' &&
      ARENA_VIEW_KEYS[event.key] &&
      !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    ) {
      event.preventDefault();
      options.setArenaView(ARENA_VIEW_KEYS[event.key]);
    }
  }

  return {
    confirmGoLobby,
    closeMatchHistory: () => {
      options.setMatchHistoryOpen(false);
    },
    goLobby,
    handleKeydown,
    initCooldown,
    playAgain,
    selectArenaView: (view: ArenaView) => {
      options.setArenaView(view);
    },
    selectFloatDir: (value: 'LONG' | 'SHORT' | null) => {
      options.setFloatDir(value);
    },
    toggleMatchHistory: () => {
      options.setMatchHistoryOpen(!options.isMatchHistoryOpen());
    },
  };
}
