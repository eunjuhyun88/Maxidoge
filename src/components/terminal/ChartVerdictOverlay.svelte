<!-- ═══════════════════════════════════════════════════════════════
     ChartVerdictOverlay — floating pill on chart canvas
     Shows scan consensus as compact overlay (replaces VerdictBanner)
     position: absolute on chart container — 0px layout footprint
═══════════════════════════════════════════════════════════════ -->
<script lang="ts">
  import DirectionBadge from './DirectionBadge.svelte';

  interface VerdictData {
    consensus: 'long' | 'short' | 'neutral';
    avgConfidence: number;
    pair: string;
    timeframe?: string;
    createdAt?: number;
    highlights?: Array<{ agent: string; vote: string; conf: number }>;
  }

  interface Props {
    verdict?: VerdictData | null;
    scanning?: boolean;
    onTap?: () => void;
  }

  const {
    verdict = null,
    scanning = false,
    onTap = () => {},
  }: Props = $props();

  const agreeCount = $derived(
    verdict?.highlights
      ? verdict.highlights.filter(h => h.vote === verdict.consensus).length
      : 0
  );
  const totalCount = $derived(verdict?.highlights?.length ?? 0);

  function timeSinceShort(ts: number): string {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    return `${Math.floor(sec / 86400)}d`;
  }

  let justArrived = $state(false);

  $effect(() => {
    if (verdict) {
      justArrived = true;
      const t = setTimeout(() => { justArrived = false; }, 2000);
      return () => { clearTimeout(t); };
    }
  });
</script>

{#if scanning}
  <div class="cvo cvo-scanning">
    <span class="cvo-pulse"></span>
    <span class="cvo-scan-label">SCANNING</span>
  </div>
{:else if verdict}
  <button
    type="button"
    class="cvo"
    class:cvo-arrived={justArrived}
    onclick={onTap}
    aria-label="{verdict.consensus.toUpperCase()} {Math.round(verdict.avgConfidence)}% — tap for details"
  >
    <DirectionBadge
      direction={verdict.consensus}
      confidence={verdict.avgConfidence}
      showConfidence
      size="xs"
      variant="soft"
    />
    <span class="cvo-agree">{agreeCount}/{totalCount}</span>
    {#if verdict.createdAt}
      <span class="cvo-time">{timeSinceShort(verdict.createdAt)}</span>
    {/if}
  </button>
{/if}

<style>
  .cvo {
    position: absolute;
    bottom: 10px;
    left: 10px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px 3px 3px;
    border: 1px solid rgba(240, 237, 228, 0.12);
    border-radius: 999px;
    background: rgba(8, 18, 13, 0.82);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    cursor: pointer;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    color: inherit;
    transition: opacity 0.15s, box-shadow 0.3s;
    user-select: none;
  }
  .cvo:active { opacity: 0.7; }
  .cvo-arrived {
    animation: cvoGlow 2s ease-out;
  }
  @keyframes cvoGlow {
    0% { box-shadow: 0 0 12px rgba(232, 150, 125, 0.4); }
    100% { box-shadow: none; }
  }
  .cvo-agree {
    font-size: 9px;
    font-weight: 700;
    color: rgba(240, 237, 228, 0.5);
  }
  .cvo-time {
    font-size: 8px;
    color: rgba(240, 237, 228, 0.35);
  }

  /* ── Scanning state ── */
  .cvo-scanning {
    cursor: default;
  }
  .cvo-pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #e8967d;
    animation: cvoPulse 1s ease infinite;
  }
  @keyframes cvoPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .cvo-scan-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: rgba(240, 237, 228, 0.45);
  }
</style>
