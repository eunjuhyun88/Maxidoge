<script lang="ts">
  import {
    calculatePositionSize,
    formatQuantity,
    formatPositionSizeWarning,
    type SizingMethod,
  } from '$lib/engine/positionSizer';

  interface Props {
    entry?: number;
    stop?: number;
    tp?: number;
    dir?: 'LONG' | 'SHORT';
    onQuantityChange?: (qty: number) => void;
  }

  let {
    entry = 0,
    stop = 0,
    tp = 0,
    dir = 'LONG' as 'LONG' | 'SHORT',
    onQuantityChange = () => {},
  }: Props = $props();
  const directionClass = $derived(dir === 'SHORT' ? 'short' : 'long');

  let accountSize = $state(10000);
  let riskPct = $state(1);
  let method: SizingMethod = $state('fixed_fractional');
  let leverageMax = $state(10);
  let expanded = $state(false);
  const accountInputId = 'position-sizer-account';
  const riskInputId = 'position-sizer-risk';
  const leverageInputId = 'position-sizer-leverage';
  const methodInputId = 'position-sizer-method';

  let result = $derived.by(() => {
    if (!entry || !stop || entry === stop) return null;
    return calculatePositionSize({
      method,
      accountSize,
      entry,
      stop,
      takeProfit: tp > 0 ? tp : undefined,
      riskPct,
      leverageMax,
    });
  });

  $effect(() => {
    if (result && result.quantity > 0) {
      onQuantityChange(result.quantity);
    }
  });
</script>

