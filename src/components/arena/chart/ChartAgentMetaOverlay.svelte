<script lang="ts">
  import { formatCompact, formatPrice } from '$lib/chart/chartCoordinates';
  import type { ChartAgentMetaOverlayProps } from './chartAgentOverlayChromeContracts';

  type LegendEntry = {
    key: string;
    color: string;
    label: string;
    value: string;
  };

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
    onZoomOut = () => {},
    onZoomIn = () => {},
    onFitRange = () => {},
    onToggleAutoScaleY = () => {},
    onResetScale = () => {},
  }: ChartAgentMetaOverlayProps = $props();

  const legendEntries = $derived.by(() => {
    const entries: LegendEntry[] = [];

    if (indicatorEnabled.ma20) {
      entries.push({
        key: 'ma20',
        color: chartTheme.ma20,
        label: 'MA20',
        value: ma20Val > 0 ? formatPrice(ma20Val) : '—',
      });
    }
    if (indicatorEnabled.ma60) {
      entries.push({
        key: 'ma60',
        color: chartTheme.ma60,
        label: 'MA60',
        value: ma60Val > 0 ? formatPrice(ma60Val) : '—',
      });
    }
    if (indicatorEnabled.ma120) {
      entries.push({
        key: 'ma120',
        color: chartTheme.ma120,
        label: 'MA120',
        value: ma120Val > 0 ? formatPrice(ma120Val) : '—',
      });
    }
    if (indicatorEnabled.ma7) {
      entries.push({
        key: 'ma7',
        color: chartTheme.ma7,
        label: 'MA7',
        value: ma7Val > 0 ? formatPrice(ma7Val) : '—',
      });
    }
    if (indicatorEnabled.ma25) {
      entries.push({
        key: 'ma25',
        color: chartTheme.ma25,
        label: 'MA25',
        value: ma25Val > 0 ? formatPrice(ma25Val) : '—',
      });
    }
    if (indicatorEnabled.ma99) {
      entries.push({
        key: 'ma99',
        color: chartTheme.ma99,
        label: 'MA99',
        value: ma99Val > 0 ? formatPrice(ma99Val) : '—',
      });
    }
    if (indicatorEnabled.rsi) {
      entries.push({
        key: 'rsi',
        color: chartTheme.rsi,
        label: 'RSI14(상대강도지수)',
        value: rsiVal > 0 ? rsiVal.toFixed(2) : '—',
      });
    }
    if (indicatorEnabled.vol) {
      entries.push({
        key: 'vol',
        color: chartTheme.candleUp,
        label: 'VOL(거래량)',
        value: latestVolume > 0 ? formatCompact(latestVolume) : '—',
      });
    }

    return entries;
  });
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

{#if advancedMode && showIndicatorLegend && legendEntries.length > 0}
  <div class="indicator-legend">
    {#each legendEntries as entry (entry.key)}
      <span class="legend-item" style="--legend-color:{entry.color}">{entry.label} {entry.value}</span>
    {/each}
  </div>
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
  }
</style>
