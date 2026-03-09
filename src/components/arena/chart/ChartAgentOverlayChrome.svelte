<script lang="ts">
  import PositionSizerPanel from './PositionSizerPanel.svelte';
  import type { DrawingMode, AgentTradeSetup, IndicatorKey } from '$lib/chart/chartTypes';
  import { formatCompact, formatPrice } from '$lib/chart/chartCoordinates';
  import type { ChartTheme } from '../ChartTheme';

  interface Props {
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
  }: Props = $props();

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
</script>

{#if isLoading}
  <div class="loading-overlay"><div class="loader"></div><span>Loading {symbol}...</span></div>
{/if}

{#if error}
  <div class="error-badge">{error}</div>
{/if}

<div class="scale-tools">
  <button class="scale-btn" onclick={onZoomOut} title="Zoom Out">-</button>
  <button class="scale-btn" onclick={onZoomIn} title="Zoom In">+</button>
  <button class="scale-btn wide" onclick={onFitRange} title="Fit Time Range">FIT</button>
  <button class="scale-btn wide" class:on={autoScaleY} onclick={onToggleAutoScaleY} title="Y Auto Scale">Y-AUTO</button>
  <button class="scale-btn wide" onclick={onResetScale} title="Reset Scale">RESET</button>
</div>

{#if advancedMode && showIndicatorLegend}
  <div class="indicator-legend">
    {#if indicatorEnabled.ma20}
      <span class="legend-item" style="--legend-color:{chartTheme.ma20}">MA20 {ma20Val > 0 ? formatPrice(ma20Val) : '—'}</span>
    {/if}
    {#if indicatorEnabled.ma60}
      <span class="legend-item" style="--legend-color:{chartTheme.ma60}">MA60 {ma60Val > 0 ? formatPrice(ma60Val) : '—'}</span>
    {/if}
    {#if indicatorEnabled.ma120}
      <span class="legend-item" style="--legend-color:{chartTheme.ma120}">MA120 {ma120Val > 0 ? formatPrice(ma120Val) : '—'}</span>
    {/if}
    {#if indicatorEnabled.ma7}
      <span class="legend-item" style="--legend-color:{chartTheme.ma7}">MA7 {ma7Val > 0 ? formatPrice(ma7Val) : '—'}</span>
    {/if}
    {#if indicatorEnabled.ma25}
      <span class="legend-item" style="--legend-color:{chartTheme.ma25}">MA25 {ma25Val > 0 ? formatPrice(ma25Val) : '—'}</span>
    {/if}
    {#if indicatorEnabled.ma99}
      <span class="legend-item" style="--legend-color:{chartTheme.ma99}">MA99 {ma99Val > 0 ? formatPrice(ma99Val) : '—'}</span>
    {/if}
    {#if indicatorEnabled.rsi}
      <span class="legend-item" style="--legend-color:{chartTheme.rsi}">RSI14(상대강도지수) {rsiVal > 0 ? rsiVal.toFixed(2) : '—'}</span>
    {/if}
    {#if indicatorEnabled.vol}
      <span class="legend-item" style="--legend-color:{chartTheme.candleUp}">VOL(거래량) {latestVolume > 0 ? formatCompact(latestVolume) : '—'}</span>
    {/if}
  </div>
{/if}

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

{#if drawingMode !== 'none'}
  <div class="drawing-indicator">
    {#if drawingMode === 'hline'}
      ── CLICK to place horizontal line
    {:else if drawingMode === 'trendline'}
      CLICK two points for trend line
    {:else if drawingMode === 'trade'}
      Position — drag down LONG · drag up SHORT
    {:else if drawingMode === 'longentry'}
      LONG — drag to set ENTRY / SL / TP
    {:else if drawingMode === 'shortentry'}
      SHORT — drag to set ENTRY / SL / TP
    {/if}
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

{#if showPosition && posEntry !== null && posTp !== null && posSl !== null}
  <div class="pos-overlay">
    <div class="pos-badge {posDir.toLowerCase()}">
      {posDir === 'LONG' ? '▲ LONG' : posDir === 'SHORT' ? '▼ SHORT' : '— NEUTRAL'}
    </div>
    <div class="pos-levels">
      <span class="pos-tp" class:highlight={hoverLine === 'tp' || isDragging === 'tp'}>{hoverLine === 'tp' ? '↕' : ''} TP ${Math.round(posTp).toLocaleString()}</span>
      <span class="pos-entry" class:highlight={hoverLine === 'entry' || isDragging === 'entry'}>{hoverLine === 'entry' ? '↕' : ''} ENTRY ${Math.round(posEntry).toLocaleString()}</span>
      <span class="pos-sl" class:highlight={hoverLine === 'sl' || isDragging === 'sl'}>{hoverLine === 'sl' ? '↕' : ''} SL ${Math.round(posSl).toLocaleString()}</span>
    </div>
    <div class="pos-rr">R:R 1:{(Math.abs(posTp - posEntry) / Math.max(1, Math.abs(posEntry - posSl))).toFixed(1)}</div>
    <div class="pos-hint">DRAG or SCROLL lines to adjust</div>
  </div>
{/if}

{#if isDragging}
  <div class="drag-indicator">DRAGGING {isDragging.toUpperCase()} — Release to set</div>
{/if}

<style>
  .indicator-legend {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 7;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2px;
    padding: 5px 6px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(5,8,16,.82);
    backdrop-filter: blur(4px);
    pointer-events: none;
    max-width: min(460px, 54%);
  }

  .scale-tools {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
    z-index: 8;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,.2);
    background: rgba(7, 12, 20, 0.86);
    backdrop-filter: blur(4px);
    box-shadow: 0 8px 24px rgba(0,0,0,.34);
  }

  .scale-btn {
    border: 1px solid rgba(255,255,255,.2);
    background: rgba(255,255,255,.06);
    color: rgba(255,255,255,.8);
    border-radius: 6px;
    min-width: 26px;
    height: 22px;
    padding: 0 6px;
    font-family: var(--fd);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .5px;
    cursor: pointer;
    transition: all .15s;
  }

  .scale-btn.wide { min-width: 46px; }

  .scale-btn:hover {
    color: #fff;
    border-color: rgba(255,255,255,.35);
    background: rgba(255,255,255,.12);
  }

  .scale-btn.on {
    color: #f5c4b8;
    border-color: rgba(232,150,125,.55);
    background: rgba(232,150,125,.16);
  }

  .legend-item {
    --legend-color: #aaa;
    font-family: var(--fm);
    font-size: 9px;
    color: rgba(255,255,255,.88);
    letter-spacing: .35px;
    white-space: nowrap;
  }

  .legend-item::before {
    content: '';
    display: inline-block;
    width: 7px;
    height: 2px;
    border-radius: 2px;
    margin-right: 4px;
    transform: translateY(-1px);
    background: var(--legend-color);
    box-shadow: 0 0 6px var(--legend-color);
  }

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

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(10,10,26,.9);
    z-index: 10;
    color: #d0d6df;
    font-size: 10px;
    font-family: var(--fm);
  }

  .loader {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(232,150,125,.2);
    border-top-color: #e8967d;
    border-radius: 50%;
    animation: spin .6s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .error-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255,45,85,.2);
    border: 1px solid rgba(255,45,85,.4);
    color: #ff2d55;
    font-size: 9px;
    font-family: var(--fm);
    font-weight: 700;
    z-index: 5;
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
    .scale-tools {
      bottom: 6px;
      gap: 3px;
      padding: 3px;
    }

    .scale-btn {
      min-width: 24px;
      height: 20px;
      font-size: 9px;
      padding: 0 5px;
    }

    .scale-btn.wide { min-width: 40px; }
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
