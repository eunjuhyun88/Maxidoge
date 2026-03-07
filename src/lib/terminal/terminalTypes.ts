// ═══════════════════════════════════════════════════════════════
//  STOCKCLAW — Terminal Shared Types & Interfaces
//  Canonical terminal type surface for route, layouts, and lib modules
// ═══════════════════════════════════════════════════════════════

import type { ScanHighlight } from '$lib/terminal/intel/intelTypes';
import type { SignalAttachment } from '$lib/stores/communityStore';
import type { ChatTradeDirection, PatternScanScope, PatternScanReport } from './terminalHelpers';

export type { ScanHighlight, ChatTradeDirection };

export type MobileTab = 'warroom' | 'chart' | 'intel';
export type TerminalDensityMode = 'essential' | 'pro';

export type MobileChatSheetState = 'closed' | 'peek' | 'half' | 'full';

export type DragTarget = 'left' | 'right' | null;
export type TerminalPanelResizeTarget = 'left' | 'right' | 'center';

export interface WarRoomHandle {
  triggerScanFromChart?: () => void;
}

export interface ChartPanelHandle {
  activateTradeDrawing?: (dir?: 'LONG' | 'SHORT') => Promise<void> | void;
  runPatternScanFromIntel?: (options?: { scope?: PatternScanScope; focus?: boolean }) => Promise<PatternScanReport>;
}

export type TerminalChatConnectionStatus = 'connected' | 'degraded' | 'disconnected';

export interface ChatMsg {
  from: string;
  icon: string;
  color: string;
  text: string;
  time: string;
  isUser: boolean;
  isSystem?: boolean;
}

export interface TerminalTradeSignal {
  vote: string;
  conf: number;
  entry: number;
  tp: number;
  sl: number;
  name: string;
  pair: string;
}

export interface ScanIntelDetail {
  pair: string;
  timeframe: string;
  token: string;
  createdAt: number;
  label: string;
  consensus: 'long' | 'short' | 'neutral';
  avgConfidence: number;
  summary: string;
  highlights: ScanHighlight[];
  signals: TerminalTradeSignal[];
}

export interface AgentTradeSetup {
  source: 'consensus' | 'agent';
  agentName?: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  rr: number;
  conf: number;
  pair: string;
}

export interface ChartCommunitySignal {
  pair: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  conf: number;
  source: string;
  reason: string;
  openCopyTrade: boolean;
}

export interface TerminalSharePrefill {
  text?: string;
  signal?: 'long' | 'short' | null;
  attachment?: SignalAttachment | null;
  /** Context hints — used when form opens without full prefill */
  contextPair?: string;
  contextPrice?: number;
  contextTimeframe?: string;
}

export interface TerminalControlBarProps {
  pair: string;
  timeframeLabel: string;
  directionLabel: string;
  directionClass: 'long' | 'short' | 'neutral' | 'scanning';
  confidenceLabel: string;
  primaryLabel: string;
  primaryHint: string;
  densityLabel: string;
  tradeReady: boolean;
  verdictAgree?: string;
  verdictTime?: string;
  onPrimaryAction: () => void;
  onToggleDensity: () => void;
}

export interface SharedChartPanelProps {
  advancedMode: boolean;
  enableTradeLineEntry: boolean;
  uiPreset: 'default' | 'tradingview';
  requireTradeConfirm: boolean;
  chatFirstMode: boolean;
  chatTradeReady: boolean;
  chatTradeDir: ChatTradeDirection;
  activeTradeSetup: AgentTradeSetup | null;
  hasScanned: boolean;
}

export interface SharedIntelPanelProps {
  densityMode: TerminalDensityMode;
  chatMessages: ChatMsg[];
  isTyping: boolean;
  chatTradeReady: boolean;
  chatFocusKey: number;
  chatConnectionStatus: TerminalChatConnectionStatus;
}
