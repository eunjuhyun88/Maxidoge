<script lang="ts">
  interface Props {
    pair?: string;
    timeframeLabel?: string;
    directionLabel?: string;
    directionClass?: 'long' | 'short' | 'neutral' | 'scanning';
    confidenceLabel?: string;
    primaryLabel?: string;
    primaryHint?: string;
    densityLabel?: string;
    tradeReady?: boolean;
    compact?: boolean;
    variant?: 'card' | 'inline';
    showMarket?: boolean;
    showPrimaryHint?: boolean;
    onPrimaryAction?: () => void;
    onToggleDensity?: () => void;
  }
  let {
    pair = 'BTC/USDT',
    timeframeLabel = '30M',
    directionLabel = 'UNSCANNED',
    directionClass = 'neutral',
    confidenceLabel = '--',
    primaryLabel = 'RUN FIRST SCAN',
    primaryHint = 'Scan current pair to generate agent consensus',
    densityLabel = 'ESSENTIAL',
    tradeReady = false,
    compact = false,
    variant = 'card',
    showMarket = true,
    showPrimaryHint = true,
    onPrimaryAction = () => {},
    onToggleDensity = () => {},
  }: Props = $props();
</script>

<div
  class="terminal-control-bar"
  class:compact={compact}
  class:inline={variant === 'inline'}
  role="region"
  aria-label="Terminal control bar"
