<!-- ═══════════════════════════════════════════════════════════════
     STOCKCLAW — Verdict Banner
     차트 상단에 최신 스캔 판정을 표시하는 배너
═══════════════════════════════════════════════════════════════ -->
<script lang="ts">
  interface VerdictData {
    pair: string;
    timeframe: string;
    consensus: 'long' | 'short' | 'neutral';
    avgConfidence: number;
    summary: string;
    highlights: Array<{ agent: string; vote: string; conf: number; note: string }>;
    createdAt: number;
  }

  const { verdict, scanning = false }: { verdict: VerdictData | null; scanning?: boolean } = $props();

  let expanded = $state(false);

  const dirColor = $derived(
    verdict?.consensus === 'long' ? '#00cc88'
    : verdict?.consensus === 'short' ? '#ff4466'
    : '#888'
  );
  const dirEmoji = $derived(
    verdict?.consensus === 'long' ? '▲'
    : verdict?.consensus === 'short' ? '▼'
    : '◆'
  );
  const agreeCount = $derived(
    verdict?.highlights
      ? verdict.highlights.filter(h => h.vote === verdict.consensus).length
      : 0
  );
  const totalCount = $derived(verdict?.highlights?.length ?? 0);

  function timeSinceShort(ts: number): string {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }
</script>

{#if scanning}
  <div class="verdict-banner verdict-loading">
    <span class="verdict-pulse"></span>
    <span class="verdict-label">SCANNING · analyzing market data...</span>
  </div>
{:else if verdict}
  <button
    type="button"
    class="verdict-banner"
    class:expanded
    style="--vdir:{dirColor}"
    onclick={() => expanded = !expanded}
  >
    <div class="verdict-row">
      <span class="verdict-dir" style="color:{dirColor}">{dirEmoji} {verdict.consensus.toUpperCase()}</span>
      <span class="verdict-conf">{Math.round(verdict.avgConfidence)}%</span>
      <span class="verdict-meta">{verdict.pair} · {verdict.timeframe.toUpperCase()} · {agreeCount}/{totalCount} agree</span>
      <span class="verdict-time">{timeSinceShort(verdict.createdAt)}</span>
      <span class="verdict-chevron">{expanded ? '▾' : '▸'}</span>
    </div>
    {#if expanded}
      <div class="verdict-detail">
        <p class="verdict-summary">{verdict.summary}</p>
        <div class="verdict-agents">
          {#each verdict.highlights as h}
            {@const vColor = h.vote === 'long' ? '#00cc88' : h.vote === 'short' ? '#ff4466' : '#888'}
            <div class="verdict-agent">
              <span class="va-name">{h.agent}</span>
              <span class="va-vote" style="color:{vColor}">{h.vote.toUpperCase()} {h.conf}%</span>
              <span class="va-note">{h.note}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </button>
{/if}

<style>
  .verdict-banner {
    font-family: var(--fb, 'Space Grotesk', sans-serif);
    background: rgba(10, 26, 13, 0.92);
    border: none;
    border-bottom: 1px solid rgba(232, 150, 125, 0.15);
    padding: 6px 12px;
    cursor: pointer;
    user-select: none;
    width: 100%;
    text-align: left;
    color: inherit;
    transition: background 0.15s;
    z-index: 5;
    flex-shrink: 0;
  }
  .verdict-banner:hover {
    background: rgba(15, 38, 20, 0.95);
  }
  .verdict-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: default;
  }
  .verdict-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #E8967D;
    animation: vpulse 1s ease infinite;
  }
  @keyframes vpulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.8); }
  }
  .verdict-label {
    font-size: 10px;
    letter-spacing: 1px;
    color: rgba(240, 237, 228, 0.6);
    text-transform: uppercase;
    font-family: var(--fd, 'Press Start 2P', monospace);
  }
  .verdict-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .verdict-dir {
    font-family: var(--fd, 'Press Start 2P', monospace);
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
  }
  .verdict-conf {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 12px;
    font-weight: 700;
    color: var(--vdir);
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 6px;
    border-radius: 4px;
  }
  .verdict-meta {
    font-size: 10px;
    color: rgba(240, 237, 228, 0.5);
    letter-spacing: 0.5px;
  }
  .verdict-time {
    font-size: 9px;
    color: rgba(240, 237, 228, 0.35);
    margin-left: auto;
  }
  .verdict-chevron {
    font-size: 10px;
    color: rgba(240, 237, 228, 0.3);
  }
  /* Expanded detail */
  .verdict-detail {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(232, 150, 125, 0.1);
  }
  .verdict-summary {
    font-size: 11px;
    color: rgba(240, 237, 228, 0.7);
    line-height: 1.5;
    margin: 0 0 8px;
  }
  .verdict-agents {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .verdict-agent {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 10px;
  }
  .va-name {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    color: rgba(240, 237, 228, 0.5);
    min-width: 72px;
    text-transform: uppercase;
    font-size: 9px;
    letter-spacing: 0.5px;
  }
  .va-vote {
    font-weight: 700;
    min-width: 80px;
  }
  .va-note {
    color: rgba(240, 237, 228, 0.4);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
