<script lang="ts">
  import PositionSizerPanel from './PositionSizerPanel.svelte';
  import type { ChartAgentActionOverlayProps } from './chartAgentOverlayChromeContracts';

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

  const sizingEntry = $derived(activeTradeSetup?.entry ?? posEntry ?? 0);
  const sizingStop = $derived(activeTradeSetup?.sl ?? posSl ?? 0);
  const sizingTakeProfit = $derived(activeTradeSetup?.tp ?? posTp ?? 0);
  const sizingDirection = $derived(
    activeTradeSetup?.dir ?? (posDir === 'SHORT' ? 'SHORT' : 'LONG')
  );
  const showPositionSizer = $derived(
    Boolean(
      (activeTradeSetup && activeTradeSetup.entry > 0 && activeTradeSetup.sl > 0) ||
      (showPosition && posEntry !== null && posSl !== null)
    )
  );
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
  const showPositionOverlay = $derived(
    showPosition && posEntry !== null && posTp !== null && posSl !== null
  );
  const positionRiskReward = $derived.by(() => {
    if (posEntry === null || posTp === null || posSl === null) return '0.0';
    return (
      Math.abs(posTp - posEntry) / Math.max(1, Math.abs(posEntry - posSl))
    ).toFixed(1);
  });
  const positionEntryLabel = $derived(
    posEntry === null ? '—' : Math.round(posEntry).toLocaleString()
  );
  const positionTakeProfitLabel = $derived(
    posTp === null ? '—' : Math.round(posTp).toLocaleString()
  );
  const positionStopLabel = $derived(
    posSl === null ? '—' : Math.round(posSl).toLocaleString()
  );
  const positionDirectionClass = $derived(posDir.toLowerCase());
</script>

