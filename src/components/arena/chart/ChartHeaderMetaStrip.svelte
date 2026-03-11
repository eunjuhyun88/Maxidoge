<script lang="ts">
  import { formatCompact } from '$lib/chart/chartCoordinates';
  import type { ChartHeaderMetaStripProps } from './chartHeaderBarContracts';

  let {
    chartMode,
    advancedMode = false,
    klineCount = 0,
    ma7Val,
    ma25Val,
    ma99Val,
    rsiVal,
    latestVolume,
    chartTheme,
  }: ChartHeaderMetaStripProps = $props();
</script>

{#if chartMode === 'agent' && klineCount > 0 && !advancedMode}
  <div class="bar-meta">
    <div class="ma-vals">
      <span class="ma-tag" style="color:{chartTheme.ma7}">MA(7) {ma7Val.toLocaleString('en-US', { maximumFractionDigits: 1 })}</span>
      <span class="ma-tag" style="color:{chartTheme.ma25}">MA(25) {ma25Val.toLocaleString('en-US', { maximumFractionDigits: 1 })}</span>
      <span class="ma-tag" style="color:{chartTheme.ma99}">MA(99) {ma99Val.toLocaleString('en-US', { maximumFractionDigits: 1 })}</span>
      <span class="ma-tag">RSI14 {Number.isFinite(rsiVal) ? rsiVal.toFixed(2) : '—'}</span>
      <span class="ma-tag">VOL {formatCompact(latestVolume)}</span>
    </div>
  </div>
{/if}

<style>
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

  .bar-meta::-webkit-scrollbar {
    height: 2px;
  }

  .bar-meta::-webkit-scrollbar-thumb {
    background: #363a45;
    border-radius: 999px;
  }

  .ma-vals {
    display: flex;
    gap: 10px;
    flex-wrap: nowrap;
    white-space: nowrap;
  }

  .ma-tag {
    font-size: 10px;
    font-family: var(--fm);
    font-weight: 400;
    letter-spacing: 0;
  }

  @media (max-width: 768px) {
    .bar-meta {
      display: none;
    }
  }
</style>
