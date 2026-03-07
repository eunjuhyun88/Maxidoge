<script lang="ts">
  import TokenDropdown from '../../shared/TokenDropdown.svelte';
  import { formatCompact, formatPrice } from '$lib/chart/chartCoordinates';
  import { CORE_TIMEFRAME_OPTIONS, normalizeTimeframe } from '$lib/utils/timeframe';
  import { isCompactViewport } from '$lib/chart/chartHelpers';
  import type { DrawingMode } from '$lib/chart/chartTypes';
  import type { ChartTheme } from '../ChartTheme';

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
    error?: string;
    isTvLikePreset?: boolean;
    advancedMode?: boolean;
    enableTradeLineEntry?: boolean;
    chatFirstMode?: boolean;
    chatTradeReady?: boolean;
    chatTradeDir?: 'LONG' | 'SHORT';
    indicatorStripState?: 'expanded' | 'collapsed' | 'hidden';
    drawingMode: DrawingMode;
    drawingsVisible?: boolean;
    drawingCount?: number;
    hasActiveTradeSetup?: boolean;
    klineCount?: number;
    ma7Val: number;
    ma25Val: number;
    ma99Val: number;
    rsiVal: number;
    latestVolume: number;
    chartTheme: ChartTheme;
    onChangePair?: (pair: string) => void;
    onChangeTimeframe?: (timeframe: string) => void;
    onSetChartMode?: (mode: 'agent' | 'trading') => void;
    onSetDrawingMode?: (mode: DrawingMode) => void;
    onToggleDrawingsVisible?: () => void;
    onClearAllDrawings?: () => void;
    onRequestChatAssist?: () => void;
    onRequestAgentScan?: () => void;
    onForcePatternScan?: () => void;
    onPublishCommunitySignal?: (dir: 'LONG' | 'SHORT') => void;
    onRestoreIndicatorStrip?: () => void;
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
    error = '',
    isTvLikePreset = false,
    advancedMode = false,
    enableTradeLineEntry = false,
    chatFirstMode = false,
    chatTradeReady = false,
    chatTradeDir = 'LONG',
    indicatorStripState = 'collapsed',
    drawingMode,
    drawingsVisible = true,
    drawingCount = 0,
    hasActiveTradeSetup = false,
    klineCount = 0,
    ma7Val,
    ma25Val,
    ma99Val,
    rsiVal,
    latestVolume,
    chartTheme,
    onChangePair = () => {},
    onChangeTimeframe = () => {},
    onSetChartMode = () => {},
    onSetDrawingMode = () => {},
    onToggleDrawingsVisible = () => {},
    onClearAllDrawings = () => {},
    onRequestChatAssist = () => {},
    onRequestAgentScan = () => {},
    onForcePatternScan = () => {},
    onPublishCommunitySignal = () => {},
    onRestoreIndicatorStrip = () => {},
  }: Props = $props();
</script>

