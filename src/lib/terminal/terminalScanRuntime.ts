import {
  buildAgentTradeSetup,
  buildConsensusTradeSetup,
  buildScanCompletionMessages,
  formatTerminalClock,
} from './terminalEventMappers';
import type {
  AgentTradeSetup,
  ChatMsg,
  ChatTradeDirection,
  ScanIntelDetail,
  TerminalTradeSignal,
} from './terminalTypes';

type ScanCompletePayload = ScanIntelDetail | CustomEvent<ScanIntelDetail>;
type ShowOnChartPayload = { signal: TerminalTradeSignal } | CustomEvent<{ signal: TerminalTradeSignal }>;

export function createTerminalScanRuntime(params: {
  setTerminalScanning: (scanning: boolean) => void;
  setLatestScan: (detail: ScanIntelDetail | null) => void;
  setActiveTradeSetup: (setup: AgentTradeSetup | null) => void;
  setChatSuggestedDir: (dir: ChatTradeDirection) => void;
  setChatTradeReady: (ready: boolean) => void;
  appendChatMessages: (messages: ChatMsg[]) => void;
}) {
  function handleScanStart() {
    params.setTerminalScanning(true);
  }

  function handleScanComplete(payload: ScanCompletePayload) {
    params.setTerminalScanning(false);
    const detail = 'detail' in payload ? payload.detail : payload;
    params.setLatestScan(detail);
    params.appendChatMessages(buildScanCompletionMessages(detail, formatTerminalClock()));
    params.setActiveTradeSetup(buildConsensusTradeSetup(detail));

    if (detail.consensus === 'long' || detail.consensus === 'short') {
      params.setChatSuggestedDir(detail.consensus === 'long' ? 'LONG' : 'SHORT');
      params.setChatTradeReady(true);
    }
  }

  function handleShowOnChart(payload: ShowOnChartPayload) {
    const signal = 'detail' in payload ? payload.detail.signal : payload.signal;
    params.setActiveTradeSetup(buildAgentTradeSetup(signal));
  }

  function clearActiveTradeSetup() {
    params.setActiveTradeSetup(null);
  }

  return {
    clearActiveTradeSetup,
    handleScanComplete,
    handleScanStart,
    handleShowOnChart,
  };
}
