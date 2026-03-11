<script lang="ts">
  import ChartAgentDrawingStatusHud from './ChartAgentDrawingStatusHud.svelte';
  import ChartAgentPositionHud from './ChartAgentPositionHud.svelte';
  import type { ChartAgentStatusHudProps } from './chartAgentOverlayChromeContracts';

  let {
    drawingMode,
    chartNotice = '',
    activeTradeSetup = null,
    showPosition = false,
    posEntry = null,
    posTp = null,
    posSl = null,
    posDir = 'LONG',
    hoverLine = null,
    isDragging = null,
    onCancelDrawing = () => {},
  }: ChartAgentStatusHudProps = $props();
</script>

<ChartAgentDrawingStatusHud
  {drawingMode}
  {chartNotice}
  {isDragging}
  onCancelDrawing={onCancelDrawing}
/>

<ChartAgentPositionHud
  {activeTradeSetup}
  {showPosition}
  {posEntry}
  {posTp}
  {posSl}
  {posDir}
  {hoverLine}
  {isDragging}
/>
