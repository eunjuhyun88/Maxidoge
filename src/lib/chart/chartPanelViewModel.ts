import type {
  AgentTradeSetup,
  DrawingMode,
  IndicatorKey,
  TradePlanDraft,
} from './chartTypes';
import type { ChartTheme } from '../../components/arena/ChartTheme';

export type ChartDragTarget = 'tp' | 'sl' | 'entry' | null;
export type ChartMode = 'agent' | 'trading';

export interface ChartPanelAnnotation {
  id: string;
  icon: string;
  name: string;
  color: string;
  label: string;
  detail: string;
  yPercent: number;
  xPercent: number;
  type: 'ob' | 'funding' | 'whale' | 'signal';
}

export interface ChartPanelShellState {
  chartMode: ChartMode;
  pair: string;
  timeframe: string;
  pairBaseLabel: string;
  pairQuoteLabel: string;
  livePrice: number;
  priceChange24h: number;
  low24h: number;
  high24h: number;
  quoteVolume24h: number;
  symbol: string;
  error?: string;
  isLoading?: boolean;
  autoScaleY?: boolean;
  isTvLikePreset?: boolean;
  advancedMode?: boolean;
  enableTradeLineEntry?: boolean;
  chatFirstMode?: boolean;
  chatTradeReady?: boolean;
  chatTradeDir?: 'LONG' | 'SHORT';
  indicatorStripState?: 'expanded' | 'collapsed' | 'hidden';
  chartVisualMode: 'focus' | 'full';
  drawingMode: DrawingMode;
  drawingsVisible?: boolean;
  drawingCount?: number;
  hasActiveTradeSetup?: boolean;
  klineCount?: number;
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
  hasScanned?: boolean;
  chartNotice?: string;
  showPosition?: boolean;
  posEntry?: number | null;
  posTp?: number | null;
  posSl?: number | null;
  posDir?: string;
  hoverLine?: ChartDragTarget;
  isDragging?: ChartDragTarget;
  pendingTradePlan: TradePlanDraft | null;
  agentAnnotations?: ChartPanelAnnotation[];
  tvLoading?: boolean;
  tvFallbackTried?: boolean;
  tvError?: string;
  tvSafeMode?: boolean;
}

export interface ChartPanelShellActions {
  onChangePair?: (pair: string) => void;
  onChangeTimeframe?: (timeframe: string) => void;
  onSetChartMode?: (mode: ChartMode) => void;
  onSetDrawingMode?: (mode: DrawingMode) => void;
  onToggleDrawingsVisible?: () => void;
  onClearAllDrawings?: () => void;
  onRequestChatAssist?: () => void;
  onRequestAgentScan?: () => void;
  onForcePatternScan?: () => void;
  onPublishHeaderCommunitySignal?: (dir: 'LONG' | 'SHORT') => void;
  onRestoreIndicatorStrip?: () => void;
  onSetChartVisualMode?: (mode: 'focus' | 'full') => void;
  onToggleIndicator?: (key: IndicatorKey) => void;
  onToggleIndicatorLegend?: () => void;
  onSetIndicatorStripState?: (state: 'expanded' | 'collapsed' | 'hidden') => void;
  onAgentSurfaceContainerReady?: (container: HTMLDivElement | null) => void;
  onChartMouseDown?: (event: MouseEvent) => void;
  onChartMouseMove?: (event: MouseEvent) => void;
  onChartMouseUp?: (event: MouseEvent) => void;
  onChartWheel?: (event: WheelEvent) => void;
  onZoomOut?: () => void;
  onZoomIn?: () => void;
  onFitRange?: () => void;
  onToggleAutoScaleY?: () => void;
  onResetScale?: () => void;
  onCloseActiveTradeSetup?: () => void;
  onExecuteActiveTrade?: () => void;
  onPublishTradeSignal?: () => void;
  onCancelDrawing?: () => void;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  onDrawingMouseDown?: (event: MouseEvent) => void;
  onDrawingMouseMove?: (event: MouseEvent) => void;
  onDrawingMouseUp?: (event: MouseEvent) => void;
  onCancelTradePlan?: () => void;
  onOpenTradeFromPlan?: () => void;
  onSetTradePlanRatio?: (nextLongRatio: number) => void;
  onRatioPointerDown?: (event: PointerEvent) => void;
  onRatioTrackReady?: (element: HTMLButtonElement | null) => void;
  onCancelCurrentAction?: () => void;
  onDeleteSelectedDrawing?: () => void;
  onRetryTradingView?: () => void;
  onSwitchAgentMode?: () => void;
  onTradingViewContainerReady?: (container: HTMLDivElement | null) => void;
}

