import {
  ERROR_MESSAGES,
  classifyError,
  detectMentionedAgent,
  inferAgentFromIntent,
  inferSuggestedDirection,
  type ChatTradeDirection,
} from './terminalHelpers';
import type {
  AgentTradeSetup,
  ChatMsg,
  ScanIntelDetail,
  SharedChartPanelProps,
  SharedIntelPanelProps,
  TerminalControlBarProps,
} from './terminalTypes';

export interface TerminalDecisionState {
  directionLabel: string;
  directionClass: 'long' | 'short' | 'neutral' | 'scanning';
  confidenceLabel: string;
  primaryLabel: string;
  primaryHint: string;
  tradeReady: boolean;
}

export interface TerminalVerdictMeta {
  agree: string;
  time: string;
}

export interface BuildOfflineAgentReplyParams {
  userText: string;
  statusLabel: string;
  err?: unknown;
  pair: string;
  timeframe: string;
  latestScan: ScanIntelDetail | null;
}

export interface OfflineAgentReply {
  sender: string;
  text: string;
  tradeDir: ChatTradeDirection | null;
  connectionStatus: SharedIntelPanelProps['chatConnectionStatus'];
}

export function tickerSegmentClass(segment: string): string {
  if (segment.startsWith('FEAR_GREED:')) {
    const match = segment.match(/FEAR_GREED:\s*(\d+)/i);
    const value = match ? Number(match[1]) : null;
    if (value != null && value <= 25) return 'ticker-chip ticker-chip-fg fear';
    if (value != null && value >= 75) return 'ticker-chip ticker-chip-fg greed';
    return 'ticker-chip ticker-chip-fg neutral';
  }
  if (segment.startsWith('MCAP_24H:')) {
    return segment.includes('-') ? 'ticker-chip ticker-chip-neg' : 'ticker-chip ticker-chip-pos';
  }
  return 'ticker-chip';
}

export function deriveTerminalDecisionState(params: {
  terminalScanning: boolean;
  latestScan: ScanIntelDetail | null;
  chatTradeReady: boolean;
  chatSuggestedDir: ChatTradeDirection;
  scanStale?: boolean;
}): TerminalDecisionState {
  const { terminalScanning, latestScan, chatTradeReady, chatSuggestedDir, scanStale } = params;

  if (terminalScanning) {
    return {
      directionLabel: 'SCANNING',
      directionClass: 'scanning',
      confidenceLabel: '--',
      primaryLabel: 'RUN FIRST SCAN',
      primaryHint: 'Scan current pair to generate agent consensus',
      tradeReady: false,
    };
  }

  if (!latestScan) {
    return {
      directionLabel: 'UNSCANNED',
      directionClass: 'neutral',
      confidenceLabel: '--',
      primaryLabel: 'RUN FIRST SCAN',
      primaryHint: 'Scan current pair to generate agent consensus',
      tradeReady: false,
    };
  }

  if (scanStale) {
    return {
      directionLabel: latestScan.consensus.toUpperCase(),
      directionClass: latestScan.consensus,
      confidenceLabel: `${Math.round(latestScan.avgConfidence)}%`,
      primaryLabel: 'RESCAN',
      primaryHint: 'Scan result is stale — timeframe or pair changed since last scan',
      tradeReady: false,
    };
  }

  return {
    directionLabel: latestScan.consensus.toUpperCase(),
    directionClass: latestScan.consensus,
    confidenceLabel: `${Math.round(latestScan.avgConfidence)}%`,
    primaryLabel: chatTradeReady ? `TRADE ${chatSuggestedDir}` : 'OPEN CHAT PLAN',
    primaryHint: chatTradeReady
      ? 'Open chart planner with latest consensus direction'
      : 'Ask agents for trade-ready setup first',
    tradeReady: chatTradeReady,
  };
}

