<script lang="ts">
  import { fetchMarketPulse, type MarketPulseData } from '$lib/api/marketPulse';
  import { heatScoreColor } from '$lib/engine/marketHeatScore';
  import { regimeColor, regimeIcon, actionBiasLabel } from '$lib/engine/macroRegime';

  interface Props {
    pair?: string;
    compact?: boolean;
  }

  let { pair = 'BTC/USDT', compact = false }: Props = $props();

  let pulseData: MarketPulseData | null = $state(null);
  let loading = $state(false);
  let expanded = $state(false);
  let fetchTimer: ReturnType<typeof setInterval> | null = null;
  let refreshToken = 0;

  async function refresh(force = false) {
    const token = ++refreshToken;
    loading = true;
    try {
      const next = await fetchMarketPulse(pair, force);
      if (token !== refreshToken) return;
      pulseData = next;
    } catch {
      // silent
    } finally {
      if (token === refreshToken) {
        loading = false;
      }
    }
  }

  $effect(() => {
    // Re-fetch when pair changes
    void pair;
    expanded = false;
    void refresh();
    // Auto-refresh every 3 min
    if (fetchTimer) clearInterval(fetchTimer);
    fetchTimer = setInterval(() => {
      void refresh(true);
    }, 3 * 60 * 1000);
    return () => {
      refreshToken += 1;
      if (fetchTimer) clearInterval(fetchTimer);
    };
  });
</script>

