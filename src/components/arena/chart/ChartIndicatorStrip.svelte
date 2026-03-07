<script lang="ts">
  import type { IndicatorKey } from '$lib/chart/chartTypes';
  import { formatCompact, formatPrice } from '$lib/chart/chartCoordinates';
  import type { ChartTheme } from '../ChartTheme';

  interface Props {
    chartVisualMode: 'focus' | 'full';
    indicatorStripState: 'expanded' | 'collapsed';
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
    showIndicatorLegend?: boolean;
    enableTradeLineEntry?: boolean;
    isTvLikePreset?: boolean;
    onSetChartVisualMode?: (mode: 'focus' | 'full') => void;
    onToggleIndicator?: (key: IndicatorKey) => void;
    onToggleIndicatorLegend?: () => void;
    onSetIndicatorStripState?: (state: 'expanded' | 'collapsed' | 'hidden') => void;
  }

  let {
    chartVisualMode,
    indicatorStripState,
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
    showIndicatorLegend = false,
    enableTradeLineEntry = false,
    isTvLikePreset = false,
    onSetChartVisualMode = () => {},
    onToggleIndicator = () => {},
    onToggleIndicatorLegend = () => {},
    onSetIndicatorStripState = () => {},
  }: Props = $props();
</script>

<div
  class="indicator-strip"
  class:collapsed={indicatorStripState === 'collapsed'}
  class:tv-like={isTvLikePreset}