{#if expanded}
  <div class={`sizer-panel ${directionClass}`}>
    <div class="sizer-header">
      <div class="sizer-title-row">
        <span class="sizer-title">POSITION SIZER</span>
        <span class={`sizer-side ${directionClass}`}>{dir}</span>
      </div>
      <button class="sizer-close" onclick={() => expanded = false}>×</button>
    </div>

    <div class="sizer-inputs">
      <div class="input-row">
        <label for={accountInputId}>Account</label>
        <div class="input-wrap">
          <span class="input-prefix">$</span>
          <input id={accountInputId} type="number" bind:value={accountSize} min={100} step={1000} />
        </div>
      </div>
      <div class="input-row">
        <label for={riskInputId}>Risk %</label>
        <input id={riskInputId} type="number" bind:value={riskPct} min={0.1} max={10} step={0.1} class="short" />
      </div>
      <div class="input-row">
        <label for={leverageInputId}>Max Lev</label>
        <input id={leverageInputId} type="number" bind:value={leverageMax} min={1} max={125} step={1} class="short" />
      </div>
      <div class="input-row">
        <label for={methodInputId}>Method</label>
        <select id={methodInputId} bind:value={method}>
          <option value="fixed_fractional">Fixed %</option>
          <option value="atr">ATR</option>
          <option value="kelly">Kelly</option>
        </select>
      </div>
    </div>

    {#if result}
      <div class="sizer-result">
        <div class="result-main">
          <span class="result-label">SIZE</span>
          <span class="result-qty">{formatQuantity(result.quantity, entry)}</span>
          <span class="result-value">(${result.positionValue.toFixed(0)})</span>
        </div>
        <div class="result-grid">
          <div class="result-item">
            <span class="ri-label">Risk $</span>
            <span class="ri-value loss">${result.riskAmount.toFixed(2)}</span>
          </div>
          <div class="result-item">
            <span class="ri-label">Stop %</span>
            <span class="ri-value">{result.stopDistancePct.toFixed(2)}%</span>
          </div>
          <div class="result-item">
            <span class="ri-label">Leverage</span>
            <span class="ri-value">{result.leverage.toFixed(2)}x</span>
          </div>
          {#if result.rr > 0}
            <div class="result-item">
              <span class="ri-label">R:R</span>
              <span class="ri-value gain">1:{result.rr.toFixed(1)}</span>
            </div>
          {/if}
          <div class="result-item">
            <span class="ri-label">Margin</span>
            <span class="ri-value">${result.marginRequired.toFixed(0)}</span>
          </div>
        </div>
        {#each result.warnings as warn}
          <div class="result-warn">{formatPositionSizeWarning(warn)}</div>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <button class={`sizer-toggle ${directionClass}`} onclick={() => expanded = true} title="Position Sizer">
    <span class="sizer-icon">📐</span>
    {#if result && result.quantity > 0}
      <span class="sizer-mini">{formatQuantity(result.quantity, entry)}</span>
    {/if}
  </button>
{/if}

<style>
  .sizer-panel {
    background: rgba(10,10,26,.95);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 8px;
    padding: 8px 10px;
    min-width: 220px;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    backdrop-filter: blur(12px);
  }

  .sizer-panel.long {
    border-color: rgba(0, 255, 136, .22);
  }

  .sizer-panel.short {
    border-color: rgba(255, 64, 96, .22);
  }

  .sizer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .sizer-title-row {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .sizer-title {
    font-family: var(--fd, sans-serif);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .8px;
    color: rgba(255,255,255,.85);
  }

  .sizer-side {
    border-radius: 999px;
    padding: 1px 5px;
    font-family: var(--fd, sans-serif);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: .6px;
    line-height: 1.2;
  }

  .sizer-side.long {
    color: #00ff88;
    background: rgba(0, 255, 136, .14);
    border: 1px solid rgba(0, 255, 136, .24);
  }

  .sizer-side.short {
    color: #ff4060;
    background: rgba(255, 64, 96, .14);
    border: 1px solid rgba(255, 64, 96, .24);
  }

  .sizer-close {
    background: none;
    border: none;
    color: rgba(255,255,255,.5);
    font-size: 14px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
  }

  .sizer-close:hover { color: #fff; }

  .sizer-inputs {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .input-row label {
    font-size: 9px;
    color: rgba(255,255,255,.6);
    min-width: 52px;
    flex-shrink: 0;
  }

  .input-wrap {
    display: flex;
    align-items: center;
    flex: 1;
  }

  .input-prefix {
    font-size: 9px;
    color: rgba(255,255,255,.5);
    margin-right: 2px;
  }

  .sizer-inputs input,
  .sizer-inputs select {
    flex: 1;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 4px;
    color: #fff;
    font-family: var(--fm, monospace);
    font-size: 10px;
    padding: 3px 5px;
    outline: none;
  }

  .sizer-inputs input.short {
    max-width: 60px;
  }

  .sizer-inputs select {
    max-width: 90px;
  }

  .sizer-inputs input:focus,
  .sizer-inputs select:focus {
    border-color: rgba(232,150,125,.5);
  }

  .sizer-result {
    border-top: 1px solid rgba(255,255,255,.08);
    padding-top: 6px;
  }

  .result-main {
    display: flex;
    align-items: baseline;
    gap: 5px;
    margin-bottom: 5px;
  }

  .result-label {
    font-size: 8px;
    font-weight: 800;
    color: rgba(255,255,255,.5);
    letter-spacing: .5px;
  }

  .result-qty {
    font-size: 14px;
    font-weight: 900;
    color: #fff;
  }

  .result-value {
    font-size: 10px;
    color: rgba(255,255,255,.5);
  }

  .result-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 8px;
    margin-bottom: 4px;
  }

  .result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .ri-label {
    font-size: 8px;
    color: rgba(255,255,255,.45);
    letter-spacing: .3px;
  }

  .ri-value {
    font-size: 9px;
    font-weight: 700;
    color: rgba(255,255,255,.8);
  }

  .ri-value.loss { color: #ff4060; }
  .ri-value.gain { color: #00ff88; }

  .result-warn {
    font-size: 8px;
    color: #ffbb33;
    margin-top: 2px;
    line-height: 1.3;
  }

  .sizer-toggle {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    border: 1px solid rgba(255,255,255,.15);
    background: rgba(255,255,255,.05);
    border-radius: 10px;
    padding: 2px 7px;
    cursor: pointer;
    transition: all .15s;
  }

  .sizer-toggle.long {
    border-color: rgba(0, 255, 136, .24);
  }

  .sizer-toggle.short {
    border-color: rgba(255, 64, 96, .24);
  }

  .sizer-toggle:hover {
    border-color: rgba(255,255,255,.3);
    background: rgba(255,255,255,.1);
  }

  .sizer-icon {
    font-size: 10px;
    line-height: 1;
  }

  .sizer-mini {
    font-family: var(--fm, monospace);
    font-size: 9px;
    font-weight: 700;
    color: rgba(255,255,255,.8);
  }
</style>
