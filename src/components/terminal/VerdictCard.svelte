<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let bias: 'long' | 'short' | 'wait' = 'wait';
  export let confidence: number = 0;
  export let pair: string = 'BTC/USDT';
  export let timeframe: string = '4h';
  export let reason: string = '';
  export let edgePct: number | null = null;
  export let gateScore: number | null = null;
  export let shouldExecute: boolean = false;
  export let model: string | null = null;
  export let loading: boolean = false;
  export let executionEnabled: boolean = false;

  $: biasLabel = bias === 'long' ? 'LONG' : bias === 'short' ? 'SHORT' : 'WAIT';
  $: biasColor = bias === 'long' ? '#00e676' : bias === 'short' ? '#ff2d55' : '#ffe600';
</script>

{#if loading}
  <div class="verdict-card verdict-loading">
    <div class="verdict-skel"></div>
  </div>
{:else if bias !== 'wait' || confidence > 0}
  <div class="verdict-card" style="--bias-color:{biasColor}">
    <div class="verdict-row1">
      <span class="verdict-badge" class:long={bias === 'long'} class:short={bias === 'short'} class:wait={bias === 'wait'}>
        {biasLabel}
      </span>
      <span class="verdict-conf">{confidence.toFixed(0)}%</span>
      <span class="verdict-pair">{pair} · {timeframe.toUpperCase()}</span>
      {#if edgePct != null}
        <span class="verdict-meta">E:{edgePct.toFixed(0)}%</span>
      {/if}
      {#if gateScore != null}
        <span class="verdict-meta">G:{gateScore.toFixed(0)}</span>
      {/if}
      <span class="verdict-spacer"></span>
      {#if executionEnabled && shouldExecute}
        <button class="verdict-exec" on:click={() => dispatch('execute')}>EXEC</button>
      {/if}
    </div>
    <div class="verdict-row2">
      <span class="verdict-reason">{reason || 'Analyzing...'}</span>
      {#if model}
        <span class="verdict-model">{model}</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .verdict-card {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 2px solid var(--bias-color, #ffe600);
    font-family: var(--fm, 'SF Mono', monospace);
  }
  .verdict-loading {
    border-bottom-color: rgba(255, 230, 0, 0.15);
  }
  .verdict-skel {
    height: 36px;
    background: linear-gradient(90deg, rgba(255,255,255,.03) 25%, rgba(255,255,255,.06) 50%, rgba(255,255,255,.03) 75%);
    background-size: 200% 100%;
    animation: verdict-shimmer 1.5s infinite;
    border-radius: 4px;
  }
  @keyframes verdict-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .verdict-row1 {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
  }

  .verdict-badge {
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 1.2px;
    padding: 2px 10px;
    border-radius: 4px;
    line-height: 1.4;
  }
  .verdict-badge.long {
    background: rgba(0, 230, 118, 0.18);
    color: #00e676;
  }
  .verdict-badge.short {
    background: rgba(255, 45, 85, 0.18);
    color: #ff2d55;
  }
  .verdict-badge.wait {
    background: rgba(255, 230, 0, 0.12);
    color: #ffe600;
  }

  .verdict-conf {
    font-size: 20px;
    font-weight: 900;
    color: #fff;
    letter-spacing: -0.5px;
    font-family: var(--fd, var(--fm, monospace));
  }

  .verdict-pair {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.5px;
  }

  .verdict-meta {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.3);
    letter-spacing: 0.5px;
  }

  .verdict-spacer {
    flex: 1;
  }

  .verdict-exec {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1px;
    padding: 3px 10px;
    border: 1px solid rgba(0, 230, 118, 0.4);
    border-radius: 4px;
    background: rgba(0, 230, 118, 0.12);
    color: #00e676;
    cursor: pointer;
    transition: background 0.15s;
  }
  .verdict-exec:hover {
    background: rgba(0, 230, 118, 0.25);
  }

  .verdict-row2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
    min-height: 18px;
  }

  .verdict-reason {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.4;
  }

  .verdict-model {
    font-size: 8px;
    color: rgba(255, 255, 255, 0.25);
    letter-spacing: 0.5px;
    white-space: nowrap;
    flex-shrink: 0;
  }
</style>
