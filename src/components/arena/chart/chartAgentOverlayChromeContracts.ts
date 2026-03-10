import type { AgentTradeSetup, DrawingMode, IndicatorKey } from '$lib/chart/chartTypes';
import type { ChartTheme } from '../ChartTheme';

export interface ChartAgentOverlayChromeProps {
  symbol: string;
  isLoading?: boolean;
  error?: string;
  autoScaleY?: boolean;
  advancedMode?: boolean;
  showIndicatorLegend?: boolean;
  indicatorEnabled: Record<IndicatorKey, boolean>;
  chartTheme: ChartTheme;
  ma7Val: number;
  ma20Val: number;
  ma25Val: number;
  ma60Val: number;
  ma99Val: number;
  ma120Val: number;
  rsiVal: number;
  latestVolume: number;
  activeTradeSetup?: AgentTradeSetup | null;
  drawingsVisible?: boolean;
  hasScanned?: boolean;
  drawingMode: DrawingMode;
  chartNotice?: string;
  showPosition?: boolean;
  posEntry?: number | null;
  posTp?: number | null;
  posSl?: number | null;
  posDir?: string;
  hoverLine?: string | null;
  isDragging?: string | null;
  onZoomOut?: () => void;
  onZoomIn?: () => void;
  onFitRange?: () => void;
  onToggleAutoScaleY?: () => void;
  onResetScale?: () => void;
  onCloseActiveTradeSetup?: () => void;
  onRequestAgentScan?: () => void;
  onExecuteActiveTrade?: () => void;
  onPublishTradeSignal?: () => void;
  onCancelDrawing?: () => void;
}

export interface ChartAgentMetaOverlayProps {
  symbol: string;
  isLoading?: boolean;
  error?: string;
  autoScaleY?: boolean;
  advancedMode?: boolean;
  showIndicatorLegend?: boolean;
  indicatorEnabled: Record<IndicatorKey, boolean>;
  chartTheme: ChartTheme;
  ma7Val: number;
  ma20Val: number;
  ma25Val: number;
  ma60Val: number;
  ma99Val: number;
  ma120Val: number;
  rsiVal: number;
  latestVolume: number;
  onZoomOut?: () => void;
  onZoomIn?: () => void;
  onFitRange?: () => void;
  onToggleAutoScaleY?: () => void;
  onResetScale?: () => void;
}

export interface ChartAgentActionOverlayProps {
  activeTradeSetup?: AgentTradeSetup | null;
  drawingsVisible?: boolean;
  hasScanned?: boolean;
  drawingMode: DrawingMode;
  chartNotice?: string;
  showPosition?: boolean;
  posEntry?: number | null;
  posTp?: number | null;
  posSl?: number | null;
  posDir?: string;
  hoverLine?: string | null;
  isDragging?: string | null;
  onCloseActiveTradeSetup?: () => void;
  onRequestAgentScan?: () => void;
  onExecuteActiveTrade?: () => void;
  onPublishTradeSignal?: () => void;
  onCancelDrawing?: () => void;
}