>
  {#if indicatorStripState === 'expanded'}
    <div class="view-mode">
      <button class="view-chip" class:on={chartVisualMode === 'focus'} onclick={() => onSetChartVisualMode('focus')}>FOCUS</button>
      <button class="view-chip" class:on={chartVisualMode === 'full'} onclick={() => onSetChartVisualMode('full')}>FULL</button>
    </div>
    <button class="ind-chip" class:on={indicatorEnabled.ma20} onclick={() => onToggleIndicator('ma20')} style="--ind-color:{chartTheme.ma20}">
      MA20 <span>{formatPrice(ma20Val)}</span>
    </button>
    <button class="ind-chip" class:on={indicatorEnabled.ma60} onclick={() => onToggleIndicator('ma60')} style="--ind-color:{chartTheme.ma60}">
      MA60 <span>{formatPrice(ma60Val)}</span>
    </button>
    <button class="ind-chip optional" class:on={indicatorEnabled.ma120} onclick={() => onToggleIndicator('ma120')} style="--ind-color:{chartTheme.ma120}">
      MA120 <span>{formatPrice(ma120Val)}</span>
    </button>
    {#if chartVisualMode === 'full'}
      <button class="ind-chip muted" class:on={indicatorEnabled.ma7} onclick={() => onToggleIndicator('ma7')} style="--ind-color:{chartTheme.ma7}">
        MA7
      </button>
      <button class="ind-chip muted" class:on={indicatorEnabled.ma25} onclick={() => onToggleIndicator('ma25')} style="--ind-color:{chartTheme.ma25}">
        MA25
      </button>
      <button class="ind-chip muted" class:on={indicatorEnabled.ma99} onclick={() => onToggleIndicator('ma99')} style="--ind-color:{chartTheme.ma99}">
        MA99
      </button>
    {/if}
    <button class="ind-chip" class:on={indicatorEnabled.bb} onclick={() => onToggleIndicator('bb')} style="--ind-color:{chartTheme.bbUpper}">
      BB
    </button>
    <button class="ind-chip" class:on={indicatorEnabled.rsi} onclick={() => onToggleIndicator('rsi')} style="--ind-color:{chartTheme.rsi}">
      RSI14 <span>{Number.isFinite(rsiVal) && rsiVal > 0 ? rsiVal.toFixed(2) : '—'}</span>
    </button>
    <button class="ind-chip" class:on={indicatorEnabled.macd} onclick={() => onToggleIndicator('macd')} style="--ind-color:{chartTheme.macdLine}">
      MACD
    </button>
    <button class="ind-chip" class:on={indicatorEnabled.stoch} onclick={() => onToggleIndicator('stoch')} style="--ind-color:{chartTheme.stochK}">
      STOCH
    </button>
    <button class="ind-chip" class:on={indicatorEnabled.vol} onclick={() => onToggleIndicator('vol')} style="--ind-color:{chartTheme.candleUp}">
      VOL <span>{formatCompact(latestVolume)}</span>
    </button>
    <button class="legend-chip" class:on={showIndicatorLegend} onclick={onToggleIndicatorLegend}>LABELS</button>
    <button class="legend-chip" onclick={() => onSetIndicatorStripState('collapsed')}>접기</button>
    <button class="legend-chip danger" onclick={() => onSetIndicatorStripState('hidden')}>끄기</button>
    {#if enableTradeLineEntry}
      <span class="ind-hint">L/S drag · +/- zoom · 0 reset</span>
    {/if}
  {:else}
    <div class="collapsed-summary">
      <span class="sum-title">INDICATORS</span>
      <span class="sum-item">MA20 {formatPrice(ma20Val)}</span>
      <span class="sum-item">MA60 {formatPrice(ma60Val)}</span>
      <span class="sum-item optional">MA120 {formatPrice(ma120Val)}</span>
      <span class="sum-item">RSI14 {Number.isFinite(rsiVal) && rsiVal > 0 ? rsiVal.toFixed(2) : '—'}</span>
      <span class="sum-item">VOL {formatCompact(latestVolume)}</span>
    </div>
    {#if !isTvLikePreset}
      <div class="strip-actions">
        <button class="legend-chip" class:on={showIndicatorLegend} onclick={onToggleIndicatorLegend}>LABELS</button>
        <button class="legend-chip" onclick={() => onSetIndicatorStripState('expanded')}>펴기</button>
        <button class="legend-chip danger" onclick={() => onSetIndicatorStripState('hidden')}>끄기</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .indicator-strip {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-bottom: 1px solid rgba(255,255,255,.06);
    background: rgba(255,255,255,.03);
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    resize: none;
  }

  .indicator-strip.tv-like {
    border-bottom-color: #2a2e39;
    background: #131722;
  }

  .indicator-strip.collapsed {
    justify-content: flex-start;
    gap: 6px;
  }

  .collapsed-summary {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    flex: 1 1 auto;
    flex-wrap: nowrap;
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-bottom: 1px;
  }

  .sum-title {
    font-family: var(--fd);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .8px;
    color: rgba(255,255,255,.92);
  }

  .sum-item {
    font-family: var(--fm);
    font-size: 9px;
    color: rgba(255,255,255,.74);
    letter-spacing: .25px;
    white-space: nowrap;
  }

  .strip-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 0;
    flex: 0 0 auto;
  }

  .view-mode {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-right: 2px;
    padding-right: 6px;
    border-right: 1px solid rgba(255,255,255,.12);
  }

  .view-chip {
    border: 1px solid rgba(255,255,255,.16);
    background: rgba(255,255,255,.04);
    color: rgba(255,255,255,.78);
    border-radius: 10px;
    padding: 2px 8px;
    font-family: var(--fd);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .5px;
    cursor: pointer;
    transition: all .15s;
  }

  .view-chip.on {
    color: #fff;
    border-color: rgba(232,150,125,.6);
    background: rgba(232,150,125,.16);
    box-shadow: 0 0 8px rgba(232,150,125,.22);
  }

  .view-chip:hover {
    border-color: rgba(255,255,255,.32);
    color: #fff;
  }

  .ind-chip {
    --ind-color: #888;
    border: 1px solid rgba(255,255,255,.15);
    background: rgba(255,255,255,.05);
    color: rgba(255,255,255,.74);
    border-radius: 12px;
    padding: 2px 7px;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .3px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all .15s;
  }

  .ind-chip span {
    color: var(--ind-color);
    font-weight: 900;
  }

  .ind-chip.on {
    color: rgba(255,255,255,.95);
    border-color: var(--ind-color);
    background: rgba(255,255,255,.12);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
  }

  .ind-chip.muted {
    opacity: .72;
  }

  .ind-chip.optional {
    opacity: .88;
  }

  .ind-chip:hover {
    color: #fff;
    border-color: rgba(255,255,255,.24);
  }

  .ind-hint {
    margin-left: auto;
    font-family: var(--fm);
    font-size: 9px;
    color: rgba(255,255,255,.58);
    letter-spacing: .4px;
  }

  .legend-chip {
    border: 1px solid rgba(255,255,255,.2);
    background: rgba(255,255,255,.04);
    color: rgba(255,255,255,.78);
    border-radius: 10px;
    padding: 2px 7px;
    font-family: var(--fd);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .5px;
    cursor: pointer;
    transition: all .15s;
  }

  .legend-chip.on {
    color: #f5c4b8;
    border-color: rgba(232,150,125,.45);
    background: rgba(232,150,125,.14);
  }

  .legend-chip.danger {
    color: rgba(255,165,165,.85);
    border-color: rgba(255,120,120,.32);
  }

  .legend-chip.danger:hover {
    color: #ffd0d0;
    border-color: rgba(255,120,120,.55);
    background: rgba(255,70,70,.14);
  }

  .legend-chip:hover {
    color: #fff;
    border-color: rgba(255,255,255,.36);
  }

  @media (max-width: 1280px) {
    .ind-hint {
      display: none;
    }

    .ind-chip.optional {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .sum-title {
      display: none;
    }

    .sum-item.optional {
      display: none;
    }
  }
</style>
