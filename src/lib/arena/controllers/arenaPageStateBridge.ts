import type { AnalyzeResponse } from '$lib/api/arenaApi';
import type { ArenaChartBridgeState } from '$lib/arena/adapters/arenaChartBridge';

interface CreateArenaPageStateBridgeOptions {
  getApiError: () => string | null;
  getChartBridge: () => ArenaChartBridgeState;
  getConfirmingExit: () => boolean;
  getHypothesisTimer: () => number;
  getMatchHistoryOpen: () => boolean;
  getPvpVisible: () => boolean;
  getResultVisible: () => boolean;
  getServerAnalysis: () => AnalyzeResponse | null;
  getServerMatchId: () => string | null;
  setApiError: (value: string | null) => void;
  setChartBridge: (value: ArenaChartBridgeState) => void;
  setConfirmingExit: (value: boolean) => void;
  setFloatDir: (value: 'LONG' | 'SHORT' | null) => void;
  setHypothesisTimer: (value: number) => void;
  setHypothesisVisible: (value: boolean) => void;
  setMatchHistoryOpen: (value: boolean) => void;
  setPreviewVisible: (value: boolean) => void;
  setPvpVisible: (value: boolean) => void;
  setResultVisible: (value: boolean) => void;
  setServerAnalysis: (value: AnalyzeResponse | null) => void;
  setServerMatchId: (value: string | null) => void;
}

export function createArenaPageStateBridge(options: CreateArenaPageStateBridgeOptions) {
  return {
    clearServerAnalysis: () => {
      options.setServerAnalysis(null);
    },
    getApiError: options.getApiError,
    getChartBridge: options.getChartBridge,
    getHypothesisTimer: options.getHypothesisTimer,
    getServerAnalysis: options.getServerAnalysis,
    getServerMatchId: options.getServerMatchId,
    isConfirmingExit: options.getConfirmingExit,
    isMatchHistoryOpen: options.getMatchHistoryOpen,
    isPvpVisible: options.getPvpVisible,
    isResultVisible: options.getResultVisible,
    setApiError: options.setApiError,
    setChartBridge: options.setChartBridge,
    setConfirmingExit: options.setConfirmingExit,
    setFloatDir: options.setFloatDir,
    setHypothesisTimer: options.setHypothesisTimer,
    setHypothesisVisible: options.setHypothesisVisible,
    setMatchHistoryOpen: options.setMatchHistoryOpen,
    setPreviewVisible: options.setPreviewVisible,
    setPvpVisible: options.setPvpVisible,
    setResultVisible: options.setResultVisible,
    setServerAnalysis: options.setServerAnalysis,
    setServerMatchId: options.setServerMatchId,
  };
}