>
  <div class="tcb-meta">
    {#if showMarket}
      <div class="tcb-market">
        <span class="tcb-pair">{pair}</span>
        <span class="tcb-tf">{timeframeLabel}</span>
      </div>
    {/if}

    <div class="tcb-consensus">
      <span class="tcb-label">CONSENSUS</span>
      <span class="tcb-dir {directionClass}">{directionLabel}</span>
      <span class="tcb-conf">{confidenceLabel}</span>
    </div>
  </div>

  <button type="button" class="tcb-density" onclick={onToggleDensity} title="정보 밀도 전환">
    {densityLabel}
  </button>

  <button type="button" class="tcb-primary" class:trade={tradeReady} onclick={onPrimaryAction}>
    <span class="tcb-primary-label">{primaryLabel}</span>
    {#if showPrimaryHint && !compact}
      <span class="tcb-primary-hint">{primaryHint}</span>
    {/if}
  </button>
</div>

<style>
  .terminal-control-bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 7px 10px;
    border: 1px solid rgba(var(--t-accent-rgb), 0.28);
    border-radius: 10px;
    background: rgba(7, 15, 10, 0.72);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(6px);
    font-family: var(--fm);
  }
  .terminal-control-bar.inline {
    min-height: 30px;
    padding: 3px 6px;
    gap: 6px;
    border-radius: 8px;
    border-color: rgba(var(--t-accent-rgb), 0.18);
    background: rgba(7, 15, 10, 0.44);
    box-shadow: none;
    backdrop-filter: none;
  }
  .terminal-control-bar.inline .tcb-meta {
    gap: 8px;
  }
  .terminal-control-bar.inline .tcb-label {
    font-size: 7px;
    letter-spacing: 0.75px;
  }
  .terminal-control-bar.inline .tcb-dir {
    font-size: 9px;
  }
  .terminal-control-bar.inline .tcb-conf {
    font-size: 8px;
  }
  .terminal-control-bar.inline .tcb-density {
    font-size: 8px;
    padding: 4px 8px;
  }
  .terminal-control-bar.inline .tcb-primary {
    border-radius: 7px;
    padding: 4px 8px;
    flex-direction: row;
    align-items: center;
    justify-content: center;
  }
  .terminal-control-bar.inline .tcb-primary-label {
    font-size: 8px;
    letter-spacing: 0.8px;
  }

  .tcb-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    overflow: hidden;
  }

  .tcb-market,
  .tcb-consensus {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
  }

  .tcb-pair {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.92);
    white-space: nowrap;
  }

  .tcb-tf {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: rgba(255, 255, 255, 0.62);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 999px;
    padding: 2px 6px;
    white-space: nowrap;
  }

  .tcb-label {
    font-size: 8px;
    letter-spacing: 0.9px;
    color: rgba(255, 255, 255, 0.55);
    white-space: nowrap;
  }

  .tcb-dir {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.9px;
    white-space: nowrap;
  }
  .tcb-dir.long { color: #00e676; }
  .tcb-dir.short { color: #ff6b6b; }
  .tcb-dir.neutral { color: #ffd54f; }
  .tcb-dir.scanning { color: #87dcbe; }

  .tcb-conf {
    font-size: 9px;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.84);
    white-space: nowrap;
  }

  .tcb-primary {
    min-width: 0;
    max-width: 100%;
    border: 1px solid rgba(135, 220, 190, 0.34);
    border-radius: 8px;
    background: rgba(135, 220, 190, 0.14);
    color: #dff9ef;
    padding: 6px 9px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .tcb-primary.trade {
    border-color: rgba(0, 230, 118, 0.45);
    background: rgba(0, 230, 118, 0.14);
  }
  .tcb-primary:hover {
    border-color: rgba(var(--t-accent-rgb), 0.55);
    background: rgba(var(--t-accent-rgb), 0.16);
    color: #fff;
  }

  .tcb-primary-label {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.9px;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .tcb-primary-hint {
    font-size: 8px;
    color: rgba(255, 255, 255, 0.66);
    letter-spacing: 0.4px;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 28ch;
  }

  .tcb-density {
    font: 800 9px/1 var(--fm);
    letter-spacing: 0.9px;
    color: rgba(240, 237, 228, 0.9);
    border: 1px solid rgba(var(--t-accent-rgb), 0.35);
    border-radius: 999px;
    background: rgba(10, 9, 8, 0.72);
    padding: 6px 10px;
    cursor: pointer;
    transition: all 0.12s ease;
    white-space: nowrap;
  }
  .tcb-density:hover {
    border-color: rgba(var(--t-accent-rgb), 0.55);
    background: rgba(var(--t-accent-rgb), 0.14);
    color: #fff;
  }

  .terminal-control-bar.compact {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    min-height: 0;
    padding: 6px 8px;
    row-gap: 6px;
    column-gap: 6px;
    border-radius: 0;
    border-left: 0;
    border-right: 0;
  }
  .terminal-control-bar.compact .tcb-meta {
    grid-column: 1;
    grid-row: 1;
    gap: 8px;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }
  .terminal-control-bar.compact .tcb-meta::-webkit-scrollbar {
    display: none;
  }
  .terminal-control-bar.compact .tcb-density {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
    align-self: center;
  }
  .terminal-control-bar.compact .tcb-primary {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
    justify-self: stretch;
    padding: 6px 8px;
    align-items: center;
    justify-content: center;
    flex-direction: row;
    gap: 6px;
  }
  .terminal-control-bar.compact .tcb-pair {
    font-size: 9px;
  }
  .terminal-control-bar.compact .tcb-tf,
  .terminal-control-bar.compact .tcb-conf {
    font-size: 8px;
    padding: 1px 5px;
  }
  .terminal-control-bar.compact .tcb-label,
  .terminal-control-bar.compact .tcb-dir,
  .terminal-control-bar.compact .tcb-primary-label,
  .terminal-control-bar.compact .tcb-density {
    font-size: 8px;
  }
  .terminal-control-bar.compact .tcb-primary {
    padding: 6px 8px;
  }
  .terminal-control-bar.compact .tcb-density {
    padding: 5px 8px;
  }

  @media (max-width: 480px) {
    .terminal-control-bar:not(.compact) {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-rows: auto auto;
    }
    .terminal-control-bar:not(.compact) .tcb-meta {
      grid-column: 1;
      grid-row: 1;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;
    }
    .terminal-control-bar:not(.compact) .tcb-meta::-webkit-scrollbar {
      display: none;
    }
    .terminal-control-bar:not(.compact) .tcb-density {
      grid-column: 2;
      grid-row: 1;
      justify-self: end;
    }
    .terminal-control-bar:not(.compact) .tcb-primary {
      grid-column: 1 / -1;
      grid-row: 2;
      width: 100%;
      justify-self: stretch;
      align-items: center;
      justify-content: center;
      flex-direction: row;
      gap: 6px;
      padding: 6px 8px;
    }
    .terminal-control-bar:not(.compact) .tcb-primary-hint {
      display: none;
    }
  }
</style>
