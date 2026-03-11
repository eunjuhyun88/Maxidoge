<!-- ═══════════════════════════════════════════════════════════════
     @deprecated — Replaced by MobileActionBar.svelte
     This file is no longer imported anywhere and can be safely deleted.
     MobileTradeStrip — compact signal + trade bar (LEGACY)
═══════════════════════════════════════════════════════════════ -->
<script lang="ts">
  interface ScanData {
    consensus: 'long' | 'short' | 'neutral';
    avgConfidence: number;
    pair: string;
    highlights?: Array<{ agent: string; vote: string; conf: number }>;
  }

  interface Props {
    scan?: ScanData | null;
    scanning?: boolean;
    onScanStart?: () => void;
    onGoToWarRoom?: () => void;
    onGoToTrade?: () => void;
  }

  let {
    scan = null,
    scanning = false,
    onScanStart = () => {},
    onGoToWarRoom = () => {},
    onGoToTrade = () => {},
  }: Props = $props();

  const agreeCount = $derived(
    scan?.highlights
      ? scan.highlights.filter(h => h.vote === scan!.consensus).length
      : 0
  );
  const totalCount = $derived(scan?.highlights?.length ?? 0);

  const dirClass = $derived(
    scan?.consensus === 'long' ? 'dir-long'
    : scan?.consensus === 'short' ? 'dir-short'
    : 'dir-neutral'
  );
</script>

<div class="mts">
  {#if scanning}
    <div class="mts-scanning">
      <span class="mts-pulse"></span>
      <span class="mts-text">SCANNING...</span>
    </div>
  {:else if scan}
    <button class="mts-consensus {dirClass}" onclick={onGoToWarRoom}>
      <span class="mts-dir">
        {scan.consensus === 'long' ? '▲' : scan.consensus === 'short' ? '▼' : '◆'}
      </span>
      <span class="mts-conf">{Math.round(scan.avgConfidence)}%</span>
      <span class="mts-agree">{agreeCount}/{totalCount}</span>
    </button>
    <button class="mts-action mts-long" onclick={onGoToTrade}>▲ LONG</button>
    <button class="mts-action mts-short" onclick={onGoToTrade}>▼ SHORT</button>
  {:else}
    <button class="mts-scan-cta" onclick={onScanStart}>
      <span class="mts-zap">⚡</span> RUN SCAN
    </button>
    <button class="mts-goto" onclick={onGoToWarRoom}>WAR ROOM →</button>
  {/if}
</div>

<style>
  .mts {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    background: rgba(8, 18, 13, 0.95);
    border-top: 1px solid rgba(232, 150, 125, 0.18);
    flex-shrink: 0;
    min-height: 42px;
  }

  /* ── Scanning state ── */
  .mts-scanning {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    justify-content: center;
  }
  .mts-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e8967d;
    animation: mtsPulse 1s ease infinite;
  }
  @keyframes mtsPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .mts-text {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    color: rgba(240, 237, 228, 0.5);
  }

  /* ── Consensus badge (clickable → goes to War Room) ── */
  .mts-consensus {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid rgba(240, 237, 228, 0.15);
    border-radius: 6px;
    background: rgba(240, 237, 228, 0.05);
    cursor: pointer;
    flex-shrink: 0;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    color: inherit;
  }
  .mts-consensus:active { opacity: 0.7; }
  .mts-dir {
    font-size: 13px;
    font-weight: 900;
  }
  .dir-long .mts-dir { color: #26a69a; }
  .dir-short .mts-dir { color: #ef5350; }
  .dir-neutral .mts-dir { color: #ffb74d; }
  .mts-conf {
    font-size: 13px;
    font-weight: 800;
    color: #F0EDE4;
  }
  .mts-agree {
    font-size: 10px;
    color: rgba(240, 237, 228, 0.5);
  }

  /* ── LONG / SHORT action buttons ── */
  .mts-action {
    flex: 1;
    padding: 8px 0;
    border: none;
    border-radius: 6px;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: opacity 0.12s;
  }
  .mts-action:active { opacity: 0.7; }
  .mts-long {
    background: rgba(38, 166, 154, 0.2);
    color: #26a69a;
    border: 1px solid rgba(38, 166, 154, 0.35);
  }
  .mts-short {
    background: rgba(239, 83, 80, 0.2);
    color: #ef5350;
    border: 1px solid rgba(239, 83, 80, 0.35);
  }

  /* ── No-scan CTA ── */
  .mts-scan-cta {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 0;
    border: 1px solid rgba(232, 150, 125, 0.35);
    border-radius: 6px;
    background: rgba(232, 150, 125, 0.12);
    color: #e8967d;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.5px;
    cursor: pointer;
  }
  .mts-scan-cta:active { opacity: 0.7; }
  .mts-zap { font-size: 14px; }

  .mts-goto {
    padding: 10px 14px;
    border: 1px solid rgba(240, 237, 228, 0.15);
    border-radius: 6px;
    background: transparent;
    color: rgba(240, 237, 228, 0.55);
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .mts-goto:active { opacity: 0.7; }
</style>
