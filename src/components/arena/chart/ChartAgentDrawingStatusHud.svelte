<script lang="ts">
  import type { ChartAgentDrawingStatusHudProps } from './chartAgentOverlayChromeContracts';

  let {
    drawingMode,
    chartNotice = '',
    isDragging = null,
    onCancelDrawing = () => {},
  }: ChartAgentDrawingStatusHudProps = $props();

  const drawingMessage = $derived.by(() => {
    switch (drawingMode) {
      case 'hline':
        return '── CLICK to place horizontal line';
      case 'trendline':
        return 'CLICK two points for trend line';
      case 'trade':
        return 'Position — drag down LONG · drag up SHORT';
      case 'longentry':
        return 'LONG — drag to set ENTRY / SL / TP';
      case 'shortentry':
        return 'SHORT — drag to set ENTRY / SL / TP';
      default:
        return '';
    }
  });
</script>

{#if drawingMessage}
  <div class="drawing-indicator">
    {drawingMessage}
    <button class="drawing-cancel" onclick={onCancelDrawing}>ESC</button>
  </div>
{/if}

{#if chartNotice}
  <div class="chart-notice">{chartNotice}</div>
{/if}

{#if isDragging}
  <div class="drag-indicator">DRAGGING {isDragging.toUpperCase()} — Release to set</div>
{/if}

<style>
  .drawing-indicator {
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 15;
    padding: 4px 12px;
    border-radius: 6px;
    background: rgba(232,150,125,.12);
    border: 1px solid rgba(232,150,125,.3);
    color: #e8967d;
    font-size: 9px;
    font-weight: 700;
    font-family: var(--fm);
    letter-spacing: .9px;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: drawPulse 1.5s ease infinite;
  }

  @keyframes drawPulse { 0%,100% { opacity: 1 } 50% { opacity: .65 } }

  .drawing-cancel {
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(255,255,255,.1);
    border: 1px solid rgba(255,255,255,.15);
    color: #ddd;
    font-size: 9px;
    font-family: var(--fm);
    font-weight: 800;
    cursor: pointer;
    letter-spacing: .8px;
  }

  .drawing-cancel:hover { background: rgba(255,45,85,.2); color: #ff2d55; border-color: rgba(255,45,85,.4); }

  .chart-notice {
    position: absolute;
    left: 50%;
    bottom: 44px;
    transform: translateX(-50%);
    z-index: 18;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(232,150,125,.3);
    background: rgba(0,0,0,.7);
    color: #ffe7b8;
    font-family: var(--fm);
    font-size: 9px;
    letter-spacing: .4px;
    box-shadow: 0 8px 24px rgba(0,0,0,.4);
    pointer-events: none;
    white-space: nowrap;
  }

  .drag-indicator {
    position: absolute;
    bottom: 38px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 15;
    padding: 4px 12px;
    border-radius: 6px;
    background: rgba(232,150,125,.9);
    color: #000;
    font-size: 9px;
    font-weight: 900;
    font-family: var(--fd);
    letter-spacing: 1.6px;
    animation: dragPulse .5s ease infinite;
  }

  @keyframes dragPulse { 0%,100% { opacity: 1 } 50% { opacity: .6 } }

  @media (max-width: 1024px) {
    .chart-notice { bottom: 36px; }
    .drag-indicator { bottom: 30px; }
  }
</style>
