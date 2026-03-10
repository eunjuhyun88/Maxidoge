<script lang="ts">
  import TokenDropdown from '../../shared/TokenDropdown.svelte';
  import { formatCompact, formatPrice } from '$lib/chart/chartCoordinates';
  import { CORE_TIMEFRAME_OPTIONS, normalizeTimeframe } from '$lib/utils/timeframe';
  import type { ChartHeaderSummaryProps } from './chartHeaderBarContracts';

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
    onChangePair = () => {},
    onChangeTimeframe = () => {},
  }: ChartHeaderSummaryProps = $props();
</script>

<div class="bar-left">
  {#if chartMode === 'agent'}
    <div class="pair-slot">
      <TokenDropdown value={pair} compact={true} onSelect={(detail) => onChangePair(detail.pair)} />
    </div>
  {:else}
    <span class="pair-name-inline">{pairBaseLabel}/{pairQuoteLabel}</span>
  {/if}

  <div class="price-inline" role="group" aria-label="Price summary">
    <span class="source-tag mkt">MKT</span>
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

<style>
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

  .pair-name-inline {
    color: #d1d4dc;
    font-family: var(--fd);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0;
    white-space: nowrap;
  }

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

  .source-tag {
    font-family: var(--fd);
    font-size: 6px;
    font-weight: 900;
    letter-spacing: 0.5px;
    line-height: 1;
    padding: 1px 3px;
    border-radius: 2px;
    vertical-align: middle;
    user-select: none;
  }

  .source-tag.mkt {
    color: #787b86;
    background: rgba(120, 123, 134, 0.14);
    border: 1px solid rgba(120, 123, 134, 0.25);
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

  .price-chg.up {
    color: #26a69a;
  }

  .price-chg.down {
    color: #ef5350;
  }

  .price-chg:not(.up):not(.down) {
    color: #787b86;
  }

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
    letter-spacing: 0.3px;
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
    padding-left: 8px;
    margin-left: 8px;
    border-left: 1px solid #363a45;
  }

  .tf-btns::-webkit-scrollbar {
    height: 2px;
  }

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
    transition: color 0.1s, background 0.1s;
  }

  .tfbtn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #d1d4dc;
  }

  .tfbtn.active {
    color: #d1d4dc;
    background: rgba(255, 255, 255, 0.08);
  }

  @media (max-width: 1280px) {
    .price-val {
      font-size: clamp(11px, 0.85vw, 13px);
    }

    .tf-btns {
      display: none;
    }

    .tf-compact {
      display: inline-flex;
    }
  }

  @media (max-width: 768px) {
    .price-val {
      font-size: 11px;
    }

    .price-chg {
      font-size: 10px;
    }

    .price-inline {
      gap: 4px;
      padding-left: 6px;
    }

    .pair-name-inline {
      font-size: 11px;
    }

    .bar-left {
      gap: 4px;
    }

    .pair-slot {
      min-width: 120px;
      flex: 0 0 auto;
    }

    .tf-compact {
      margin-left: 6px;
      padding-left: 6px;
    }

    .tfbtn {
      height: 26px;
      padding: 0 5px;
      font-size: 10px;
    }

    .market-stats-tooltip {
      display: none !important;
    }
  }
</style>