{#if pulseData}
  {@const heat = pulseData.heatScore}
  {@const regime = pulseData.macroRegime}
  {@const hColor = heatScoreColor(heat.score)}
  {@const rColor = regimeColor(regime.regime)}

  <div class="pulse-badge" class:compact class:expanded>
    <!-- Heat Score Pill -->
    <button
      class="pulse-pill heat"
      style="--pill-color: {hColor}"
      onclick={() => expanded = !expanded}
      aria-pressed={expanded}
      title={heat.summary}
    >
      <span class="pill-label">HEAT</span>
      <span class="pill-value" style="color: {hColor}">{heat.score}</span>
    </button>

    <!-- Regime Pill -->
    <button
      class="pulse-pill regime"
      style="--pill-color: {rColor}"
      onclick={() => expanded = !expanded}
      aria-pressed={expanded}
      title={regime.summary}
    >
      <span class="pill-icon">{regimeIcon(regime.regime)}</span>
      <span class="pill-value" style="color: {rColor}">{regime.regime.replace('_', ' ')}</span>
    </button>

    <!-- Action Bias -->
    {#if !compact}
      <span class="action-bias" style="color: {rColor}">{actionBiasLabel(regime.actionBias)}</span>
    {/if}

    <!-- Expanded Details -->
    {#if expanded}
      <div class="pulse-detail">
        <div class="detail-section">
          <div class="detail-title" style="color: {hColor}">Heat Score {heat.score}/100 — {heat.zone}</div>
          {#each heat.components as comp}
            {#if comp.value != null || comp.name === 'liqImbalance'}
              <div class="detail-row">
                <span class="detail-name">{comp.label}</span>
                <div class="detail-bar-wrap">
                  <div
                    class="detail-bar"
                    style="width: {comp.score}%; background: {heatScoreColor(comp.score)}"
                  ></div>
                </div>
                <span class="detail-score">{comp.score}</span>
              </div>
            {/if}
          {/each}
        </div>
        <div class="detail-section">
          <div class="detail-title" style="color: {rColor}">{regimeIcon(regime.regime)} {regime.regime} (신뢰도 {regime.confidence}%)</div>
          {#each regime.components as comp}
            {#if comp.strength > 0}
              <div class="detail-row">
                <span class="detail-name">{comp.label}</span>
                <span class="detail-signal" class:bullish={comp.signal === 'BULLISH'} class:bearish={comp.signal === 'BEARISH'}>
                  {comp.signal}
                </span>
              </div>
            {/if}
          {/each}
        </div>
        <div class="detail-section">
          <div class="detail-title">Raw Data</div>
          <div class="detail-grid">
            {#if pulseData.raw.fearGreed != null}
              <span class="raw-item">F&G: {pulseData.raw.fearGreed}</span>
            {/if}
            {#if pulseData.raw.mvrv != null}
              <span class="raw-item">MVRV: {pulseData.raw.mvrv.toFixed(2)}</span>
            {/if}
            {#if pulseData.raw.fundingRate != null}
              <span class="raw-item">FR: {(pulseData.raw.fundingRate * 100).toFixed(4)}%</span>
            {/if}
            {#if pulseData.raw.lsRatio != null}
              <span class="raw-item">L/S: {pulseData.raw.lsRatio.toFixed(2)}</span>
            {/if}
            {#if pulseData.raw.dxy}
              <span class="raw-item">DXY: {pulseData.raw.dxy.price.toFixed(2)}</span>
            {/if}
          </div>
        </div>
        <div class="detail-action" style="color: {rColor}">
          Action Bias: {actionBiasLabel(regime.actionBias)}
        </div>
      </div>
    {/if}
  </div>
{:else if loading}
  <div class="pulse-badge loading">
    <span class="pulse-loading">PULSE...</span>
  </div>
{/if}

<style>
  .pulse-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    position: relative;
    flex-shrink: 0;
  }

  .pulse-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    border: 1px solid rgba(255,255,255,.15);
    background: rgba(255,255,255,.05);
    border-radius: 10px;
    padding: 2px 7px;
    cursor: pointer;
    transition: all .15s;
    font-family: var(--fm, 'JetBrains Mono', monospace);
  }

  .pulse-pill:hover {
    border-color: var(--pill-color, rgba(255,255,255,.3));
    background: rgba(255,255,255,.1);
  }

  .pill-label {
    font-size: 8px;
    font-weight: 900;
    letter-spacing: .6px;
    color: rgba(255,255,255,.6);
  }

  .pill-value {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .3px;
  }

  .pill-icon {
    font-size: 10px;
    line-height: 1;
  }

  .action-bias {
    font-family: var(--fd, sans-serif);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .5px;
    opacity: .85;
  }

  .pulse-loading {
    font-family: var(--fm, monospace);
    font-size: 9px;
    color: rgba(255,255,255,.4);
    letter-spacing: .5px;
  }

  /* ── Expanded Detail Panel ── */
  .pulse-detail {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 100;
    background: rgba(10,10,26,.96);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 8px;
    padding: 10px 12px;
    min-width: 300px;
    max-width: 380px;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0,0,0,.5);
  }

  .detail-section {
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255,255,255,.06);
  }

  .detail-section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .detail-title {
    font-family: var(--fd, sans-serif);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .6px;
    margin-bottom: 5px;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
  }

  .detail-name {
    font-family: var(--fm, monospace);
    font-size: 9px;
    color: rgba(255,255,255,.7);
    min-width: 80px;
    flex-shrink: 0;
  }

  .detail-bar-wrap {
    flex: 1;
    height: 4px;
    background: rgba(255,255,255,.06);
    border-radius: 2px;
    overflow: hidden;
  }

  .detail-bar {
    height: 100%;
    border-radius: 2px;
    transition: width .3s ease;
  }

  .detail-score {
    font-family: var(--fm, monospace);
    font-size: 9px;
    font-weight: 700;
    color: rgba(255,255,255,.85);
    min-width: 20px;
    text-align: right;
  }

  .detail-signal {
    font-family: var(--fd, sans-serif);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .5px;
    padding: 1px 5px;
    border-radius: 3px;
    color: rgba(255,255,255,.7);
    background: rgba(255,255,255,.06);
  }

  .detail-signal.bullish {
    color: #00ff88;
    background: rgba(0,255,136,.1);
  }

  .detail-signal.bearish {
    color: #ff4060;
    background: rgba(255,64,96,.1);
  }

  .detail-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
  }

  .raw-item {
    font-family: var(--fm, monospace);
    font-size: 9px;
    color: rgba(255,255,255,.6);
  }

  .detail-action {
    font-family: var(--fd, sans-serif);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .5px;
    text-align: center;
    padding-top: 4px;
  }

  .compact .pill-label {
    display: none;
  }

  .compact .pulse-pill {
    padding: 1px 5px;
  }
</style>
