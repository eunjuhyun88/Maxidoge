<script lang="ts">
  import DirectionBadge from '../DirectionBadge.svelte';

  interface Props {
    selectedCount?: number;
    signalPoolLength?: number;
    trackedCount?: number;
    avgConfidence?: number;
    avgRR?: number;
    consensusDir?: string;
    topSignalHint?: string;
    canApplyTopSignal?: boolean;
    onOpenCopyTrade?: () => void;
    onGoSignals?: () => void;
    onApplyTopSignal?: () => void;
  }

  let {
    selectedCount = 0,
    signalPoolLength = 0,
    trackedCount = 0,
    avgConfidence = 0,
    avgRR = 0,
    consensusDir = 'NEUTRAL',
    topSignalHint = '',
    canApplyTopSignal = false,
    onOpenCopyTrade = () => {},
    onGoSignals = () => {},
    onApplyTopSignal = () => {},
  }: Props = $props();
</script>

<button class="chart-signal-cta" onclick={onApplyTopSignal} disabled={!canApplyTopSignal}>
  <span class="csc-text">{canApplyTopSignal ? 'TRADE THIS SIGNAL' : 'WAIT FOR SIGNAL'}</span>
  <div class="csc-meta">
    <DirectionBadge direction={consensusDir} size="xs" variant="soft" />
    <span class="csc-hint">{topSignalHint || 'No actionable setup yet'}</span>
  </div>
  <span class="csc-arrow">↗</span>
</button>

{#if selectedCount > 0}
  <button class="copy-trade-cta" onclick={onOpenCopyTrade}>
    <span class="ctc-text">CREATE COPY TRADE</span>
    <span class="ctc-count">{selectedCount} selected</span>
    <span class="ctc-arrow">→</span>
  </button>
{/if}

<button class="signal-room-cta" onclick={onGoSignals}>
  <span class="src-text">SIGNAL ROOM</span>
  <span class="src-count">{signalPoolLength} SIGNALS</span>
  {#if trackedCount > 0}
    <span class="src-tracked">TRACKED {trackedCount}</span>
  {/if}
  <span class="src-arrow">→</span>
</button>

<div class="wr-stats">
  <div class="stat-cell"><div class="stat-lbl">SIG</div><div class="stat-val" style="color:var(--yel)">{signalPoolLength}</div></div>
  <div class="stat-cell"><div class="stat-lbl">CONF</div><div class="stat-val" style="color:var(--grn)">{avgConfidence}%</div></div>
  <div class="stat-cell"><div class="stat-lbl">R:R</div><div class="stat-val" style="color:var(--ora)">1:{avgRR.toFixed(1)}</div></div>
  <div class="stat-cell">
    <div class="stat-lbl">DIR</div>
    <div class="stat-dir-wrap">
      <DirectionBadge direction={consensusDir} size="xs" variant="soft" />
    </div>
  </div>
</div>