export function buildTerminalControlBarProps(params: {
  pair: string;
  timeframeLabel: string;
  densityLabel: string;
  decisionState: TerminalDecisionState;
  onPrimaryAction: () => void;
  onToggleDensity: () => void;
}): TerminalControlBarProps {
  const { pair, timeframeLabel, densityLabel, decisionState, onPrimaryAction, onToggleDensity } = params;
  return {
    pair,
    timeframeLabel,
    directionLabel: decisionState.directionLabel,
    directionClass: decisionState.directionClass,
    confidenceLabel: decisionState.confidenceLabel,
    primaryLabel: decisionState.primaryLabel,
    primaryHint: decisionState.primaryHint,
    densityLabel,
    tradeReady: decisionState.tradeReady,
    onPrimaryAction,
    onToggleDensity,
  };
}

export function buildTerminalVerdictMeta(latestScan: ScanIntelDetail | null): TerminalVerdictMeta {
  if (!latestScan) {
    return {
      agree: '',
      time: '',
    };
  }

  const agree = latestScan.highlights
    ? `${latestScan.highlights.filter((highlight) => highlight.vote === latestScan.consensus).length}/${latestScan.highlights.length}`
    : '';

  if (!latestScan.createdAt) {
    return {
      agree,
      time: '',
    };
  }

  const sec = Math.floor((Date.now() - latestScan.createdAt) / 1000);
  const time = sec < 60
    ? 'just now'
    : sec < 3600
      ? `${Math.floor(sec / 60)}m ago`
      : `${Math.floor(sec / 3600)}h ago`;

  return {
    agree,
    time,
  };
}

export function buildSharedChartPanelProps(params: {
  chatTradeReady: boolean;
  chatSuggestedDir: ChatTradeDirection;
  activeTradeSetup: AgentTradeSetup | null;
  latestScan: ScanIntelDetail | null;
}): SharedChartPanelProps {
  const { chatTradeReady, chatSuggestedDir, activeTradeSetup, latestScan } = params;
  return {
    advancedMode: true,
    enableTradeLineEntry: true,
    uiPreset: 'tradingview',
    requireTradeConfirm: true,
    chatFirstMode: true,
    chatTradeReady,
    chatTradeDir: chatSuggestedDir,
    activeTradeSetup,
    hasScanned: !!latestScan,
  };
}

export function buildSharedIntelPanelProps(params: {
  densityMode: SharedIntelPanelProps['densityMode'];
  chatMessages: ChatMsg[];
  isTyping: boolean;
  chatTradeReady: boolean;
  chatFocusKey: number;
  chatConnectionStatus: SharedIntelPanelProps['chatConnectionStatus'];
}): SharedIntelPanelProps {
  return { ...params };
}

export function buildOfflineAgentReply(params: BuildOfflineAgentReplyParams): OfflineAgentReply {
  const { userText, statusLabel, err, pair, timeframe, latestScan } = params;
  const sender = detectMentionedAgent(userText) || inferAgentFromIntent(userText);
  const errorKind = classifyError(statusLabel, err);
  const connectionStatus = errorKind === 'network' || errorKind === 'llm_unavailable'
    ? 'disconnected'
    : 'degraded';
  const scanSummary = latestScan
    ? `최근 스캔: ${latestScan.pair} ${latestScan.timeframe.toUpperCase()} ${String(latestScan.consensus).toUpperCase()} ${Math.round(latestScan.avgConfidence)}%`
    : '';
  const tradeDirFromQuestion = inferSuggestedDirection(userText);
  const tradeDirFromScan = latestScan?.consensus === 'long'
    ? 'LONG'
    : latestScan?.consensus === 'short'
      ? 'SHORT'
      : null;
  const tradeDir = tradeDirFromQuestion || tradeDirFromScan;
  const tradeHint = tradeDir
    ? `\n💡 ${tradeDir} 관점 참고. START ${tradeDir}로 드래그 진입 가능.`
    : '';

  return {
    sender,
    tradeDir,
    connectionStatus,
    text:
      `⚠️ ${ERROR_MESSAGES[errorKind]}\n` +
      `${pair} ${timeframe.toUpperCase()} 기준 로컬 폴백 응답입니다.` +
      (scanSummary ? `\n${scanSummary}` : '') +
      tradeHint,
  };
}
