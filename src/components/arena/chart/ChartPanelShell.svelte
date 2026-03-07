<script lang="ts">
  import ChartAgentSurface from './ChartAgentSurface.svelte';
  import ChartHeaderBar from './ChartHeaderBar.svelte';
  import type {
    AgentTradeSetup,
    DrawingMode,
    IndicatorKey,
    TradePlanDraft,
  } from '$lib/chart/chartTypes';
  import type { ChartTheme } from '../ChartTheme';

  type AgentAnnotation = {
    id: string;
    icon: string;
    name: string;
    color: string;
    label: string;
    detail: string;
    yPercent: number;
    xPercent: number;
    type: 'ob' | 'funding' | 'whale' | 'signal';
  };

  interface Props {
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
    hoverLine?: 'tp' | 'sl' | 'entry' | null;
    isDragging?: 'tp' | 'sl' | 'entry' | null;
    pendingTradePlan: TradePlanDraft | null;
    agentAnnotations?: AgentAnnotation[];
    tvLoading?: boolean;
    tvFallbackTried?: boolean;
    tvError?: string;
    tvSafeMode?: boolean;
    onChangePair?: (pair: string) => void;
    onChangeTimeframe?: (timeframe: string) => void;
    onSetChartMode?: (mode: 'agent' | 'trading') => void;
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
    onRetryTradingView?: () => void;
    onSwitchAgentMode?: () => void;
    onTradingViewContainerReady?: (container: HTMLDivElement | null) => void;
  }

  let {
    chartMode,
    pair,
    timeframe,
    pairBaseLabel,
    pairQuoteLabel,
    livePrice,
    priceChange24h,
    low24h,
    high24h,
    quoteVolume24h,
    symbol,
    error = '',
    isLoading = false,
    autoScaleY = false,
    isTvLikePreset = false,
    advancedMode = false,
    enableTradeLineEntry = false,
    chatFirstMode = false,
    chatTradeReady = false,
    chatTradeDir = 'LONG',
    indicatorStripState = 'collapsed',
    chartVisualMode,
    drawingMode,
    drawingsVisible = true,
    drawingCount = 0,
    hasActiveTradeSetup = false,
    klineCount = 0,
    showIndicatorLegend = false,
    indicatorEnabled,
    chartTheme,
    ma7Val,
    ma20Val,
    ma25Val,
    ma60Val,
    ma99Val,
    ma120Val,
    rsiVal,
    latestVolume,
    activeTradeSetup = null,
    hasScanned = false,
    chartNotice = '',
    showPosition = false,
    posEntry = null,
    posTp = null,
    posSl = null,
    posDir = 'LONG',
    hoverLine = null,
    isDragging = null,
    pendingTradePlan,
    agentAnnotations = [],
    tvLoading = false,
    tvFallbackTried = false,
    tvError = '',
    tvSafeMode = false,
    onChangePair = () => {},
    onChangeTimeframe = () => {},
    onSetChartMode = () => {},
    onSetDrawingMode = () => {},
    onToggleDrawingsVisible = () => {},
    onClearAllDrawings = () => {},
    onRequestChatAssist = () => {},
    onRequestAgentScan = () => {},
    onForcePatternScan = () => {},
    onPublishHeaderCommunitySignal = () => {},
    onRestoreIndicatorStrip = () => {},
    onSetChartVisualMode = () => {},
    onToggleIndicator = () => {},
    onToggleIndicatorLegend = () => {},
    onSetIndicatorStripState = () => {},
    onAgentSurfaceContainerReady = () => {},
    onChartMouseDown = () => {},
    onChartMouseMove = () => {},
    onChartMouseUp = () => {},
    onChartWheel = () => {},
    onZoomOut = () => {},
    onZoomIn = () => {},
    onFitRange = () => {},
    onToggleAutoScaleY = () => {},
    onResetScale = () => {},
    onCloseActiveTradeSetup = () => {},
    onExecuteActiveTrade = () => {},
    onPublishTradeSignal = () => {},
    onCancelDrawing = () => {},
    onCanvasReady = () => {},
    onDrawingMouseDown = () => {},
    onDrawingMouseMove = () => {},
    onDrawingMouseUp = () => {},
    onCancelTradePlan = () => {},
    onOpenTradeFromPlan = () => {},
    onSetTradePlanRatio = () => {},
    onRatioPointerDown = () => {},
    onRatioTrackReady = () => {},
    onRetryTradingView = () => {},
    onSwitchAgentMode = () => {},
    onTradingViewContainerReady = () => {},
  }: Props = $props();

  let chartIndicatorStripModule = $state<Promise<typeof import('./ChartIndicatorStrip.svelte')> | null>(null);
  let chartTradingViewPaneModule = $state<Promise<typeof import('./ChartTradingViewPane.svelte')> | null>(null);

  $effect(() => {
    if (chartMode !== 'agent' || !advancedMode || indicatorStripState === 'hidden' || chartIndicatorStripModule) return;
    chartIndicatorStripModule = import('./ChartIndicatorStrip.svelte');
  });

  $effect(() => {
    if (chartMode !== 'trading' || chartTradingViewPaneModule) return;
    chartTradingViewPaneModule = import('./ChartTradingViewPane.svelte');
  });
</script>