<div class="chart-bar" class:tv-like={isTvLikePreset}>
  <div class="bar-top top-meta">
    <div class="pair-summary">
      {#if chartMode === 'trading'}
        <span class="pair-name">{pairBaseLabel}/{pairQuoteLabel}</span>
      {/if}
      <span class="pair-k">LAST</span>
      <span class="pair-last">${formatPrice(livePrice)}</span>
      <span class="pair-move" class:up={priceChange24h >= 0} class:down={priceChange24h < 0}>
        {priceChange24h >= 0 ? '+' : '-'}{Math.abs(priceChange24h).toFixed(2)}%
      </span>
    </div>
    <div class="market-stats">
      <div class="mstat">
        <span class="mstat-k">24H LOW</span>
        <span class="mstat-v">{low24h > 0 ? formatPrice(low24h) : '—'}</span>
      </div>
      <div class="mstat">
        <span class="mstat-k">24H HIGH</span>
        <span class="mstat-v">{high24h > 0 ? formatPrice(high24h) : '—'}</span>
      </div>
      <div class="mstat wide">
        <span class="mstat-k">24H VOL(USDT)</span>
        <span class="mstat-v">{quoteVolume24h > 0 ? formatCompact(quoteVolume24h) : '—'}</span>
      </div>
    </div>
  </div>

  <div class="bar-tools">
    <div class="bar-left">
      <div class="live-indicator">
        <span class="live-dot" class:err={!!error}></span>
        {error ? 'OFFLINE' : 'LIVE'}
      </div>

      {#if chartMode === 'agent'}
        <div class="pair-slot">
          <TokenDropdown value={pair} compact={isCompactViewport()} onSelect={(detail) => onChangePair(detail.pair)} />
        </div>
      {/if}

      <div class="tf-compact">
        <span class="tf-compact-label">TF</span>
        <select
          class="tf-compact-select"
          value={normalizeTimeframe(timeframe)}
          onchange={(e) => onChangeTimeframe((e.currentTarget as HTMLSelectElement).value)}
          aria-label="Timeframe"
        >
          {#each CORE_TIMEFRAME_OPTIONS as tf}
            <option value={tf.value}>{tf.label}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="tf-btns">
      {#each CORE_TIMEFRAME_OPTIONS as tf}
        <button
          class="tfbtn"
          class:active={normalizeTimeframe(timeframe) === tf.value}
          onclick={() => onChangeTimeframe(tf.value)}
        >
          {tf.label}
        </button>
      {/each}
    </div>

    <div class="bar-controls">
      <div class="mode-toggle">
        <button class="mode-btn" class:active={chartMode === 'agent'} onclick={() => onSetChartMode('agent')}>
          AGENT
        </button>
        <button class="mode-btn" class:active={chartMode === 'trading'} onclick={() => onSetChartMode('trading')}>
          TRADING
        </button>
      </div>

      {#if chartMode === 'agent'}
        <div class="draw-tools">
          {#if !isTvLikePreset}
            <button class="draw-btn" class:active={drawingMode === 'hline'} onclick={() => onSetDrawingMode(drawingMode === 'hline' ? 'none' : 'hline')} title="Horizontal Line">&#x2500;</button>
            <button class="draw-btn" class:active={drawingMode === 'trendline'} onclick={() => onSetDrawingMode(drawingMode === 'trendline' ? 'none' : 'trendline')} title="Trend Line">&#x2571;</button>
          {/if}
          {#if enableTradeLineEntry}
            <button class="draw-btn trade-tool" class:active={drawingMode === 'trade' || drawingMode === 'longentry' || drawingMode === 'shortentry'} onclick={() => onSetDrawingMode(drawingMode === 'trade' ? 'none' : 'trade')} title="Position Tool (R) — drag down LONG · drag up SHORT">⬡</button>
          {/if}
          {#if drawingCount > 0 || hasActiveTradeSetup}
            <button class="draw-btn vis-toggle" class:off={!drawingsVisible} onclick={onToggleDrawingsVisible} title={drawingsVisible ? 'Hide drawings (V)' : 'Show drawings (V)'}>
              {drawingsVisible ? '◉' : '○'}<span class="vis-count">{drawingCount}</span>
            </button>
          {/if}
          <button class="draw-btn clear-btn" onclick={onClearAllDrawings} title="Clear">&#x2715;</button>
        </div>
      {/if}

      {#if chartMode === 'agent'}
        {#if chatFirstMode}
          <button
            class="scan-btn chat-trigger"
            class:ready={chatTradeReady}
            onclick={onRequestChatAssist}
            title={chatTradeReady ? `AI answer ready. Start ${chatTradeDir} drag on chart.` : 'Open Intel chat and ask AI first'}
          >
            {chatTradeReady ? `START ${chatTradeDir}` : 'OPEN CHAT'}
          </button>
        {:else}
          <button class="scan-btn" onclick={onRequestAgentScan} title="Run agent scan for current market">
            SCAN
          </button>
        {/if}
        <button
          class="scan-btn pattern-trigger"
          onclick={onForcePatternScan}
          title="Re-scan head and shoulders / falling wedge patterns"
        >
          PATTERN
        </button>
        <div class="opinion-actions">
          <button
            class="scan-btn view-btn long"
            onclick={() => onPublishCommunitySignal('LONG')}
            title="LONG 시그널을 공유 모달로 열기"
          >
            ▲ LONG 공유
          </button>
          <button
            class="scan-btn view-btn short"
            onclick={() => onPublishCommunitySignal('SHORT')}
            title="SHORT 시그널을 공유 모달로 열기"
          >
            ▼ SHORT 공유
          </button>
        </div>

        {#if advancedMode && indicatorStripState === 'hidden' && !isTvLikePreset}
          <button class="strip-restore-btn" onclick={onRestoreIndicatorStrip}>IND ON</button>
        {/if}
      {/if}
    </div>
  </div>

  {#if chartMode === 'agent' && klineCount > 0 && !advancedMode}
    <div class="bar-meta">
      <div class="ma-vals">
        <span class="ma-tag" style="color:{chartTheme.ma7}">MA(7) {ma7Val.toLocaleString('en-US',{maximumFractionDigits:1})}</span>
        <span class="ma-tag" style="color:{chartTheme.ma25}">MA(25) {ma25Val.toLocaleString('en-US',{maximumFractionDigits:1})}</span>
        <span class="ma-tag" style="color:{chartTheme.ma99}">MA(99) {ma99Val.toLocaleString('en-US',{maximumFractionDigits:1})}</span>
        <span class="ma-tag">RSI14 {Number.isFinite(rsiVal) ? rsiVal.toFixed(2) : '—'}</span>
        <span class="ma-tag">VOL {formatCompact(latestVolume)}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .chart-bar {
    padding: 3px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: linear-gradient(90deg, #1a1a3a, #0a0a2a);
    font-size: 10px;
    font-family: var(--fm);
    flex-shrink: 0;
  }

  .chart-bar.tv-like {
    background: #131722;
    border-bottom: 1px solid #2a2e39;
    gap: 4px;
  }

  .bar-top.top-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-bottom: 1px;
  }

  .bar-top.top-meta::-webkit-scrollbar {
    height: 2px;
  }

  .bar-top.top-meta::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
  }

  .pair-summary {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    min-width: max-content;
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .pair-name {
    color: rgba(232, 237, 247, 0.92);
    font-family: var(--fd);
    font-size: var(--cp-font-md);
    font-weight: 800;
    letter-spacing: .18px;
  }

  .pair-k {
    color: rgba(187, 198, 216, 0.66);
    font-family: var(--fm);
    font-size: var(--cp-font-2xs);
    font-weight: 700;
    letter-spacing: .42px;
  }

  .pair-last {
    color: #f5f8ff;
    font-family: var(--fd);
    font-size: var(--cp-font-lg);
    font-weight: 900;
    letter-spacing: .18px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .pair-move {
    font-family: var(--fd);
    font-size: var(--cp-font-sm);
    font-weight: 800;
    letter-spacing: .12px;
    font-variant-numeric: tabular-nums;
  }

  .pair-move.up { color: #00ff88; }
  .pair-move.down { color: #ff2d55; }
  .pair-move:not(.up):not(.down) { color: rgba(190, 198, 214, 0.9); }

  .bar-left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: max-content;
    flex: 0 0 auto;
  }

  .pair-slot {
    min-width: 128px;
    flex: 0 1 auto;
  }

  .market-stats {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-bottom: 1px;
  }

  .market-stats::-webkit-scrollbar { height: 2px; }

  .market-stats::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
  }

  .mstat {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    height: auto;
    padding: 0;
    border: 0;
    background: transparent;
    white-space: nowrap;
  }

  .mstat.wide {
    min-width: auto;
  }

  .mstat-k {
    font-family: var(--fm);
    font-size: var(--cp-font-2xs);
    font-weight: 700;
    letter-spacing: .4px;
    color: rgba(187, 198, 216, 0.66);
  }

  .mstat-v {
    font-family: var(--fd);
    font-size: var(--cp-font-md);
    font-weight: 800;
    letter-spacing: .12px;
    color: rgba(255,255,255,.92);
    font-variant-numeric: tabular-nums;
  }

  .bar-tools {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-top: 1px;
    padding-bottom: 1px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .bar-tools::-webkit-scrollbar { height: 2px; }

  .bar-tools::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
  }

  .bar-controls {
    display: flex;
    align-items: center;
    gap: 3px;
    min-width: max-content;
    flex: 0 0 auto;
  }

  .bar-meta {
    display: flex;
    align-items: center;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-bottom: 1px;
  }

  .bar-meta::-webkit-scrollbar { height: 2px; }

  .bar-meta::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
  }

  .live-indicator {
    font-size: var(--cp-font-xs);
    font-weight: 800;
    color: var(--grn);
    display: flex;
    align-items: center;
    gap: 4px;
    letter-spacing: .45px;
  }

  .live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--grn);
    animation: pulse .8s infinite;
  }

  .live-dot.err { background: #ff2d55; }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  .tf-btns {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    flex: 1 1 auto;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 1px;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }

  .tf-btns::-webkit-scrollbar { height: 2px; }

  .tf-btns::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 999px;
  }

  .tf-compact {
    display: none;
    align-items: center;
    gap: 3px;
    margin-left: 1px;
    min-width: max-content;
    flex: 0 0 auto;
  }

  .tf-compact-label {
    color: rgba(187, 198, 216, 0.66);
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .5px;
  }

  .tf-compact-select {
    height: 24px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,.2);
    background: rgba(255,255,255,.06);
    color: rgba(232, 237, 247, 0.92);
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .35px;
    padding: 0 24px 0 8px;
    appearance: none;
    cursor: pointer;
  }

  .tf-compact-select:focus-visible {
    outline: 1px solid rgba(232,150,125,.45);
    outline-offset: 1px;
  }

  .tfbtn {
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.08);
    color: #b8c0cc;
    font-size: var(--cp-font-2xs);
    font-family: var(--fd);
    font-weight: 700;
    letter-spacing: .3px;
    cursor: pointer;
    transition: all .15s;
  }

  .tfbtn:hover { background: rgba(255,255,255,.1); color: #fff; }

  .tfbtn.active { background: rgba(232,150,125,.15); color: #e8967d; border-color: rgba(232,150,125,.3); }

  .ma-vals { display: flex; gap: 8px; flex-wrap: nowrap; white-space: nowrap; }
  .ma-tag { font-size: var(--cp-font-2xs); font-family: var(--fm); font-weight: 700; letter-spacing: .2px; opacity: 1; }

  .mode-toggle { display: flex; gap: 0; border-radius: 6px; overflow: hidden; border: 1px solid rgba(232,150,125,.25); margin-left: 0; }
  .mode-btn { padding: 2px 8px; background: rgba(255,255,255,.03); border: none; color: #b2b9c5; font-size: var(--cp-font-2xs); font-family: var(--fd); font-weight: 800; letter-spacing: .4px; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 2px; white-space: nowrap; }
  .mode-btn:first-child { border-right: 1px solid rgba(232,150,125,.15); }
  .mode-btn:hover { background: rgba(232,150,125,.08); color: #ccc; }
  .mode-btn.active { background: linear-gradient(135deg, rgba(232,150,125,.2), rgba(255,180,0,.15)); color: #e8967d; text-shadow: 0 0 8px rgba(232,150,125,.5); }

  .scan-btn {
    height: 22px;
    padding: 0 8px;
    border-radius: 4px;
    border: 1px solid rgba(232,150,125,.35);
    background: linear-gradient(135deg, rgba(232,150,125,.2), rgba(255,180,0,.12));
    color: #e8967d;
    font-size: var(--cp-font-2xs);
    font-family: var(--fd);
    font-weight: 900;
    letter-spacing: .45px;
    cursor: pointer;
    transition: all .15s;
    white-space: nowrap;
  }

  .scan-btn:hover {
    background: linear-gradient(135deg, rgba(232,150,125,.28), rgba(255,180,0,.18));
    border-color: rgba(232,150,125,.55);
    color: #fff3bf;
    box-shadow: 0 0 10px rgba(232,150,125,.26);
  }

  .scan-btn.chat-trigger {
    border-color: rgba(120, 218, 255, 0.4);
    background: linear-gradient(135deg, rgba(94, 161, 255, 0.34), rgba(94, 161, 255, 0.18));
    color: #d6edff;
  }

  .scan-btn.chat-trigger:hover {
    border-color: rgba(120, 218, 255, 0.62);
    background: linear-gradient(135deg, rgba(94, 161, 255, 0.46), rgba(94, 161, 255, 0.24));
    color: #f0f8ff;
  }

  .scan-btn.chat-trigger.ready {
    border-color: rgba(79, 209, 142, 0.62);
    background: linear-gradient(135deg, rgba(39, 195, 145, 0.38), rgba(39, 195, 145, 0.2));
    color: #dcfff0;
  }

  .scan-btn.chat-trigger.ready:hover {
    border-color: rgba(79, 209, 142, 0.82);
    background: linear-gradient(135deg, rgba(39, 195, 145, 0.5), rgba(39, 195, 145, 0.28));
    color: #f6fff9;
  }

  .scan-btn.pattern-trigger {
    border-color: rgba(255, 140, 160, 0.45);
    background: linear-gradient(135deg, rgba(255, 120, 144, 0.28), rgba(255, 120, 144, 0.12));
    color: #ffdbe2;
  }

  .scan-btn.pattern-trigger:hover {
    border-color: rgba(255, 140, 160, 0.7);
    background: linear-gradient(135deg, rgba(255, 120, 144, 0.4), rgba(255, 120, 144, 0.2));
    color: #fff2f5;
  }

  .opinion-actions { display: flex; align-items: center; gap: 4px; margin-left: 2px; }

  .scan-btn.view-btn.long {
    border-color: rgba(92,212,160,.52);
    background: linear-gradient(135deg, rgba(92,212,160,.3), rgba(92,212,160,.14));
    color: #d9ffe9;
  }

  .scan-btn.view-btn.long:hover {
    border-color: rgba(92,212,160,.78);
    background: linear-gradient(135deg, rgba(92,212,160,.42), rgba(92,212,160,.2));
    color: #f4fff9;
  }

  .scan-btn.view-btn.short {
    border-color: rgba(231,127,144,.55);
    background: linear-gradient(135deg, rgba(231,127,144,.3), rgba(231,127,144,.14));
    color: #ffe4ea;
  }

  .scan-btn.view-btn.short:hover {
    border-color: rgba(231,127,144,.78);
    background: linear-gradient(135deg, rgba(231,127,144,.42), rgba(231,127,144,.2));
    color: #fff5f7;
  }

  .draw-tools { display: flex; gap: 2px; margin-left: 0; padding-left: 0; border-left: none; }
  .draw-btn { width: 22px; height: 19px; border-radius: 4px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); color: #b5bdc9; font-size: var(--cp-font-sm); font-family: monospace; cursor: pointer; transition: all .15s; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }
  .draw-btn:hover { background: rgba(232,150,125,.1); color: #e8967d; border-color: rgba(232,150,125,.3); }
  .draw-btn.active { background: rgba(232,150,125,.2); color: #e8967d; border-color: #e8967d; box-shadow: 0 0 6px rgba(232,150,125,.3); }
  .draw-btn.trade-tool { font-size: 10px; color: #e8967d; border-color: rgba(232,150,125,.25); width: 26px; }
  .draw-btn.trade-tool:hover { background: rgba(232,150,125,.15); color: #f0a88e; border-color: rgba(232,150,125,.45); }
  .draw-btn.trade-tool.active { background: rgba(232,150,125,.2); color: #f5c0a8; border-color: rgba(232,150,125,.6); box-shadow: 0 0 8px rgba(232,150,125,.35); }
  .draw-btn.vis-toggle { font-size: 9px; gap: 2px; width: auto; padding: 0 5px; color: #e8967d; border-color: rgba(232,150,125,.2); }
  .draw-btn.vis-toggle:hover { background: rgba(232,150,125,.1); border-color: rgba(232,150,125,.35); }
  .draw-btn.vis-toggle.off { opacity: 0.35; border-style: dashed; }
  .draw-btn.vis-toggle.off:hover { opacity: 0.7; }
  .vis-count { font-family: var(--fd, monospace); font-size: 9px; color: rgba(232,150,125,.6); }
  .draw-btn.clear-btn:hover { background: rgba(255,45,85,.15); color: #ff2d55; border-color: rgba(255,45,85,.4); }

  .strip-restore-btn {
    border: 1px solid rgba(255,255,255,.22);
    background: rgba(255,255,255,.08);
    color: rgba(255,255,255,.85);
    border-radius: 6px;
    padding: 3px 8px;
    font-family: var(--fd);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .5px;
    cursor: pointer;
    transition: all .15s;
  }

  .strip-restore-btn:hover {
    color: #fff;
    border-color: rgba(232,150,125,.45);
    background: rgba(232,150,125,.16);
  }

  .chart-bar.tv-like .mode-toggle {
    border-color: rgba(255, 255, 255, 0.18);
  }

  .chart-bar.tv-like .mode-btn.active {
    background: rgba(79, 140, 255, 0.2);
    color: #e6f0ff;
    text-shadow: none;
  }

  .chart-bar.tv-like .scan-btn {
    border-color: rgba(255, 255, 255, 0.5);
    background: rgba(79, 140, 255, 0.2);
    color: #e6f0ff;
  }

  .chart-bar.tv-like .scan-btn:hover {
    border-color: rgba(79, 140, 255, 0.6);
    background: rgba(79, 140, 255, 0.3);
    color: #fff;
    box-shadow: none;
  }

  .chart-bar.tv-like .scan-btn.chat-trigger.ready {
    border-color: rgba(38, 166, 154, 0.62);
    background: rgba(38, 166, 154, 0.24);
    color: #d9fffa;
  }

  .chart-bar.tv-like .scan-btn.chat-trigger.ready:hover {
    border-color: rgba(38, 166, 154, 0.8);
    background: rgba(38, 166, 154, 0.33);
    color: #f2ffff;
  }

  .chart-bar.tv-like .scan-btn.view-btn.long {
    border-color: rgba(38,166,154,.7);
    background: rgba(38,166,154,.24);
    color: #e7fffb;
  }

  .chart-bar.tv-like .scan-btn.view-btn.short {
    border-color: rgba(239,83,80,.68);
    background: rgba(239,83,80,.24);
    color: #ffeef0;
  }

  .chart-bar.tv-like .draw-btn.active {
    border-color: rgba(79, 140, 255, 0.8);
    background: rgba(79, 140, 255, 0.24);
    box-shadow: none;
  }

  .chart-bar.tv-like .tfbtn.active {
    color: #e6f0ff;
    border-color: rgba(79, 140, 255, 0.8);
    background: rgba(79, 140, 255, 0.22);
  }

  .chart-bar.tv-like .live-indicator {
    color: #8bd0ff;
  }

  .chart-bar.tv-like .live-dot {
    background: #8bd0ff;
  }

  @media (max-width: 1280px) {
    .pair-last { font-size: clamp(14px, 1.05vw, 16px); }
    .mstat-v { font-size: clamp(10px, 0.72vw, 11px); }
    .tf-btns { display: none; }
    .tf-compact { display: inline-flex; }
  }

  @media (max-width: 768px) {
    .chart-bar { padding: 4px 6px; gap: 3px; }
    .bar-top.top-meta { gap: 6px; }
    .pair-summary { gap: 6px; }
    .pair-k { font-size: 9px; letter-spacing: .42px; }
    .pair-name { font-size: 12px; letter-spacing: .25px; }
    .pair-last { font-size: 14px; }
    .pair-move { font-size: 10px; }
    .market-stats { gap: 6px; }
    .mstat-k { font-size: 9px; letter-spacing: .45px; }
    .mstat-v { font-size: 11px; }
    .bar-left { gap: 4px; }
    .live-indicator { font-size: 10px; letter-spacing: .6px; }
    .pair-slot { min-width: 138px; flex: 0 0 auto; }
    .bar-tools { gap: 4px; }
    .tf-btns { width: auto; flex: 0 0 auto; }
    .tf-compact { margin-left: 0; }
    .tf-compact-select { height: 24px; font-size: 10px; padding: 0 20px 0 7px; }
    .tfbtn { height: 22px; padding: 0 7px; font-size: 9px; letter-spacing: .32px; white-space: nowrap; }
    .bar-controls { gap: 2px; }
    .mode-toggle .mode-btn { min-height: 22px; padding: 0 7px; font-size: 9px; letter-spacing: .3px; }
    .draw-tools .draw-btn { width: 22px; height: 22px; font-size: 9px; }
    .scan-btn { min-height: 22px; height: 22px; padding: 0 7px; font-size: 9px; letter-spacing: .28px; }
    .ma-vals { gap: 6px; }
    .bar-meta { display: none; }
    .opinion-actions { display: none; }
    .pattern-trigger { display: none; }
    .scan-btn { display: none; }
    .scan-btn.chat-trigger { display: none; }
  }
</style>
