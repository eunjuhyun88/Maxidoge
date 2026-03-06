// ═══════════════════════════════════════════════════════════════
//  STOCKCLAW — Terminal Page Types & Interfaces
//  Extracted from terminal/+page.svelte for maintainability
// ═══════════════════════════════════════════════════════════════

import type { ScanHighlight } from '../../components/terminal/intelTypes';
import type { ChatTradeDirection, PatternScanScope, PatternScanReport } from '../../components/terminal/terminalHelpers';

// Re-export for convenience
export type { ScanHighlight, ChatTradeDirection };

// ─── Layout Types ────────────────────────────────────────────

export type MobileTab = 'warroom' | 'chart' | 'intel';

export type DragTarget = 'left' | 'right' | null;

export type TabletSplitResizeAxis = 'x' | 'y';

export interface TabletSplitResizeState {
  axis: TabletSplitResizeAxis;
  pointerId: number;
  startClient: number;
  startValue: number;
}

// ─── Component Handle Types ─────────────────────────────────

export interface WarRoomHandle {
  triggerScanFromChart?: () => void;
}

export interface ChartPanelHandle {
  activateTradeDrawing?: (dir?: 'LONG' | 'SHORT') => Promise<void> | void;
  runPatternScanFromIntel?: (options?: { scope?: PatternScanScope; focus?: boolean }) => Promise<PatternScanReport>;
}

// ─── Chat Types ──────────────────────────────────────────────

export interface ChatMsg {
  from: string;
  icon: string;
  color: string;
  text: string;
  time: string;
  isUser: boolean;
  isSystem?: boolean;
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
  signals: Array<{ vote: string; conf: number; entry: number; tp: number; sl: number; name: string; pair: string }>;
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

// ─── Shared Props Types ─────────────────────────────────────

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
  densityMode: 'essential' | 'pro';
  chatMessages: ChatMsg[];
  isTyping: boolean;
  chatTradeReady: boolean;
  chatFocusKey: number;
  chatConnectionStatus: 'connected' | 'degraded' | 'disconnected';
}
