import type {
  AgentTradeSetup,
  ChatTradeDirection,
  ScanIntelDetail,
  TerminalChatConnectionStatus,
} from './terminalTypes';
import { get, readonly, writable } from 'svelte/store';

export function createTerminalSessionRuntime() {
  const isTypingStore = writable(false);
  const latestScanStore = writable<ScanIntelDetail | null>(null);
  const terminalScanningStore = writable(false);
  const chatTradeReadyStore = writable(false);
  const chatSuggestedDirStore = writable<ChatTradeDirection>('LONG');
  const chatConnectionStatusStore = writable<TerminalChatConnectionStatus>('connected');
  const activeTradeSetupStore = writable<AgentTradeSetup | null>(null);

  function getIsTyping() {
    return get(isTypingStore);
  }

  function setIsTyping(typing: boolean) {
    isTypingStore.set(typing);
  }

  function getLatestScan() {
    return get(latestScanStore);
  }

  function setLatestScan(detail: ScanIntelDetail | null) {
    latestScanStore.set(detail);
  }

  function getTerminalScanning() {
    return get(terminalScanningStore);
  }

  function setTerminalScanning(scanning: boolean) {
    terminalScanningStore.set(scanning);
  }

  function getChatTradeReady() {
    return get(chatTradeReadyStore);
  }

  function setChatTradeReady(ready: boolean) {
    chatTradeReadyStore.set(ready);
  }

  function getChatSuggestedDir() {
    return get(chatSuggestedDirStore);
  }

  function setChatSuggestedDir(dir: ChatTradeDirection) {
    chatSuggestedDirStore.set(dir);
  }

  function getChatConnectionStatus() {
    return get(chatConnectionStatusStore);
  }

  function setChatConnectionStatus(status: TerminalChatConnectionStatus) {
    chatConnectionStatusStore.set(status);
  }

  function getActiveTradeSetup() {
    return get(activeTradeSetupStore);
  }

  function setActiveTradeSetup(setup: AgentTradeSetup | null) {
    activeTradeSetupStore.set(setup);
  }

  function hasLatestScan(): boolean {
    return !!getLatestScan();
  }

  return {
    activeTradeSetup: readonly(activeTradeSetupStore),
    chatConnectionStatus: readonly(chatConnectionStatusStore),
    chatSuggestedDir: readonly(chatSuggestedDirStore),
    chatTradeReady: readonly(chatTradeReadyStore),
    getActiveTradeSetup,
    getChatConnectionStatus,
    getChatSuggestedDir,
    getChatTradeReady,
    getIsTyping,
    getLatestScan,
    getTerminalScanning,
    hasLatestScan,
    isTyping: readonly(isTypingStore),
    latestScan: readonly(latestScanStore),
    setActiveTradeSetup,
    setChatConnectionStatus,
    setChatSuggestedDir,
    setChatTradeReady,
    setIsTyping,
    setLatestScan,
    setTerminalScanning,
    terminalScanning: readonly(terminalScanningStore),
  };
}