export type ChartPanelShellProps = ChartPanelShellState & ChartPanelShellActions;

export interface BuildChartPanelShellStateParams {
  chartMode: ChartMode;
  pair: string;
  timeframe: string;
  pairBaseLabel: string;
  pairQuoteLabel: string;
  livePrice: number;
  priceChange24h: number;
  low24h: number;
  high24h: number;
  quoteVolume24h: number;
  symbol: string;
  error: string;
  isLoading: boolean;
  autoScaleY: boolean;
  isTvLikePreset: boolean;
  advancedMode: boolean;
  enableTradeLineEntry: boolean;
  chatFirstMode: boolean;
  chatTradeReady: boolean;
  chatTradeDir: 'LONG' | 'SHORT';
  indicatorStripState: 'expanded' | 'collapsed' | 'hidden';
  chartVisualMode: 'focus' | 'full';
  drawingMode: DrawingMode;
  drawingsVisible: boolean;
  drawingsLength: number;
  klineCount: number;
  showIndicatorLegend: boolean;
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
  activeTradeSetup: AgentTradeSetup | null;
  hasScanned: boolean;
  chartNotice: string;
  showPosition: boolean;
  posEntry: number | null;
  posTp: number | null;
  posSl: number | null;
  posDir: string;
  hoverLine: ChartDragTarget;
  isDragging: ChartDragTarget;
  pendingTradePlan: TradePlanDraft | null;
  agentAnnotations: ChartPanelAnnotation[];
  tvLoading: boolean;
  tvFallbackTried: boolean;
  tvError: string;
  tvSafeMode: boolean;
}

export function buildChartPanelShellState(
  params: BuildChartPanelShellStateParams,
): ChartPanelShellState {
  return {
    chartMode: params.chartMode,
    pair: params.pair,
    timeframe: params.timeframe,
    pairBaseLabel: params.pairBaseLabel,
    pairQuoteLabel: params.pairQuoteLabel,
    livePrice: params.livePrice,
    priceChange24h: params.priceChange24h,
    low24h: params.low24h,
    high24h: params.high24h,
    quoteVolume24h: params.quoteVolume24h,
    symbol: params.symbol,
    error: params.error,
    isLoading: params.isLoading,
    autoScaleY: params.autoScaleY,
    isTvLikePreset: params.isTvLikePreset,
    advancedMode: params.advancedMode,
    enableTradeLineEntry: params.enableTradeLineEntry,
    chatFirstMode: params.chatFirstMode,
    chatTradeReady: params.chatTradeReady,
    chatTradeDir: params.chatTradeDir,
    indicatorStripState: params.indicatorStripState,
    chartVisualMode: params.chartVisualMode,
    drawingMode: params.drawingMode,
    drawingsVisible: params.drawingsVisible,
    drawingCount: params.drawingsLength,
    hasActiveTradeSetup: !!params.activeTradeSetup,
    klineCount: params.klineCount,
    showIndicatorLegend: params.showIndicatorLegend,
    indicatorEnabled: params.indicatorEnabled,
    chartTheme: params.chartTheme,
    ma7Val: params.ma7Val,
    ma20Val: params.ma20Val,
    ma25Val: params.ma25Val,
    ma60Val: params.ma60Val,
    ma99Val: params.ma99Val,
    ma120Val: params.ma120Val,
    rsiVal: params.rsiVal,
    latestVolume: params.latestVolume,
    activeTradeSetup: params.activeTradeSetup,
    hasScanned: params.hasScanned,
    chartNotice: params.chartNotice,
    showPosition: params.showPosition,
    posEntry: params.posEntry,
    posTp: params.posTp,
    posSl: params.posSl,
    posDir: params.posDir,
    hoverLine: params.hoverLine,
    isDragging: params.isDragging,
    pendingTradePlan: params.pendingTradePlan,
    agentAnnotations: params.agentAnnotations,
    tvLoading: params.tvLoading,
    tvFallbackTried: params.tvFallbackTried,
    tvError: params.tvError,
    tvSafeMode: params.tvSafeMode,
  };
}
