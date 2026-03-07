<script lang="ts">
  import { onDestroy } from 'svelte';
  import type {
    AgentTradeSetup,
    DrawingMode,
    IndicatorKey,
    TradePlanDraft,
  } from '$lib/chart/chartTypes';
  import type { ChartTheme } from '../ChartTheme';
  import ChartAgentOverlayChrome from './ChartAgentOverlayChrome.svelte';
  import ChartAnnotationLayer from './ChartAnnotationLayer.svelte';
  import ChartDrawingCanvas from './ChartDrawingCanvas.svelte';
  import ChartToolbar from './ChartToolbar.svelte';
  import ChartTradePlanOverlay from './ChartTradePlanOverlay.svelte';

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
    drawingCount?: number;
    enableTradeLineEntry?: boolean;
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
    pendingTradePlan: TradePlanDraft | null;
    agentAnnotations?: AgentAnnotation[];
    onContainerReady?: (container: HTMLDivElement | null) => void;
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
    onRequestAgentScan?: () => void;
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
    onSetDrawingMode?: (mode: DrawingMode) => void;
    onToggleDrawingsVisible?: () => void;
    onClearAllDrawings?: () => void;
  }

  let {
    chartMode,
    symbol,
    isLoading = false,
    error = '',
    autoScaleY = false,
    advancedMode = false,
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
    drawingsVisible = true,
    drawingCount = 0,
    enableTradeLineEntry = false,
    hasScanned = false,
    drawingMode,
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
    onContainerReady = () => {},
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
    onRequestAgentScan = () => {},
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
    onCancelCurrentAction = () => {},
    onDeleteSelectedDrawing = () => {},
    onSetDrawingMode = () => {},
    onToggleDrawingsVisible = () => {},
    onClearAllDrawings = () => {},
  }: Props = $props();

  let containerEl: HTMLDivElement | null = $state(null);

  $effect(() => {
    onContainerReady(containerEl);
  });

  onDestroy(() => {
    onContainerReady(null);
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onCancelCurrentAction();
      event.preventDefault();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      // Only handle delete if not inside an input/textarea
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      onDeleteSelectedDrawing();
      event.preventDefault();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="chart-container"
  bind:this={containerEl}
  role="application"
  aria-label="Trading chart"
  tabindex="0"
  class:hidden-chart={chartMode !== 'agent'}
  onmousedown={onChartMouseDown}
  onmousemove={onChartMouseMove}
  onmouseup={onChartMouseUp}
  onmouseleave={onChartMouseUp}
  onwheel={onChartWheel}
  onkeydown={handleKeyDown}
>
  {#if chartMode === 'agent'}
    <ChartToolbar
      {drawingMode}
      {drawingsVisible}
      {drawingCount}
      {enableTradeLineEntry}
      onSetDrawingMode={onSetDrawingMode}
      onToggleDrawingsVisible={onToggleDrawingsVisible}
      onClearAllDrawings={onClearAllDrawings}
    />

    <ChartAgentOverlayChrome
      {symbol}
      {isLoading}
      {error}
      {autoScaleY}
      {advancedMode}
      {showIndicatorLegend}
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
      {onZoomOut}
      {onZoomIn}
      onFitRange={onFitRange}
      onToggleAutoScaleY={onToggleAutoScaleY}
      onResetScale={onResetScale}
      onCloseActiveTradeSetup={onCloseActiveTradeSetup}
      onRequestAgentScan={onRequestAgentScan}
      onExecuteActiveTrade={onExecuteActiveTrade}
      onPublishTradeSignal={onPublishTradeSignal}
      onCancelDrawing={onCancelDrawing}
    />

    <ChartDrawingCanvas
      {drawingMode}
      onCanvasReady={onCanvasReady}
      onMouseDown={onDrawingMouseDown}
      onMouseMove={onDrawingMouseMove}
      onMouseUp={onDrawingMouseUp}
    />
  {/if}

  <ChartTradePlanOverlay
    {pendingTradePlan}
    onCancel={onCancelTradePlan}
    onOpen={onOpenTradeFromPlan}
    onSetRatio={onSetTradePlanRatio}
    onRatioPointerDown={onRatioPointerDown}
    onRatioTrackReady={onRatioTrackReady}
  />

  {#if chartMode === 'agent'}
    <ChartAnnotationLayer annotations={agentAnnotations} />
  {/if}
</div>

<style>
  .chart-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .chart-container.hidden-chart {
    display: none;
  }
</style>
