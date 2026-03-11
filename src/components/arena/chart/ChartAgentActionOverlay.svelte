<script lang="ts">
  import type { ChartAgentActionOverlayProps } from './chartAgentOverlayChromeContracts';
  import ChartAgentStatusHud from './ChartAgentStatusHud.svelte';
  import ChartAgentTradeHud from './ChartAgentTradeHud.svelte';

  let {
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
    onCloseActiveTradeSetup = () => {},
    onRequestAgentScan = () => {},
    onExecuteActiveTrade = () => {},
    onPublishTradeSignal = () => {},
    onCancelDrawing = () => {},
  }: ChartAgentActionOverlayProps = $props();
</script>

<ChartAgentTradeHud
  {activeTradeSetup}
  {drawingsVisible}
  {hasScanned}
  onCloseActiveTradeSetup={onCloseActiveTradeSetup}
  onRequestAgentScan={onRequestAgentScan}
  onExecuteActiveTrade={onExecuteActiveTrade}
  onPublishTradeSignal={onPublishTradeSignal}
/>

<ChartAgentStatusHud
  {activeTradeSetup}
  {drawingMode}
  {chartNotice}
  {showPosition}
  {posEntry}
  {posTp}
  {posSl}
  {posDir}
  {hoverLine}
  {isDragging}
  onCancelDrawing={onCancelDrawing}
/>
