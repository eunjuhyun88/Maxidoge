<!-- ═══════════════════════════════════════════════════════════════
     TabletWarRoomDrawer — slide-in overlay drawer for War Room
     Used on tablet layout: WarRoom slides from left edge
     Toggle button always visible on left edge
═══════════════════════════════════════════════════════════════ -->
<script lang="ts">
  import type { AgentSignal } from '$lib/data/warroom';
  import type { ChartCommunitySignal, ScanIntelDetail, TerminalDensityMode, WarRoomHandle } from '$lib/terminal/terminalTypes';
  import WarRoom from './WarRoom.svelte';

  interface Props {
    open?: boolean;
    densityMode?: TerminalDensityMode;
    warRoomRef?: WarRoomHandle | null;
    onToggle?: () => void;
    onScanStart?: () => void;
    onScanComplete?: (detail: ScanIntelDetail) => void;
    onShowOnChart?: (detail: { signal: AgentSignal }) => void;
    onShareToCommunity?: (detail: ChartCommunitySignal) => void;
  }

  let {
    open = false,
    densityMode = 'essential',
    warRoomRef = $bindable(null),
    onToggle = () => {},
    onScanStart = () => {},
    onScanComplete = () => {},
    onShowOnChart = () => {},
    onShareToCommunity = () => {},
  }: Props = $props();

  function handleBackdrop() {
    if (open) onToggle();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      onToggle();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Toggle strip button (always visible) -->
<button
  class="twd-toggle"
  class:twd-toggle-open={open}
  onclick={onToggle}
  aria-label={open ? 'Close War Room' : 'Open War Room'}
  title="War Room"
>
  <span class="twd-toggle-icon">{open ? '◀' : '▶'}</span>
  <span class="twd-toggle-label">WAR</span>
</button>

<!-- Backdrop -->
{#if open}
  <button
    class="twd-backdrop"
    onclick={handleBackdrop}
    aria-label="Close War Room drawer"
  ></button>
{/if}

<!-- Drawer panel -->
<div
  class="twd-drawer"
  class:twd-drawer-open={open}
  role="dialog"
  aria-label="War Room"
  aria-hidden={!open}
>
  <WarRoom
    bind:this={warRoomRef}
    {densityMode}
    onScanStart={onScanStart}
    onScanComplete={onScanComplete}
    onShowOnChart={onShowOnChart}
    {onShareToCommunity}
  />
</div>

<style>
  /* ── Toggle strip (always visible on left edge) ── */
  .twd-toggle {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 22;
    width: 24px;
    padding: 12px 0;
    border: 1px solid rgba(240, 237, 228, 0.1);
    border-left: none;
    border-radius: 0 6px 6px 0;
    background: rgba(8, 18, 13, 0.9);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: rgba(240, 237, 228, 0.4);
    transition: background 0.15s, color 0.15s;
  }
  .twd-toggle:hover,
  .twd-toggle-open {
    background: rgba(232, 150, 125, 0.12);
    color: rgba(240, 237, 228, 0.7);
    border-color: rgba(232, 150, 125, 0.2);
  }
  .twd-toggle-icon {
    font-size: 8px;
  }
  .twd-toggle-label {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 1px;
    writing-mode: vertical-rl;
    text-orientation: mixed;
  }

  /* ── Backdrop ── */
  .twd-backdrop {
    position: fixed;
    inset: 0;
    z-index: 28;
    background: rgba(0, 0, 0, 0.4);
    border: none;
    cursor: default;
    animation: twdFadeIn 0.2s ease;
  }
  @keyframes twdFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ── Drawer panel ── */
  .twd-drawer {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 320px;
    max-width: 80vw;
    z-index: 30;
    background: rgba(8, 18, 13, 0.98);
    border-right: 1px solid rgba(232, 150, 125, 0.15);
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .twd-drawer-open {
    transform: translateX(0);
  }
</style>
