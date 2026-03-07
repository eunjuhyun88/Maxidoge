import type {
  AgentTradeSetup,
  ChatTradeDirection,
  ScanIntelDetail,
  TerminalChatConnectionStatus,
} from './terminalTypes';

export function createTerminalSessionRuntime(params: {
  getIsTyping: () => boolean;
  setIsTyping: (typing: boolean) => void;
  getLatestScan: () => ScanIntelDetail | null;
  setLatestScan: (detail: ScanIntelDetail | null) => void;
  getTerminalScanning: () => boolean;
  setTerminalScanning: (scanning: boolean) => void;
  getChatTradeReady: () => boolean;
  setChatTradeReady: (ready: boolean) => void;
  getChatSuggestedDir: () => ChatTradeDirection;
  setChatSuggestedDir: (dir: ChatTradeDirection) => void;
  getChatConnectionStatus: () => TerminalChatConnectionStatus;
  setChatConnectionStatus: (status: TerminalChatConnectionStatus) => void;
  getActiveTradeSetup: () => AgentTradeSetup | null;
  setActiveTradeSetup: (setup: AgentTradeSetup | null) => void;
}) {
  function hasLatestScan(): boolean {
    return !!params.getLatestScan();
  }

  return {
    getActiveTradeSetup: params.getActiveTradeSetup,
    getChatConnectionStatus: params.getChatConnectionStatus,
    getChatSuggestedDir: params.getChatSuggestedDir,
    getChatTradeReady: params.getChatTradeReady,
    getIsTyping: params.getIsTyping,
    getLatestScan: params.getLatestScan,
    getTerminalScanning: params.getTerminalScanning,
    hasLatestScan,
    setActiveTradeSetup: params.setActiveTradeSetup,
    setChatConnectionStatus: params.setChatConnectionStatus,
    setChatSuggestedDir: params.setChatSuggestedDir,
    setChatTradeReady: params.setChatTradeReady,
    setIsTyping: params.setIsTyping,
    setLatestScan: params.setLatestScan,
    setTerminalScanning: params.setTerminalScanning,
  };
}