<div class="chart-wrapper" class:tv-like={isTvLikePreset}>
  <ChartHeaderBar
    {chartMode}
    {pair}
    {timeframe}
    {pairBaseLabel}
    {pairQuoteLabel}
    {livePrice}
    {priceChange24h}
    {low24h}
    {high24h}
    {quoteVolume24h}
    {error}
    {isTvLikePreset}
    {advancedMode}
    {enableTradeLineEntry}
    {chatFirstMode}
    {chatTradeReady}
    {chatTradeDir}
    {indicatorStripState}
    {drawingMode}
    {drawingsVisible}
    {drawingCount}
    {hasActiveTradeSetup}
    {klineCount}
    {ma7Val}
    {ma25Val}
    {ma99Val}
    {rsiVal}
    {latestVolume}
    {chartTheme}
    onChangePair={onChangePair}
    onChangeTimeframe={onChangeTimeframe}
    onSetChartMode={onSetChartMode}
    onSetDrawingMode={onSetDrawingMode}
    onToggleDrawingsVisible={onToggleDrawingsVisible}
    onClearAllDrawings={onClearAllDrawings}
    onRequestChatAssist={onRequestChatAssist}
    onRequestAgentScan={onRequestAgentScan}
    onForcePatternScan={onForcePatternScan}
    onPublishCommunitySignal={onPublishHeaderCommunitySignal}
    onRestoreIndicatorStrip={onRestoreIndicatorStrip}
  />

  {#if chartMode === 'agent' && advancedMode && indicatorStripState !== 'hidden' && chartIndicatorStripModule}
    {#await chartIndicatorStripModule then chartIndicatorStripNs}
      {@const ChartIndicatorStrip = chartIndicatorStripNs.default}
      <ChartIndicatorStrip
        {chartVisualMode}
        indicatorStripState={indicatorStripState as 'expanded' | 'collapsed'}
        {indicatorEnabled}
        {chartTheme}
        {ma7Val}
        {ma20Val}
        {ma25Val}
        {ma60Val}
        {ma99Val}
        {ma120Val}
        {rsiVal}
        {latestVolume}
        {showIndicatorLegend}
        {enableTradeLineEntry}
        {isTvLikePreset}
        onSetChartVisualMode={onSetChartVisualMode}
        onToggleIndicator={onToggleIndicator}
        onToggleIndicatorLegend={onToggleIndicatorLegend}
        onSetIndicatorStripState={onSetIndicatorStripState}
      />
    {/await}
  {/if}

  <ChartAgentSurface
    {chartMode}
    {symbol}
    {isLoading}
    {error}
    advancedMode={advancedMode}
    showIndicatorLegend={showIndicatorLegend}
    {indicatorEnabled}
    {chartTheme}
    {ma7Val}
    {ma20Val}
    {ma25Val}
    {ma60Val}
    {ma99Val}
    {ma120Val}
    {rsiVal}
    {latestVolume}
    {activeTradeSetup}
    {drawingsVisible}
    {hasScanned}
    {drawingMode}
    {chartNotice}
    {showPosition}
    {posEntry}
    {posTp}
    {posSl}
    {posDir}
    {hoverLine}
    {isDragging}
    {pendingTradePlan}
    {agentAnnotations}
    {autoScaleY}
    onContainerReady={onAgentSurfaceContainerReady}
    onChartMouseDown={onChartMouseDown}
    onChartMouseMove={onChartMouseMove}
    onChartMouseUp={onChartMouseUp}
    onChartWheel={onChartWheel}
    onZoomOut={onZoomOut}
    onZoomIn={onZoomIn}
    onFitRange={onFitRange}
    onToggleAutoScaleY={onToggleAutoScaleY}
    onResetScale={onResetScale}
    onCloseActiveTradeSetup={onCloseActiveTradeSetup}
    onRequestAgentScan={onRequestAgentScan}
    onExecuteActiveTrade={onExecuteActiveTrade}
    onPublishTradeSignal={onPublishTradeSignal}
    onCancelDrawing={onCancelDrawing}
    onCanvasReady={onCanvasReady}
    onDrawingMouseDown={onDrawingMouseDown}
    onDrawingMouseMove={onDrawingMouseMove}
    onDrawingMouseUp={onDrawingMouseUp}
    onCancelTradePlan={onCancelTradePlan}
    onOpenTradeFromPlan={onOpenTradeFromPlan}
    onSetTradePlanRatio={onSetTradePlanRatio}
    onRatioPointerDown={onRatioPointerDown}
    onRatioTrackReady={onRatioTrackReady}
  />

  {#if chartMode === 'trading' && chartTradingViewPaneModule}
    {#await chartTradingViewPaneModule then chartTradingViewPaneNs}
      {@const ChartTradingViewPane = chartTradingViewPaneNs.default}
      <ChartTradingViewPane
        {pair}
        {tvLoading}
        {tvFallbackTried}
        tvError={tvError}
        tvSafeMode={tvSafeMode}
        onRetry={onRetryTradingView}
        onSwitchAgent={onSwitchAgentMode}
        onContainerReady={onTradingViewContainerReady}
      />
    {/await}
  {/if}

  <!-- chart-footer removed: pattern info shown on chart overlay, indicators in legend -->
</div>

<style>
  .chart-wrapper {
    --cp-font-2xs: clamp(8px, 0.56vw, 9px);
    --cp-font-xs: clamp(9px, 0.64vw, 10px);
    --cp-font-sm: clamp(10px, 0.74vw, 11px);
    --cp-font-md: clamp(11px, 0.86vw, 13px);
    --cp-font-lg: clamp(15px, 1.15vw, 18px);
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0a0a1a;
    overflow: hidden;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }

  .chart-wrapper.tv-like {
    --blk: #131722;
    --fg: #b2b5be;
    --yel: #4f8cff;
    --grn: #26a69a;
    --red: #ef5350;
    --pk: #b388ff;
    --cyan: #5ea1ff;
    --ora: #ffb74d;
    background: #131722;
  }
</style>
