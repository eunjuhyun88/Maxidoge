<script lang="ts">
  import type { ChartAgentOverlayChromeProps } from './chartAgentOverlayChromeContracts';
  import ChartAgentActionOverlay from './ChartAgentActionOverlay.svelte';
  import ChartAgentMetaOverlay from './ChartAgentMetaOverlay.svelte';

  let {
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
  }: ChartAgentOverlayChromeProps = $props();
</script>

<ChartAgentMetaOverlay
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
  {onZoomOut}
  {onZoomIn}
  onFitRange={onFitRange}
  onToggleAutoScaleY={onToggleAutoScaleY}
  onResetScale={onResetScale}
/>

<ChartAgentActionOverlay
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
  onCloseActiveTradeSetup={onCloseActiveTradeSetup}
  onRequestAgentScan={onRequestAgentScan}
  onExecuteActiveTrade={onExecuteActiveTrade}
  onPublishTradeSignal={onPublishTradeSignal}
  onCancelDrawing={onCancelDrawing}
/>