{#if activeTradeSetup && drawingsVisible}
  <button class="overlay-close-btn" onclick={onCloseActiveTradeSetup} title="Close overlay">&#x2715;</button>
{/if}

{#if !hasScanned && !activeTradeSetup}
  <div class="first-scan-cta">
    <button class="fsc-btn" onclick={onRequestAgentScan}>
      <span class="fsc-icon">&#x25C9;</span>
      <span class="fsc-label">RUN FIRST SCAN</span>
      <span class="fsc-sub">Generate agent consensus</span>
    </button>
  </div>
{/if}

{#if activeTradeSetup}
  <div class="trade-cta-bar">
    <span class="tcb-dir" class:long={activeTradeSetup.dir === 'LONG'} class:short={activeTradeSetup.dir === 'SHORT'}>
      {activeTradeSetup.dir === 'LONG' ? '▲' : '▼'} {activeTradeSetup.dir}
    </span>
    <span class="tcb-conf">{activeTradeSetup.conf}%</span>
    <span class="tcb-rr">R:R 1:{activeTradeSetup.rr.toFixed(1)}</span>
    <button class="tcb-execute" class:long={activeTradeSetup.dir === 'LONG'} class:short={activeTradeSetup.dir === 'SHORT'} onclick={onExecuteActiveTrade}>
      EXECUTE {activeTradeSetup.dir}
    </button>
    <button class="tcb-copy" onclick={onPublishTradeSignal} title="커뮤니티에 시그널 공유">
      📡 공유
    </button>
  </div>
{/if}

{#if drawingMessage}
  <div class="drawing-indicator">
    {drawingMessage}
    <button class="drawing-cancel" onclick={onCancelDrawing}>ESC</button>
  </div>
{/if}

{#if chartNotice}
  <div class="chart-notice">{chartNotice}</div>
{/if}

{#if showPositionSizer}
  <div class="position-sizer-dock">
    <PositionSizerPanel
      entry={sizingEntry}
      stop={sizingStop}
      tp={sizingTakeProfit}
      dir={sizingDirection}
    />
  </div>
{/if}

{#if showPositionOverlay}
  <div class="pos-overlay">
    <div class="pos-badge {positionDirectionClass}">
      {posDir === 'LONG' ? '▲ LONG' : posDir === 'SHORT' ? '▼ SHORT' : '— NEUTRAL'}
    </div>
    <div class="pos-levels">
      <span class="pos-tp" class:highlight={hoverLine === 'tp' || isDragging === 'tp'}>{hoverLine === 'tp' ? '↕' : ''} TP ${positionTakeProfitLabel}</span>
      <span class="pos-entry" class:highlight={hoverLine === 'entry' || isDragging === 'entry'}>{hoverLine === 'entry' ? '↕' : ''} ENTRY ${positionEntryLabel}</span>
      <span class="pos-sl" class:highlight={hoverLine === 'sl' || isDragging === 'sl'}>{hoverLine === 'sl' ? '↕' : ''} SL ${positionStopLabel}</span>
    </div>
    <div class="pos-rr">R:R 1:{positionRiskReward}</div>
    <div class="pos-hint">DRAG or SCROLL lines to adjust</div>
  </div>
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

  .position-sizer-dock {
    position: absolute;
    right: 8px;
    bottom: 10px;
    z-index: 14;
    display: inline-flex;
    justify-content: flex-end;
  }

  .overlay-close-btn {
    position: absolute;
    top: 8px;
    right: 80px;
    z-index: 10;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    background: rgba(10,9,8,.8);
    border: 1px solid rgba(232,150,125,.35);
    color: rgba(232,150,125,.9);
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
    transition: all .15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .overlay-close-btn:hover { background: rgba(232,150,125,.15); border-color: #e8967d; color: #e8967d; }

  .first-scan-cta {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 12;
  }

  .fsc-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(10,9,8,.76);
    border: 1.5px solid rgba(232,150,125,.3);
    cursor: pointer;
    transition: all .2s;
    backdrop-filter: blur(4px);
  }

  .fsc-btn:hover { border-color: #e8967d; box-shadow: 0 0 12px rgba(232,150,125,.15); background: rgba(232,150,125,.14); }

  .fsc-icon { font-size: 11px; color: #e8967d; animation: fscPulse 2s ease infinite; }

  @keyframes fscPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.92)} }

  .fsc-label { font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1px; color: #e8967d; }
  .fsc-sub { font-family: var(--fm); font-size: 9px; color: rgba(240,237,228,.62); letter-spacing: .3px; }

  .trade-cta-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 14;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: rgba(10,9,8,.9);
    border-top: 1px solid rgba(232,150,125,.2);
    backdrop-filter: blur(4px);
  }

  .tcb-dir { font-family: var(--fm); font-size: 11px; font-weight: 900; letter-spacing: 1px; }
  .tcb-dir.long { color: var(--grn, #00ff88); }
  .tcb-dir.short { color: var(--red, #ff2d55); }
  .tcb-conf { font-family: var(--fd); font-size: 12px; font-weight: 800; color: rgba(240,237,228,.6); }
  .tcb-rr { font-family: var(--fm); font-size: 9px; color: rgba(240,237,228,.55); letter-spacing: .5px; }

  .tcb-execute {
    margin-left: auto;
    padding: 5px 16px;
    border-radius: 4px;
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all .15s;
    border: 1px solid;
  }

  .tcb-execute.long { color: #0a0908; background: var(--grn, #00ff88); border-color: var(--grn, #00ff88); }
  .tcb-execute.long:hover { box-shadow: 0 0 12px rgba(0,255,136,.3); }
  .tcb-execute.short { color: #fff; background: var(--red, #ff2d55); border-color: var(--red, #ff2d55); }
  .tcb-execute.short:hover { box-shadow: 0 0 12px rgba(255,45,85,.3); }

  .tcb-copy {
    padding: 5px 10px;
    border-radius: 4px;
    border: 1px solid rgba(232,150,125,.45);
    background: rgba(232,150,125,.16);
    color: #ffe8d8;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .8px;
    cursor: pointer;
    transition: all .15s;
  }

  .tcb-copy:hover {
    border-color: rgba(232,150,125,.65);
    background: rgba(232,150,125,.24);
    color: #fff5ee;
    box-shadow: 0 0 10px rgba(232,150,125,.24);
  }

  .pos-overlay { position: absolute; top: 6px; right: 6px; z-index: 12; display: flex; flex-direction: column; gap: 3px; align-items: flex-end; }
  .pos-badge { padding: 3px 10px; border-radius: 6px; font-size: 10px; font-weight: 900; font-family: var(--fd); letter-spacing: 2px; border: 2px solid; }
  .pos-badge.long { background: rgba(0,255,136,.2); border-color: #00ff88; color: #00ff88; }
  .pos-badge.short { background: rgba(255,45,85,.2); border-color: #ff2d55; color: #ff2d55; }
  .pos-badge.neutral { background: rgba(255,170,0,.2); border-color: #ffaa00; color: #ffaa00; }
  .pos-levels { display: flex; flex-direction: column; gap: 1px; font-size: 9px; font-family: var(--fm); font-weight: 700; text-align: right; }
  .pos-tp { color: #4ade80; }
  .pos-entry { color: #ffba30; }
  .pos-sl { color: #ff4060; }
  .pos-rr { font-size: 10px; font-weight: 900; font-family: var(--fd); color: #e8967d; background: rgba(0,0,0,.6); padding: 2px 8px; border-radius: 4px; }
  .pos-hint { font-size: 9px; color: rgba(255,255,255,.5); font-family: var(--fm); letter-spacing: .5px; text-align: right; margin-top: 2px; }
  .pos-levels .highlight { background: rgba(255,255,255,.15); padding: 0 4px; border-radius: 3px; animation: lineHover .5s ease infinite; }
  @keyframes lineHover { 0%,100%{opacity:1} 50%{opacity:.7} }

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
    .position-sizer-dock { right: 6px; bottom: 8px; }
    .drag-indicator { bottom: 30px; }
  }

  @media (max-width: 768px) {
    .first-scan-cta { top: 6px; right: 6px; }
    .fsc-sub { display: none; }
    .fsc-btn { padding: 4px 8px; }
    .trade-cta-bar { display: none; }
  }
</style>
