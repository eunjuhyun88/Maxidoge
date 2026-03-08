<script lang="ts">
  import TokenDropdown from '../../shared/TokenDropdown.svelte';
  import { formatCompact, formatPrice } from '$lib/chart/chartCoordinates';
  import { CORE_TIMEFRAME_OPTIONS, normalizeTimeframe } from '$lib/utils/timeframe';
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
    chatFirstMode?: boolean;
    chatTradeReady?: boolean;
    chatTradeDir?: 'LONG' | 'SHORT';
    indicatorStripState?: 'expanded' | 'collapsed' | 'hidden';
    drawingMode: DrawingMode;
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
    chatFirstMode = false,
    chatTradeReady = false,
    chatTradeDir = 'LONG',
    indicatorStripState = 'collapsed',
    drawingMode,
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
    onRequestChatAssist = () => {},
    onRequestAgentScan = () => {},
    onForcePatternScan = () => {},
    onPublishCommunitySignal = () => {},
    onRestoreIndicatorStrip = () => {},
  }: Props = $props();
</script>

<div class="chart-bar" class:tv-like={isTvLikePreset}>
  <div class="bar-tools">
    <div class="bar-left">
      {#if chartMode === 'agent'}
        <div class="pair-slot">
          <TokenDropdown value={pair} compact={true} onSelect={(detail) => onChangePair(detail.pair)} />
        </div>
      {:else}
        <span class="pair-name-inline">{pairBaseLabel}/{pairQuoteLabel}</span>
      {/if}

      <div class="price-inline" role="group" aria-label="Price summary">
        <span class="price-val">${formatPrice(livePrice)}</span>
        <span class="price-chg" class:up={priceChange24h >= 0} class:down={priceChange24h < 0}>
          {priceChange24h >= 0 ? '+' : '-'}{Math.abs(priceChange24h).toFixed(2)}%
        </span>
        <div class="market-stats-tooltip">
          <div class="mstat">
            <span class="mstat-k">24H LOW</span>
            <span class="mstat-v">{low24h > 0 ? formatPrice(low24h) : '—'}</span>
          </div>
          <div class="mstat">
            <span class="mstat-k">24H HIGH</span>
            <span class="mstat-v">{high24h > 0 ? formatPrice(high24h) : '—'}</span>
          </div>
          <div class="mstat">
            <span class="mstat-k">VOL</span>
            <span class="mstat-v">{quoteVolume24h > 0 ? formatCompact(quoteVolume24h) : '—'}</span>
          </div>
        </div>
      </div>

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
            class:ready={hasActiveTradeSetup}
            onclick={() => {
              if (hasActiveTradeSetup) {
                onPublishCommunitySignal('LONG');
              } else {
                onSetDrawingMode('trade');
              }
            }}
            title={hasActiveTradeSetup ? 'LONG 시그널 공유' : '먼저 차트에 포지션을 그리세요 (⬡ 도구)'}
          >
            ▲ LONG 공유
          </button>
          <button
            class="scan-btn view-btn short"
            class:ready={hasActiveTradeSetup}
            onclick={() => {
              if (hasActiveTradeSetup) {
                onPublishCommunitySignal('SHORT');
              } else {
                onSetDrawingMode('trade');
              }
            }}
            title={hasActiveTradeSetup ? 'SHORT 시그널 공유' : '먼저 차트에 포지션을 그리세요 (⬡ 도구)'}
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
  /* ━━ TradingView-flat design: no gradients, no glows, solid colors ━━ */
  .chart-bar {
    padding: 0 8px;
    border-bottom: 1px solid #2a2e39;
    display: flex;
    flex-direction: column;
    gap: 0;
    background: #131722;
    font-size: 11px;
    font-family: var(--fm);
    flex-shrink: 0;
  }

  .chart-bar.tv-like {
    background: #131722;
    border-bottom: 1px solid #2a2e39;
  }

  /* ── Pair name inline (trading mode) ── */
  .pair-name-inline {
    color: #d1d4dc;
    font-family: var(--fd);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0;
    white-space: nowrap;
  }

  /* ── Price inline ── */
  .price-inline {
    position: relative;
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    min-width: max-content;
    flex: 0 0 auto;
    cursor: default;
    padding: 0 0 0 8px;
    border-left: 1px solid #363a45;
    margin-left: 4px;
  }

  .price-val {
    color: #d1d4dc;
    font-family: var(--fd);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .price-chg {
    font-family: var(--fd);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }
  .price-chg.up { color: #26a69a; }
  .price-chg.down { color: #ef5350; }
  .price-chg:not(.up):not(.down) { color: #787b86; }

  /* ── 24H stats tooltip (hover) ── */
  .market-stats-tooltip {
    display: none;
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    padding: 8px 12px;
    background: #1e222d;
    border: 1px solid #363a45;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 50;
    white-space: nowrap;
    gap: 12px;
  }
  .price-inline:hover .market-stats-tooltip {
    display: flex;
  }

  .mstat {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    white-space: nowrap;
  }
  .mstat-k {
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 400;
    letter-spacing: .3px;
    color: #787b86;
  }
  .mstat-v {
    font-family: var(--fd);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0;
    color: #d1d4dc;
    font-variant-numeric: tabular-nums;
  }

  .bar-left {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: max-content;
    flex: 0 0 auto;
  }

  .pair-slot {
    min-width: 100px;
    flex: 0 1 auto;
  }

  .bar-tools {
    display: flex;
    align-items: center;
    gap: 0;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding: 4px 0;
  }

  .bar-tools::-webkit-scrollbar { height: 3px; }

  .bar-tools::-webkit-scrollbar-thumb {
    background: #363a45;
    border-radius: 999px;
  }

  .bar-controls {
    display: flex;
    align-items: center;
    gap: 2px;
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
    padding: 2px 0 3px;
    border-top: 1px solid #2a2e39;
  }

  .bar-meta::-webkit-scrollbar { height: 2px; }

  .bar-meta::-webkit-scrollbar-thumb {
    background: #363a45;
    border-radius: 999px;
  }

  /* ── Dividers between groups ── */
  .tf-btns,
  .bar-controls {
    padding-left: 8px;
    margin-left: 8px;
    border-left: 1px solid #363a45;
  }

  .tf-btns {
    display: flex;
    align-items: center;
    gap: 1px;
    min-width: 0;
    flex: 0 0 auto;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }

  .tf-btns::-webkit-scrollbar { height: 2px; }

  .tf-btns::-webkit-scrollbar-thumb {
    background: #363a45;
    border-radius: 999px;
  }

  .tf-compact {
    display: none;
    align-items: center;
    gap: 4px;
    padding-left: 8px;
    margin-left: 8px;
    border-left: 1px solid #363a45;
    min-width: max-content;
    flex: 0 0 auto;
  }

  .tf-compact-label {
    color: #787b86;
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 400;
  }

  .tf-compact-select {
    height: 22px;
    border-radius: 4px;
    border: 1px solid #363a45;
    background: transparent;
    color: #d1d4dc;
    font-family: var(--fd);
    font-size: 11px;
    font-weight: 700;
    padding: 0 22px 0 6px;
    appearance: none;
    cursor: pointer;
  }

  .tf-compact-select:hover {
    border-color: #4a4e59;
  }

  .tf-compact-select:focus-visible {
    outline: 1px solid #2962ff;
    outline-offset: 0;
  }

  /* ── TF buttons (TradingView style: no border, flat) ── */
  .tfbtn {
    padding: 0 6px;
    height: 28px;
    border-radius: 4px;
    background: transparent;
    border: none;
    color: #787b86;
    font-size: 11px;
    font-family: var(--fd);
    font-weight: 700;
    letter-spacing: 0;
    cursor: pointer;
    transition: color .1s, background .1s;
  }

  .tfbtn:hover { background: rgba(255,255,255,.06); color: #d1d4dc; }

  .tfbtn.active { color: #d1d4dc; background: rgba(255,255,255,.08); }

  .ma-vals { display: flex; gap: 10px; flex-wrap: nowrap; white-space: nowrap; }
  .ma-tag { font-size: 10px; font-family: var(--fm); font-weight: 400; letter-spacing: 0; }

  /* ── Mode toggle (flat, clean) ── */
  .mode-toggle { display: flex; gap: 0; border-radius: 4px; overflow: hidden; border: 1px solid #363a45; }
  .mode-btn {
    padding: 0 8px;
    height: 22px;
    background: transparent;
    border: none;
    color: #787b86;
    font-size: 11px;
    font-family: var(--fd);
    font-weight: 700;
    cursor: pointer;
    transition: color .1s, background .1s;
    display: flex;
    align-items: center;
    white-space: nowrap;
  }
  .mode-btn:first-child { border-right: 1px solid #363a45; }
  .mode-btn:hover { background: rgba(255,255,255,.06); color: #d1d4dc; }
  .mode-btn.active { background: rgba(41, 98, 255, 0.12); color: #5b9cf6; }

  /* ── Action buttons (flat, consistent) ── */
  .scan-btn {
    height: 22px;
    padding: 0 8px;
    border-radius: 4px;
    border: 1px solid #363a45;
    background: transparent;
    color: #d1d4dc;
    font-size: 11px;
    font-family: var(--fd);
    font-weight: 700;
    cursor: pointer;
    transition: color .1s, background .1s, border-color .1s;
    white-space: nowrap;
  }

  .scan-btn:hover {
    background: rgba(255,255,255,.06);
    border-color: #4a4e59;
    color: #e6e6e6;
  }

  .scan-btn.chat-trigger {
    border-color: rgba(41, 98, 255, 0.4);
    color: #5b9cf6;
  }

  .scan-btn.chat-trigger:hover {
    border-color: rgba(41, 98, 255, 0.6);
    background: rgba(41, 98, 255, 0.1);
    color: #93bbfc;
  }

  .scan-btn.chat-trigger.ready {
    border-color: rgba(38, 166, 154, 0.5);
    color: #26a69a;
  }

  .scan-btn.chat-trigger.ready:hover {
    border-color: rgba(38, 166, 154, 0.7);
    background: rgba(38, 166, 154, 0.1);
    color: #4db6ac;
  }

  .scan-btn.pattern-trigger {
    color: #787b86;
  }

  .scan-btn.pattern-trigger:hover {
    color: #d1d4dc;
  }

  .opinion-actions { display: flex; align-items: center; gap: 2px; }

  .scan-btn.view-btn:not(.ready) {
    color: #787b86;
    border-style: dashed;
    border-color: #363a45;
  }
  .scan-btn.view-btn:not(.ready):hover {
    color: #d1d4dc;
    border-color: #4a4e59;
  }

  .scan-btn.view-btn.long {
    border-color: rgba(38, 166, 154, 0.5);
    color: #26a69a;
  }

  .scan-btn.view-btn.long:hover {
    border-color: rgba(38, 166, 154, 0.7);
    background: rgba(38, 166, 154, 0.08);
    color: #4db6ac;
  }

  .scan-btn.view-btn.short {
    border-color: rgba(239, 83, 80, 0.5);
    color: #ef5350;
  }

  .scan-btn.view-btn.short:hover {
    border-color: rgba(239, 83, 80, 0.7);
    background: rgba(239, 83, 80, 0.08);
    color: #f77c7a;
  }

  .strip-restore-btn {
    border: 1px solid #363a45;
    background: transparent;
    color: #787b86;
    border-radius: 4px;
    padding: 0 6px;
    height: 22px;
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: color .1s, background .1s;
    display: flex;
    align-items: center;
  }

  .strip-restore-btn:hover {
    color: #d1d4dc;
    background: rgba(255,255,255,.06);
  }

  /* ── tv-like overrides (minimal since base is already TV-flat) ── */
  .chart-bar.tv-like .mode-btn.active {
    background: rgba(41, 98, 255, 0.12);
    color: #5b9cf6;
  }

  .chart-bar.tv-like .scan-btn.view-btn.long {
    border-color: rgba(38,166,154,.5);
    color: #26a69a;
  }

  .chart-bar.tv-like .scan-btn.view-btn.short {
    border-color: rgba(239,83,80,.5);
    color: #ef5350;
  }

  /* ━━ Responsive ━━ */
  @media (max-width: 1280px) {
    .price-val { font-size: clamp(11px, 0.85vw, 13px); }
    .tf-btns { display: none; }
    .tf-compact { display: inline-flex; }
    .pattern-trigger { display: none; }
    .scan-btn { padding: 0 6px; }
    .opinion-actions .scan-btn { padding: 0 5px; font-size: 10px; }
  }

  @media (max-width: 1024px) {
    .opinion-actions { display: none; }
    .mode-btn { padding: 0 5px; font-size: 10px; }
    .bar-controls { gap: 2px; }
  }

  @media (max-width: 768px) {
    .chart-bar { padding: 0 6px; }
    .price-val { font-size: 11px; }
    .price-chg { font-size: 10px; }
    .price-inline { gap: 4px; padding-left: 6px; }
    .pair-name-inline { font-size: 11px; }
    .bar-left { gap: 4px; }
    .pair-slot { min-width: 120px; flex: 0 0 auto; }
    .bar-tools { gap: 0; }
    .tf-compact { margin-left: 6px; padding-left: 6px; }
    .bar-controls { margin-left: 6px; padding-left: 6px; gap: 2px; }
    .tfbtn { height: 26px; padding: 0 5px; font-size: 10px; }
    .mode-btn { height: 20px; padding: 0 6px; font-size: 10px; }
    .scan-btn { height: 20px; padding: 0 6px; font-size: 10px; }
    .bar-meta { display: none; }
    .opinion-actions { display: none; }
    .pattern-trigger { display: none; }
    .scan-btn:not(.chat-trigger) { display: none; }
    .scan-btn.chat-trigger { display: flex; align-items: center; }
    .market-stats-tooltip { display: none !important; }
  }
</style>
