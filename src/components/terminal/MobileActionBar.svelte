<!-- ═══════════════════════════════════════════════════════════════
     MobileActionBar — scan/trade action bar for mobile terminal chart tab
     Shows: scan CTA, scanning state, or scan results + trade buttons.
     32px height, only visible on chart tab.
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
    onGoToTrade?: () => void;
    onShowWarRoom?: () => void;
  }

  let {
    scan = null,
    scanning = false,
    onScanStart = () => {},
    onGoToTrade = () => {},
    onShowWarRoom = () => {},
  }: Props = $props();

  const agreeCount = $derived(
    scan?.highlights
      ? scan.highlights.filter(h => h.vote === scan!.consensus).length
      : 0
  );
  const totalCount = $derived(scan?.highlights?.length ?? 0);
</script>

<div class="mab">
  {#if scanning}
    <div class="mab-scanning">
      <span class="mab-pulse"></span>
      <span class="mab-scan-text">SCANNING...</span>
    </div>
  {:else if scan}
    <button class="mab-badge" onclick={onShowWarRoom}>
      <span class="mab-dir" class:dir-long={scan.consensus === 'long'} class:dir-short={scan.consensus === 'short'} class:dir-neutral={scan.consensus === 'neutral'}>
        {scan.consensus === 'long' ? '▲' : scan.consensus === 'short' ? '▼' : '◆'}
      </span>
      <span class="mab-conf">{Math.round(scan.avgConfidence)}%</span>
      <span class="mab-agree">{agreeCount}/{totalCount}</span>
    </button>
    <button class="mab-trade mab-long" onclick={onGoToTrade}>▲ LONG</button>
    <button class="mab-trade mab-short" onclick={onGoToTrade}>▼ SHORT</button>
  {:else}
    <button class="mab-scan-cta" onclick={onScanStart}>⚡ SCAN</button>
  {/if}
</div>

<style>
  .mab {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    background: rgba(8, 18, 13, 0.96);
    border-top: 1px solid rgba(232, 150, 125, 0.12);
    flex-shrink: 0;
    min-height: 32px;
  }

  .mab-scan-cta {
    padding: 3px 10px;
    border: 1px solid rgba(232, 150, 125, 0.3);
    border-radius: 4px;
    background: rgba(232, 150, 125, 0.1);
    color: #e8967d;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.5px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .mab-scan-cta:active { opacity: 0.7; }

  .mab-scanning {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }
  .mab-pulse {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #e8967d;
    animation: mabPulse 1s ease infinite;
  }
  @keyframes mabPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .mab-scan-text {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 9px; font-weight: 700;
    letter-spacing: 1px;
    color: rgba(240, 237, 228, 0.5);
  }

  .mab-badge {
    display: flex; align-items: center; gap: 3px;
    padding: 2px 5px;
    border: 1px solid rgba(240, 237, 228, 0.12);
    border-radius: 4px;
    background: rgba(240, 237, 228, 0.05);
    cursor: pointer; flex-shrink: 0;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    color: inherit;
  }
  .mab-badge:active { opacity: 0.7; }
  .mab-dir { font-size: 9px; font-weight: 900; }
  .dir-long { color: #26a69a; }
  .dir-short { color: #ef5350; }
  .dir-neutral { color: #ffb74d; }
  .mab-conf { font-size: 9px; font-weight: 800; color: #F0EDE4; }
  .mab-agree { font-size: 8px; color: rgba(240, 237, 228, 0.4); }

  .mab-trade {
    flex: 1; padding: 3px 0;
    border: none; border-radius: 4px;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 10px; font-weight: 800;
    cursor: pointer;
  }
  .mab-trade:active { opacity: 0.7; }
  .mab-long {
    background: rgba(38, 166, 154, 0.18);
    color: #26a69a;
    border: 1px solid rgba(38, 166, 154, 0.25);
  }
  .mab-short {
    background: rgba(239, 83, 80, 0.18);
    color: #ef5350;
    border: 1px solid rgba(239, 83, 80, 0.25);
  }
</style>
