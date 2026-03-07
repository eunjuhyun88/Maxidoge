import type { SignalEvidence } from '$lib/terminal/signalEvidence';
import type { PatternScanReport, PatternScanScope } from './chartTypes';

export interface ChartPanelScanRequestDetail {
  source: string;
  pair: string;
  timeframe: string;
}

export interface ChartPanelChatRequestDetail {
  source: string;
  pair: string;
  timeframe: string;
}

export interface ChartPanelCommunitySignalDetail {
  pair: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  conf: number;
  source: string;
  reason: string;
  openCopyTrade: boolean;
  evidence?: SignalEvidence;
}

export interface ChartPanelPriceUpdateDetail {
  price: number;
}

export interface ChartPanelDragDetail {
  price: number;
}

export interface ChartPanelPatternScanOptions {
  scope?: PatternScanScope;
  focus?: boolean;
}

export interface ChartPanelPublicHandle {
  activateTradeDrawing?: (dir?: 'LONG' | 'SHORT') => Promise<void> | void;
  runPatternScanFromIntel?: (options?: ChartPanelPatternScanOptions) => Promise<PatternScanReport>;
}
