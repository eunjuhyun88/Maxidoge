import type { DrawingMode } from '$lib/chart/chartTypes';
import type { ChartTheme } from '../ChartTheme';

export interface ChartHeaderSummaryProps {
  chartMode: 'agent' | 'trading';
  pair: string;
  timeframe: string;
  pairBaseLabel: string;
  pairQuoteLabel: string;
  livePrice: number;
  priceChange24h: number;
  low24h: number;
  high24h: number;
  quoteVolume24h: number;
  onChangePair?: (pair: string) => void;
  onChangeTimeframe?: (timeframe: string) => void;
}

export interface ChartHeaderControlsProps {
  chartMode: 'agent' | 'trading';
  isTvLikePreset?: boolean;
  advancedMode?: boolean;
  chatFirstMode?: boolean;
  chatTradeReady?: boolean;
  chatTradeDir?: 'LONG' | 'SHORT';
  indicatorStripState?: 'expanded' | 'collapsed' | 'hidden';
  drawingMode: DrawingMode;
  hasActiveTradeSetup?: boolean;
  onSetChartMode?: (mode: 'agent' | 'trading') => void;
  onSetDrawingMode?: (mode: DrawingMode) => void;
  onRequestChatAssist?: () => void;
  onRequestAgentScan?: () => void;
  onForcePatternScan?: () => void;
  onPublishCommunitySignal?: (dir: 'LONG' | 'SHORT') => void;
  onRestoreIndicatorStrip?: () => void;
}

export interface ChartHeaderMetaStripProps {
  chartMode: 'agent' | 'trading';
  advancedMode?: boolean;
  klineCount?: number;
  ma7Val: number;
  ma25Val: number;
  ma99Val: number;
  rsiVal: number;
  latestVolume: number;
  chartTheme: ChartTheme;
}
