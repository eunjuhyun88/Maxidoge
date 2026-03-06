<script lang="ts">
  import DirectionBadge from './DirectionBadge.svelte';

  interface Props {
    bias?: 'long' | 'short' | 'wait';
    confidence?: number;
    pair?: string;
    timeframe?: string;
    reason?: string;
    edgePct?: number | null;
    gateScore?: number | null;
    shouldExecute?: boolean;
    model?: string | null;
    loading?: boolean;
    executionEnabled?: boolean;
    showModelMeta?: boolean;
    onexecute?: () => void;
  }

  let {
    bias = 'wait',
    confidence = 0,
    pair = 'BTC/USDT',
    timeframe = '4h',
    reason = '',
    edgePct = null,
    gateScore = null,
    shouldExecute = false,
    model = null,
    loading = false,
    executionEnabled = false,
    showModelMeta = false,
    onexecute,
  }: Props = $props();

  const biasColor = $derived(bias === 'long' ? '#00e676' : bias === 'short' ? '#ff2d55' : 'var(--term-accent, #e8967d)');
</script>

{#if loading}
  <div class="vc" style="--bc:rgba(var(--t-accent-rgb),.15)">
    <div class="vc-skel"></div>
  </div>
{:else if bias !== 'wait' || confidence > 0}
  <div class="vc" style="--bc:{biasColor}">
    <DirectionBadge
      direction={bias === 'wait' ? 'neutral' : bias}
      confidence={confidence}
      showArrow
      showConfidence={false}
      size="sm"
      variant="soft"
    />
    <span class="vc-conf">{confidence.toFixed(0)}%</span>
    <span class="vc-pair">{pair} · {timeframe.toUpperCase()}</span>
    {#if edgePct != null}<span class="vc-meta">E:{edgePct.toFixed(0)}%</span>{/if}
    {#if gateScore != null}<span class="vc-meta">G:{gateScore.toFixed(0)}</span>{/if}
    <span class="vc-reason">{reason || '...'}</span>
    {#if showModelMeta && model}<span class="vc-model">{model}</span>{/if}
    {#if executionEnabled && shouldExecute}
      <button class="vc-exec" onclick={() => onexecute?.()}>EXEC</button>
    {/if}
  </div>
{/if}

<style>
  .vc {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 10px;
    background: rgba(255,255,255,.02);
    border-bottom: 2px solid var(--bc, var(--term-accent, #e8967d));
    font-family: var(--fm, 'SF Mono', monospace);
    flex-shrink: 0; min-height: 0;
    overflow: hidden;
  }
  .vc-skel {
    flex: 1; height: 20px;
    background: linear-gradient(90deg, rgba(255,255,255,.03) 25%, rgba(255,255,255,.06) 50%, rgba(255,255,255,.03) 75%);
    background-size: 200% 100%; animation: vcShim 1.5s infinite; border-radius: 3px;
  }
  @keyframes vcShim { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  .vc-conf {
    font-size: 15px; font-weight: 900; color: #fff;
    letter-spacing: -.5px; font-family: var(--fd, var(--fm)); flex-shrink: 0;
  }
  .vc-pair { font-size: 10px; color: rgba(255,255,255,.4); letter-spacing: .4px; flex-shrink: 0; }
  .vc-meta { font-size: 9px; color: rgba(255,255,255,.25); flex-shrink: 0; }
  .vc-reason {
    font-size: 9px; color: rgba(255,255,255,.35);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    flex: 1; min-width: 0;
  }
  .vc-model { font-size: 7px; color: rgba(255,255,255,.18); flex-shrink: 0; white-space: nowrap; }
  .vc-exec {
    font-size: 8px; font-weight: 800; letter-spacing: .8px;
    padding: 2px 8px; border: 1px solid rgba(0,230,118,.4);
    border-radius: 3px; background: rgba(0,230,118,.1); color: #00e676;
    cursor: pointer; flex-shrink: 0; transition: background .12s;
  }
  .vc-exec:hover { background: rgba(0,230,118,.2); }
</style>
